import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ADVANCED } from '../src/common/ai/ai-protocol.js';
import { Observable, of } from 'rxjs';
import { ClientAiService, type SseFrame } from '../src/modules/client/ai/client-ai.service.js';

/** 构造一个只实现本用例用到方法的假 Prisma。 */
function makeService(explanation: string | null): {
  service: ClientAiService;
  updateMany: ReturnType<typeof vi.fn>;
} {
  const updateMany = vi.fn(async (_args: { where: unknown; data: { explanation: string } }) => ({ count: 1 }));
  const prisma = {
    sentence: {
      findFirst: vi.fn(async () => ({
        sentenceEn: 'I have been waiting for 20 minutes.',
        translationZh: '我已经等了 20 分钟了。',
        explanation,
      })),
      updateMany,
    },
  };
  const aiCallLog = { record: vi.fn(async () => undefined) };
  const aiQuota = { refund: vi.fn(async () => undefined) };
  const aiSettings = {
    current: {
      models: [
        {
          id: 'text-1',
          purpose: 'text',
          enabled: true,
          format: 'openai_chat',
          fullUrl: false,
          baseUrl: 'https://example.com/v1',
          modelId: 'm',
          modelLabel: '',
          apiKey: 'test-key',
          advanced: { ...DEFAULT_ADVANCED },
        },
      ],
    },
  };
  const service = new ClientAiService(aiCallLog as never, aiQuota as never, prisma as never, aiSettings as never);
  return { service, updateMany };
}

/** 用固定帧替换真实的流式调用（避免单测打外网）。 */
function stubStream(service: ClientAiService, frames: SseFrame[]): void {
  (service as unknown as { streamChat: () => Observable<SseFrame> }).streamChat = () => of(...frames);
}

/** 订阅到结束。 */
function drain(stream: Observable<SseFrame>): Promise<void> {
  return new Promise((resolve) => stream.subscribe({ complete: () => resolve() }));
}

/**
 * 老题解析的「实时生成 → 写回库」逻辑。
 *
 * 关键边界：只有**正常收到 done 帧**才允许入库——客户端切题/断连时上游被 abort，
 * 流会以 complete() 收尾，若不加判断就会把半截解析写进全站共享的 explanation。
 */
describe('analyzeStream 解析入库', () => {
  it('正常结束后把累积文本写回 explanation（条件更新：只填空值）', async () => {
    const { service, updateMany } = makeService(null);
    stubStream(service, [{ data: '· 主句' }, { data: '是现在完成时' }, { event: 'done', data: '[DONE]' }]);

    await drain(await service.analyzeStream({ userId: 1, sentenceId: 7 }));
    await vi.waitFor(() => expect(updateMany).toHaveBeenCalledTimes(1));

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: BigInt(7), OR: [{ explanation: null }, { explanation: '' }] },
      data: { explanation: '· 主句是现在完成时' },
    });
  });

  it('没收到 done 帧（客户端中止 / 上游失败）不写库', async () => {
    const { service, updateMany } = makeService(null);
    stubStream(service, [{ data: '· 半截解析' }]);

    await drain(await service.analyzeStream({ userId: 1, sentenceId: 7 }));
    // finalize 是同步触发的，但 updateMany 是 fire-and-forget，让出一个宏任务再断言
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('题目已有解析时直接下发已有文本，不再调 AI、也不写库', async () => {
    const { service, updateMany } = makeService('已有的题目解析');
    const streamChat = vi.fn();
    (service as unknown as { streamChat: typeof streamChat }).streamChat = streamChat;

    const stream = await service.analyzeStream({ userId: 1, sentenceId: 7 });
    const frames: SseFrame[] = [];
    await new Promise<void>((resolve) =>
      stream.subscribe({ next: (frame) => frames.push(frame), complete: () => resolve() }),
    );

    expect(streamChat).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(frames[0]?.data).toBe('已有的题目解析');
    expect(frames.some((frame) => frame.event === 'done')).toBe(true);
  });

  it('超过 500 字时截断（sentence.explanation 列宽上限）', async () => {
    const { service, updateMany } = makeService(null);
    stubStream(service, [{ data: 'x'.repeat(600) }, { event: 'done', data: '[DONE]' }]);

    await drain(await service.analyzeStream({ userId: 1, sentenceId: 7 }));
    await vi.waitFor(() => expect(updateMany).toHaveBeenCalled());
    const arg = updateMany.mock.calls[0]?.[0] as { data: { explanation: string } };
    expect(arg.data.explanation).toHaveLength(500);
  });
});
