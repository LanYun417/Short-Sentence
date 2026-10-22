/**
 * 并发控制与重试（零第三方依赖）。
 * 模块职责：为外部 AI 调用提供信号量限流与指数退避重试——
 * NVIDIA（约 40 RPM）与 Agnes 都有频率限制，裸并发会大面积 429。
 */

/** 信号量：限制同时进行的异步任务数。 */
export class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  /** 占用一个执行位（达到上限时排队等待）。 */
  async acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active += 1;
  }

  /** 释放一个执行位并唤醒等待者。 */
  release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  /**
   * 在信号量保护下执行任务（异常也保证释放）。
   * @param task 任务体
   */
  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }
}

/** 指数退避延时（毫秒）：base * 2^(attempt-1)，封顶 maxMs。 */
export function backoffDelay(attempt: number, baseMs = 1000, maxMs = 30_000): number {
  const raw = baseMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(raw, maxMs);
}

/** 通用延时。 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 重试选项。 */
export interface RetryOptions {
  /** 最大尝试次数（含首次，至少 1） */
  maxAttempts: number;
  /** 退避基期（毫秒） */
  baseDelayMs?: number;
  /** 退避封顶（毫秒） */
  maxDelayMs?: number;
  /** 是否重试的判定（默认仅 AiProviderError 且 retryable=true） */
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * 带指数退避的执行。
 * @param task 任务体（入参为第几次尝试，从 1 开始）
 * @param options 重试选项
 */
export async function withRetry<T>(task: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts);
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const shouldRetry =
    options.shouldRetry ??
    ((error: unknown): boolean =>
      error instanceof Error && 'retryable' in error && (error as { retryable?: boolean }).retryable === true);

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      await delay(backoffDelay(attempt, baseDelayMs, maxDelayMs));
    }
  }
  // 理论上不可达（循环内要么 return 要么 throw），兜底抛最后一次错误
  throw lastError;
}
