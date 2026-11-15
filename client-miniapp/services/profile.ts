/**
 * 账号资料：注销与个人数据导出（合规要求）。
 *
 * 注销是**不可逆**操作，服务端要求二次身份校验：
 * - 邮箱账号 → 邮箱验证码（先调 sendDeletionCode，码只发到本人邮箱）
 * - 微信账号 → wx.login 的 code（服务端反查 openid 比对）
 */
import { request } from '../utils/request';

/** 注销原因（与后端 DELETION_REASON_TYPES 对齐；不选则不传）。 */
export type DeletionReason = 'no_time' | 'too_hard' | 'content' | 'bugs' | 'privacy' | 'other';

/**
 * 注销入参：身份凭证按账号类型二选一 + 可选原因。
 *
 * 用 `type` 而不是 `interface`：只有类型别名才会被推断出隐式索引签名，
 * 否则无法直接当作 `Record<string, unknown>` 传给 request 的 data。
 */
export type DeleteAccountPayload = {
  /** 邮箱验证码（邮箱账号必填） */
  emailCode?: string;
  /** 微信身份凭证（微信账号必填） */
  wechatCode?: string;
  /** 注销原因（可选） */
  reasonType?: DeletionReason;
  /** 补充说明（可选，200 字以内） */
  reasonDetail?: string;
};

/**
 * 注销账号（软删：服务端令令牌失效、匿名化身份并清理学习记录）。
 * 邮箱账号不传 emailCode、微信账号不传 wechatCode 会被服务端拒绝。
 */
export function deleteAccount(payload: DeleteAccountPayload = {}): Promise<null> {
  return request<null>('/client/auth/me', { method: 'DELETE', data: payload });
}

/** 发送注销验证码（只发给当前登录用户本人邮箱）。 */
export function sendDeletionCode(): Promise<null> {
  return request<null>('/client/auth/deletion-code', { method: 'POST' });
}

/** 导出本人全部数据（后端以 JSON 附件形式裸响应）。 */
export function exportMyData(): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>('/client/auth/me/export');
}

/**
 * 把导出数据写成临时文件，返回文件路径（供 wx.shareFileMessage 转发/保存）。
 */
export function writeExportFile(data: Record<string, unknown>): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const filePath = `${wx.env.USER_DATA_PATH}/my-data-${stamp}.json`;
  wx.getFileSystemManager().writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
}
