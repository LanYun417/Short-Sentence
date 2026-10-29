/**
 * App 版本管理接口（「短句」后台）。
 */
import { del, get, post, put, request } from './request';
import type { AppVersionItem, AppVersionPayload, AppVersionQuery, PageResult } from '@/types/api';

/** 分页查询版本 */
export function getAppVersionListApi(params: AppVersionQuery): Promise<PageResult<AppVersionItem>> {
  return get<PageResult<AppVersionItem>>('/app-versions', params);
}

/**
 * 上传安装包（.apk，≤200MB）。
 * 单独走 `/app-versions/upload`：`/files/upload` 限制 10MB，安装包过不去。
 */
export function uploadApkApi(file: File): Promise<{ fileId: number; fileUrl: string; size: number }> {
  const formData = new FormData();
  formData.append('file', file);
  return request<{ fileId: number; fileUrl: string; size: number }>({
    url: '/app-versions/upload',
    method: 'POST',
    data: formData,
  });
}

/** 新增版本 */
export function createAppVersionApi(payload: AppVersionPayload): Promise<{ id: number }> {
  return post<{ id: number }>('/app-versions', payload);
}

/** 编辑版本 */
export function updateAppVersionApi(id: number, payload: AppVersionPayload): Promise<null> {
  return put<null>(`/app-versions/${id}`, payload);
}

/** 上下架 */
export function setAppVersionStatusApi(id: number, status: number): Promise<null> {
  return put<null>(`/app-versions/${id}/status`, { status });
}

/** 删除版本记录 */
export function deleteAppVersionApi(id: number): Promise<null> {
  return del<null>(`/app-versions/${id}`);
}
