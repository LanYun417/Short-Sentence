/**
 * 成长体系后台链路（e2e）：/api/gamify 的成就编辑 / XP 账本审计 / 手动补偿 / 统计。
 *
 * 覆盖点：
 * - 成就列表带解锁人数；编辑展示字段生效；code 不可变（路由即 code，非法分组 400、未知 code 404）；
 * - 手动补偿：正向入账（eventType=manual + remark 审计）、用户 XP 同步增加、账本可搜到；
 *   只加不减红线——amount<=0 被 DTO 拦截（400）；
 * - 统计口径（byEventType 含 manual）；
 * - 客户端 token 访问后台接口被拒（双体系隔离）。
 *
 * 幂等：固定客户端账号与固定成就 code；跑完还原成就名、删掉 manual 账本行并把 XP 落回去。
 * 前置条件：本地 MySQL 与 Redis 可用，且已 db push + seed。
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
const CLIENT_EMAIL = 'e2e-gamify-admin@example.com';
const CLIENT_PASSWORD = 'E2eGamify2026';
/** 用于编辑/还原的成就 code（种子里必有）。 */
const ACHIEVEMENT_CODE = 'first_step';
/** 本次补偿金额（afterAll 精确回滚用）。 */
const GRANT_AMOUNT = 33;

describe('成长体系后台 /api/gamify (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let adminToken: string;
  let clientToken: string;
  let originalName: string;
  let xpBeforeGrant = 0;

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
      .send({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD, nickname: 'E2E 成长后台账号', emailCode: '123456' });
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
    const achievement = await prisma.achievement.findUnique({ where: { code: ACHIEVEMENT_CODE } });
    if (!achievement) {
      throw new Error(`种子成就 ${ACHIEVEMENT_CODE} 不存在，请先执行 seed`);
    }
    originalName = achievement.name;
    const user = await prisma.clientUser.findUnique({ where: { email: CLIENT_EMAIL }, select: { xp: true } });
    xpBeforeGrant = user?.xp ?? 0;
  });

  afterAll(async () => {
    // 还原成就名；删掉本用例的 manual 账本行并把 XP 落回去（幂等）
    await prisma.achievement
      .update({ where: { code: ACHIEVEMENT_CODE }, data: { name: originalName } })
      .catch(() => undefined);
    const user = await prisma.clientUser.findUnique({ where: { email: CLIENT_EMAIL }, select: { id: true } });
    if (user) {
      await prisma.clientXpLog
        .deleteMany({ where: { userId: user.id, eventType: 'manual', eventKey: { startsWith: 'manual:' } } })
        .catch(() => undefined);
      await prisma.clientUser
        .update({ where: { id: user.id }, data: { xp: Math.max(0, xpBeforeGrant) } })
        .catch(() => undefined);
    }
    await app.close();
  });

  it('成就列表：全部成就且带解锁人数', async () => {
    const res = await adminGet('/gamify/achievements').expect(200);
    const list = res.body.data as Array<{ code: string; name: string; unlockCount: number }>;
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((a) => typeof a.unlockCount === 'number')).toBe(true);
    expect(list.some((a) => a.code === ACHIEVEMENT_CODE)).toBe(true);
  });

  it('编辑成就展示字段生效；非法分组 400、未知 code 404', async () => {
    const newName = `E2E 改名 ${Date.now()}`;
    await adminPut(`/gamify/achievements/${ACHIEVEMENT_CODE}`, { name: newName, rewardXp: 5 }).expect(200);
    const res = await adminGet('/gamify/achievements').expect(200);
    const list = res.body.data as Array<{ code: string; name: string; rewardXp: number }>;
    const row = list.find((a) => a.code === ACHIEVEMENT_CODE);
    expect(row?.name).toBe(newName);
    expect(row?.rewardXp).toBe(5);

    await adminPut(`/gamify/achievements/${ACHIEVEMENT_CODE}`, { category: 'not-a-category' }).expect(400);
    await adminPut('/gamify/achievements/no_such_code', { name: 'x' }).expect(404);
  });

  it('手动补偿：正向入账 + XP 同步增加 + 账本带 remark 可搜到', async () => {
    const res = await adminPost('/gamify/xp/grant', {
      email: CLIENT_EMAIL,
      amount: GRANT_AMOUNT,
      reason: 'e2e 补偿测试',
    }).expect(200);
    const data = res.body.data as { granted: boolean; balance: number };
    expect(data.granted).toBe(true);
    expect(data.balance).toBe(xpBeforeGrant + GRANT_AMOUNT);

    const logs = await adminGet(`/gamify/xp-logs?keyword=${encodeURIComponent(CLIENT_EMAIL)}&eventType=manual`).expect(
      200,
    );
    const logData = logs.body.data as {
      list: Array<{ eventType: string; amount: number; remark: string }>;
      total: number;
    };
    expect(logData.total).toBeGreaterThan(0);
    expect(logData.list[0].amount).toBe(GRANT_AMOUNT);
    expect(logData.list[0].remark).toContain('e2e 补偿测试');
  });

  it('只加不减红线：amount<=0 被拦截；未知邮箱 404', async () => {
    await adminPost('/gamify/xp/grant', { email: CLIENT_EMAIL, amount: 0, reason: 'xx' }).expect(400);
    await adminPost('/gamify/xp/grant', { email: CLIENT_EMAIL, amount: -10, reason: 'xx' }).expect(400);
    await adminPost('/gamify/xp/grant', { email: 'nobody@example.com', amount: 10, reason: 'xx' }).expect(404);
  });

  it('统计总览：byEventType 含 manual，计数非负', async () => {
    const res = await adminGet('/gamify/stats').expect(200);
    const stats = res.body.data as {
      totalXpIssued: number;
      todayXp: number;
      logCount: number;
      byEventType: Array<{ eventType: string; sum: number }>;
    };
    expect(stats.logCount).toBeGreaterThan(0);
    expect(stats.totalXpIssued).toBeGreaterThanOrEqual(0);
    expect(stats.byEventType.some((e) => e.eventType === 'manual')).toBe(true);
  });

  it('客户端 token 访问后台成长接口被拒（双体系隔离）', async () => {
    const res = await request(app.getHttpServer())
      .get(`${API}/gamify/achievements`)
      .set('authorization', `Bearer ${clientToken}`);
    expect([401, 403]).toContain(res.status);
  });
});
