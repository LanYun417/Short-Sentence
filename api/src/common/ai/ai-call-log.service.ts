/**
 * AI 调用日志服务。
 * 模块职责：把每次 AI 调用（生题/生图/造句/词根）落库，作为计费核对与排障依据。
 * 写日志失败绝不影响主流程（与 NoticeService.publish 的吞错哲学一致）。
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/** 调用类型（与 ai_call_log.type 一致）。 */
export const AI_CALL_TYPE = {
  /** 批量生题 */
  SENTENCE_GEN: 'sentence_gen',
  /** 批量生图 */
  IMAGE_GEN: 'image_gen',
  /** 场景延展造句（流式） */
  EXPAND: 'expand',
  /** 词根词缀拆解（流式） */
  WORD_ROOT: 'word_root',
} as const;

/** 调用状态。 */
export const AI_CALL_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
} as const;

/** 记录入参。 */
export interface AiCallLogInput {
  type: string;
  provider: string;
  model: string;
  /** 关联业务 id（批次/句子/用户，按 type 解释） */
  bizId?: number;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
  status: string;
  errorMessage?: string | null;
}

@Injectable()
export class AiCallLogService {
  constructor(private readonly prisma: PrismaService) {}

  /** 记录一次调用（失败只记日志，不抛出）。 */
  async record(input: AiCallLogInput): Promise<void> {
    try {
      await this.prisma.aiCallLog.create({
        data: {
          type: input.type,
          provider: input.provider,
          model: input.model,
          bizId: BigInt(input.bizId ?? 0),
          promptTokens: input.promptTokens ?? 0,
          completionTokens: input.completionTokens ?? 0,
          latencyMs: input.latencyMs,
          status: input.status,
          errorMessage: input.errorMessage ? input.errorMessage.slice(0, 500) : null,
        },
      });
    } catch {
      // 日志写库失败不影响业务：静默跳过（AI 调用的结果已经返回给调用方）
    }
  }
}
