/**
 * 情景闯关接口（「短句」运营后台）。
 * 对应后端 `StageAdminController`（/api/stages）。
 * 层级：场景（分类，/sentence/category 管理）→ 剧本 → 关卡。
 */
import { del, get, post, put } from './request';
import type {
  PageResult,
  StageAdminChapter,
  StageScriptAdminItem,
  StageScriptPayload,
  StageSessionDetail,
  StageSessionItem,
  StageSessionQuery,
  StageStoryAdminItem,
  StageStoryPayload,
} from '@/types/api';

/** 关卡总览（剧本分组 + 关卡 + 参与/通关/领奖统计） */
export function getStageOverviewApi(): Promise<StageAdminChapter[]> {
  return get<StageAdminChapter[]>('/stages');
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

/* ------------------------------ 剧本（stage_script）CRUD ------------------------------ */

/** 剧本列表（含停用的，带统计） */
export function getStageScriptsApi(): Promise<StageScriptAdminItem[]> {
  return get<StageScriptAdminItem[]>('/stages/scripts');
}

/** 新增剧本 */
export function createStageScriptApi(payload: StageScriptPayload): Promise<{ id: number }> {
  return post<{ id: number }>('/stages/scripts', payload);
}

/** 编辑剧本 */
export function updateStageScriptApi(id: number, payload: Partial<StageScriptPayload>): Promise<null> {
  return put<null>(`/stages/scripts/${id}`, payload);
}

/** 启停剧本 */
export function setStageScriptStatusApi(id: number, status: 0 | 1): Promise<null> {
  return post<null>(`/stages/scripts/${id}/status`, { status });
}

/** 删除剧本（连同其下关卡） */
export function deleteStageScriptApi(id: number): Promise<{ deletedStories: number }> {
  return del<{ deletedStories: number }>(`/stages/scripts/${id}`);
}

/** 生成/重新生成剧本封面（AI 生图 → webp 入库） */
export function generateStageScriptCoverApi(id: number, regenerate = false): Promise<{ coverUrl: string }> {
  return post<{ coverUrl: string }>(`/stages/scripts/${id}/cover`, { regenerate });
}

/** 一键补齐全部缺失剧本封面 */
export function generateMissingStageCoversApi(): Promise<{ generated: number[]; skipped: number[]; failed: number[] }> {
  return post<{ generated: number[]; skipped: number[]; failed: number[] }>('/stages/scripts/covers/generate-missing');
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

/** 编辑关卡 */
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

/** 剧本内重排序 */
export function reorderStageStoriesApi(scriptId: number, ids: number[]): Promise<null> {
  return post<null>('/stages/stories/reorder', { scriptId, ids });
}

/** AI 生成关卡草稿（不落库；返回整套剧情，审核后再走新增接口保存） */
export function aiGenerateStageStoryApi(scriptId: number): Promise<StageStoryPayload> {
  return post<StageStoryPayload>('/stages/stories/ai-generate', { scriptId });
}
