/**
 * 客户端 AI 控制器（/api/client/ai）。
 * 权限口径：需登录（client 令牌）；响应为 SSE 流，跳过统一响应体包装（@RawResponse）。
 *
 * 为什么不用 @Sse()：NestJS 的 @Sse 只支持 GET（EventSource 语义），
 * 而 AI 生成必须 POST（输入体较长、且不想把用户输入暴露在 URL）。
 * 故用 @Res() 手动写 SSE，并把三个反代友好头带上（X-Accel-Buffering 防缓冲）。
 */
import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import { RawResponse } from '../../../common/http/response.interceptor.js';
import type { ClientUserContext } from '../../../common/types.js';
import { ClientAiService, type SseFrame } from './client-ai.service.js';
import { ClientExpandDto, ClientWordRootDto } from './dto.js';

@Controller('client/ai')
export class ClientAiController {
  constructor(private readonly clientAi: ClientAiService) {}

  /** 场景延展造句（SSE）。 */
  @Post('expand')
  @RawResponse()
  expand(@CurrentClientUser() user: ClientUserContext, @Body() dto: ClientExpandDto, @Res() res: Response): void {
    this.writeSse(res, this.clientAi.expandStream(user.userId, dto.chinese, dto.sentenceId));
  }

  /** 词根词缀拆解（SSE）。 */
  @Post('word-root')
  @RawResponse()
  wordRoot(@CurrentClientUser() user: ClientUserContext, @Body() dto: ClientWordRootDto, @Res() res: Response): void {
    this.writeSse(res, this.clientAi.wordRootStream(user.userId, dto.word, dto.sentenceId));
  }

  /** 把 SSE 帧流写到 HTTP 响应（event/data 双行 + 空行分帧）。 */
  private writeSse(res: Response, stream: Observable<SseFrame>): void {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // 反代（Nginx）默认缓冲 SSE，这里显式关闭
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    stream.subscribe({
      next: (frame: SseFrame) => {
        if (res.writableEnded) {
          return;
        }
        res.write(`event: ${frame.event ?? 'message'}\ndata: ${frame.data}\n\n`);
      },
      error: () => {
        if (!res.writableEnded) {
          res.write('event: error\ndata: AI 服务暂时不可用，请稍后重试\n\n');
          res.end();
        }
      },
      complete: () => {
        if (!res.writableEnded) {
          res.end();
        }
      },
    });
  }
}
