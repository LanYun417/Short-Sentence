/**
 * 句签管理 DTO（运营后台）。
 */
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** 编辑句签文案（图片与状态不在此改，避免误把就绪卡改坏）。 */
export class UpdateSentenceCardDto {
  @IsOptional()
  @IsString({ message: '标题必须为字符串' })
  @MaxLength(80, { message: '标题最长 80 个字符' })
  title?: string;

  @IsOptional()
  @IsString({ message: '中文标题必须为字符串' })
  @MaxLength(80, { message: '中文标题最长 80 个字符' })
  titleZh?: string;

  @IsOptional()
  @IsString({ message: '英文短句必须为字符串' })
  @MaxLength(200, { message: '英文短句最长 200 个字符' })
  sentenceEn?: string;

  @IsOptional()
  @IsString({ message: '中文释义必须为字符串' })
  @MaxLength(200, { message: '中文释义最长 200 个字符' })
  translationZh?: string;
}

/** 按日期重新生成句签。 */
export class GenerateSentenceCardDto {
  /** 业务日期（YYYY-MM-DD） */
  @IsString({ message: '日期必须为字符串' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '日期格式须为 YYYY-MM-DD' })
  bizDate!: string;

  /**
   * 已就绪时是否强制覆盖。
   * 缺省按 true 处理——运营点「重新生成」的意图就是要换一张。
   */
  @IsOptional()
  @IsBoolean({ message: 'force 必须为布尔值' })
  force?: boolean;
}
