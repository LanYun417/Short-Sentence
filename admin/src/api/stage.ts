/**
 * 情景闯关接口（「短句」运营后台）。
 * 对应后端 `StageAdminController`（/api/stages）。
 */
import { del, get, post, put } from './request';
import type {
  PageResult,
  StageAdminChapter,
  StageChapterCoverItem,
  StageSessionDetail,
  StageSessionItem,
  StageSessionQuery,
  StageStoryAdminItem,
  StageStoryPayload,
} from '@/types/api';

/** 关卡总览（章节 + 关卡 + 参与/通关/领奖统计） */
export function getStageOverviewApi(): Promise<StageAdminChapter[]> {
  return get<StageAdminChapter[]>('/stages');
}

/** 章节封面管理列表（每章一行，含未生成的） */
export function getStageCoversApi(): Promise<StageChapterCoverItem[]> {
  return get<StageChapterCoverItem[]>('/stages/covers');
}

/** 生成章节封面。chapterKey 缺省 = 补齐全部缺失；regenerate = 强制重生成 */
export function generateStageCoverApi(params: { chapterKey?: string; regenerate?: boolean }): Promise<unknown> {
  return post<unknown>('/stages/covers/generate', params);
}

/** 对话会话分页列表 */
export function getStageSessionListApi(params: StageSessionQuery): Promise<PageResult<StageSessionItem>> {
  return get<PageResult<StageSessionItem>>('/stages/sessions', params);
}

/** 会话详情（完整消息流） */
export function getStageSessionDetailApi(id: number): Promise<StageSessionDetail> {
  return get<StageSessionDetail>(`/stages/sessions/${id}`);
}

/** 强制结束进行中的会话 */
export function closeStageSessionApi(id: number): Promise<null> {
  return post<null>(`/stages/sessions/${id}/close`);
}

/* ------------------------------ 关卡（stage_story）CRUD ------------------------------ */

/** 关卡列表（含停用的，带统计） */
export function getStageStoriesApi(): Promise<StageStoryAdminItem[]> {
  return get<StageStoryAdminItem[]>('/stages/stories');
}

/** 新增关卡 */
export function createStageStoryApi(payload: StageStoryPayload): Promise<{ id: number }> {
  return post<{ id: number }>('/stages/stories', payload);
}

/** 编辑关卡（category 不允许修改） */
export function updateStageStoryApi(id: number, payload: Partial<StageStoryPayload>): Promise<null> {
  return put<null>(`/stages/stories/${id}`, payload);
}

/** 启停关卡 */
export function setStageStoryStatusApi(id: number, status: 0 | 1): Promise<null> {
  return post<null>(`/stages/stories/${id}/status`, { status });
}

/** 删除关卡（物理删除；返回关联会话数供提示） */
export function deleteStageStoryApi(id: number): Promise<{ sessionCount: number }> {
  return del<{ sessionCount: number }>(`/stages/stories/${id}`);
}

/** 章内重排序 */
export function reorderStageStoriesApi(chapterKey: string, ids: number[]): Promise<null> {
  return post<null>('/stages/stories/reorder', { chapterKey, ids });
}

/** AI 生成关卡草稿（不落库；返回整套剧情，审核后再走新增接口保存） */
export function aiGenerateStageStoryApi(params: { chapterKey: string; category: string }): Promise<StageStoryPayload> {
  return post<StageStoryPayload>('/stages/stories/ai-generate', params);
}
