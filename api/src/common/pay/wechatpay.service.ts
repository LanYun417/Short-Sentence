/**
 * 微信支付 v3 客户端服务。
 *
 * 职责：统一下单（Native 扫码 / JSAPI 小程序）、查单、关单、退款、回调验签。
 * 依赖：`node:crypto` + `fetch`（零新增运行时依赖）；配置来自 PaySettingsService 快照
 * （后台「支付设置」维护，env 兜底）。
 *
 * 关键约定：
 * - **签名路径包含 query**：微信要求签名串里的 URL_PATH 与实际请求完全一致（含查询参数），
 *   否则 401 SIGN_ERROR；本服务所有请求都只传 path + query、由内部拼绝对地址。
 * - **回调 body 必须用原始报文**验签（重新 JSON.stringify 会因键序/空白差异失败），
 *   rawBody 由 app.setup.ts 的 body parser verify 钩子保留。
 * - 平台证书**按序列号内存缓存**：回调头里带 serial，命中不到时刷新一次证书列表；
 *   微信会轮换证书，缓存 TTL 取证书自身的 expire_time 与 12 小时中的较小值。
 * - 未配置时所有方法抛可读的 400（不阻断启动，与 AI / 微信登录同一口径）。
 */
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../exception/app.exception.js';
import { PaySettingsService } from './pay-settings.service.js';
import type { PayWechatSettings } from './pay-settings.js';
import {
  buildAuthorizationHeader,
  buildCallbackSignatureString,
  buildRequestSignatureString,
  decryptAesGcm,
  normalizePrivateKey,
  randomNonce,
  signWithPrivateKey,
  verifyWithCertificate,
  WECHATPAY_API_BASE,
  type EncryptCertificate,
} from './wechatpay-crypto.js';

/** 单次 HTTP 超时（ms）。 */
const HTTP_TIMEOUT_MS = 10_000;

/** 证书刷新最小间隔（ms）：序列号未命中时最多每分钟拉一次，防伪造 serial 打爆微信接口。 */
const CERT_REFRESH_MIN_INTERVAL_MS = 60 * 1000;

/** 回调时间戳允许的最大偏差（ms）；超出视为重放。 */
const CALLBACK_MAX_SKEW_MS = 5 * 60 * 1000;

/** Native 下单入参。 */
export interface NativePrepayInput {
  /** 商户订单号 */
  orderNo: string;
  /** 金额（分） */
  amount: number;
  /** 商品描述（微信账单展示） */
  description: string;
  /** 附加数据（回调原样带回；用于标记业务线） */
  attach?: string;
}

/** JSAPI 下单入参。 */
export interface JsapiPrepayInput extends NativePrepayInput {
  /** 支付人 openid（小程序登录用户的 wechat_openid） */
  openid: string;
}

/** 小程序 `wx.requestPayment` 所需参数。 */
export interface JsapiPayParams {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
}

/** 微信支付订单查询结果（只取本服务用到的字段）。 */
export interface WechatTransaction {
  /** out_trade_no */
  outTradeNo: string;
  /** transaction_id（支付成功才有） */
  transactionId: string;
  /** 交易状态：SUCCESS / REFUND / NOTPAY / CLOSED / USERPAYING / PAYERROR */
  tradeState: string;
  /** 实付金额（分） */
  total: number;
  /** 支付人 openid */
  payerOpenid?: string;
  /** 支付完成时间（ISO；微信返回 RFC3339） */
  successTime?: string;
}

/** 退款结果。 */
export interface WechatRefundResult {
  /** 微信退款单号 */
  refundId: string;
  /** 退款状态：SUCCESS / PROCESSING / CLOSED / ABNORMAL */
  status: string;
}

/** 微信支付 API 错误响应体。 */
interface WechatApiError {
  code?: string;
  message?: string;
}

/** /v3/certificates 响应。 */
interface CertificatesResponse {
  data?: Array<{
    serial_no: string;
    effective_time?: string;
    expire_time?: string;
    encrypt_certificate: {
      algorithm: string;
      nonce: string;
      associated_data?: string;
      ciphertext: string;
    };
  }>;
}

@Injectable()
export class WechatPayService {
  private readonly logger = new Logger(WechatPayService.name);

  /** 平台证书缓存：serial → PEM。 */
  private readonly certificates = new Map<string, string>();

  /** 证书缓存写入时刻（ms）。 */
  private certificatesFetchedAt = 0;

  /** 证书刷新互斥（并发回调只刷新一次）。 */
  private refreshing: Promise<void> | null = null;

  constructor(private readonly settings: PaySettingsService) {}

  /** 支付是否可用（配置齐全）。 */
  get enabled(): boolean {
    return this.settings.enabled;
  }

  /**
   * Native 下单（Web / Android 收银台展示二维码）。
   * @returns code_url（weixin://wxpay/bizpayurl?...），前端渲染二维码
   */
  async nativePrepay(input: NativePrepayInput): Promise<{ codeUrl: string }> {
    const cfg = this.requireConfig();
    const body = {
      appid: cfg.appId,
      mchid: cfg.mchId,
      description: input.description,
      out_trade_no: input.orderNo,
      notify_url: cfg.notifyUrl,
      amount: { total: input.amount, currency: 'CNY' },
      ...(input.attach ? { attach: input.attach } : {}),
    };
    const result = await this.request<{ code_url?: string }>('POST', '/v3/pay/transactions/native', body);
    if (!result.code_url) {
      throw AppException.serviceUnavailable('微信支付下单失败：未返回支付二维码');
    }
    return { codeUrl: result.code_url };
  }

  /**
   * JSAPI 下单（微信小程序）。
   * @returns prepay_id 与 `wx.requestPayment` 所需签名参数
   */
  async jsapiPrepay(input: JsapiPrepayInput): Promise<JsapiPayParams> {
    const cfg = this.requireConfig();
    const body = {
      appid: cfg.appId,
      mchid: cfg.mchId,
      description: input.description,
      out_trade_no: input.orderNo,
      notify_url: cfg.notifyUrl,
      amount: { total: input.amount, currency: 'CNY' },
      payer: { openid: input.openid },
      ...(input.attach ? { attach: input.attach } : {}),
    };
    const result = await this.request<{ prepay_id?: string }>('POST', '/v3/pay/transactions/jsapi', body);
    if (!result.prepay_id) {
      throw AppException.serviceUnavailable('微信支付下单失败：未返回 prepay_id');
    }
    return this.buildJsapiPayParams(cfg, result.prepay_id);
  }

  /**
   * 按商户订单号查单（轮询兜底：回调丢失时前端轮询本接口即可补单）。
   */
  async queryByOutTradeNo(orderNo: string): Promise<WechatTransaction> {
    const cfg = this.requireConfig();
    const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderNo)}?mchid=${encodeURIComponent(cfg.mchId)}`;
    const result = await this.request<{
      out_trade_no?: string;
      transaction_id?: string;
      trade_state?: string;
      amount?: { total?: number };
      payer?: { openid?: string };
      success_time?: string;
    }>('GET', path);
    return {
      outTradeNo: result.out_trade_no ?? orderNo,
      transactionId: result.transaction_id ?? '',
      tradeState: result.trade_state ?? '',
      total: result.amount?.total ?? 0,
      payerOpenid: result.payer?.openid,
      successTime: result.success_time,
    };
  }

  /** 关闭订单（未支付订单过期时调用；已支付会报错，属正常竞态，调用方吞掉）。 */
  async closeOrder(orderNo: string): Promise<void> {
    const cfg = this.requireConfig();
    await this.request<null>('POST', `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderNo)}/close`, {
      mchid: cfg.mchId,
    });
  }

  /**
   * 申请退款（全额；退款结果以微信异步通知或查单为准，这里只拿受理结果）。
   */
  async refund(input: {
    orderNo: string;
    refundNo: string;
    total: number;
    refund: number;
    reason?: string;
  }): Promise<WechatRefundResult> {
    const cfg = this.requireConfig();
    const body = {
      out_trade_no: input.orderNo,
      out_refund_no: input.refundNo,
      ...(input.reason ? { reason: input.reason.slice(0, 80) } : {}),
      notify_url: cfg.notifyUrl,
      amount: { refund: input.refund, total: input.total, currency: 'CNY' },
    };
    const result = await this.request<{ refund_id?: string; status?: string }>(
      'POST',
      '/v3/refund/domestic/refunds',
      body,
    );
    if (!result.refund_id) {
      throw AppException.serviceUnavailable('微信退款失败：未返回退款单号');
    }
    return { refundId: result.refund_id, status: result.status ?? '' };
  }

  /**
   * 回调验签（含时间戳防重放）。
   * @param headers 请求头（大小写不敏感读取）
   * @param rawBody 原始报文
   * @returns 验签结果；serial 与签名一并返回供流水记录
   */
  async verifyCallback(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): Promise<{ verified: boolean; serial: string; reason?: string }> {
    const timestamp = this.header(headers, 'wechatpay-timestamp');
    const nonce = this.header(headers, 'wechatpay-nonce');
    const signature = this.header(headers, 'wechatpay-signature');
    const serial = this.header(headers, 'wechatpay-serial');
    if (!timestamp || !nonce || !signature || !serial) {
      return { verified: false, serial, reason: '缺少验签请求头' };
    }
    // 防重放：时间戳偏差超过 5 分钟直接拒
    const ts = Number(timestamp) * 1000;
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > CALLBACK_MAX_SKEW_MS) {
      return { verified: false, serial, reason: '回调时间戳超出允许偏差' };
    }
    if (!this.settings.enabled) {
      return { verified: false, serial, reason: '支付未配置' };
    }
    const cert = await this.findCertificate(serial);
    if (!cert) {
      return { verified: false, serial, reason: `未找到序列号 ${serial} 对应的平台证书` };
    }
    const message = buildCallbackSignatureString(timestamp, nonce, rawBody);
    const verified = verifyWithCertificate(cert, signature, message);
    return { verified, serial, reason: verified ? undefined : '签名校验失败' };
  }

  /** 解密回调 Resource（公开给订单服务用）。 */
  decryptResource(resource: {
    algorithm: string;
    ciphertext: string;
    nonce: string;
    associated_data?: string;
  }): string {
    const cfg = this.requireConfig();
    return decryptAesGcm(
      {
        algorithm: resource.algorithm,
        ciphertext: resource.ciphertext,
        nonce: resource.nonce,
        associatedData: resource.associated_data,
      },
      cfg.apiv3Key,
    );
  }

  /* ------------------------------ 内部实现 ------------------------------ */

  /** 取配置；未配置抛可读错误。 */
  private requireConfig(): PayWechatSettings {
    if (!this.settings.enabled) {
      throw AppException.badRequest('微信支付未配置（后台「支付设置」补齐六项后可用）');
    }
    return this.settings.current;
  }

  /** 读请求头（Node 已小写化，但兼容数组形态）。 */
  private header(headers: Record<string, string | string[] | undefined>, name: string): string {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0] ?? '';
    }
    return value ?? '';
  }

  /** 小程序支付参数签名（appId\ntimeStamp\nnonceStr\npackage\n）。 */
  private buildJsapiPayParams(cfg: PayWechatSettings, prepayId: string): JsapiPayParams {
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = randomNonce();
    const packageValue = `prepay_id=${prepayId}`;
    const message = `${cfg.appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
    const paySign = signWithPrivateKey(normalizePrivateKey(cfg.privateKey), message);
    return {
      appId: cfg.appId,
      timeStamp,
      nonceStr,
      package: packageValue,
      signType: 'RSA',
      paySign,
    };
  }

  /**
   * 签名并发起请求。
   * @param method HTTP 方法
   * @param path 含 query 的路径（如 `/v3/pay/...?mchid=...`）
   * @param body 请求体（GET 不传）
   */
  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const cfg = this.requireConfig();
    const privateKey = normalizePrivateKey(cfg.privateKey);
    if (!privateKey.includes('-----BEGIN')) {
      throw AppException.badRequest('商户 API 私钥未配置或格式不正确（后台「支付设置」检查）');
    }
    const payload = body === undefined ? '' : JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomNonce();
    const message = buildRequestSignatureString(method, path, timestamp, nonce, payload);
    const signature = signWithPrivateKey(privateKey, message);
    const authorization = buildAuthorizationHeader({
      mchId: cfg.mchId,
      serialNo: cfg.serialNo,
      nonce,
      timestamp,
      signature,
    });

    let response: Response;
    try {
      response = await fetch(`${WECHATPAY_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: authorization,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'short-sentence-pay/1.0',
        },
        ...(payload ? { body: payload } : {}),
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(
        `微信支付请求失败 ${method} ${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw AppException.serviceUnavailable('微信支付服务暂时不可用，请稍后再试');
    }

    const text = await response.text();
    if (!response.ok) {
      let detail: WechatApiError = {};
      try {
        detail = JSON.parse(text) as WechatApiError;
      } catch {
        // 非 JSON（网关错误页等），保留原文片段
      }
      const messageText = detail.message ?? text.slice(0, 200);
      this.logger.warn(
        `微信支付接口报错 ${method} ${path} status=${response.status} code=${detail.code ?? '-'} ${messageText}`,
      );
      throw AppException.badRequest(`微信支付接口报错（${detail.code ?? response.status}）：${messageText}`);
    }
    if (!text) {
      return null as T;
    }
    return JSON.parse(text) as T;
  }

  /** 按序列号取平台证书（缓存未命中时刷新一次）。 */
  private async findCertificate(serial: string): Promise<string> {
    const cached = this.certificates.get(serial);
    if (cached) {
      return cached;
    }
    await this.refreshCertificates();
    return this.certificates.get(serial) ?? '';
  }

  /** 拉取并解密平台证书列表（互斥 + 最小间隔：并发回调只发一次请求）。 */
  private async refreshCertificates(): Promise<void> {
    if (this.refreshing) {
      return this.refreshing;
    }
    // 刚刷过仍找不到目标序列号：按最小间隔节流，不重复拉取（防伪造 serial 打爆微信接口）；
    // 但**不能**用长 TTL 挡住轮换——微信换证书后，回调会带新序列号，这里必须能重新拉到。
    if (this.certificatesFetchedAt > 0 && Date.now() - this.certificatesFetchedAt < CERT_REFRESH_MIN_INTERVAL_MS) {
      return;
    }
    this.refreshing = (async () => {
      let result: CertificatesResponse;
      try {
        result = await this.request<CertificatesResponse>('GET', '/v3/certificates');
      } catch (error) {
        // 拉取失败也记时刻，避免异常期间每条回调都打一次微信接口
        this.certificatesFetchedAt = Date.now();
        throw error;
      }
      const list = result.data ?? [];
      for (const item of list) {
        const encrypted: EncryptCertificate = {
          serialNo: item.serial_no,
          algorithm: item.encrypt_certificate.algorithm,
          ciphertext: item.encrypt_certificate.ciphertext,
          nonce: item.encrypt_certificate.nonce,
          associatedData: item.encrypt_certificate.associated_data ?? '',
        };
        const pem = this.decryptResource({
          algorithm: encrypted.algorithm,
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
          associated_data: encrypted.associatedData,
        });
        this.certificates.set(item.serial_no, pem);
      }
      this.certificatesFetchedAt = Date.now();
      this.logger.log(`微信支付平台证书已刷新：${list.length} 张`);
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }
}
