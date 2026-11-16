/**
 * 用户端主链路契约（e2e）。
 *
 * 为什么单独一条：既有 e2e 只覆盖「应用装配冒烟」与**后台**契约，而
 * 「登录 → 抽题 → 作答 → 经验/成就 → 收藏/历史」这条直接面向用户的链路
 * 此前**零回归保护**——它坏了没有任何页面会报错，只有用户会流失。
 *
 * ⚠️ 只碰自己造的数据：作答 / 收藏 / 历史 / 清理**一律针对专用测试题**
 * （`E2E_SENTENCE_EN`），绝不使用「当前抽到的那道题」——抽题是随机的，
 * 拿它做断言与清理会误删真实题库里的题目（第一版就这么踩过）。
 * `next` 只做响应形状断言，并借数据库校对词块是否「不丢不增且已打乱」。
 *
 * 幂等性（可反复跑，不堆垃圾数据）：
 * - 账号用固定邮箱：已注册则改走登录；
 * - 测试题按 `sentenceEn` 唯一键 upsert，跑完连作答记录一起清理；
 * - 每轮开跑前先清掉该用户在该题上的历史记录，避免上轮中断留下的残留导致假失败。
 *
 * 前置条件：本地 MySQL 与 Redis 可用，且已执行 `npm run prisma:push` 与 `npm run seed`。
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisService } from '../src/common/redis/redis.service.js';
import { createTestApp } from './setup-app.js';

/** 路由前缀（见 src/app.setup.ts 的 setGlobalPrefix）。 */
const API = '/api';
/** 验证码在 Redis 中的键前缀（见 src/common/auth/captcha.service.ts）。 */

/** 固定的端到端账号：已注册就登录，避免每跑一次堆一个用户。 */
const E2E_EMAIL = 'e2e-client@example.com';
const E2E_PASSWORD = 'E2eClient2026';
const E2E_NICKNAME = 'E2E 契约账号';

/** 固定的测试题（sentenceEn 是唯一键，可安全 upsert）。 */
const E2E_SENTENCE_EN = 'This is the end-to-end contract sentence.';
const E2E_SENTENCE_ZH = '这是一句端到端契约测试专用句子。';

/** 抽题响应（字段与 QuestionsService.NextQuestion 对齐）。 */
interface NextQuestion {
  sentenceId: number;
  translationZh: string;
  imageUrl: string | null;
  categoryName: string | null;
  difficulty: number;
  festivalName: string | null;
  wordMeanings: Record<string, string> | null;
  todayDone: number;
  todayGoal: number;
  source: 'new' | 'review';
  words: string[] | null;
}

/** 作答响应（字段与 QuestionsService.AnswerResult 对齐）。 */
interface AnswerResult {
  sentenceId: number;
  isCorrect: boolean;
  sentenceEn: string;
  validAnswers: string[];
  translationZh: string;
  ipa: string | null;
  imageUrl: string | null;
  favorited: boolean;
  todayDone: number;
  todayGoal: number;
  xpEarned: number;
  goalBonus: number;
  newAchievements: Array<{ code: string; name: string }>;
  repeated?: boolean;
}

describe('用户端主链路 (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let token: string;
  let userId: bigint;
  /** 专用测试题 id：本次所有写操作都只针对它（绝不使用随机抽到的题）。 */
  let testSentenceId: bigint;

  /** 带客户端令牌的 GET。 */
  const authGet = (path: string): request.Test =>
    request(app.getHttpServer()).get(`${API}${path}`).set('authorization', `Bearer ${token}`);

  /** 带客户端令牌的 POST。 */
  const authPost = (path: string, body: object): request.Test =>
    request(app.getHttpServer()).post(`${API}${path}`).set('authorization', `Bearer ${token}`).send(body);

  /** 注册或登录（幂等）：返回访问令牌。 */
  async function registerOrLogin(): Promise<string> {
    // 注册必须邮箱验证码：e2e 不配 SES，直接把码写进 Redis（与 EmailCodeService 同 key 格式）
    await redis.set(`client:email-code:register:${E2E_EMAIL.toLowerCase()}`, '123456', 5 * 60 * 1000);
    const reg = await request(app.getHttpServer())
      .post(`${API}/client/auth/register`)
      .send({ email: E2E_EMAIL, password: E2E_PASSWORD, nickname: E2E_NICKNAME, emailCode: '123456', agreed: true });
    if (reg.status === 200) {
      return (reg.body.data as { accessToken: string }).accessToken;
    }
    // 409 = 该邮箱已注册（重复跑）→ 改走登录；其余状态码是真失败，把响应带出来便于定位
    if (reg.status !== 409) {
      throw new Error(`客户端注册失败（HTTP ${reg.status}）：${JSON.stringify(reg.body)}`);
    }
    // 登录不再需要验证码（账号 + 密码即可）
    const login = await request(app.getHttpServer())
      .post(`${API}/client/auth/login`)
      .send({ email: E2E_EMAIL, password: E2E_PASSWORD })
      .expect(200);
    return (login.body.data as { accessToken: string }).accessToken;
  }

  /** 清掉本账号在测试题上的作答/收藏痕迹（开跑前与收尾共用）。 */
  async function cleanTestSentence(): Promise<void> {
    if (!prisma || !userId) {
      return;
    }
    await prisma.sentenceRecord.deleteMany({ where: { userId, sentenceId: testSentenceId } }).catch(() => undefined);
    await prisma.sentenceFavorite.deleteMany({ where: { userId, sentenceId: testSentenceId } }).catch(() => undefined);
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);

    // 1. 保障库里至少有一道 ready 题：CI 的库是空的，没有题整条链路无从跑起
    const category = await prisma.sentenceCategory.findFirst({ where: { status: 1 }, orderBy: { sort: 'asc' } });
    expect(category).toBeTruthy();
    const sentence = await prisma.sentence.upsert({
      where: { sentenceEn: E2E_SENTENCE_EN },
      create: {
        categoryId: category!.id,
        sentenceEn: E2E_SENTENCE_EN,
        translationZh: E2E_SENTENCE_ZH,
        scenePrompt: 'two people talking in a bright office, flat cartoon illustration',
        difficulty: 2,
        source: 'manual',
        status: 'ready',
      },
      // 上一轮可能留下别的状态，这里拉回 ready 并清掉配图引用
      update: { status: 'ready', imageFileId: 0n },
    });
    testSentenceId = sentence.id;

    // 2. 幂等登录 + 定位用户
    token = await registerOrLogin();
    const me = await authGet('/client/auth/me').expect(200);
    userId = BigInt((me.body.data as { id: number }).id);

    // 3. 清掉上轮中断可能留下的残留记录，让「首次答对发经验」这类断言稳定成立
    await cleanTestSentence();
  });

  afterAll(async () => {
    await cleanTestSentence();
    // 测试题本身也删掉，不给题库留脏数据（子表已先清理）
    if (prisma && testSentenceId) {
      await prisma.sentence.delete({ where: { id: testSentenceId } }).catch(() => undefined);
    }
    await app?.close();
  });

  it('注册必须勾选同意协议：缺 agreed / agreed=false 均 400，带 agreed=true 可过', async () => {
    // 未勾选：DTO 校验直接拒（附带头像/昵称都不放行）
    await request(app.getHttpServer())
      .post(`${API}/client/auth/register`)
      .send({ email: 'e2e-noagree@example.com', password: 'E2eAgree2026', emailCode: '123456' })
      .expect(400);
    // 显式 false：同样拒
    await request(app.getHttpServer())
      .post(`${API}/client/auth/register`)
      .send({ email: 'e2e-noagree@example.com', password: 'E2eAgree2026', emailCode: '123456', agreed: false })
      .expect(400);
    // 勾选后：走到邮箱验证码校验（验证码未写 Redis → 提示验证码错，说明协议关已过）
    await request(app.getHttpServer())
      .post(`${API}/client/auth/register`)
      .send({ email: 'e2e-noagree@example.com', password: 'E2eAgree2026', emailCode: '123456', agreed: true })
      .expect(400)
      .expect((res) => {
        expect((res.body as { message: string }).message).toContain('验证码');
      });
  });

  it('邮箱验证码登录：错码 401 / 对码 200 / 未注册 400', async () => {
    const email = 'e2e-code-login@example.com';
    // 未注册 + 错码：先被验证码关拦下（401，统一文案防枚举）
    await request(app.getHttpServer())
      .post(`${API}/client/auth/code-login`)
      .send({ email, emailCode: '000000' })
      .expect(401);

    // 注册一个真实账号（协议勾选 path 已被上个用例覆盖）
    await redis.set(`client:email-code:register:${email}`, '654321', 5 * 60 * 1000);
    const reg = await request(app.getHttpServer())
      .post(`${API}/client/auth/register`)
      .send({ email, password: 'E2eCodeLogin2026', emailCode: '654321', agreed: true });
    if (reg.status !== 200 && reg.status !== 409) {
      throw new Error(`注册失败（HTTP ${reg.status}）：${JSON.stringify(reg.body)}`);
    }

    // 错码：401
    await request(app.getHttpServer())
      .post(`${API}/client/auth/code-login`)
      .send({ email, emailCode: '000000' })
      .expect(401);

    // 对码：200 且拿到 client 类型令牌
    await redis.set(`client:email-code:login:${email}`, '123456', 5 * 60 * 1000);
    const ok = await request(app.getHttpServer())
      .post(`${API}/client/auth/code-login`)
      .send({ email, emailCode: '123456' })
      .expect(200);
    const data = ok.body.data as { accessToken: string; user: { email: string } };
    expect(data.user.email).toBe(email);
    expect(typeof data.accessToken).toBe('string');
    // 一次性：同一个码再登一次应失败
    await request(app.getHttpServer())
      .post(`${API}/client/auth/code-login`)
      .send({ email, emailCode: '123456' })
      .expect(401);

    // 未注册 + 对码：400（邮箱已被证明归属，引导去注册；不自动建号）
    await redis.set('client:email-code:login:nobody-e2e@example.com', '123456', 5 * 60 * 1000);
    await request(app.getHttpServer())
      .post(`${API}/client/auth/code-login`)
      .send({ email: 'nobody-e2e@example.com', emailCode: '123456' })
      .expect(400);
  });

  it('GET /client/auth/me 返回本人资料（令牌可用）', async () => {
    const res = await authGet('/client/auth/me').expect(200);
    expect(res.body).toMatchObject({ code: 200, message: 'success' });
    expect(res.body.data).toMatchObject({ email: E2E_EMAIL });
    expect(typeof res.body.data.id).toBe('number');
  });

  it('GET /client/questions/next 抽到一道题：字段齐全，词块不丢不增且已打乱', async () => {
    const res = await authGet('/client/questions/next').expect(200);
    const question = res.body.data as NextQuestion;

    // 键集合精确固化：多一个少一个都说明契约变了
    expect(Object.keys(question).sort()).toEqual(
      [
        'categoryName',
        'difficulty',
        'festivalName',
        'imageUrl',
        'sentenceId',
        'source',
        'todayDone',
        'todayGoal',
        'translationZh',
        // ttsText：盲听作答模式（listen）恒定下发的朗读文本
        'ttsText',
        'wordMeanings',
        'words',
      ].sort(),
    );
    expect(['new', 'review']).toContain(question.source);
    expect(question.todayGoal).toBeGreaterThan(0);
    expect(question.todayDone).toBeGreaterThanOrEqual(0);
    expect(typeof question.translationZh).toBe('string');
    expect(question.difficulty).toBeGreaterThanOrEqual(1);
    expect(question.difficulty).toBeLessThanOrEqual(3);

    // 词块：与题干原文「不丢词、不增词」，且顺序被打乱（同序等于把答案摆给用户）
    const drawn = await prisma.sentence.findUniqueOrThrow({
      where: { id: BigInt(question.sentenceId) },
      select: { sentenceEn: true },
    });
    const words = question.words as string[];
    expect(Array.isArray(words)).toBe(true);
    expect([...words].sort()).toEqual(drawn.sentenceEn.split(' ').sort());
    expect(words.length).toBeGreaterThan(1);
    expect(words.join(' ')).not.toBe(drawn.sentenceEn);
  });

  it('答错：判为不正确，但仍给少量正反馈经验（不惩罚）', async () => {
    const res = await authPost(`/client/questions/${testSentenceId}/answer`, {
      userAnswer: 'definitely not the right answer',
      elapsedMs: 4200,
    }).expect(200);
    const result = res.body.data as AnswerResult;
    expect(result.isCorrect).toBe(false);
    expect(result.sentenceId).toBe(Number(testSentenceId));
    // 答错给 2 分正反馈（XP_RULES.answer_wrong），为 0 说明 XP 规则表被改坏了
    expect(result.xpEarned).toBeGreaterThan(0);
  });

  it('答对：判分正确、发经验，回传答案用于翻转面', async () => {
    const res = await authPost(`/client/questions/${testSentenceId}/answer`, {
      userAnswer: E2E_SENTENCE_EN,
      elapsedMs: 3200,
    }).expect(200);
    const result = res.body.data as AnswerResult;

    expect(result.isCorrect).toBe(true);
    expect(result.sentenceEn).toBe(E2E_SENTENCE_EN);
    expect(result.translationZh).toBe(E2E_SENTENCE_ZH);
    expect(Array.isArray(result.validAnswers)).toBe(true);
    expect(Array.isArray(result.newAchievements)).toBe(true);
    expect(result.xpEarned).toBeGreaterThan(0);
    expect(result.todayDone).toBeGreaterThanOrEqual(1);
  });

  it('同一题再答一次：仍判分，但不重复发经验（防重放）', async () => {
    const res = await authPost(`/client/questions/${testSentenceId}/answer`, {
      userAnswer: E2E_SENTENCE_EN,
    }).expect(200);
    const result = res.body.data as AnswerResult;
    expect(result.isCorrect).toBe(true);
    expect(result.repeated).toBe(true);
    expect(result.xpEarned).toBe(0);
  });

  it('GET /client/gamify/overview 反映本次作答（经验、成就、场景探索）', async () => {
    const res = await authGet('/client/gamify/overview').expect(200);
    const overview = res.body.data as {
      xp: number;
      level: { code: string };
      achievements: Array<{ code: string; unlocked: boolean }>;
      sceneMap: Array<{ id: number; unlocked: boolean; practicedCount: number }>;
      unlockedScenes: number;
      totalScenes: number;
    };
    expect(overview.xp).toBeGreaterThan(0);
    expect(overview.level.code).toMatch(/^[ABC][12]$/);
    // 作答过至少一题 → 「初次落笔」必然解锁（判定链路的端到端证据）
    expect(overview.achievements.find((item) => item.code === 'first_step')?.unlocked).toBe(true);
    // 测试题所属场景应被标记为已练（practicedCount 按 sentenceId 去重统计）
    expect(overview.sceneMap.filter((item) => item.practicedCount > 0).length).toBeGreaterThan(0);
    expect(overview.totalScenes).toBeGreaterThan(0);
  });

  it('收藏 / 取消收藏：收藏夹随之增减', async () => {
    const on = await authPost(`/client/questions/${testSentenceId}/favorite`, {}).expect(200);
    expect((on.body.data as { favorited: boolean }).favorited).toBe(true);

    const list = await authGet('/client/favorites').expect(200);
    const items = list.body.data as { list: Array<{ sentenceId: number }>; total: number };
    expect(items.list.some((item) => item.sentenceId === Number(testSentenceId))).toBe(true);

    const off = await request(app.getHttpServer())
      .delete(`${API}/client/questions/${testSentenceId}/favorite`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect((off.body.data as { favorited: boolean }).favorited).toBe(false);

    const after = await authGet('/client/favorites').expect(200);
    const afterItems = after.body.data as { list: Array<{ sentenceId: number }> };
    expect(afterItems.list.some((item) => item.sentenceId === Number(testSentenceId))).toBe(false);
  });

  it('GET /client/history 含本次作答记录', async () => {
    const res = await authGet('/client/history').expect(200);
    const data = res.body.data as { list: Array<{ sentenceId: number; sentenceEn: string }>; total: number };
    expect(Array.isArray(data.list)).toBe(true);
    expect(data.list.some((item) => item.sentenceId === Number(testSentenceId))).toBe(true);
  });

  it('GET /client/leaderboard：七个榜（今日/周/月 × 答题/答对 + 打卡）口径一致', async () => {
    const types = [
      'today_answered',
      'today_correct',
      'week_answered',
      'week_correct',
      'month_answered',
      'month_correct',
      'checkin_total',
    ] as const;
    for (const type of types) {
      const res = await authGet(`/client/leaderboard?type=${type}`).expect(200);
      const data = res.body.data as {
        type: string;
        unit: string;
        date: string;
        top: unknown[];
        me: { rank: number; count: number } | null;
      };
      expect(data.type).toBe(type);
      expect(data.unit).toBe(type === 'checkin_total' ? '天' : '题');
      expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(data.top)).toBe(true);
      expect(data.top.length).toBeLessThanOrEqual(100);
      // 本轮已经作答，答题/答对类四个维度的窗口都必含这条记录
      if (type !== 'checkin_total') {
        expect(data.me, `${type} 应有我的名次`).toBeTruthy();
        expect(data.me!.count).toBeGreaterThan(0);
      }
    }
  });

  it('GET /client/leaderboard：非法 type 返回 400', async () => {
    await authGet('/client/leaderboard?type=not_a_board').expect(400);
  });

  it('查榜会旁路解锁首次上榜成就（名次型成就只在榜单链路点亮）', async () => {
    const res = await authGet('/client/leaderboard?type=today_answered').expect(200);
    const me = (res.body.data as { me: { rank: number } | null }).me;
    expect(me).toBeTruthy();
    expect(me!.rank).toBeLessThanOrEqual(100);

    const overview = await authGet('/client/gamify/overview').expect(200);
    const achievements = (overview.body.data as { achievements: Array<{ code: string; unlocked: boolean }> })
      .achievements;
    expect(achievements.find((item) => item.code === 'rank_top100')?.unlocked).toBe(true);
  });

  it('未携带令牌访问受保护接口返回 401（用户端同样不可裸奔）', async () => {
    await request(app.getHttpServer()).get(`${API}/client/gamify/overview`).expect(401);
  });
});
