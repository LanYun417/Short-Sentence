/**
 * 刷题 DTO（客户端）。
 */
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * 作答模式：
 * - input    默写（自己敲出整句，默认）
 * - assemble 拼词（点选词块拼成句子，见 /questions/next 下发的 words）
 * - listen   听力（不显示中文题干，先听发音再默写——与同类闪卡最大的差异点）
 */
export const ANSWER_MODES = ['input', 'assemble', 'listen'] as const;
export type AnswerMode = (typeof ANSWER_MODES)[number];

/** 提交答案入参。 */
export class AnswerSentenceDto {
  /** 用户输入的英文 */
  @IsString({ message: '答案必须为字符串' })
  @MaxLength(300, { message: '答案最长 300 个字符' })
  userAnswer!: string;

  /** 作答耗时（毫秒，前端计时；作弊性由上限截断） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '作答耗时必须为整数' })
  @Min(0, { message: '作答耗时不能为负' })
  @Max(3_600_000, { message: '作答耗时异常' })
  elapsedMs?: number;

  /**
   * 作答模式（缺省按 input 处理）。
   * 只上报「这次是怎么作答的」，**不传经验值**——经验仍由服务端按模式选规则发放：
   * 拼词模式的答案就在选项里，识别难度低于默写，故按约六成计算（见 XP_RULES）。
   */
  @IsOptional()
  @IsIn([...ANSWER_MODES], { message: '作答模式不合法' })
  mode?: AnswerMode;
}

/**
 * 抽题查询入参。
 *
 * 拼词词块（`words`）现由服务端**恒定下发**，故不再需要 `mode` 参数——
 * 客户端切换作答模式时沿用当前题即可，无需重抽（Web / App 一致）。
 * 旧客户端仍会带 `mode`，全局 ValidationPipe 的 whitelist 会静默剥离，不影响兼容。
 */
export class NextQuestionQueryDto {
  /**
   * 目标难度：1 易 / 2 中 / 3 难。
   * 只作用于新题抽取；复习题仍按间隔重复排期走。该难度无可用新题时服务端回落到不限难度。
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '难度必须为整数' })
  @Min(1, { message: '难度最小为 1' })
  @Max(3, { message: '难度最大为 3' })
  difficulty?: number;

  /**
   * 节日题库名（如「春节」）。
   * 传了则只从该节日的**当前题库**抽题（专门刷题）；不传走日常混抽。
   */
  @IsOptional()
  @IsString({ message: '节日名必须为字符串' })
  @MaxLength(50, { message: '节日名过长' })
  festival?: string;

  /**
   * 场景分类 id。
   * 传了则只从该场景的题库抽题（专门刷题，与 festival 互斥、festival 优先）；不传走日常混抽。
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '分类 id 必须为整数' })
  @Min(1, { message: '分类 id 最小为 1' })
  categoryId?: number;

  /**
   * 抽题来源偏好：`review` 只抽到期复习题（不掺新题）/ `new` 只抽新题。
   * 不传走「日常混抽」（按 newRatio 概率二选一）。
   *
   * 存在的理由：复习要成串才有效果——用户从「今日待复习 N」点进来时，
   * 期待一路都是到期复习题；若混入新题，一次只刷一两张就散掉，
   * 记忆曲线的安排就被冲掉了。festival / categoryId 仍优先于此参数。
   */
  @IsOptional()
  @IsIn(['review', 'new'], { message: 'source 只支持 review / new' })
  source?: 'review' | 'new';
}
