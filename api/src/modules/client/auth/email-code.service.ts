/**
 * 邮箱验证码（客户端注册 / 登录 / 重置密码）。
 *
 * 为什么用 Redis 而不是新建表：验证码是「5 分钟就失效的短时凭证」，
 * 落库要额外清理与索引，而项目已有 Redis（限流、登出黑名单、图形验证码都在用）。
 *
 * 两道保险：
 * - 同一邮箱同一用途 **60 秒只能发一次**（`incrWithTtl` 固定窗口，Redis 原子自增，并发也拦得住）；
 * - 验证码 **5 分钟有效**，校验成功立即删除（一次性，防同码复用）。
 */
import { randomInt } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../../common/exception/app.exception.js';
import { RedisService } from '../../../common/redis/redis.service.js';
import { MailService } from '../../../common/mail/mail.service.js';

/** 用途 → 邮件正文里的动作名（对应模板变量 `action`）。 */
const PURPOSE_ACTION = {
  register: '注册',
  login: '登录',
  reset: '重置密码',
  // 注销是不可逆操作，必须二次确认身份（详见 ClientAuthUserService.deleteAccount）
  delete: '注销账号',
} as const;

export type EmailCodePurpose = keyof typeof PURPOSE_ACTION;

/** 验证码有效期 */
const CODE_TTL_MS = 5 * 60 * 1000;
/** 同邮箱同用途的最小发送间隔 */
const THROTTLE_MS = 60 * 1000;

@Injectable()
export class EmailCodeService {
  private readonly logger = new Logger(EmailCodeService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly mail: MailService,
  ) {}

  private codeKey(email: string, purpose: EmailCodePurpose): string {
    return `client:email-code:${purpose}:${email}`;
  }

  /**
   * 生成并发送验证码。
   *
   * @param email 收件邮箱
   * @param purpose 用途（决定 Redis 键与邮件里的动作名）
   */
  async issue(email: string, purpose: EmailCodePurpose): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const throttleKey = `${this.codeKey(normalized, purpose)}:throttle`;
    const count = await this.redis.incrWithTtl(throttleKey, THROTTLE_MS);
    // 0 = Redis 不可用：验证码存不进也校验不了，直接明确报错，不要假装发出去了
    if (count === 0) {
      throw AppException.badRequest('验证码服务暂不可用，请稍后重试');
    }
    if (count > 1) {
      throw AppException.badRequest('验证码已发送，请 60 秒后再试');
    }

    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const saved = await this.redis.set(this.codeKey(normalized, purpose), code, CODE_TTL_MS);
    if (!saved) {
      await this.redis.del(throttleKey);
      throw AppException.badRequest('验证码服务暂不可用，请稍后重试');
    }

    try {
      await this.mail.sendCaptcha(normalized, code, PURPOSE_ACTION[purpose]);
    } catch (error) {
      // 发信失败要立刻放开节流并作废验证码：否则用户白等 60 秒，手里还没有码
      await this.redis.del(throttleKey);
      await this.redis.del(this.codeKey(normalized, purpose));
      throw error;
    }
    this.logger.log(`[EmailCode] 已发送 ${purpose} 验证码 → ${normalized}`);
  }

  /**
   * 校验验证码（不区分「没发过」与「填错了」，统一 false，避免探测）。
   * 校验成功即删除，保证一次性。
   */
  async verify(email: string, purpose: EmailCodePurpose, code: string): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    const key = this.codeKey(normalized, purpose);
    const saved = await this.redis.get(key);
    if (!saved || saved !== code.trim()) {
      return false;
    }
    await this.redis.del(key);
    return true;
  }
}
