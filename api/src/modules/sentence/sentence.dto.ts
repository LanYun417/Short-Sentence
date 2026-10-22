/**
 * 题库管理 DTO（管理端）。
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

/** 句子状态（与 schema 注释一致）。 */
export const SENTENCE_STATUS = {
  PENDING_IMAGE: 'pending_image',
  READY: 'ready',
  OFFLINE: 'offline',
} as const;

/** 手工创建/编辑句子入参。 */
export class SaveSentenceDto {
  @Type(() => Number)
  @IsInt({ message: '分类 id 必须为整数' })
  @Min(1, { message: '分类 id 必须为正整数' })
  categoryId!: number;

  @IsString({ message: '英文句子必须为字符串' })
  @MinLength(1, { message: '英文句子不能为空' })
  @MaxLength(300, { message: '英文句子最长 300 个字符' })
  sentenceEn!: string;

  @IsString({ message: '中文释义必须为字符串' })
  @MinLength(1, { message: '中文释义不能为空' })
  @MaxLength(300, { message: '中文释义最长 300 个字符' })
  translationZh!: string;

  @IsOptional()
  @IsString({ message: '音标必须为字符串' })
  @MaxLength(200, { message: '音标最长 200 个字符' })
  ipa?: string;

  @IsOptional()
  @IsString({ message: '场景提示词必须为字符串' })
  @MaxLength(500, { message: '场景提示词最长 500 个字符' })
  scenePrompt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '难度必须为整数' })
  difficulty?: number;

  @IsOptional()
  @IsString({ message: '状态取值不正确' })
  status?: string;
}

/** 手动触发批量生成入参。 */
export class TriggerGenDto {
  /** 本次目标数量（缺省取配置 SENTENCE_DAILY_TARGET） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '目标数量必须为整数' })
  @Min(1, { message: '目标数量至少为 1' })
  count?: number;
}
