/**
 * 词根词典管理接口（「短句」运营后台）。
 */
import { del, get, post, put } from './request';
import type { PageResult, WordRootItem, WordRootPayload, WordRootQuery } from '@/types/api';

/** 分页列表（热度优先） */
export function getWordRootListApi(params: WordRootQuery): Promise<PageResult<WordRootItem>> {
  return get<PageResult<WordRootItem>>('/word-roots', params);
}

/** 详情 */
export function getWordRootDetailApi(id: number): Promise<WordRootItem> {
  return get<WordRootItem>(`/word-roots/${id}`);
}

/** 编辑（音标 / 释义 / 结构化解析） */
export function updateWordRootApi(id: number, payload: WordRootPayload): Promise<null> {
  return put<null>(`/word-roots/${id}`, payload);
}

/** 删除 */
export function deleteWordRootApi(id: number): Promise<null> {
  return del<null>(`/word-roots/${id}`);
}

/**
 * 按单词立即解析并入库（单条，通常 3~10s）。
 * 放宽超时：AI 解析偶发偏慢，默认 15s 容易在服务端已成功时前端先报超时。
 */
export function analyzeWordApi(word: string): Promise<WordRootItem> {
  return post<WordRootItem>('/word-roots/analyze', { word }, { timeout: 60_000 });
}
