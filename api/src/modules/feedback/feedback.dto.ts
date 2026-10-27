/**
 * 产品反馈处理 DTO（管理端）。
 */
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** 处理反馈入参。 */
export class HandleFeedbackDto {
  /** 处理结果：resolved 已处理 / dismissed 已驳回 */
  @IsIn(['resolved', 'dismissed'], { message: '处理结果不合法' })
  status!: string;

  /**
   * 给用户的回复（可选）。
   * **会下发用户端**——用户在「我的反馈」能看到，是「意见被听见」的闭环；
   * 与内部备注 `handleNote` 分开，后者只给运营看。
   */
  @IsOptional()
  @IsString({ message: '回复必须为字符串' })
  @MaxLength(500, { message: '回复最长 500 个字符' })
  reply?: string;

  /** 内部处理备注（可选；**不下发**用户端） */
  @IsOptional()
  @IsString({ message: '内部备注必须为字符串' })
  @MaxLength(500, { message: '内部备注最长 500 个字符' })
  handleNote?: string;
}
