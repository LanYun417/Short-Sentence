/**
 * 投稿 DTO（用户端提交 / 后台审核）。
 */
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** 用户提交一条投稿。 */
export class CreateSubmissionDto {
  /** 英文句子（3~300 字；过短没有学习价值，过长不适合做卡片） */
  @IsString({ message: '句子必须为字符串' })
  @MinLength(3, { message: '句子太短了（至少 3 个字符）' })
  @MaxLength(300, { message: '句子最长 300 个字符' })
  sentenceEn!: string;

  /** 中文译文 */
  @IsString({ message: '译文必须为字符串' })
  @MinLength(1, { message: '请填写中文译文' })
  @MaxLength(300, { message: '译文最长 300 个字符' })
  translationZh!: string;

  /** 附言（可选：出处 / 为什么喜欢这句） */
  @IsOptional()
  @IsString({ message: '附言必须为字符串' })
  @MaxLength(300, { message: '附言最长 300 个字符' })
  note?: string;

  /** 来源端（用于区分投稿发生在哪一端） */
  @IsOptional()
  @IsIn(['web', 'android'], { message: '来源端不合法' })
  platform?: string;
}

/** 后台审核一条投稿。 */
export class ReviewSubmissionDto {
  /** approve 通过（进精选）/ reject 驳回 */
  @IsIn(['approve', 'reject'], { message: '审核动作不合法' })
  action!: 'approve' | 'reject';

  /** 审核备注（驳回时建议填写，会下发给投稿人） */
  @IsOptional()
  @IsString({ message: '备注必须为字符串' })
  @MaxLength(300, { message: '备注最长 300 个字符' })
  note?: string;
}
