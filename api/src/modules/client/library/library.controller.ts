/**
 * 收藏夹 / 复习池控制器（/api/client/favorites、/api/client/review）。
 */
import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import { RawResponse } from '../../../common/http/response.interceptor.js';
import type { ClientUserContext } from '../../../common/types.js';
import { QuestionsService } from '../questions/questions.service.js';

@Controller('client')
export class LibraryController {
  constructor(private readonly questions: QuestionsService) {}

  /**
   * 导出收藏句子为 Anki 可导入的 CSV（英文 / 中文 / 音标，Tab 分隔兼容 Anki 字段）。
   * RawResponse 跳过统一信封，直接以附件下发。
   */
  @Get('favorites/anki.csv')
  @RawResponse()
  async exportAnki(
    @CurrentClientUser() user: ClientUserContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const rows = await this.questions.exportFavoritesForAnki(user.userId);
    // Anki 默认导入的字段分隔符是 Tab；用 CSV 工具转义后再把逗号换 Tab 不合适，
    // 这里直接按 Tab 输出并做最小转义（换行/引号），保证英文句子里的逗号不破坏列。
    const escape = (value: string): string => value.replace(/[\r\n\t]/g, ' ').trim();
    const body = rows.map((r) => `${escape(r.en)}\t${escape(r.zh)}\t${escape(r.ipa)}`).join('\r\n');
    const filename = `short-sentence-anki-${new Date().toISOString().slice(0, 10)}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    // BOM 帮助部分 Anki 客户端/Excel 正确识别 UTF-8 中文
    return `\uFEFF${body}`;
  }

  /** 收藏夹（分页）。 */
  @Get('favorites')
  favorites(@CurrentClientUser() user: ClientUserContext, @Query() query: Record<string, unknown>) {
    return this.questions.listFavorites(user.userId, query);
  }

  /** 复习池（分页：答错且到期的题）。 */
  @Get('review')
  review(@CurrentClientUser() user: ClientUserContext, @Query() query: Record<string, unknown>) {
    return this.questions.listReview(user.userId, query);
  }

  /** 学习记录（全量历史：全部/错题/对题 + 难度/场景/时间范围筛选）。 */
  @Get('history')
  history(@CurrentClientUser() user: ClientUserContext, @Query() query: Record<string, unknown>) {
    return this.questions.listHistory(user.userId, query);
  }
}
