/**
 * AI 私教（客户端）：自适应薄弱点画像 + 可选 AI 点评。
 *
 * 设计要点（刻意做成「AI 不可用时功能依然完整」）：
 * - **画像纯计算、零 AI 成本、始终可用**：从 sentence_record 聚合出按场景正确率、
 *   易错题、到期复习数，再由规则引擎生成今日复习计划。密钥缺失、预算打满、
 *   额度用尽都不影响这一层。
 * - **AI 点评是可拨高的增强**：一次性非流式生成（前端一个 POST 即可），
 *   走每人每日额度 + 全局预算双闸 + ai_call_log 留痕；任何失败都降级为规则文案，
 *   绝不把 5xx 抛给客户端。
 * - 不改动 ClientAiService（其构造函数被单测直接实例化），故独立成 service/controller。
 */
import { Injectable, Logger } from '@nestjs/common';
import { config } from '../../../common/config/config.js';
import { AiBudgetService } from '../../../common/ai/ai-budget.service.js';
import { AiCallLogService } from '../../../common/ai/ai-call-log.service.js';
import { AiQuotaService } from '../../../common/ai/ai-quota.service.js';
import { AiSettingsService } from '../../../common/ai/ai-settings.service.js';
import { resolveTextChannel } from '../../../common/ai/ai.config.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

const DAY = 24 * 60 * 60 * 1000;
/** 画像只回看最近 30 天（与 sentence_record 的保留窗口一致），并限制单次扫描行数。 */
const PROFILE_WINDOW_DAYS = 30;
const PROFILE_MAX_ROWS = 3000;
/** 点评是短文本，没必要用生题的 16000 上限；但必须显式带 max_tokens 防截断。 */
const ADVICE_MAX_TOKENS = 500;

/** 单个场景的掌握度。 */
export interface CoachCategory {
  categoryId: number;
  name: string;
  total: number;
  correct: number;
  /** 0..1 */
  accuracy: number;
}

/** 反复答错的题（只给中文题干，不下发答案，与抽题口径一致）。 */
export interface CoachToughSentence {
  sentenceId: number;
  translationZh: string;
  wrongCount: number;
}

/** 薄弱点画像 + 今日复习计划。 */
export interface CoachProfile {
  totalAnswers: number;
  correctAnswers: number;
  /** 0..1 */
  accuracy: number;
  todayAnswers: number;
  /** 今日到期需复习的题数 */
  dueToday: number;
  /** 连续打卡天数 */
  streak: number;
  /** 正确率最低的若干场景（至少答过 3 次才纳入，避免样本太少误判） */
  weakCategories: CoachCategory[];
  toughSentences: CoachToughSentence[];
  /** 规则引擎生成的今日复习计划（始终可用） */
  plan: string[];
  /** 一句话重点 */
  focus: string;
  /** AI 点评是否可用（密钥已配置）；前端据此决定是否展示「生成点评」 */
  aiAvailable: boolean;
}

/** 私教点评；source=rule 表示 AI 降级为规则文案。 */
export interface CoachAdvice {
  text: string;
  source: 'ai' | 'rule';
}

@Injectable()
export class ClientCoachService {
  private readonly logger = new Logger(ClientCoachService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiQuota: AiQuotaService,
    private readonly aiBudget: AiBudgetService,
    private readonly aiCallLog: AiCallLogService,
    private readonly aiSettings: AiSettingsService,
  ) {}

  /** 薄弱点画像（纯计算，不调用 AI）。 */
  async profile(userId: number): Promise<CoachProfile> {
    const uid = BigInt(userId);
    const now = Date.now();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const since = new Date(now - PROFILE_WINDOW_DAYS * DAY);

    const [records, categories, dueRows, latestCheckin] = await Promise.all([
      this.prisma.sentenceRecord.findMany({
        where: { userId: uid, createdAt: { gte: since } },
        select: {
          isCorrect: true,
          createdAt: true,
          sentence: { select: { id: true, categoryId: true, translationZh: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: PROFILE_MAX_ROWS,
      }),
      this.prisma.sentenceCategory.findMany({
        where: { status: 1 },
        select: { id: true, name: true, sort: true },
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      }),
      // 到期复习：与 getMemoryStats 同口径（答对记录的最新排期在今天结束前）
      this.prisma.sentenceRecord.findMany({
        where: { userId: uid, isCorrect: 1, nextReviewAt: { lte: endOfToday } },
        select: { sentenceId: true, nextReviewAt: true },
        orderBy: { nextReviewAt: 'asc' },
      }),
      this.prisma.userCheckin.findFirst({
        where: { userId: uid },
        orderBy: { checkinDate: 'desc' },
        select: { streak: true },
      }),
    ]);

    // 到期数按 sentenceId 去重（同题多次答对只算一张到期卡）
    const dueSet = new Set<number>();
    for (const r of dueRows) dueSet.add(Number(r.sentenceId));

    const totalAnswers = records.length;
    const correctAnswers = records.filter((r) => r.isCorrect === 1).length;
    const accuracy = totalAnswers ? correctAnswers / totalAnswers : 0;
    const todayAnswers = records.filter((r) => r.createdAt.getTime() >= todayStart.getTime()).length;

    // 按场景聚合（题已物理删除的记录 sentence 为 null，跳过）
    const categoryAgg = new Map<number, { total: number; correct: number }>();
    // 易错题：按句子统计答错次数
    const wrongAgg = new Map<number, { count: number; translationZh: string }>();
    for (const r of records) {
      const s = r.sentence;
      if (!s) continue;
      const cid = Number(s.categoryId);
      const agg = categoryAgg.get(cid) ?? { total: 0, correct: 0 };
      agg.total += 1;
      if (r.isCorrect === 1) agg.correct += 1;
      categoryAgg.set(cid, agg);

      if (r.isCorrect === 0) {
        const sid = Number(s.id);
        const w = wrongAgg.get(sid) ?? { count: 0, translationZh: s.translationZh };
        w.count += 1;
        wrongAgg.set(sid, w);
      }
    }

    const nameOf = new Map(categories.map((c) => [Number(c.id), c.name]));
    const weakCategories: CoachCategory[] = [...categoryAgg.entries()]
      .filter(([, agg]) => agg.total >= 3) // 样本太少不判薄弱
      .map(([cid, agg]) => ({
        categoryId: cid,
        name: nameOf.get(cid) ?? '其他场景',
        total: agg.total,
        correct: agg.correct,
        accuracy: agg.correct / agg.total,
      }))
      .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
      .slice(0, 3)
      .filter((c) => c.accuracy < 0.8); // 正确率 80% 以上不算薄弱

    const toughSentences: CoachToughSentence[] = [...wrongAgg.entries()]
      .map(([sid, w]) => ({ sentenceId: sid, translationZh: w.translationZh, wrongCount: w.count }))
      .sort((a, b) => b.wrongCount - a.wrongCount)
      .slice(0, 3);

    const dueToday = dueSet.size;
    const streak = latestCheckin?.streak ?? 0;
    const { plan, focus } = this.buildPlan({
      totalAnswers,
      accuracy,
      todayAnswers,
      dueToday,
      weakCategories,
      toughSentences,
    });

    return {
      totalAnswers,
      correctAnswers,
      accuracy: Number(accuracy.toFixed(3)),
      todayAnswers,
      dueToday,
      streak,
      weakCategories,
      toughSentences,
      plan,
      focus,
      aiAvailable: resolveTextChannel(this.aiSettings.current).apiKey.trim().length > 0,
    };
  }

  /**
   * AI 私教点评：任何不可用的情况（密钥缺失 / 预算 / 额度 / 上游异常）
   * 都降级成规则文案，永远 200，不阻断客户端。
   */
  async advice(userId: number): Promise<CoachAdvice> {
    const profile = await this.profile(userId);
    const rule = this.ruleAdvice(profile);
    if (!profile.aiAvailable) {
      return { text: rule, source: 'rule' };
    }

    const channel = resolveTextChannel(this.aiSettings.current);
    const startedAt = Date.now();
    let quotaConsumed = false;
    try {
      // 双闸：预算先判（超预算不写日志、不扣额度），再扣每人额度
      await this.aiBudget.assertWithinBudget();
      await this.aiQuota.consume(userId, 'coach');
      quotaConsumed = true;

      const response = await fetch(`${channel.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${channel.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: channel.model,
          messages: [
            {
              role: 'system',
              content: [
                '你是温柔但专业的英语口语私教，面向中文母语的学习者。',
                '基于学员的练习数据给一段 2~3 句的中文点评：先肯定具体进步，再点出最该补的一个点，',
                '最后给一个今天就能执行的小行动。要具体、不说空话、不用 markdown、不要列表、不要标题，',
                '不要出现"作为 AI"之类的措辞。整体不超过 120 字。',
              ].join(''),
            },
            { role: 'user', content: this.profileSummary(profile) },
          ],
          temperature: 0.7,
          stream: false,
          // 生文必须显式带 max_tokens，否则 reasoning 模型容易截断整段输出
          max_tokens: Math.min(config.ai.maxOutputTokens, ADVICE_MAX_TOKENS),
        }),
        signal: AbortSignal.timeout(config.ai.requestTimeoutMs),
      });
      if (!response.ok) {
        throw new Error(`上游返回 ${response.status}`);
      }
      const body = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string | null; reasoning_content?: string | null };
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      // reasoning 模型会把正文放在 reasoning_content、content 为 null
      const message = body.choices?.[0]?.message;
      const text = (message?.content?.trim() || message?.reasoning_content?.trim() || '').slice(0, 400);
      if (!text) {
        throw new Error('上游返回空文本');
      }
      await this.aiCallLog.record({
        type: 'coach_advice',
        provider: channel.channel === 'nim' ? 'nvidia' : 'agnes',
        model: channel.model,
        bizId: userId,
        promptTokens: body.usage?.prompt_tokens ?? 0,
        completionTokens: body.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - startedAt,
        status: 'success',
      });
      return { text, source: 'ai' };
    } catch (error) {
      this.logger.warn(`[Coach] 点评降级: ${error instanceof Error ? error.message : String(error)}`);
      if (quotaConsumed) {
        await this.aiQuota.refund(userId); // 没有产出，不白扣用户额度
      }
      // 预算闸门主动抛错时不写失败日志（与 provider 约定一致）
      const overBudget = error instanceof Error && error.message.includes('预算上限');
      if (!overBudget) {
        await this.aiCallLog.record({
          type: 'coach_advice',
          provider: channel.channel === 'nim' ? 'nvidia' : 'agnes',
          model: channel.model,
          bizId: userId,
          latencyMs: Date.now() - startedAt,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
      return { text: rule, source: 'rule' };
    }
  }

  /** 规则引擎：把画像转成今日可执行的复习计划（AI 不可用时这层就是全部价值）。 */
  private buildPlan(args: {
    totalAnswers: number;
    accuracy: number;
    todayAnswers: number;
    dueToday: number;
    weakCategories: CoachCategory[];
    toughSentences: CoachToughSentence[];
  }): { plan: string[]; focus: string } {
    const plan: string[] = [];
    if (args.totalAnswers === 0) {
      return {
        plan: ['还没有练习记录，先做 5 题让私教认识你。', '答对后会按 1/3/7/15/30 天自动安排复习。'],
        focus: '从第一句开始，今天先练 5 题',
      };
    }
    if (args.dueToday > 0) {
      plan.push(`先清掉 ${args.dueToday} 张到期复习卡，趁记忆还热。`);
    }
    if (args.weakCategories.length > 0) {
      const w = args.weakCategories[0];
      plan.push(`重点补「${w.name}」：正确率 ${Math.round(w.accuracy * 100)}%，今天挑 5 题专项练。`);
    }
    if (args.toughSentences.length > 0) {
      const t = args.toughSentences[0];
      plan.push(`「${t.translationZh}」错了 ${t.wrongCount} 次，单独默写一遍。`);
    }
    if (args.todayAnswers === 0) {
      plan.push('今天还没开张，先来 5 题找回手感。');
    }
    if (plan.length === 0) {
      plan.push('暂无到期复习，保持节奏做几题新句吧。', '答对的题会按间隔重复自动回来找你。');
    }
    const pct = Math.round(args.accuracy * 100);
    const focus =
      args.dueToday > 0
        ? `今天先复习 ${args.dueToday} 张卡`
        : args.weakCategories.length > 0
          ? `主攻「${args.weakCategories[0].name}」`
          : `整体正确率 ${pct}%，稳住节奏`;
    return { plan: plan.slice(0, 4), focus };
  }

  /** 降级文案：把规则计划串成一段口语化的私教话术。 */
  private ruleAdvice(profile: CoachProfile): string {
    const pct = Math.round(profile.accuracy * 100);
    const head =
      profile.totalAnswers === 0
        ? '还没开始没关系，今天练 5 题，我就能给你排出专属复习节奏。'
        : `最近 ${profile.totalAnswers} 次练习正确率 ${pct}%，连续打卡 ${profile.streak} 天，这个节奏挺稳。`;
    return `${head}${profile.plan.join('')}`;
  }

  /** 喂给模型的画像摘要（只含统计，不带用户身份信息）。 */
  private profileSummary(p: CoachProfile): string {
    const weak =
      p.weakCategories.map((c) => `${c.name}：${c.correct}/${c.total} 正确`).join('；') || '暂无明显薄弱场景';
    const tough = p.toughSentences.map((t) => `「${t.translationZh}」错 ${t.wrongCount} 次`).join('；') || '无反复错题';
    return [
      `累计作答 ${p.totalAnswers} 次，正确率 ${Math.round(p.accuracy * 100)}%，连续打卡 ${p.streak} 天。`,
      `今日已答 ${p.todayAnswers} 次，到期待复习 ${p.dueToday} 题。`,
      `薄弱场景：${weak}。`,
      `易错题：${tough}。`,
    ].join('');
  }
}
