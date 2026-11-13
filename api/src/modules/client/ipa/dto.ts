/**
 * 音标学习 DTO（客户端）。
 */
import { ArrayMaxSize, IsArray, IsIn, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

/** 测验题型：看词选音标 / 看音标选词。 */
export type IpaQuizType = 'word_to_phoneme' | 'phoneme_to_word';

/** 一条测验答案（客户端上报的是「真实选择」，判分在服务端）。 */
export class IpaQuizAnswerDto {
  /** 题型，决定判分方向 */
  @IsIn(['word_to_phoneme', 'phoneme_to_word'], { message: '题型不合法' })
  type!: IpaQuizType;

  /**
   * 题干：
   * - word_to_phoneme → 英文单词（如 cat）
   * - phoneme_to_word → 音标符号（如 æ）
   */
  @IsString({ message: '题干必须是字符串' })
  @MinLength(1, { message: '题干不能为空' })
  @MaxLength(60, { message: '题干过长' })
  prompt!: string;

  /**
   * 用户的选择：
   * - word_to_phoneme → 音标符号
   * - phoneme_to_word → 英文单词
   */
  @IsString({ message: '答案必须是字符串' })
  @MinLength(1, { message: '答案不能为空' })
  @MaxLength(60, { message: '答案过长' })
  answer!: string;
}

/** 提交一整套测验答案。 */
export class IpaQuizSubmitDto {
  /** 答案列表（一题一条） */
  @IsArray({ message: '答案必须是数组' })
  @ArrayMaxSize(50, { message: '单次提交最多 50 题' })
  @ValidateNested({ each: true })
  answers!: IpaQuizAnswerDto[];
}

/** 标记某个音标「学会了」。 */
export class IpaLearnedDto {
  /** 音标符号（如 æ；不含斜线） */
  @IsString({ message: '音标必须是字符串' })
  @MinLength(1, { message: '音标不能为空' })
  @MaxLength(20, { message: '音标最长 20 个字符' })
  symbol!: string;
}
