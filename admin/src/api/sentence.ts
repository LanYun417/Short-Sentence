/**
 * 题库管理接口（「短句」运营后台）。
 */
import { del, get, post, put } from './request';
import type {
  GenTaskItem,
  GenTaskQuery,
  PageResult,
  SentenceCategoryItem,
  SentenceCategoryPayload,
  SentenceItem,
  SentenceQuery,
  SentenceSavePayload,
} from '@/types/api';

/** 场景分类（复用客户端公开接口） */
export interface SentenceCategoryOption {
  id: number;
  name: string;
  nameEn: string | null;
  icon: string | null;
}

/** 分页查询题库 */
export function getSentenceListApi(params: SentenceQuery): Promise<PageResult<SentenceItem>> {
  return get<PageResult<SentenceItem>>('/sentences', params);
}

/** 题目详情 */
export function getSentenceDetailApi(id: number): Promise<SentenceItem> {
  return get<SentenceItem>(`/sentences/${id}`);
}

/** 新增题目 */
export function createSentenceApi(payload: SentenceSavePayload): Promise<{ id: number }> {
  return post<{ id: number }>('/sentences', payload);
}

/** 编辑题目 */
export function updateSentenceApi(id: number, payload: SentenceSavePayload): Promise<null> {
  return put<null>(`/sentences/${id}`, payload);
}

/** 下架题目（软删除） */
export function deleteSentenceApi(id: number): Promise<null> {
  return del<null>(`/sentences/${id}`);
}

/** 批量上下架（上架只对已有配图的题生效） */
export function batchSentenceStatusApi(ids: number[], status: 'ready' | 'offline'): Promise<{ affected: number }> {
  return post<{ affected: number }>('/sentences/batch-status', { ids, status });
}

/** 手动触发批量生成（异步；进度看批次列表） */
export function triggerGenApi(count?: number): Promise<{ taskId: number }> {
  return post<{ taskId: number }>('/sentences/gen/batch', count ? { count } : undefined);
}

/** 生成批次列表（运营监控） */
export function getGenTaskListApi(params: GenTaskQuery): Promise<PageResult<GenTaskItem>> {
  return get<PageResult<GenTaskItem>>('/sentences/gen-tasks', params);
}

/** 暂停批次（在下一个批次边界生效） */
export function pauseGenTaskApi(id: number): Promise<null> {
  return post<null>(`/sentences/gen-tasks/${id}/pause`);
}

/** 继续批次（从已完成进度接着跑） */
export function resumeGenTaskApi(id: number): Promise<null> {
  return post<null>(`/sentences/gen-tasks/${id}/resume`);
}

/** 取消批次（终态，之后可删除） */
export function cancelGenTaskApi(id: number): Promise<null> {
  return post<null>(`/sentences/gen-tasks/${id}/cancel`);
}

/** 删除批次（保留已配图题目，只清理未配图的） */
export function deleteGenTaskApi(id: number): Promise<{ removedSentences: number }> {
  return del<{ removedSentences: number }>(`/sentences/gen-tasks/${id}`);
}

/** 场景分类（用于筛选与表单下拉） */
export function getCategoryOptionsApi(): Promise<SentenceCategoryOption[]> {
  return get<SentenceCategoryOption[]>('/client/categories');
}

/** 场景分类列表（含题目数） */
export function getCategoryListApi(): Promise<SentenceCategoryItem[]> {
  return get<SentenceCategoryItem[]>('/sentences/categories');
}

/** 新增场景分类 */
export function createCategoryApi(payload: SentenceCategoryPayload): Promise<{ id: number }> {
  return post<{ id: number }>('/sentences/categories', payload);
}

/** 编辑场景分类 */
export function updateCategoryApi(id: number, payload: SentenceCategoryPayload): Promise<null> {
  return put<null>(`/sentences/categories/${id}`, payload);
}

/** 删除场景分类（有题目引用时后端拒绝） */
export function deleteCategoryApi(id: number): Promise<null> {
  return del<null>(`/sentences/categories/${id}`);
}
