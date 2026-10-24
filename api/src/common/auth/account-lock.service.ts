/**
 * 登录防爆破：按**账号**维度的失败锁定。
 *
 * 与 {@link LoginRateLimiterService} 的关系（两者互补，都开着）：
 * - 那个按 **IP**：挡「一个 IP 到处试不同账号」；
 * - 这个按 **账号**：挡「很多 IP 盯同一个账号」（换 IP 即可绕过按 IP 的限流）。
 *
 * ⚠️ 已知取舍：按账号锁定意味着攻击者可以故意输错密码把某个账号**拒之门外**（DoS）。
 * 缓解：锁定时长只有 15 分钟、文案不透露账号是否存在、且登录成功后立即清零。
 * 对「防止口令被猜出」而言这个取舍是值得的。
 *
 * 降级口径同限流服务：Redis 优先，未配置/异常时回退进程内 Map（单实例够用）。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../exception/app.exception.js';
import { config } from '../config/config.js';
import { RedisService } from '../redis/redis.service.js';

/** 计数键前缀（scope 区分 admin / client，避免两套用户表互相误伤）。 */
const FAIL_PREFIX = 'auth:account:fail:';
/** 锁定键前缀。 */
const LOCK_PREFIX = 'auth:account:locked:';

/** 进程内回退存储。 */
const memoryFail = new Map<string, { failures: number; expiresAt: number }>();
const memoryLock = new Map<string, number>();

/** 清理过期的进程内计数。 */
function cleanupMemory(): void {
  const now = Date.now();
  for (const [key, value] of memoryFail) {
    if (value.expiresAt < now) {
      memoryFail.delete(key);
    }
  }
  for (const [key, expiresAt] of memoryLock) {
    if (expiresAt < now) {
      memoryLock.delete(key);
    }
  }
}

@Injectable()
export class AccountLockService {
  constructor(private readonly redis: RedisService) {}

  /** 锁定时长（毫秒）。 */
  private get lockMs(): number {
    return config.security.accountLockMinutes * 60 * 1000;
  }

  /**
   * 检查账号是否被锁定；锁定中抛 429。
   * @param scope 用户体系（admin / client）
   * @param identity 账号标识（用户名 / 邮箱，调用方负责小写归一化）
   */
  async assertNotLocked(scope: string, identity: string): Promise<void> {
    if (await this.isLocked(scope, identity)) {
      throw AppException.tooManyRequests(`登录失败次数过多，请 ${config.security.accountLockMinutes} 分钟后再试`);
    }
  }

  /** 记录一次失败；达到阈值则锁定该账号。 */
  async recordFailure(scope: string, identity: string): Promise<void> {
    const key = this.key(FAIL_PREFIX, scope, identity);

    if (this.redis.isReady()) {
      const count = await this.redis.incrWithTtl(key, this.lockMs);
      if (count >= config.security.accountFailLimit) {
        await this.redis.set(this.key(LOCK_PREFIX, scope, identity), '1', this.lockMs);
        await this.redis.del(key);
      }
      return;
    }

    cleanupMemory();
    const entry = memoryFail.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      memoryFail.set(key, { failures: 1, expiresAt: Date.now() + this.lockMs });
      return;
    }
    entry.failures += 1;
    if (entry.failures >= config.security.accountFailLimit) {
      memoryLock.set(this.key(LOCK_PREFIX, scope, identity), Date.now() + this.lockMs);
      memoryFail.delete(key);
    }
  }

  /** 登录成功：清零该账号的计数与锁定。 */
  async clear(scope: string, identity: string): Promise<void> {
    if (this.redis.isReady()) {
      await this.redis.del(this.key(FAIL_PREFIX, scope, identity));
      await this.redis.del(this.key(LOCK_PREFIX, scope, identity));
      return;
    }
    memoryFail.delete(this.key(FAIL_PREFIX, scope, identity));
    memoryLock.delete(this.key(LOCK_PREFIX, scope, identity));
  }

  /** 是否处于锁定期。 */
  private async isLocked(scope: string, identity: string): Promise<boolean> {
    const key = this.key(LOCK_PREFIX, scope, identity);
    if (this.redis.isReady()) {
      return (await this.redis.get(key)) !== null;
    }
    cleanupMemory();
    const until = memoryLock.get(key);
    return until !== undefined && until > Date.now();
  }

  /** 组合键（scope + 小写化标识，避免大小写差异绕过锁定）。 */
  private key(prefix: string, scope: string, identity: string): string {
    return `${prefix}${scope}:${identity.trim().toLowerCase()}`;
  }
}
