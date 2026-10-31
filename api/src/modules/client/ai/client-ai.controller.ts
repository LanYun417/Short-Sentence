/**
 * 客户端 AI 控制器（/api/client/ai）。
 * 权限口径：需登录（client 令牌）；响应为 SSE 流，跳过统一响应体包装（@RawResponse）。
 *
 * 为什么不用 @Sse()：NestJS 的 @Sse 只支持 GET（EventSource 语义），
 * 而 AI 生成必须 POST（输入体较长、且不想把用户输入暴露在 URL）。
 * 故用 @Res() 手动写 SSE，并把三个反代友好头带上（X-Accel-Buffering 防缓冲）。
 */
import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import { AiQuotaService, type AiQuotaUsage } from '../../../common/ai/ai-quota.service.js';
import { RawResponse } from '../../../common/http/response.interceptor.js';
import type { ClientUserContext } from '../../../common/types.js';
import { ClientAiService, type SseFrame } from './client-ai.service.js';
import { ClientAnalyzeDto, ClientExpandDto, ClientWordRootDto } from './dto.js';

@Controller('client/ai')
export class ClientAiController {
  constructor(
    private readonly clientAi: ClientAiService,
    private readonly aiQuota: AiQuotaService,
  ) {}

  /** 今日 AI 额度（前端展示「剩余 N 次」并在用尽前置灰按钮）。 */
  @Get('quota')
  quota(@CurrentClientUser() user: ClientUserContext): Promise<AiQuotaUsage> {
    return this.aiQuota.usage(user.userId);
  }

  /** 场景延展造句（SSE）。 */
  @Post('expand')
  @RawResponse()
  async expand(
    @CurrentClientUser() user: ClientUserContext,
    @Body() dto: ClientExpandDto,
    @Res() res: Response,
  ): Promise<void> {
    // 额度必须在写 SSE 头之前扣：超限直接抛 429，前端拿到的是正常 JSON 错误（而不是半截流）
    await this.aiQuota.consume(user.userId, 'expand');
    this.writeSse(res, this.clientAi.expandStream(user.userId, dto.chinese, dto.sentenceId));
  }

  /** 词根词缀拆解（SSE）。 */
  @Post('word-root')
  @RawResponse()
  async wordRoot(
    @CurrentClientUser() user: ClientUserContext,
    @Body() dto: ClientWordRootDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.aiQuota.consume(user.userId, 'word_root');
    this.writeSse(res, this.clientAi.wordRootStream(user.userId, dto.word, dto.sentenceId));
  }

  /**
   * 题目解析（SSE）：答题后无论对错都可调用，讲解语法与词形。
   *
   * **不占用「AI 拓展」额度**：解析是答题的配套学习环节（每题都要给），
   * 与用户主动发起的 expand / word-root 不是一类；因此这里不 consume 额度，仅落日志。
   * 若日后要控成本，在此加 `await this.aiQuota.consume(user.userId, 'analysis')` 即可。
   */
  @Post('analyze')
  @RawResponse()
  async analyze(
    @CurrentClientUser() user: ClientUserContext,
    @Body() dto: ClientAnalyzeDto,
    @Res() res: Response,
  ): Promise<void> {
    // 句子查找失败会在此抛 404（写 SSE 头之前），前端拿到的是正常 JSON 错误
    const stream = await this.clientAi.analyzeStream({
      userId: user.userId,
      sentenceId: dto.sentenceId,
    });
    this.writeSse(res, stream);
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
        // SSE 规范：data 字段可跨多行，每行各带一个 `data: ` 前缀（空行才是帧分隔符）。
        // AI 解析是分点文本、含换行，必须逐行加前缀——否则换行之后的内容会被前端丢弃
        // （前端按行读，只认以 data: 开头的行）。单行 payload（expand / word-root）走同一路径，
        // split 后只有一行，行为与旧写法完全一致。
        const payload = frame.data
          .split('\n')
          .map((line) => `data: ${line}`)
          .join('\n');
        res.write(`event: ${frame.event ?? 'message'}\n${payload}\n\n`);
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
