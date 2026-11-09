/**
 * 学习小队请求 DTO。
 * 形状校验放这里，业务规则（长度归一、是否已组队）在 service。
 */
import { IsString, Length } from 'class-validator';

/** 修改小队名称。 */
export class RenameTeamDto {
  /** 新小队名（service 会去空白、压缩连续空格，并按码点校验 2~20 字） */
  @IsString()
  @Length(1, 50)
  name!: string;
}
