/**
 * 微信支付回调控制器（/api/pay/notify/wechat）。
 *
 * 权限口径：`@Public()`——回调来自微信服务器，不带我们的令牌；安全性由**验签**保证
 * （平台证书 RSA-SHA256 + 5 分钟时间戳防重放），在服务层完成。
 *
 * 响应契约（与全局「成功恒 200」不同，**刻意例外**）：
 * - 必须回微信要求的真实 HTTP 码：200 + `{code:"SUCCESS"}` 才会停止重试；
 * - 4xx/5xx 会触发微信按策略重试，故验签失败回 401、报文异常回 400、入账失败回 500；
 * - 用 `@Res()` 手写响应以绕开 OkExpressAdapter 的 200 固定化（与 CSV 导出同一机制）。
 */
import { Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/auth/auth.guard.js';
import { RawResponse } from '../../common/http/response.interceptor.js';
import { PayOrderService } from '../../common/pay/pay-order.service.js';

/** 带 rawBody 的请求（由 app.setup.ts 的 body parser verify 钩子填充）。 */
interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@Controller('pay/notify')
export class PayNotifyController {
  constructor(private readonly payOrders: PayOrderService) {}

  /** 微信支付结果通知（验签 → 解密 → 入账；重复通知幂等）。 */
  @Post('wechat')
  @Public()
  @RawResponse()
  async wechat(@Req() req: RawBodyRequest, @Res() res: Response): Promise<void> {
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : '';
    if (!rawBody) {
      res.status(400).json({ code: 'FAIL', message: '缺少请求体' });
      return;
    }
    const result = await this.payOrders.handleNotify(req.headers, rawBody);
    res.status(result.statusCode).json(result.body);
  }
}
