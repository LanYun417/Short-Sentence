/**
 * 举报处理 DTO（管理端）。
 */
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** 处理举报入参。 */
export class HandleReportDto {
  /** 处理结果：resolved 已处理 / dismissed 已驳回 */
  @IsIn(['resolved', 'dismissed'], { message: '处理结果不合法' })
  status!: string;

  /** 处理备注（可选） */
  @IsOptional()
  @IsString({ message: '处理备注必须为字符串' })
  @MaxLength(500, { message: '处理备注最长 500 个字符' })
  handleNote?: string;
}
