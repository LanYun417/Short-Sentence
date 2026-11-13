/**
 * 音标学习 DTO（客户端）。
 */
import { IsString, MaxLength, MinLength } from 'class-validator';

/** 标记某个音标「学会了」。 */
export class IpaLearnedDto {
  /** 音标符号（如 æ；不含斜线） */
  @IsString({ message: '音标必须是字符串' })
  @MinLength(1, { message: '音标不能为空' })
  @MaxLength(20, { message: '音标最长 20 个字符' })
  symbol!: string;
}
