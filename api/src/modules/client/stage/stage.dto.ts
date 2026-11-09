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
}
