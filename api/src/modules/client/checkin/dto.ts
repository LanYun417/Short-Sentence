/**
 * 打卡管理后台 DTO（/api/checkins）。
 *
 * 补签 / 撤销的 reason 不落 user_checkin 表（无备注列）——
 * 走 @OperationLog 的 params 审计（拦截器会序列化请求体）。
 */
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** 日期格式 YYYY-MM-DD。 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 补签 / 撤销参数。 */
export class CheckinBackfillDto {
  /** 目标用户邮箱（client_user.email 唯一） */
  @IsEmail({}, { message: '请输入合法的用户邮箱' })
  email!: string;

  /** 补签日期（YYYY-MM-DD，不能晚于今天） */
  @Matches(DATE_RE, { message: '日期格式必须是 YYYY-MM-DD' })
  date!: string;

  /** 原因（写入操作日志 params 审计） */
  @IsString({ message: '原因必须是字符串' })
  @MinLength(2, { message: '请填写原因（至少 2 字）' })
  @MaxLength(200, { message: '原因最长 200 字' })
  reason!: string;
}
