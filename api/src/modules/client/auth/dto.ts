/**
 * 客户端鉴权 DTO。
 */
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_LENGTH_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../../common/auth/password-policy.js';

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

  /**
   * 登录口令。注册时受口令策略约束（长度与复杂度），
   * 与「后台重置密码 / 自助改密」同一口径（`common/auth/password-policy.ts`），
   * 避免「注册时 6 位能过、改密要 8 位」这类前后不一致。
   */
  @IsString({ message: PASSWORD_LENGTH_MESSAGE })
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_LENGTH_MESSAGE })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: PASSWORD_LENGTH_MESSAGE })
  @Matches(PASSWORD_COMPLEXITY_REGEX, { message: PASSWORD_COMPLEXITY_MESSAGE })
  password!: string;

  @IsOptional()
  @IsString({ message: '昵称必须为字符串' })
  @MaxLength(50, { message: '昵称最长 50 个字符' })
  nickname?: string;

  /** 图形验证码 id（服务端开启验证码时必填） */
  @IsOptional()
  @IsString({ message: '验证码 id 必须为字符串' })
  @MaxLength(64, { message: '验证码 id 最长 64 个字符' })
  captchaId?: string;

  /** 图形验证码字符（服务端开启验证码时必填；大小写不敏感） */
  @IsOptional()
  @IsString({ message: '验证码必须为字符串' })
  @MaxLength(10, { message: '验证码最长 10 个字符' })
  captchaCode?: string;

  /** 邮箱验证码（可选：传了就校验邮箱验证码，不再校验图形验证码） */
  @IsOptional()
  @IsString({ message: '邮箱验证码必须为字符串' })
  @MaxLength(10, { message: '邮箱验证码最长 10 个字符' })
  emailCode?: string;
}

/** 登录入参。 */
export class ClientLoginDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  @IsString({ message: '密码必须为字符串' })
  password!: string;

  /** 图形验证码 id（服务端开启验证码时必填） */
  @IsOptional()
  @IsString({ message: '验证码 id 必须为字符串' })
  @MaxLength(64, { message: '验证码 id 最长 64 个字符' })
  captchaId?: string;

  /** 图形验证码字符（服务端开启验证码时必填；大小写不敏感） */
  @IsOptional()
  @IsString({ message: '验证码必须为字符串' })
  @MaxLength(10, { message: '验证码最长 10 个字符' })
  captchaCode?: string;

  /** 邮箱验证码（可选：传了就校验邮箱验证码，不再校验图形验证码） */
  @IsOptional()
  @IsString({ message: '邮箱验证码必须为字符串' })
  @MaxLength(10, { message: '邮箱验证码最长 10 个字符' })
  emailCode?: string;
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

  /** 每日学习提醒邮件：1 订阅 / 0 不订阅（用户主动开启才发） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '邮件提醒开关必须为整数' })
  @Min(0, { message: '邮件提醒开关只能为 0 或 1' })
  @Max(1, { message: '邮件提醒开关只能为 0 或 1' })
  emailReminder?: number;
}

/** 发送邮箱验证码入参。 */
export class SendEmailCodeDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(100, { message: '邮箱最长 100 个字符' })
  email!: string;

  /** 用途：register 注册 / login 登录 / reset 重置密码 */
  @IsEnum(['register', 'login', 'reset'], { message: '验证码用途不正确' })
  purpose!: 'register' | 'login' | 'reset';
}

/** 设置个人主页背景句签入参。 */
export class SetClientBackgroundDto {
  /** 句签 id（0 = 恢复默认品牌渐变；须为本人已获得的句签） */
  @Type(() => Number)
  @IsInt({ message: '句签 id 必须为整数' })
  @Min(0, { message: '句签 id 不能为负' })
  cardId!: number;
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
