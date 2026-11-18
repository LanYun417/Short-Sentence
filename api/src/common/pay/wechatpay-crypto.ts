/**
 * 微信支付 v3 加密基座（纯函数，零依赖）。
 * 模块职责：请求签名 / 回调验签 / 证书与通知解密 / 私钥归一化。
 *
 * 为什么自己写而不引库：全部能力都在 `node:crypto` 里（RSA-SHA256 签名、X.509 验签、
 * AES-256-GCM 解密），一个 SDK 不用引；本项目运行时依赖零新增是默认纪律。
 *
 * 微信支付 v3 的签名规范（官方文档《API v3 签名》）：
 * - 请求：`METHOD\nURL_PATH\nTIMESTAMP\nNONCE\nBODY\n` 五段拼行；
 * - 回调验签：`TIMESTAMP\nNONCE\nBODY\n` 三段拼行；
 * - 算法均为 RSA-SHA256（SHA256withRSA / SHA256-RSA2048），签名结果 base64。
 */
import { createDecipheriv, createSign, createVerify, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** 微信支付 API 域名（直连模式）。 */
export const WECHATPAY_API_BASE = 'https://api.mch.weixin.qq.com';

/** 签名算法标识（Authorization 头里与微信约定值）。 */
export const WECHATPAY_AUTH_SCHEME = 'WECHATPAY2-SHA256-RSA2048';

/** 平台证书 / 通知解密用的密码算法（微信固定 AES-256-GCM）。 */
export const WECHATPAY_ENCRYPT_ALGORITHM = 'AEAD_AES_256_GCM';

/** GCM 认证标签长度（字节，微信在密文尾部追加）。 */
const GCM_TAG_LENGTH = 16;

/** 授权头字段拼装（请求签名用）。 */
export interface WechatPayAuthHeader {
  mchId: string;
  serialNo: string;
  nonce: string;
  timestamp: string;
  signature: string;
}

/**
 * 拼「请求签名串」：`METHOD\nURL_PATH\nTIMESTAMP\nNONCE\nBODY\n`。
 * @param method HTTP 方法（大写）
 * @param urlPath **不含域名**的路径（含 query，如 `/v3/pay/transactions/native`）
 * @param timestamp 秒级时间戳（字符串）
 * @param nonce 随机串
 * @param body 请求体原文（GET 传空串）
 */
export function buildRequestSignatureString(
  method: string,
  urlPath: string,
  timestamp: string,
  nonce: string,
  body: string,
): string {
  return `${method.toUpperCase()}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
}

/**
 * 拼「回调验签串」：`TIMESTAMP\nNONCE\nBODY\n`（**body 必须是收到的原始报文**，
 * 重新序列化 JSON 会破坏验签，故调用方需保留 rawBody，见 app.setup.ts 的 verify stash）。
 */
export function buildCallbackSignatureString(timestamp: string, nonce: string, body: string): string {
  return `${timestamp}\n${nonce}\n${body}\n`;
}

/** 商户私钥归一化：接受文件路径 / 行内 PEM / `\n` 转义三种形态，统一输出可用的 PEM 文本。 */
export function normalizePrivateKey(raw: string): string {
  const value = (raw ?? '').trim();
  if (!value) {
    return '';
  }
  // 形态一：文件路径（以 .pem/.key 结尾，或能以文件读出且内容含 PRIVATE KEY）
  if (/\.(pem|key)$/i.test(value)) {
    try {
      return readFileSync(value, 'utf8');
    } catch {
      // 文件读不到时按行内文本继续（很可能就是被误判成路径的转义串，交给后续校验报错）
    }
  }
  // 形态二：行内 PEM，换行被转义成字面 \n（后台文本框粘贴常见）
  if (!value.includes('-----BEGIN') && /\\n/.test(value)) {
    return value.replace(/\\n/g, '\n');
  }
  if (/-----BEGIN/.test(value) && /\\n/.test(value) && !/\n/.test(value)) {
    return value.replace(/\\n/g, '\n');
  }
  return value;
}

/** 判断私钥是否形如可用 PEM（粗校验，供启动/保存时报可读错误）。 */
export function isValidPemKey(pem: string): boolean {
  return /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*-----END (?:RSA )?PRIVATE KEY-----/.test(pem);
}

/** 用商户私钥做 RSA-SHA256 签名，返回 base64。 */
export function signWithPrivateKey(privateKeyPem: string, message: string): string {
  const signer = createSign('RSA-SHA256');
  signer.update(message, 'utf8');
  signer.end();
  return signer.sign(normalizePrivateKey(privateKeyPem), 'base64');
}

/** 用平台证书（PEM 公钥）验证回调签名；恒定时间比较由 OpenSSL 内部保证。 */
export function verifyWithCertificate(certificatePem: string, signature: string, message: string): boolean {
  try {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(message, 'utf8');
    verifier.end();
    return verifier.verify(certificatePem, signature, 'base64');
  } catch {
    // 证书不可用 / 签名格式错误一律判失败（fail-closed）
    return false;
  }
}

/** 平台证书详情项（GET /v3/certificates 的 data 元素）。 */
export interface EncryptCertificate {
  /** 证书序列号 */
  serialNo: string;
  /** 加密算法（AEAD_AES_256_GCM） */
  algorithm: string;
  /** base64 密文（尾部 16 字节为 GCM tag） */
  ciphertext: string;
  /** base64 nonce */
  nonce: string;
  /** 附加数据（证书下发为 "certificate"） */
  associatedData: string;
}

/** 通知原文（Resource 字段）。 */
export interface EncryptResource {
  algorithm: string;
  ciphertext: string;
  nonce: string;
  associatedData?: string;
}

/**
 * 解密微信支付 AEAD_AES_256_GCM 资源（平台证书 / 回调通知通用）。
 * @param resource 密文、nonce、附加数据
 * @param apiv3Key商户平台设置的 APIv3 密钥（32 字节，直接做 AES key）
 * @returns 明文（UTF-8 文本；调用方再 JSON.parse）
 */
export function decryptAesGcm(resource: EncryptResource, apiv3Key: string): string {
  if (resource.algorithm !== WECHATPAY_ENCRYPT_ALGORITHM) {
    throw new Error(`不支持的加密算法：${resource.algorithm}（仅支持 ${WECHATPAY_ENCRYPT_ALGORITHM}）`);
  }
  if (!apiv3Key) {
    throw new Error('APIv3 密钥缺失，无法解密');
  }
  const key = Buffer.from(apiv3Key, 'utf8');
  if (key.length !== 32) {
    throw new Error(`APIv3 密钥长度须为 32 字节，实际 ${key.length}`);
  }
  const cipher = Buffer.from(resource.ciphertext, 'base64');
  if (cipher.length < GCM_TAG_LENGTH) {
    throw new Error('密文过短，无法拆分 GCM tag');
  }
  const nonce = Buffer.from(resource.nonce, 'base64');
  const associatedData = resource.associatedData ? Buffer.from(resource.associatedData, 'utf8') : Buffer.alloc(0);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce, { authTagLength: GCM_TAG_LENGTH });
  decipher.setAAD(associatedData);
  // 微信把 tag 附在密文尾部：最后 16 字节是认证标签
  const tag = cipher.subarray(cipher.length - GCM_TAG_LENGTH);
  decipher.setAuthTag(tag);
  const data = cipher.subarray(0, cipher.length - GCM_TAG_LENGTH);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** 生成本次请求随机串（32 位十六进制，微信建议 32 字符内随机串）。 */
export function randomNonce(): string {
  return randomBytes(16).toString('hex');
}

/** 恒定时间字符串比较（防时序侧信道，仅同长度可比）。 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** 拼 Authorization 头（请求签名）。 */
export function buildAuthorizationHeader(header: WechatPayAuthHeader): string {
  return (
    `${WECHATPAY_AUTH_SCHEME} ` +
    `mchid="${header.mchId}",` +
    `serial_no="${header.serialNo}",` +
    `nonce="${header.nonce}",` +
    `timestamp="${header.timestamp}",` +
    `signature="${header.signature}"`
  );
}
