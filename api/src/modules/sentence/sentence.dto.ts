/**
 * 题库管理 DTO（管理端）。
 */
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** 句子状态（与 schema 注释一致）。 */
export const SENTENCE_STATUS = {
  PENDING_IMAGE: 'pending_image',
  READY: 'ready',
  OFFLINE: 'offline',
} as const;

/** 手工创建/编辑句子入参。 */
export class SaveSentenceDto {
  @Type(() => Number)
  @IsInt({ message: '分类 id 必须为整数' })
  @Min(1, { message: '分类 id 必须为正整数' })
  categoryId!: number;

  @IsString({ message: '英文句子必须为字符串' })
  @MinLength(1, { message: '英文句子不能为空' })
  @MaxLength(300, { message: '英文句子最长 300 个字符' })
  sentenceEn!: string;

  @IsString({ message: '中文释义必须为字符串' })
  @MinLength(1, { message: '中文释义不能为空' })
  @MaxLength(300, { message: '中文释义最长 300 个字符' })
  translationZh!: string;

  @IsOptional()
  @IsString({ message: '音标必须为字符串' })
  @MaxLength(200, { message: '音标最长 200 个字符' })
  ipa?: string;

  @IsOptional()
  @IsString({ message: '场景提示词必须为字符串' })
  @MaxLength(500, { message: '场景提示词最长 500 个字符' })
  scenePrompt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '难度必须为整数' })
  difficulty?: number;

  @IsOptional()
  @IsString({ message: '状态取值不正确' })
  status?: string;
}

/** 手动触发批量生成入参。 */
export class TriggerGenDto {
  /** 本次目标数量（缺省取配置 SENTENCE_DAILY_TARGET） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '目标数量必须为整数' })
  @Min(1, { message: '目标数量至少为 1' })
  count?: number;

  /**
   * 强制本批全部为该难度（1 易 / 2 中 / 3 难；省略则按 40/40/20 自然分布）。
   * 用于「某一档题目不够用」时定向补题，例如基础档被抽空。
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '难度必须为整数' })
  @Min(1, { message: '难度最小为 1' })
  @Max(3, { message: '难度最大为 3' })
  difficulty?: number;
}

/** 场景分类保存入参。 */
export class SaveCategoryDto {
  /** 分类名称（中文，唯一） */
  @IsString({ message: '分类名称必须为字符串' })
  @IsNotEmpty({ message: '分类名称不能为空' })
  @MaxLength(50, { message: '分类名称最长 50 个字符' })
  name!: string;

  /** 英文名（客户端卡片副标题） */
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: '英文名最长 50 个字符' })
  nameEn?: string;

  /** 图标（bootstrap-icons 类名） */
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: '图标名最长 100 个字符' })
  icon?: string;

  /** 排序（升序） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '排序必须为整数' })
  sort?: number;

  /** 1 启用 / 0 禁用 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @IsIn([0, 1], { message: '状态只能是 0 或 1' })
  status?: number;
}
