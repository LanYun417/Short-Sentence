/**
 * AI 设置 DTO（管理端）。
 *
 * 约定：`apiKey` 留空表示**不修改**——前端拿不到真密钥，只能留空；
 * 传掩码值回填会把真 key 覆盖成 `****abcd`，所以这里只接受「新值或空」。
 */
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

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

  /**
   * 英伟达 NIM 生题通道 - 上游地址（留空 = 不修改；填了即启用 NIM 通道，需与 nimApiKey / nimModel 一起填）。
   * 默认 `https://integrate.api.nvidia.com/v1`（OpenAI 兼容）。
   */
  @IsOptional()
  @IsString({ message: 'NIM 上游地址必须为字符串' })
  @Transform(trim)
  @MaxLength(500, { message: 'NIM 上游地址过长' })
  nimBaseUrl?: string;

  /** 英伟达 NIM 生题通道 - API Key（留空 = 不修改；与 nimBaseUrl / nimModel 一起生效） */
  @IsOptional()
  @IsString({ message: 'NIM API Key 必须为字符串' })
  @Transform(trim)
  @MaxLength(500, { message: 'NIM API Key 过长' })
  nimApiKey?: string;

  /** 英伟达 NIM 生题通道 - 模型名（留空 = 不修改；非空即启用通道，仅生题内容生成走 NIM） */
  @IsOptional()
  @IsString({ message: 'NIM 模型名必须为字符串' })
  @Transform(trim)
  @MaxLength(100, { message: 'NIM 模型名过长' })
  nimModel?: string;

  /**
   * 生题内容生成通道选择：'agnes'（默认，走全局生文模型）或 'nim'（走 NIM 通道，需 nim 三件套齐备）。
   * 这是显式开关——两套配置可同时存在，由本字段决定生题走哪条。
   */
  @IsOptional()
  @IsIn(['agnes', 'nim'], { message: '生题通道只能是 agnes 或 nim' })
  genChannel?: 'agnes' | 'nim';
}
