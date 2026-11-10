/**
 * 句子接龙 / 情景闯关相关的请求 DTO。
 * 形状校验放这里，业务规则（长度归一、解锁判定）在 service。
 */
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

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
