/**
 * 成长体系后台 DTO（/api/gamify）。
 */
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** 成就分组（与 schema 注释一致）。 */
export const ACHIEVEMENT_CATEGORIES: string[] = ['persist', 'behavior', 'luck'];

/**
 * 后台编辑成就展示字段。
 * code 是主键 + 判定映射键（ACHIEVEMENT_CONDITIONS），不开放修改；
 * 也不开放新增/删除——判定逻辑是硬编码在代码里的，后台凭空加一条没有判定、永远不解锁。
 */
export class UpdateAchievementDto {
  /** 成就名称 */
  @IsOptional()
  @IsString({ message: '名称必须是字符串' })
  @MinLength(1, { message: '名称不能为空' })
  @MaxLength(50, { message: '名称最长 50 字' })
  name?: string;

  /** 达成条件描述（展示给用户） */
  @IsOptional()
  @IsString({ message: '描述必须是字符串' })
  @MaxLength(200, { message: '描述最长 200 字' })
  description?: string;

  /** 图标（lucide 图标名，前端拼 i-lucide-*；改之前确认名字在 lucide 里真实存在） */
  @IsOptional()
  @IsString({ message: '图标必须是字符串' })
  @MinLength(1, { message: '图标不能为空' })
  @MaxLength(100, { message: '图标名最长 100 字符' })
  icon?: string;

  /** 分组：persist 坚持 / behavior 行为 / luck 运气 */
  @IsOptional()
  @IsIn(ACHIEVEMENT_CATEGORIES, { message: '分组不合法' })
  category?: string;

  /** 解锁奖励经验值（0 = 无奖励） */
  @IsOptional()
  @IsInt({ message: '奖励 XP 必须是整数' })
  @Min(0, { message: '奖励 XP 不能为负' })
  @Max(10000, { message: '奖励 XP 最多 10000' })
  rewardXp?: number;

  /** 排序（升序） */
  @IsOptional()
  @IsInt({ message: '排序必须是整数' })
  @Min(0, { message: '排序不能为负' })
  sort?: number;
}

/**
 * 后台手动补偿 XP。
 *
 * 设计红线「只加不减」：amount 必须为正，不提供扣减入口——
 * 一旦用户会「失去」经验就会焦虑流失（见 gamify.prisma 红线说明）。
 */
export class GrantXpDto {
  /** 目标用户邮箱（client_user.email 唯一） */
  @IsEmail({}, { message: '请输入合法的用户邮箱' })
  email!: string;

  /** 补偿经验值（恒为正；绕过每日上限——这是运营的主动行为，不是事件驱动的刷量） */
  @IsInt({ message: '经验值必须是整数' })
  @Min(1, { message: '补偿经验值至少 1' })
  @Max(100000, { message: '单次补偿最多 100000' })
  amount!: number;

  /** 补偿原因（写入账本 remark，审计必填） */
  @IsString({ message: '原因必须是字符串' })
  @MinLength(2, { message: '请填写补偿原因（至少 2 字）' })
  @MaxLength(200, { message: '原因最长 200 字' })
  reason!: string;
}
