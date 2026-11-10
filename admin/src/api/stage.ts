/**
 * 情景闯关接口（「短句」运营后台）。
 * 对应后端 `StageAdminController`（/api/stages）。
 */
import { get, post } from './request';
import type {
  PageResult,
  StageAdminChapter,
  StageChapterCoverItem,
  StageSessionDetail,
  StageSessionItem,
  StageSessionQuery,
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
