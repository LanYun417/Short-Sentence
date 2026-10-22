/**
 * 客户端鉴权 DTO。
 */
import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** 性别取值（保密为默认）。 */
export const CLIENT_GENDER = {
  MALE: 'male',
  FEMALE: 'female',
  SECRET: 'secret',
} as const;

/** 注册入参。 */
export class ClientRegisterDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(100, { message: '邮箱最长 100 个字符' })
  email!: string;

  @IsString({ message: '密码必须为字符串' })
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(32, { message: '密码最长 32 位' })
  password!: string;

  @IsOptional()
  @IsString({ message: '昵称必须为字符串' })
  @MaxLength(50, { message: '昵称最长 50 个字符' })
  nickname?: string;
}

/** 登录入参。 */
export class ClientLoginDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  @IsString({ message: '密码必须为字符串' })
  password!: string;
}

/** 刷新令牌入参。 */
export class ClientRefreshDto {
  @IsString({ message: 'refreshToken 必须为字符串' })
  refreshToken!: string;
}

/** 修改资料入参（全部可选，未传字段不更新）。 */
export class UpdateClientProfileDto {
  @IsOptional()
  @IsString({ message: '昵称必须为字符串' })
  @MaxLength(50, { message: '昵称最长 50 个字符' })
  nickname?: string;

  /** 头像文件 id（0 = 恢复默认头像） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '头像文件 id 必须为整数' })
  avatarFileId?: number;

  /** 出生年月日（ISO 日期，如 1995-06-01） */
  @IsOptional()
  @IsDateString({}, { message: '出生年月日格式不正确' })
  birthday?: string;

  @IsOptional()
  @IsEnum(Object.values(CLIENT_GENDER), { message: '性别取值不正确' })
  gender?: string;

  @IsOptional()
  @IsString({ message: '个性签名必须为字符串' })
  @MaxLength(200, { message: '个性签名最长 200 个字符' })
  signature?: string;
}

/** 修改密码入参。 */
export class ChangeClientPasswordDto {
  @IsString({ message: '原密码必须为字符串' })
  oldPassword!: string;

  @IsString({ message: '新密码必须为字符串' })
  @MinLength(6, { message: '新密码至少 6 位' })
  @MaxLength(32, { message: '新密码最长 32 位' })
  newPassword!: string;
}
