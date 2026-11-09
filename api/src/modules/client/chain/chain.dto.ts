/**
 * 句子接龙 DTO。
 * 校验分两层：这里只挡「形状」（类型/长度），业务规则（ASCII、单词数、链接）
 * 在 service 的 `validateEntry` 里，便于单测与复用。
 */
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

/** 提交一条续写。 */
export class CreateChainEntryDto {
  /** 英文续写（必填） */
  @IsString()
  @Length(1, 200)
  contentEn!: string;

  /** 中文翻译（可选） */
  @IsOptional()
  @IsString()
  @Length(0, 120)
  contentZh?: string;
}

/** 举报一条接龙。 */
export class ReportChainEntryDto {
  /** 原因：inappropriate 内容不当 / spam 广告灌水 / other 其他 */
  @IsOptional()
  @IsIn(['inappropriate', 'spam', 'other'])
  reason?: string;
}

/** 后台设置条目状态。 */
export class SetChainEntryStatusDto {
  /** visible 通过 / rejected 拒绝 / hidden 隐藏 */
  @IsIn(['visible', 'hidden', 'rejected'])
  status!: 'visible' | 'hidden' | 'rejected';
}
