/**
 * App 版本管理 DTO（管理端）。
 */
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** 新增 / 编辑 App 版本入参。 */
export class SaveAppVersionDto {
  /** 平台（当前只做 android；ios 预留） */
  @IsOptional()
  @IsIn(['android', 'ios'], { message: '平台仅支持 android / ios' })
  platform?: string;

  /** 版本名（展示用，如 1.2.0） */
  @IsString({ message: '版本号必须为字符串' })
  @MinLength(1, { message: '版本号不能为空' })
  @MaxLength(50, { message: '版本号最长 50 个字符' })
  version!: string;

  /** 版本序号（Android versionCode，越大越新） */
  @Type(() => Number)
  @IsInt({ message: '版本序号必须为整数' })
  @Min(1, { message: '版本序号至少为 1' })
  versionCode!: number;

  /** 安装包文件 id（先调专用上传接口拿到） */
  @Type(() => Number)
  @IsInt({ message: '安装包文件 id 必须为整数' })
  @Min(1, { message: '请先上传安装包' })
  fileId!: number;

  /** 安装包大小（字节；不传则由文件记录兜底） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '文件大小必须为整数' })
  @Min(0, { message: '文件大小不能为负' })
  fileSize?: number;

  /** 更新说明（多行文本） */
  @IsOptional()
  @IsString({ message: '更新说明必须为字符串' })
  @MaxLength(1000, { message: '更新说明最长 1000 个字符' })
  changelog?: string;

  /** 是否强制更新：1 是 / 0 否 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '强制更新标记必须为整数' })
  @Min(0, { message: '强制更新标记只能为 0 或 1' })
  @Max(1, { message: '强制更新标记只能为 0 或 1' })
  forceUpdate?: number;

  /** 状态：1 上架 / 0 下架 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @Min(0, { message: '状态只能为 0 或 1' })
  @Max(1, { message: '状态只能为 0 或 1' })
  status?: number;
}

/** 上下架入参。 */
export class AppVersionStatusDto {
  @Type(() => Number)
  @IsInt({ message: '状态必须为整数' })
  @Min(0, { message: '状态只能为 0 或 1' })
  @Max(1, { message: '状态只能为 0 或 1' })
  status!: number;
}
