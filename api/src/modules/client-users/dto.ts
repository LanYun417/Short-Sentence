/**
 * 客户端用户管理 DTO。
 */
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_LENGTH_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../common/auth/password-policy.js';

/** 设置状态。 */
export class ClientUserStatusDto {
  /** 1 启用 / 0 禁用 */
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @IsIn([0, 1], { message: '状态只能是 0 或 1' })
  status!: number;
}

/**
 * 重置密码。
 *
 * ⚠️ 长度必须用 `@MinLength` / `@MaxLength`（字符串装饰器）。
 * 曾误写成 `@Min(6)` / `@Max(32)`（数值装饰器），class-validator 会拿字符串做
 * `>= 6` 比较，`'Abc123987' >= 6` 转 NaN 判假，于是「过短」和「过长」两条
 * 错误同时报出，任何密码都重置不了（2026-10-28 线上反馈）。
 * 这里复用口令策略常量，与「新增用户 / 自助改密」保持同一口径。
 */
export class ClientUserResetPasswordDto {
  /** 新密码（受 password-policy 约束） */
  @IsString({ message: PASSWORD_LENGTH_MESSAGE })
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_LENGTH_MESSAGE })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: PASSWORD_LENGTH_MESSAGE })
  @Matches(PASSWORD_COMPLEXITY_REGEX, { message: PASSWORD_COMPLEXITY_MESSAGE })
  newPassword!: string;
}
