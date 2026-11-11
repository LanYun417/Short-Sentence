/**
 * 学习小队请求 DTO。
 * 形状校验放这里，业务规则（长度归一、是否已组队、人数上限）在 service。
 */
import { IsInt, IsOptional, IsString, Length, MaxLength, Min, MinLength } from 'class-validator';

/** 修改小队名称。 */
export class RenameTeamDto {
  /** 新小队名（service 会去空白、压缩连续空格，并按码点校验 2~20 字） */
  @IsString()
  @Length(1, 50)
  name!: string;
}

/** 自建队伍：建一个新小队并拿到组队码。 */
export class CreateTeamDto {
  /** 小队名（2~20 字，同 rename 归一规则） */
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;
}

/** 凭组队码加入小队。 */
export class JoinTeamDto {
  /** 组队码（6 位，字母数字；service 会转大写归一） */
  @IsString()
  @Length(4, 8)
  code!: string;
}

/** 发送小队群聊消息。 */
export class SendTeamMessageDto {
  /** 消息正文（≤500 字） */
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content!: string;

  /** 引用的消息 id（可选；必须属于同一小队） */
  @IsOptional()
  @IsInt()
  @Min(1)
  quoteId?: number;
}

/** 群聊消息游标分页上限。 */
export const TEAM_MESSAGE_PAGE_MAX = 50;
