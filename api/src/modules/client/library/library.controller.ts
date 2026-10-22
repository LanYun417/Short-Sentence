/**
 * 收藏夹 / 复习池控制器（/api/client/favorites、/api/client/review）。
 */
import { Controller, Get, Query } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import type { ClientUserContext } from '../../../common/types.js';
import { QuestionsService } from '../questions/questions.service.js';

@Controller('client')
export class LibraryController {
  constructor(private readonly questions: QuestionsService) {}

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
}
