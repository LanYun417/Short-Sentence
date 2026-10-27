/**
 * 产品反馈 DTO（客户端）。
 *
 * 与 `report/dto.ts`（举报某道题）区分：这里是**对产品本身**的意见，
 * 不关联题目，因此多出「联系方式 / 来源端 / 版本」三项，便于回访与定位问题版本。
 */
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** 反馈类型（前后端与端上文案共用同一套值）。 */
export const FEEDBACK_TYPES = ['feature', 'bug', 'content', 'ux', 'other'] as const;

/** 提交产品反馈入参。 */
export class CreateFeedbackDto {
  /**
   * 反馈类型：
   * - feature 功能建议
   * - bug 使用异常
   * - content 内容问题（题目/翻译/词根等）
   * - ux 体验建议（界面、动效、交互）
   * - other 其他
   */
  @IsIn([...FEEDBACK_TYPES], { message: '反馈类型不合法' })
  type!: string;

  /** 反馈内容 */
  @IsString({ message: '反馈内容必须为字符串' })
  @MinLength(5, { message: '请至少写 5 个字，方便我们定位问题' })
  @MaxLength(1000, { message: '反馈内容最长 1000 个字符' })
  content!: string;

  /** 联系方式（可选；邮箱/微信等，便于回访） */
  @IsOptional()
  @IsString({ message: '联系方式必须为字符串' })
  @MaxLength(100, { message: '联系方式最长 100 个字符' })
  contact?: string;

  /** 来源端：web / android（缺省 web） */
  @IsOptional()
  @IsIn(['web', 'android'], { message: '来源端不合法' })
  platform?: string;

  /** 客户端版本（可选；App 上报，便于定位「哪个版本出的问题」） */
  @IsOptional()
  @IsString({ message: '版本号必须为字符串' })
  @MaxLength(30, { message: '版本号最长 30 个字符' })
  appVersion?: string;
}
