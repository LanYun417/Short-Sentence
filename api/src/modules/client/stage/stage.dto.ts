/**
 * 句子接龙 / 情景闯关相关的请求 DTO。
 * 形状校验放这里，业务规则（长度归一、解锁判定）在 service。
 */
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** 进入场景对话（restart=true 重新开一局）。 */
export class StartStageDialogueDto {
  @IsOptional()
  @IsBoolean()
  restart?: boolean;
}

/** 用户发一句。 */
export class StageMessageDto {
  @IsString()
  @Length(1, 300)
  content!: string;

  /** 发送时翻译是否开启（用于无翻译通关加成反作弊；默认 true）。 */
  @IsOptional()
  @IsBoolean()
  showTranslation?: boolean;
}

/** 切换翻译显示开关。 */
export class StageTranslationDto {
  @IsBoolean()
  show!: boolean;
}

/** 生成/重新生成章节封面。chapterKey 缺省 = 全部章节（仅补缺失，除非 regenerate）。 */
export class GenerateStageCoverDto {
  /** 章节 key（缺省 = 全部章节）；与 STAGE_CHAPTERS.key 一致 */
  @IsOptional()
  @IsString()
  @Length(1, 30)
  chapterKey?: string;

  /** 为 true 时即使已有封面也强制重生成 */
  @IsOptional()
  @IsBoolean()
  regenerate?: boolean;
}

/* ------------------------------ 关卡（stage_story）CRUD ------------------------------ */

/** 出场角色。 */
export class StageRoleDto {
  @IsString()
  @Length(1, 40)
  nameEn!: string;

  @IsString()
  @Length(1, 40)
  name!: string;

  @IsString()
  @Length(1, 500)
  persona!: string;

  @IsString()
  @Length(1, 10)
  emoji!: string;
}

/** 开场白一句。 */
export class StageLineDto {
  @IsString()
  @Length(1, 40)
  speaker!: string;

  @IsString()
  @Length(1, 300)
  contentEn!: string;

  @IsString()
  @Length(1, 200)
  contentZh!: string;
}

/** 候选英文短句。 */
export class StageHintDto {
  @IsString()
  @Length(1, 200)
  en!: string;

  @IsString()
  @Length(1, 200)
  zh!: string;
}

/** 新增关卡。 */
export class CreateStageStoryDto {
  @IsString()
  @Length(1, 30)
  chapterKey!: string;

  /** 绑定的场景分类名（sentence_category.name） */
  @IsString()
  @Length(1, 100)
  category!: string;

  @IsString()
  @Length(1, 100)
  title!: string;

  @IsString()
  @Length(1, 1000)
  intro!: string;

  @IsString()
  @Length(1, 1000)
  outro!: string;

  @IsString()
  @Length(1, 200)
  userRole!: string;

  @IsString()
  @Length(1, 1000)
  setting!: string;

  @IsString()
  @Length(1, 500)
  goal!: string;

  @IsInt()
  @Min(1)
  @Max(50)
  minTurns!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  maxTurns!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  target?: number;

  @IsInt()
  @Min(0)
  @Max(10000)
  rewardXp!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => StageRoleDto)
  roles!: StageRoleDto[];

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => StageLineDto)
  opening!: StageLineDto[];

  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => StageHintDto)
  starterHints!: StageHintDto[];
}

/** 编辑关卡：全字段可选；category 不允许修改（service 拦截）。 */
export class UpdateStageStoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 30)
  chapterKey?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  intro?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  outro?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  userRole?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  setting?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  goal?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  minTurns?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxTurns?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  target?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  rewardXp?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => StageRoleDto)
  roles?: StageRoleDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => StageLineDto)
  opening?: StageLineDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => StageHintDto)
  starterHints?: StageHintDto[];
}

/** 启停关卡。 */
export class SetStageStoryStatusDto {
  @IsIn([0, 1])
  status!: 0 | 1;
}

/** 章内重排序：ids 按数组顺序重写 sort。 */
export class ReorderStageStoriesDto {
  @IsString()
  @Length(1, 30)
  chapterKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  ids!: number[];
}
