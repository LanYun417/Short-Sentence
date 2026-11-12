/**
 * AI 设置 DTO（管理端）——模型列表，整表提交。
 *
 * 约定：每个模型的 `apiKey` **留空表示沿用已存密钥**——读接口只回掩码，前端拿不到真密钥，
 * 传掩码值回填会把真 key 覆盖成 `****abcd`，所以这里只接受「新值或空」。
 */
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { API_FORMATS, type AdvancedAiConfig } from '../../common/ai/ai-protocol.js';

/** 去除首尾空白。 */
const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** 高级参数（作为一个对象嵌套在模型项里）。 */
class AdvancedAiConfigDto implements AdvancedAiConfig {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  modelSeries = '';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  maxInputTokens = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  maxOutputTokens = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  toolRounds = 0;

  @IsOptional()
  @IsBoolean()
  imageInput = true;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  thinkingParam = '';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  thinkingOptions: string[] = [];

  @IsOptional()
  @IsString()
  @MaxLength(30)
  thinkingValue = '';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-1)
  @Max(2)
  temperature = -1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-1)
  @Max(1)
  topP = -1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1)
  @Max(100)
  topK = -1;
}

/** 单个模型配置。 */
class SaveAiModelDto {
  /** 模型配置 id（同一份列表内唯一） */
  @IsString({ message: 'id 必须为字符串' })
  @Transform(trim)
  @MaxLength(32)
  id!: string;

  /** 用途：text 生文 / image 生图 */
  @IsIn(['text', 'image'], { message: '用途只能是 text 或 image' })
  purpose!: 'text' | 'image';

  /** 是否启用（缺省启用） */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** API 格式（生图固定 openai_chat） */
  @IsOptional()
  @IsIn([...API_FORMATS])
  format?: 'openai_chat' | 'openai_responses' | 'anthropic';

  /** 上游地址是否为完整 URL（含路径） */
  @IsOptional()
  @IsBoolean()
  fullUrl?: boolean;

  /** 上游地址 */
  @IsString({ message: '上游地址必须为字符串' })
  @Transform(trim)
  @MaxLength(500)
  baseUrl!: string;

  /** 模型 ID */
  @IsString({ message: '模型 ID 必须为字符串' })
  @Transform(trim)
  @MaxLength(100)
  modelId!: string;

  /** 模型展示名称（空 = 显示模型 ID） */
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(64)
  modelLabel?: string;

  /** API Key（留空 = 沿用已存密钥） */
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(500)
  apiKey?: string;

  /** 高级参数 */
  @IsOptional()
  @Type(() => AdvancedAiConfigDto)
  @IsObject()
  advanced?: AdvancedAiConfigDto;
}

/** 保存 AI 设置（整表提交模型列表）。 */
export class UpdateAiSettingsDto {
  @IsArray({ message: 'models 必须为数组' })
  @ArrayMaxSize(20, { message: '最多 20 个模型' })
  @ValidateNested({ each: true })
  @Type(() => SaveAiModelDto)
  models!: SaveAiModelDto[];
}

/** 测试连通性入参（可选：直接传一个未保存的模型配置；不传则按 id 或默认文本模型测）。 */
export class TestAiDto {
  @IsOptional()
  @Type(() => SaveAiModelDto)
  @ValidateNested()
  model?: SaveAiModelDto;
}

export { SaveAiModelDto };
