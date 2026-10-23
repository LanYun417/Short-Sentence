/**
 * 客户端用户管理 DTO。
 */
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** 列表查询。 */
export class ClientUserQueryDto {
  /** 关键词（邮箱 / 昵称） */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  /** 状态：1 启用 / 0 禁用 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1], { message: '状态只能是 0 或 1' })
  status?: number;

  /** 性别：male / female / secret */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  gender?: string;
}

/** 设置状态。 */
export class ClientUserStatusDto {
  /** 1 启用 / 0 禁用 */
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @IsIn([0, 1], { message: '状态只能是 0 或 1' })
  status!: number;
}

/** 重置密码。 */
export class ClientUserResetPasswordDto {
  /** 新密码（6~32 位，需含字母与数字） */
  @IsString({ message: '密码必须为字符串' })
  @Min(6, { message: '密码长度不能少于 6 位' })
  @Max(32, { message: '密码长度不能超过 32 位' })
  newPassword!: string;
}
