/**
 * 题库管理 DTO（管理端）。
 */
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** 句子状态（与 schema 注释一致）。 */
export const SENTENCE_STATUS = {
  PENDING_IMAGE: 'pending_image',
  READY: 'ready',
  OFFLINE: 'offline',
} as const;

/** 题目状态取值。 */
export type SentenceStatus = (typeof SENTENCE_STATUS)[keyof typeof SENTENCE_STATUS];

/** 批量上下架入参。 */
export class BatchSentenceStatusDto {
  @Type(() => Number)
  @ArrayNotEmpty({ message: '题目 id 列表不能为空' })
  @ArrayMaxSize(200, { message: '单次最多操作 200 条' })
  @IsArray({ message: '题目 id 列表必须为数组' })
  @IsInt({ each: true, message: '每个题目 id 都必须为整数' })
  @Min(1, { each: true, message: '题目 id 必须为正整数' })
  ids!: number[];

  @IsIn([SENTENCE_STATUS.READY, SENTENCE_STATUS.OFFLINE], { message: '只允许上架(ready)或下架(offline)' })
  status!: SentenceStatus;
}

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
  @IsString({ message: '题目解析必须为字符串' })
  @MaxLength(500, { message: '题目解析最长 500 个字符' })
  explanation?: string;

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

/** 存量题解析回填入参（管理端手动触发，按批补）。 */
export class BackfillExplanationDto {
  /**
   * 本批补多少条（缺省 20，上限 100）。
   * 上限刻意压得低：一次补太多会长时间占用上游配额并逼近请求超时，
   * 分批点几次更可控，接口每次都返回剩余条数。
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '数量必须为整数' })
  @Min(1, { message: '数量至少为 1' })
  @Max(100, { message: '单批最多 100 条' })
  limit?: number;

  /**
   * 是否重新生成已有解析（缺省 false）。
   * true = 把「不是新三行格式」的旧解析也重新生成（空值 + 旧的冗长解析），
   * 用于把历史内容统一精简成固定格式；补完即收敛，可反复点到 remaining=0。
   */
  @IsOptional()
  @IsBoolean({ message: 'force 必须为布尔值' })
  force?: boolean;
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

  /**
   * 定向补的场景分类名（中文，须为启用分类；省略则按自然分布跨所有启用分类）。
   * 用于把某个 0 题的新场景填起来：本批所有题强制归属该分类，模型自报的分类名会被服务端覆盖。
   */
  @IsOptional()
  @IsString({ message: '场景分类名必须为字符串' })
  @MaxLength(50, { message: '场景分类名最长 50 个字符' })
  categoryName?: string;
}

/**
 * 单题重新生图入参。
 *
 * scenePrompt 可选：传了就先用新提示词覆盖该题的场景提示词再生图
 * （运营在后台改了构图、想立刻看效果，不必再走一次「编辑保存」）。
 */
export class RegenerateImageDto {
  @IsOptional()
  @IsString({ message: '场景提示词必须为字符串' })
  @MaxLength(500, { message: '场景提示词最长 500 个字符' })
  scenePrompt?: string;
}

/**
 * 批量重新生图入参。
 *
 * 上限 50（不是批量上下架的 200）：每张图都要消耗 Agnes 配额，
 * 而免费额度限流严格（40 RPM / 并发 2），一次 200 张要跑 5 分钟以上，
 * 中途失败重试也难。换风格这种场景分两批点完全可接受。
 */
export class BatchRegenerateImageDto {
  @Type(() => Number)
  @ArrayNotEmpty({ message: '题目 id 列表不能为空' })
  @ArrayMaxSize(50, { message: '单次最多重新生成 50 条' })
  @IsArray({ message: '题目 id 列表必须为数组' })
  @IsInt({ each: true, message: '每个题目 id 都必须为整数' })
  @Min(1, { each: true, message: '题目 id 必须为正整数' })
  ids!: number[];
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

  /**
   * 图标：**lucide 图标名**（不带前缀）。
   * Web 端拼 `i-lucide-*`、App 端查 `android/lib/theme/icon_map.dart`，
   * 所以名字必须是 lucide 里真实存在的，否则 Web 端会画不出图标。
   */
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
