/**
 * 账号资料：注销与个人数据导出（合规要求）。
 */
import { request } from '../utils/request';

/** 注销账号（软删：服务端令令牌失效、匿名化身份并清理学习记录）。 */
export function deleteAccount(): Promise<null> {
  return request<null>('/client/auth/me', { method: 'DELETE' });
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
