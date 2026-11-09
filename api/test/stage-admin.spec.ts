/**
 * 情景闯关后台管理（StageService.adminXxx）单测。
 * 重点钉住：强制结束的状态机、无翻译筛选、概览统计的聚合映射、详情消息完整返回。
 */
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { GamifyService } from '../src/modules/client/gamify/gamify.service.js';
import type { AgnesSentenceProvider } from '../src/common/ai/agnes-sentence.provider.js';
import { StageService } from '../src/modules/client/stage/stage.service.js';

function makeService() {
  const categories = [
    { id: 1n, name: '日常生活' },
    { id: 2n, name: '居家生活' },
  ];
  const sessions: Array<Record<string, unknown>> = [];
  const messages: Array<Record<string, unknown>> = [];
  const progress: Array<Record<string, unknown>> = [];
  const xpLogs: Array<{ eventKey: string }> = [];
  const users = [{ id: 7n, nickname: '小明', xp: 100 }];

  const prisma: any = {
    sentenceCategory: {
      findMany: vi.fn(async () => categories),
      findUnique: vi.fn(async ({ where }: { where: { id: bigint } }) => {
        const hit = categories.find((c) => c.id === where.id);
        return hit ? { name: hit.name } : null;
      }),
    },
    stageDialogueSession: {
      groupBy: vi.fn(async ({ by, where }: { by: string[]; where?: Record<string, unknown> }) => {
        const key = by[0];
        const groups = new Map<
          string,
          { categoryId: bigint; _count: { _all: number }; _avg: { turnCount: number | null } }
        >();
        for (const s of sessions) {
          if (where?.status && s.status !== where.status) continue;
          if (where?.cleared !== undefined && s.cleared !== where.cleared) continue;
          if (where?.translationUsed !== undefined && s.translationUsed !== where.translationUsed) continue;
          const k = String(s[key as 'categoryId']);
          const g = groups.get(k) ?? {
            categoryId: s.categoryId as bigint,
            _count: { _all: 0 },
            _avg: { turnCount: null },
          };
          g._count._all += 1;
          groups.set(k, g);
        }
        // 计算 avg turnCount（仅 cleared 聚合用得到）
        if (where?.cleared) {
          for (const g of groups.values()) {
            const rows = sessions.filter((s) => s.cleared && String(s.categoryId) === String(g.categoryId));
            g._avg.turnCount = rows.reduce((sum, s) => sum + Number(s.turnCount), 0) / rows.length;
          }
        }
        return [...groups.values()];
      }),
      findMany: vi.fn(async ({ where, skip, take }: any) => {
        let rows = sessions.filter((s) => {
          if (where?.categoryId && String(s.categoryId) !== String(where.categoryId)) return false;
          if (where?.status && s.status !== where.status) return false;
          if (where?.userId && String(s.userId) !== String(where.userId)) return false;
          if (where?.cleared !== undefined && s.cleared !== where.cleared) return false;
          if (where?.translationUsed !== undefined && s.translationUsed !== where.translationUsed) return false;
          if (where?.userId?.in && !where.userId.in.some((u: bigint) => String(u) === String(s.userId))) return false;
          return true;
        });
        if (skip) rows = rows.slice(skip);
        if (take) rows = rows.slice(0, take);
        return rows.map((s) => ({
          ...s,
          _count: { messages: messages.filter((m) => String(m.sessionId) === String(s.id)).length },
        }));
      }),
      count: vi.fn(
        async ({ where }: any) =>
          sessions.filter((s) => {
            if (where?.categoryId && String(s.categoryId) !== String(where.categoryId)) return false;
            if (where?.status && s.status !== where.status) return false;
            if (where?.userId && String(s.userId) !== String(where.userId)) return false;
            if (where?.cleared !== undefined && s.cleared !== where.cleared) return false;
            if (where?.translationUsed !== undefined && s.translationUsed !== where.translationUsed) return false;
            return true;
          }).length,
      ),
      findUnique: vi.fn(
        async ({ where }: { where: { id: bigint } }) => sessions.find((s) => String(s.id) === String(where.id)) ?? null,
      ),
      update: vi.fn(async ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = sessions.find((s) => String(s.id) === String(where.id));
        if (row) Object.assign(row, data);
        return row;
      }),
    },
    stageDialogueMessage: {
      findMany: vi.fn(async ({ where }: { where: { sessionId: bigint } }) =>
        messages.filter((m) => String(m.sessionId) === String(where.sessionId)),
      ),
    },
    studyStageProgress: {
      groupBy: vi.fn(async ({ where }: any) => {
        const groups = new Map<string, { categoryId: bigint; _count: { _all: number } }>();
        for (const p of progress) {
          if (where?.dialogueClearedAt?.not === null && !p.dialogueClearedAt) continue;
          const k = String(p.categoryId);
          const g = groups.get(k) ?? { categoryId: p.categoryId as bigint, _count: { _all: 0 } };
          g._count._all += 1;
          groups.set(k, g);
        }
        return [...groups.values()];
      }),
    },
    clientXpLog: {
      findMany: vi.fn(async ({ where }: { where: { eventKey: { startsWith: string } } }) =>
        xpLogs.filter((l) => l.eventKey.startsWith(where.eventKey.startsWith)),
      ),
    },
    clientUser: {
      findMany: vi.fn(async ({ where }: { where: { id?: { in: bigint[] }; nickname?: { contains: string } } }) => {
        if (where.nickname) return users.filter((u) => u.nickname.includes(where.nickname?.contains ?? ''));
        return users.filter((u) => !where.id?.in || where.id.in.some((id) => id === u.id));
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: bigint } }) => users.find((u) => u.id === where.id) ?? null),
    },
    $queryRaw: vi.fn(async () => {
      const groups = new Map<string, number>();
      for (const s of sessions) {
        const k = String(s.categoryId);
        groups.set(k, (groups.get(k) ?? 0) + 1);
      }
      return [...groups.entries()].map(([cid, cnt]) => ({ cid: BigInt(cid), cnt }));
    }),
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };

  const gamify = { awardXp: vi.fn(), checkAchievements: vi.fn() };
  const ai = { stageDialogueTurn: vi.fn(), stageDialogueSummary: vi.fn() };
  const service = new StageService(
    prisma as unknown as PrismaService,
    gamify as unknown as GamifyService,
    ai as unknown as AgnesSentenceProvider,
  );
  return { service, prisma, sessions, messages, progress, xpLogs };
}

describe('情景闯关后台：会话管理', () => {
  it('强制结束：active → ended，且不改 cleared/进度', async () => {
    const { service, sessions } = makeService();
    sessions.push({
      id: 1n,
      categoryId: 1n,
      userId: 7n,
      status: 'active',
      turnCount: 3,
      cleared: false,
      translationUsed: false,
      startedAt: new Date(),
    });
    await service.adminCloseSession(1);
    expect(sessions[0].status).toBe('ended');
    expect(sessions[0].endedAt).toBeTruthy();
    expect(sessions[0].cleared).toBe(false);
  });

  it('强制结束：已结束 / 不存在分别报错', async () => {
    const { service, sessions } = makeService();
    sessions.push({
      id: 2n,
      categoryId: 1n,
      userId: 7n,
      status: 'completed',
      turnCount: 6,
      cleared: true,
      translationUsed: false,
      startedAt: new Date(),
    });
    await expect(service.adminCloseSession(2)).rejects.toThrow(/已结束/);
    await expect(service.adminCloseSession(999)).rejects.toThrow(/不存在/);
  });

  it('会话详情返回完整消息流', async () => {
    const { service, sessions, messages } = makeService();
    sessions.push({
      id: 5n,
      categoryId: 1n,
      userId: 7n,
      status: 'completed',
      turnCount: 6,
      cleared: true,
      translationUsed: true,
      summary: 'ok',
      startedAt: new Date(),
      endedAt: new Date(),
    });
    messages.push(
      {
        id: 1n,
        sessionId: 5n,
        role: 'npc',
        speaker: 'Maya',
        contentEn: 'Hi',
        contentZh: '你好',
        createdAt: new Date(),
      },
      {
        id: 2n,
        sessionId: 5n,
        role: 'user',
        speaker: null,
        contentEn: 'Hello',
        contentZh: null,
        createdAt: new Date(),
      },
    );
    const detail = await service.adminSessionDetail(5);
    expect(detail.nickname).toBe('小明');
    expect(detail.stageTitle).toBe('便利店的清晨');
    expect(detail.messages).toHaveLength(2);
    expect(detail.messages[0].contentZh).toBe('你好');
  });

  it('会话列表：noTranslation=1 只返回「已通关且未用过翻译」', async () => {
    const { service, sessions } = makeService();
    sessions.push({
      id: 1n,
      categoryId: 1n,
      userId: 7n,
      status: 'completed',
      turnCount: 6,
      cleared: true,
      translationUsed: false,
      startedAt: new Date(),
    });
    sessions.push({
      id: 2n,
      categoryId: 1n,
      userId: 7n,
      status: 'completed',
      turnCount: 6,
      cleared: true,
      translationUsed: true,
      startedAt: new Date(),
    });
    sessions.push({
      id: 3n,
      categoryId: 1n,
      userId: 7n,
      status: 'active',
      turnCount: 2,
      cleared: false,
      translationUsed: false,
      startedAt: new Date(),
    });
    const { list, total } = await service.adminSessionList({ noTranslation: '1' });
    expect(total).toBe(1);
    expect(list[0].id).toBe(1);
  });

  it('概览：聚合参与/通关/无翻译/待领奖', async () => {
    const { service, sessions, progress, xpLogs } = makeService();
    sessions.push({
      id: 1n,
      categoryId: 1n,
      userId: 7n,
      status: 'completed',
      turnCount: 8,
      cleared: true,
      translationUsed: false,
      startedAt: new Date(),
    });
    sessions.push({
      id: 2n,
      categoryId: 1n,
      userId: 8n,
      status: 'active',
      turnCount: 2,
      cleared: false,
      translationUsed: true,
      startedAt: new Date(),
    });
    progress.push({ categoryId: 1n, dialogueClearedAt: new Date() });
    xpLogs.push({ eventKey: 'stage:7:1' });
    const chapters = await service.adminOverview();
    const stage = chapters.flatMap((c) => c.stages).find((s) => s.id === 1);
    expect(stage?.participantCount).toBe(2);
    expect(stage?.clearedCount).toBe(1);
    expect(stage?.clearedSessionCount).toBe(1);
    expect(stage?.avgClearedTurns).toBe(8);
    expect(stage?.noTranslationClearedCount).toBe(1);
    expect(stage?.claimableCount).toBe(0); // 1 通关 - 1 已领 = 0
    expect(stage?.activeSessionCount).toBe(1);
  });
});
