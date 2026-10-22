/**
 * 刷题 DTO（客户端）。
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** 提交答案入参。 */
export class AnswerSentenceDto {
  /** 用户输入的英文 */
  @IsString({ message: '答案必须为字符串' })
  @MaxLength(300, { message: '答案最长 300 个字符' })
  userAnswer!: string;

  /** 作答耗时（毫秒，前端计时；作弊性由上限截断） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '作答耗时必须为整数' })
  @Min(0, { message: '作答耗时不能为负' })
  @Max(3_600_000, { message: '作答耗时异常' })
  elapsedMs?: number;
}
