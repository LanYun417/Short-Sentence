/**
 * 词根词典管理 DTO（运营后台）。
 */
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** 编辑词条（音标 / 释义 / 结构化解析）。 */
export class UpdateWordRootDto {
  @IsOptional()
  @IsString({ message: '音标必须为字符串' })
  @MaxLength(120, { message: '音标最长 120 个字符' })
  phonetic?: string;

  @IsOptional()
  @IsString({ message: '释义必须为字符串' })
  @MaxLength(300, { message: '释义最长 300 个字符' })
  meaning?: string;

  /**
   * 结构化解析（JSON 字符串，形如 {"parts":[...],"explanation":"","related":[]}）。
   * 用字符串而非对象接收：白名单校验需要明确的形状，且前端用 JSON 文本域编辑。
   */
  @IsOptional()
  @IsString({ message: '解析结果必须为字符串' })
  @MaxLength(4000, { message: '解析结果过长' })
  analysisJson?: string;
}

/** 按单词立即解析并入库。 */
export class AnalyzeWordDto {
  @IsString({ message: '单词必须为字符串' })
  @Matches(/^[a-zA-Z][a-zA-Z'-]{0,63}$/, { message: '单词只能包含字母、连字符与撇号（1~64 个字符）' })
  word!: string;
}
