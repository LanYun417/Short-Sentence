/**
 * 题库管理接口（「短句」运营后台）。
 */
import { del, get, post, put, request } from './request';
import type {
  BackfillWordMeaningsResult,
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

/**
 * 单题重新生图（**异步**：后端只负责受理，约 10~40 秒后出图）。
 *
 * 不能做成同步接口：生图耗时远超管理端 15 秒请求超时，同步返回必然报超时，
 * 而图其实还在生成，运营会以为失败并反复重试（白烧配额）。
 * 进度靠轮询题目详情（`getSentenceDetailApi`）看 status / imageUrl 变化。
 */
export function regenerateSentenceImageApi(id: number, scenePrompt?: string): Promise<null> {
  return post<null>(`/sentences/${id}/regenerate-image`, scenePrompt ? { scenePrompt } : {});
}

/**
 * 批量重新生图（异步，单题接口的批量版；换配图风格时用）。
 *
 * 后端**不要求全部成功**：不存在、正在生成中、已有生图任务在跑的题会被跳过并
 * 原样回给前端，其余题照常受理。单次上限 50 张（每张都消耗 Agnes 配额）。
 */
export function batchRegenerateSentenceImageApi(ids: number[]): Promise<{ accepted: number[]; skipped: number[] }> {
  return post<{ accepted: number[]; skipped: number[] }>('/sentences/batch-regenerate-image', { ids });
}

/** 下架题目（软删除） */
export function deleteSentenceApi(id: number): Promise<null> {
  return del<null>(`/sentences/${id}`);
}

/** 批量上下架（上架只对已有配图的题生效） */
export function batchSentenceStatusApi(ids: number[], status: 'ready' | 'offline'): Promise<{ affected: number }> {
  return post<{ affected: number }>('/sentences/batch-status', { ids, status });
}

/**
 * 导出题库 CSV（流式；筛选与列表共用同一套条件）。
 *
 * 参数不含分页字段：导出是「全量按筛选」，传 page/pageSize 只会让调用方困惑
 * （日志的三个导出函数同样用 `Omit` 抠掉分页，保持一致）。
 */
export function exportSentencesApi(params: Omit<SentenceQuery, 'page' | 'pageSize'>): Promise<Blob> {
  return request<Blob>({
    url: '/sentences/export',
    method: 'GET',
    params,
    responseType: 'blob',
  });
}

/**
 * 手动触发批量生成（异步；进度看批次列表）。
 *
 * categoryName 传了就「定向填某个场景」：本批所有题强制归属该分类
 * （服务端会覆盖模型自报的分类名，否则模型会把题都出到熟悉的旧场景）。
 */
export function triggerGenApi(params?: {
  count?: number;
  difficulty?: number;
  categoryName?: string;
}): Promise<{ taskId: number }> {
  return post<{ taskId: number }>('/sentences/gen/batch', params);
}

/**
 * 一次性生成**全部节日**题库（首次铺库 / 换年后补齐）。
 *
 * 节日题库是常驻内容库：铺满后用户端随时能看到所有节日并专门刷题，
 * 而不是只有节日当天才有题可选。只补题量不足的节日，已就绪的会跳过。
 */
export function triggerAllFestivalsApi(): Promise<{
  total: number;
  created: number;
  skipped: number;
  failed: number;
  tasks: Array<{ festivalName: string; taskId: number }>;
}> {
  return post('/sentences/gen/festivals', {});
}

/**
 * 为全年所有节日生成**专属封面图**（即发即忘：立即返回，后台串行生成）。
 *
 * 封面是每个节日单独画的一张主视觉（红灯笼 / 龙舟 / 圣诞树…），比从题库里挑一张
 * 更能体现节日。已有封面的节日默认跳过；force=true 强制重画（换掉不贴合的封面）。
 */
export function triggerFestivalCoversApi(force = false): Promise<{ total: number; started: boolean }> {
  return post('/sentences/gen/festival-covers', { force });
}

/** 补全存量题解析（按批；force = 连旧格式一起重新生成；返回扫描/更新/剩余条数）。 */
export function backfillExplanationsApi(
  limit?: number,
  force?: boolean,
): Promise<{
  scanned: number;
  updated: number;
  remaining: number;
}> {
  return post<{ scanned: number; updated: number; remaining: number }>('/sentences/explanation/backfill', {
    limit,
    force,
  });
}

/** 补全存量题逐词释义（按批；force = 重生成已有词义的题；返回汇总 + 每题明细 items）。 */
export function backfillWordMeaningsApi(limit?: number, force?: boolean): Promise<BackfillWordMeaningsResult> {
  return post<BackfillWordMeaningsResult>('/sentences/word-meanings/backfill', {
    limit,
    force,
  });
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
