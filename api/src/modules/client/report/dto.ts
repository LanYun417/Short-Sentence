/**
 * 举报/反馈 DTO（客户端）。
 */
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** 提交举报/反馈入参。 */
export class CreateReportDto {
  /** 被举报句子 id */
  @Type(() => Number)
  @IsInt({ message: '题目 id 必须为整数' })
  @Min(1, { message: '题目 id 不合法' })
  sentenceId!: number;

  /**
   * 举报类型：
   * - wrong 题目/翻译有误
   * - inappropriate 内容不适当
   * - image 图片不雅/有问题
   * - other 其他
   */
  @IsIn(['wrong', 'inappropriate', 'image', 'other'], { message: '反馈类型不合法' })
  reason!: string;

  /** 补充描述（可选） */
  @IsOptional()
  @IsString({ message: '补充说明必须为字符串' })
  @MaxLength(500, { message: '补充说明最长 500 个字符' })
  description?: string;
}
