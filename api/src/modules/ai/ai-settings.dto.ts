/**
 * AI 设置 DTO（管理端）。
 *
 * 约定：`apiKey` 留空表示**不修改**——前端拿不到真密钥，只能留空；
 * 传掩码值回填会把真 key 覆盖成 `****abcd`，所以这里只接受「新值或空」。
 */
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** 去除首尾空白。 */
const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** 保存 AI 设置。 */
export class UpdateAiSettingsDto {
  /** Agnes API Key（留空 = 不修改） */
  @IsOptional()
  @IsString({ message: 'API Key 必须为字符串' })
  @Transform(trim)
  @MaxLength(500, { message: 'API Key 过长' })
  apiKey?: string;

  /** 上游地址（含 /v1；留空 = 不修改） */
  @IsOptional()
  @IsString({ message: 'API 地址必须为字符串' })
  @Transform(trim)
  @MaxLength(500, { message: 'API 地址过长' })
  baseUrl?: string;

  /** 生文模型（留空 = 不修改） */
  @IsOptional()
  @IsString({ message: '生文模型必须为字符串' })
  @Transform(trim)
  @MaxLength(100, { message: '生文模型名过长' })
  textModel?: string;

  /** 生图模型（留空 = 不修改） */
  @IsOptional()
  @IsString({ message: '生图模型必须为字符串' })
  @Transform(trim)
  @MaxLength(100, { message: '生图模型名过长' })
  imageModel?: string;
}
