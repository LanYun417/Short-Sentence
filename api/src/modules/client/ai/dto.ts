/**
 * 客户端 AI 能力 DTO。
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** 场景延展造句入参。 */
export class ClientExpandDto {
  /** 用户输入的中文（想表达的意思） */
  @IsString({ message: '中文描述必须为字符串' })
  @MinLength(1, { message: '中文描述不能为空' })
  @MaxLength(200, { message: '中文描述最长 200 个字符' })
  chinese!: string;

  /** 关联句子 id（可选，用于让 AI 参考当前场景） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '句子 id 必须为整数' })
  sentenceId?: number;
}

/** 词根词缀拆解入参。 */
export class ClientWordRootDto {
  /** 要拆解的英文单词 */
  @IsString({ message: '单词必须为字符串' })
  @MinLength(1, { message: '单词不能为空' })
  @MaxLength(50, { message: '单词最长 50 个字符' })
  word!: string;

  /** 关联句子 id（可选） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '句子 id 必须为整数' })
  sentenceId?: number;
}

/** 题目解析入参（老题没有解析时实时生成，正常结束后写回库）。 */
export class ClientAnalyzeDto {
  /** 题目句子 id（正文以它从库里取权威文本） */
  @Type(() => Number)
  @IsInt({ message: '句子 id 必须为整数' })
  sentenceId!: number;
}
