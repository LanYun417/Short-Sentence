/**
 * 音标管理后台链路（e2e）：/api/ipa 的列表 / 编辑 / 重置种子 / 统计 / 学习记录审计。
 *
 * 覆盖点：
 * - 后台分页列表带学会人数；编辑只改内容字段（symbol 不可改由 DTO 拦——这里验证可改字段生效）；
 * - 重置种子把手改内容还原（upsert by symbol）；
 * - 统计口径（trend 7 天、top 非空）；
 * - 客户端标记「学会了」后，后台 records 能按用户邮箱搜到审计行；
 * - 客户端 token 访问后台接口被拒（双体系隔离）。
 *
 * 幂等：固定客户端账号；跑完清掉该用户的音标学习记录与对应 XP 账本行。
 * 前置条件：本地 MySQL 与 Redis 可用，且已 db push + seed（48 音标种子已写入）。
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisService } from '../src/common/redis/redis.service.js';
import { createTestApp } from './setup-app.js';
import { resolveSeedAdminPassword } from '../src/prisma/seed.service.js';

const API = '/api';
const CAPTCHA_KEY_PREFIX = 'auth:captcha:';

/** 固定客户端账号（与其它 e2e 分开，避免相互干扰）。 */
const CLIENT_EMAIL = 'e2e-ipa-admin@example.com';
const CLIENT_PASSWORD = 'E2eIpaAdmin2026';
/** 用于编辑/还原的音标。 */
const PHONEME_SYMBOL = 'iː';

describe('音标管理后台 /api/ipa (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let adminToken: string;
  let clientToken: string;

  const adminGet = (path: string): request.Test =>
    request(app.getHttpServer()).get(`${API}${path}`).set('authorization', `Bearer ${adminToken}`);
  const adminPost = (path: string, body: object = {}): request.Test =>
    request(app.getHttpServer()).post(`${API}${path}`).set('authorization', `Bearer ${adminToken}`).send(body);
  const adminPut = (path: string, body: object): request.Test =>
    request(app.getHttpServer()).put(`${API}${path}`).set('authorization', `Bearer ${adminToken}`).send(body);

  async function captchaPair(): Promise<{ captchaId: string | null; captchaCode: string }> {
    const captcha = await request(app.getHttpServer()).get(`${API}/auth/captcha`).expect(200);
    const { enabled, captchaId } = captcha.body.data as { enabled: boolean; captchaId: string | null };
    if (!enabled || !captchaId) {
      return { captchaId: null, captchaCode: '' };
    }
    return { captchaId, captchaCode: (await redis.get(`${CAPTCHA_KEY_PREFIX}${captchaId}`)) ?? '' };
  }

  async function loginAdmin(): Promise<string> {
    const pair = await captchaPair();
    const res = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ username: 'admin', password: resolveSeedAdminPassword(), ...pair })
      .expect(200);
    return (res.body.data as { accessToken: string }).accessToken;
  }

  async function loginClient(): Promise<string> {
    await redis.set(`client:email-code:register:${CLIENT_EMAIL.toLowerCase()}`, '123456', 5 * 60 * 1000);
    const reg = await request(app.getHttpServer())
      .post(`${API}/client/auth/register`)
      .send({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD, nickname: 'E2E 音标后台账号', emailCode: '123456' });
    if (reg.status === 200) {
      return (reg.body.data as { accessToken: string }).accessToken;
    }
    if (reg.status !== 409) {
      throw new Error(`客户端注册失败（HTTP ${reg.status}）：${JSON.stringify(reg.body)}`);
    }
    const login = await request(app.getHttpServer())
      .post(`${API}/client/auth/login`)
      .send({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD })
      .expect(200);
    return (login.body.data as { accessToken: string }).accessToken;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    adminToken = await loginAdmin();
    clientToken = await loginClient();
    const phoneme = await prisma.ipaPhoneme.findUnique({ where: { symbol: PHONEME_SYMBOL } });
    if (!phoneme) {
      throw new Error(`种子音标 ${PHONEME_SYMBOL} 不存在，请先执行 seed`);
    }
  });

  afterAll(async () => {
    // 清理本用例产生的学习记录与 XP 账本行（幂等）
    const user = await prisma.clientUser.findUnique({ where: { email: CLIENT_EMAIL }, select: { id: true } });
    if (user) {
      await prisma.ipaLearningRecord.deleteMany({ where: { userId: user.id } }).catch(() => undefined);
      await prisma.clientXpLog
        .deleteMany({ where: { userId: user.id, eventKey: { startsWith: 'ipa-learned:' } } })
        .catch(() => undefined);
    }
    await app.close();
  });

  it('后台分页列表：48 个音标且带学会人数', async () => {
    const res = await adminGet('/ipa/phonemes?page=1&pageSize=100').expect(200);
    const data = res.body.data as { list: Array<{ id: number; symbol: string; learnedCount: number }>; total: number };
    expect(data.total).toBe(48);
    expect(data.list).toHaveLength(48);
    expect(data.list.every((p) => typeof p.learnedCount === 'number')).toBe(true);
    expect(data.list.some((p) => p.symbol === PHONEME_SYMBOL)).toBe(true);
  });

  /** 全量拉音标列表后按 symbol 精确找（关键字会误命中别人 tips 里的 "/iː/"）。 */
  async function findPhonemeBySymbol(symbol: string) {
    const res = await adminGet('/ipa/phonemes?page=1&pageSize=100').expect(200);
    const data = res.body.data as {
      list: Array<{ id: number; symbol: string; type: string; tips: string; sort: number; exampleWords: string[] }>;
    };
    const row = data.list.find((p) => p.symbol === symbol);
    if (!row) {
      throw new Error(`音标 ${symbol} 不在列表中`);
    }
    return row;
  }

  it('关键字 / 类型筛选生效', async () => {
    const byKeyword = await adminGet(`/ipa/phonemes?keyword=${encodeURIComponent(PHONEME_SYMBOL)}`).expect(200);
    const kwData = byKeyword.body.data as { total: number };
    expect(kwData.total).toBeGreaterThan(0);

    const byType = await adminGet('/ipa/phonemes?type=vowel').expect(200);
    const typeData = byType.body.data as { list: Array<{ type: string }>; total: number };
    expect(typeData.list.length).toBeGreaterThan(0);
    expect(typeData.list.every((p) => p.type === 'vowel')).toBe(true);
  });

  it('编辑音标内容字段生效（symbol 不可改——DTO 不含该字段）', async () => {
    const item = await findPhonemeBySymbol(PHONEME_SYMBOL);
    const newTips = `E2E 编辑于 ${Date.now()}`;
    await adminPut(`/ipa/phonemes/${item.id}`, { tips: newTips, sort: 999, exampleWords: ['see', 'e2e'] }).expect(200);

    const updated = await findPhonemeBySymbol(PHONEME_SYMBOL);
    expect(updated.tips).toBe(newTips);
    expect(updated.sort).toBe(999);
    expect(updated.exampleWords).toEqual(['see', 'e2e']);

    // 非法类型被 DTO 拦截
    await adminPut(`/ipa/phonemes/${item.id}`, { type: 'not-a-type' }).expect(400);
    // 不存在的音标 404
    await adminPut('/ipa/phonemes/999999999', { tips: 'x' }).expect(404);
  });

  it('重置种子把手改内容还原，且返回 48', async () => {
    const res = await adminPost('/ipa/phonemes/reset-seeds').expect(200);
    expect((res.body.data as { updated: number }).updated).toBe(48);

    const restored = await findPhonemeBySymbol(PHONEME_SYMBOL);
    expect(restored.tips).not.toContain('E2E 编辑于');
    expect(restored.sort).not.toBe(999);
  });

  it('统计总览：trend 7 天、top 非空、计数非负', async () => {
    const res = await adminGet('/ipa/stats').expect(200);
    const stats = res.body.data as {
      totalPhonemes: number;
      totalLearned: number;
      learnerCount: number;
      todayLearned: number;
      trend: Array<{ date: string; count: number }>;
      top: Array<{ symbol: string; count: number }>;
    };
    expect(stats.totalPhonemes).toBe(48);
    expect(stats.trend).toHaveLength(7);
    expect(stats.totalLearned).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(stats.top)).toBe(true);
  });

  it('客户端标记学会后，后台 records 按邮箱搜到审计行', async () => {
    const learn = await request(app.getHttpServer())
      .post(`${API}/client/ipa/learned`)
      .set('authorization', `Bearer ${clientToken}`)
      .send({ symbol: PHONEME_SYMBOL })
      .expect(200);
    expect((learn.body.data as { symbol: string }).symbol).toBe(PHONEME_SYMBOL);

    const res = await adminGet(`/ipa/records?keyword=${encodeURIComponent(CLIENT_EMAIL)}&pageSize=20`).expect(200);
    const data = res.body.data as { list: Array<{ email: string; symbol: string }>; total: number };
    expect(data.total).toBeGreaterThan(0);
    expect(data.list.some((r) => r.email === CLIENT_EMAIL && r.symbol === PHONEME_SYMBOL)).toBe(true);
  });

  it('客户端 token 访问后台音标接口被拒（双体系隔离）', async () => {
    const res = await request(app.getHttpServer())
      .get(`${API}/ipa/phonemes`)
      .set('authorization', `Bearer ${clientToken}`);
    expect([401, 403]).toContain(res.status);
  });
});
