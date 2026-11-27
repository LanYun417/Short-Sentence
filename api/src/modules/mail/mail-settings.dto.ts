/**
 * 邮件设置 DTO（管理端）。
 */
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

/** 保存邮件设置入参。secretKey 传空串表示「不修改」（前端只拿到掩码，不能回填真值）。 */
export class UpdateMailSettingsDto {
  /** 总开关 */
  @IsBoolean({ message: '开关必须为布尔值' })
  enabled!: boolean;

  @IsOptional()
  @IsString({ message: 'SecretId 必须为字符串' })
  @MaxLength(200, { message: 'SecretId 过长' })
  secretId?: string;

  /** 留空 = 保持原密钥不变 */
  @IsOptional()
  @IsString({ message: 'SecretKey 必须为字符串' })
  @MaxLength(200, { message: 'SecretKey 过长' })
  secretKey?: string;

  @IsOptional()
  @IsString({ message: '地域必须为字符串' })
  @MaxLength(50, { message: '地域过长' })
  region?: string;

  @IsOptional()
  @IsString({ message: '发件人邮箱必须为字符串' })
  @MaxLength(100, { message: '发件人邮箱过长' })
  fromAddress?: string;

  @IsOptional()
  @IsString({ message: '发件人显示名必须为字符串' })
  @MaxLength(50, { message: '发件人显示名过长' })
  fromAlias?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '模板 ID 必须为整数' })
  @Min(1, { message: '模板 ID 必须为正整数' })
  templateCaptcha?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '模板 ID 必须为整数' })
  @Min(1, { message: '模板 ID 必须为正整数' })
  templateReminder?: number;

  /** 周报模板 ID（可选；不填 = 不启用邮件周报，站内周报不受影响） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '模板 ID 必须为整数' })
  @Min(1, { message: '模板 ID 必须为正整数' })
  templateWeekly?: number;
}

/** 发送测试邮件入参。 */
export class TestMailDto {
  @IsEmail({}, { message: '请填写正确的收件邮箱' })
  @MinLength(3, { message: '请填写收件邮箱' })
  to!: string;
}
