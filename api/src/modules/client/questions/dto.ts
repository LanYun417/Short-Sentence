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

/** 抽题查询入参。 */
export class NextQuestionQueryDto {
  /**
   * 目标难度：1 易 / 2 中 / 3 难。
   * 只作用于新题抽取；复习题仍按间隔重复排期走。该难度无可用新题时服务端回落到不限难度。
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '难度必须为整数' })
  @Min(1, { message: '难度最小为 1' })
  @Max(3, { message: '难度最大为 3' })
  difficulty?: number;
}
