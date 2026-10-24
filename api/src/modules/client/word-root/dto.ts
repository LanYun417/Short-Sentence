/**
 * 词根词典 DTO（客户端）。
 */
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** 收录词条：把 AI 词根拆解的结果落进词典（词库已有则不覆盖）。 */
export class ClientWordRootCollectDto {
  /** 要收录的英文单词 */
  @IsString({ message: '单词必须为字符串' })
  @MinLength(1, { message: '单词不能为空' })
  @MaxLength(50, { message: '单词最长 50 个字符' })
  word!: string;

  /**
   * AI 拆解结果。故意不定义强类型嵌套 DTO——这是「AI 输出的透传」，
   * 校验重心放在 service 的 sanitizeAnalysis（截断 / 白名单 / 丢弃脏项）。
   */
  @IsOptional()
  @IsObject({ message: '拆解结果必须是对象' })
  analysis?: Record<string, unknown>;
}
