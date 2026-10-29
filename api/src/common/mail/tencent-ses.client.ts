/**
 * 腾讯云 SES（邮件推送）客户端 —— 零新增依赖的 TC3-HMAC-SHA256 签名实现。
 *
 * 为什么手写而不是装 SDK：项目硬约束「运行时依赖零新增」，而 SES 只需要一个
 * `SendEmail` 调用；官方 Node SDK 会带进一大坨产品客户端与重试框架，不值得。
 * 签名算法见官方文档「签名方法 v3」，这里是标准实现（与 COS/CDN 等产品同源）。
 *
 * 关键约束：
 * - `X-TC-Timestamp` 与实际系统时间偏差不能超过 5 分钟，否则 403；
 * - 日期用 **UTC**（`toISOString().slice(0,10)`），不能按本地时区算；
 * - 请求体必须是紧凑 JSON，且参与签名（body 变一个字符签名就对不上）。
 */
import { createHash, createHmac } from 'node:crypto';

/** SES 接入点（固定域名，与 Region 无关） */
const SES_HOST = 'ses.tencentcloudapi.com';
const SES_SERVICE = 'ses';
const SES_VERSION = '2020-10-02';
/** 签名算法标识 */
const ALGORITHM = 'TC3-HMAC-SHA256';

/** SES 调用凭证（来自后台「邮件设置」，不来自环境变量）。 */
export interface SesCredential {
  secretId: string;
  secretKey: string;
  /** 地域，如 ap-guangzhou / ap-hongkong */
  region: string;
}

/** 上游错误（含腾讯云错误码，便于运营定位）。 */
export class SesError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SesError';
    this.code = code;
  }
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

/**
 * 发送模板邮件。
 *
 * @param credential 凭证
 * @param payload SendEmail 的 Action 参数（FromEmailAddress / Destination / Subject / Template）
 * @returns 腾讯云返回的 MessageId
 */
export async function sesSendEmail(
  credential: SesCredential,
  payload: Record<string, unknown>,
): Promise<{ messageId: string; requestId: string }> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  // 必须是 UTC 日期：本地时区在东八区，用本地日期会在跨日时段签名错位
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const contentType = 'application/json; charset=utf-8';

  // ---- 步骤 1：拼接规范请求串 ----
  const canonicalHeaders = `content-type:${contentType}\nhost:${SES_HOST}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, sha256Hex(body)].join('\n');

  // ---- 步骤 2：拼接待签名字符串 ----
  const credentialScope = `${date}/${SES_SERVICE}/tc3_request`;
  const stringToSign = [ALGORITHM, String(timestamp), credentialScope, sha256Hex(canonicalRequest)].join('\n');

  // ---- 步骤 3：计算签名 ----
  const secretDate = hmacSha256(`TC3${credential.secretKey}`, date);
  const secretService = hmacSha256(secretDate, SES_SERVICE);
  const secretSigning = hmacSha256(secretService, 'tc3_request');
  const signature = createHmac('sha256', secretSigning).update(stringToSign, 'utf8').digest('hex');

  // ---- 步骤 4：拼接 Authorization ----
  const authorization =
    `${ALGORITHM} Credential=${credential.secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${SES_HOST}/`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      // 注意：不要手动设置 Host（fetch 禁止），签名里的 host 与实际请求一致即可
      'X-TC-Action': 'SendEmail',
      'X-TC-Version': SES_VERSION,
      'X-TC-Region': credential.region,
      'X-TC-Timestamp': String(timestamp),
    },
    body,
    signal: AbortSignal.timeout(15000),
  });

  // 腾讯云即使业务错误也可能返回 HTTP 200，必须看 Response.Error
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SesError('SesBadResponse', `SES 返回非 JSON（HTTP ${response.status}）：${text.slice(0, 200)}`);
  }
  const envelope = parsed as { Response?: Record<string, unknown> };
  const result = envelope.Response;
  if (!result) {
    throw new SesError('SesBadResponse', `SES 返回结构异常：${text.slice(0, 200)}`);
  }
  const error = result.Error as { Code?: string; Message?: string } | undefined;
  if (error?.Code) {
    throw new SesError(error.Code, error.Message ?? error.Code);
  }
  if (!response.ok) {
    throw new SesError(`Http${response.status}`, `SES 请求失败（HTTP ${response.status}）`);
  }
  return {
    messageId: typeof result.MessageId === 'string' ? result.MessageId : '',
    requestId: typeof result.RequestId === 'string' ? result.RequestId : '',
  };
}
