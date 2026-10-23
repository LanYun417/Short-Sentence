/**
 * 每日句签管理接口（「短句」运营后台）。
 */
import { del, get, post, put } from './request';
import type {
  PageResult,
  SentenceCardDetail,
  SentenceCardItem,
  SentenceCardPayload,
  SentenceCardQuery,
} from '@/types/api';

/** 分页列表（日期倒序） */
export function getSentenceCardListApi(params: SentenceCardQuery): Promise<PageResult<SentenceCardItem>> {
  return get<PageResult<SentenceCardItem>>('/sentence-cards', params);
}

/** 详情（含提示词与最近领取用户） */
export function getSentenceCardDetailApi(id: number): Promise<SentenceCardDetail> {
  return get<SentenceCardDetail>(`/sentence-cards/${id}`);
}

/** 编辑文案 */
export function updateSentenceCardApi(id: number, payload: SentenceCardPayload): Promise<null> {
  return put<null>(`/sentence-cards/${id}`, payload);
}

/**
 * 按日期重新生成（同步等待 AI 文案 + 生图，通常 10~40s）。
 *
 * 必须放宽超时：请求封装默认 15s，而这条链路是「AI 写文案 → AI 生图 → sharp 转码 → 入库」，
 * 上游限流时更慢；用默认超时会在服务端还在干活时前端先报超时，用户以为失败又点一次。
 *
 * @param bizDate YYYY-MM-DD
 * @param force 已就绪时是否覆盖
 */
export function generateSentenceCardApi(
  bizDate: string,
  force = true,
): Promise<{ bizDate: string; generated: boolean }> {
  return post<{ bizDate: string; generated: boolean }>(
    '/sentence-cards/generate',
    { bizDate, force },
    { timeout: 180_000 },
  );
}

/** 删除（连带领取记录） */
export function deleteSentenceCardApi(id: number): Promise<null> {
  return del<null>(`/sentence-cards/${id}`);
}
