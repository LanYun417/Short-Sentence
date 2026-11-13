/**
 * 音标学习 DTO（客户端 + 后台共用）。
 */
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

/** 音标类型（与 schema / 客户端一致）。 */
export const IPA_PHONEME_TYPES: string[] = ['vowel', 'diphthong', 'consonant_voiceless', 'consonant_voiced'];

/** 标记某个音标「学会了」。 */
export class IpaLearnedDto {
  /** 音标符号（如 æ；不含斜线） */
  @IsString({ message: '音标必须是字符串' })
  @MinLength(1, { message: '音标不能为空' })
  @MaxLength(20, { message: '音标最长 20 个字符' })
  symbol!: string;
}

/**
 * 后台编辑音标内容字段。
 *
 * 注意：symbol 是业务主键（XP 幂等 event_key 含 symbol），**不开放修改**——
 * 改 symbol 会让已学用户按新 symbol 重复触发发奖。
 */
export class UpdateIpaPhonemeDto {
  /** 类型：vowel / diphthong / consonant_voiceless / consonant_voiced */
  @IsOptional()
  @IsIn(IPA_PHONEME_TYPES, { message: '音标类型不合法' })
  type?: string;

  /** 示例词（英文词，2~6 个） */
  @IsOptional()
  @IsArray({ message: '示例词必须是字符串数组' })
  @ArrayMaxSize(6, { message: '示例词最多 6 个' })
  @IsString({ each: true, message: '示例词必须是字符串' })
  @MinLength(1, { each: true, message: '示例词不能为空' })
  @MaxLength(30, { each: true, message: '单个示例词最长 30 字符' })
  exampleWords?: string[];

  /** 中文发音要点 */
  @IsOptional()
  @IsString({ message: '要点必须是字符串' })
  @MaxLength(200, { message: '要点最长 200 字' })
  tips?: string;

  /** 组内排序 */
  @IsOptional()
  @IsInt({ message: '排序必须是整数' })
  @Min(0, { message: '排序不能为负' })
  sort?: number;
}
