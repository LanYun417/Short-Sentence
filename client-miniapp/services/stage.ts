/**
 * 情景闯关接口。
 *
 * 说明：翻译开关不用 `PATCH /:id/dialogue/translation`——
 * `wx.request` 不支持 PATCH，而 `POST /:id/dialogue/messages` 的 `showTranslation`
 * 已由服务端持久化（且 translationUsed 粘性），发消息时带上即可。
 */
import { request } from '../utils/request';
import type {
  StageClaimResult,
  StageDialogueView,
  StageOverview,
  StageSceneDetail,
  StageScriptDetail,
  StageTurnResult,
} from './types';

/** 闯关地图（场景汇总 + 推荐关卡 + 可领取数）。 */
export function fetchStageOverview(): Promise<StageOverview> {
  return request<StageOverview>('/client/stages');
}

/** 场景详情（该场景下的剧本列表）。 */
export function fetchStageScene(sceneId: number): Promise<StageSceneDetail> {
  return request<StageSceneDetail>(`/client/stages/scenes/${sceneId}`);
}

/** 剧本详情（该剧本下的关卡列表，含解锁/进度）。 */
export function fetchStageScript(scriptId: number): Promise<StageScriptDetail> {
  return request<StageScriptDetail>(`/client/stages/scripts/${scriptId}`);
}

/** 进入关卡：有会话就续聊，没有就新建（restart=true 重开一局）。 */
export function startDialogue(stageId: number, restart = false): Promise<StageDialogueView> {
  return request<StageDialogueView>(`/client/stages/${stageId}/dialogue`, {
    method: 'POST',
    data: { restart },
  });
}

/** 发一句 → 1~3 个角色回应 → 可能结束并给出复盘。 */
export function sendStageMessage(stageId: number, content: string, showTranslation: boolean): Promise<StageTurnResult> {
  return request<StageTurnResult>(`/client/stages/${stageId}/dialogue/messages`, {
    method: 'POST',
    data: { content, showTranslation },
  });
}

/** 主动结束对话。 */
export function endDialogue(stageId: number): Promise<StageDialogueView> {
  return request<StageDialogueView>(`/client/stages/${stageId}/dialogue/end`, { method: 'POST' });
}

/** 领取通关奖励（幂等）。 */
export function claimStage(stageId: number): Promise<StageClaimResult> {
  return request<StageClaimResult>(`/client/stages/${stageId}/claim`, { method: 'POST' });
}
