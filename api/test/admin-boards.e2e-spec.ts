/**
 * 排行榜 / 打卡后台链路（e2e）：/api/leaderboards 与 /api/checkins。
 *
 * 排行榜：类型枚举、实时榜单 shape、非法 type 400、按用户查 7 榜名次。
 * 打卡：30 天日历统计 shape、补签幂等（created→false）+ streak 重算 + 记录可搜到、
 * 撤销幂等（revoked→false）、未来日期 400、未知邮箱 404、客户端 token 被拒。
 *
 * 幂等：固定客户端账号 + 固定补签日期（昨天）；afterAll 清掉残留行。
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

const CLIENT_EMAIL = 'e2e-boards-admin@example.com';
const CLIENT_PASSWORD = 'E2eBoards2026';

function shiftDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const BACKFILL_DATE = shiftDate(-1); // 昨天

describe('排行榜 / 打卡后台 (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let adminToken: string;
  let clientToken: string;

  const adminGet = (path: string): request.Test =>
    request(app.getHttpServer()).get(`${API}${path}`).set('authorization', `Bearer ${adminToken}`);
  const adminPost = (path: string, body: object = {}): request.Test =>
    request(app.getHttpServer()).post(`${API}${path}`).set('authorization', `Bearer ${adminToken}`).send(body);

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
      .send({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD, nickname: 'E2E 榜单打卡账号', emailCode: '123456' });
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
  });

  afterAll(async () => {
    const user = await prisma.clientUser.findUnique({ where: { email: CLIENT_EMAIL }, select: { id: true } });
    if (user) {
      await prisma.userCheckin
        .deleteMany({ where: { userId: user.id, checkinDate: BACKFILL_DATE } })
        .catch(() => undefined);
    }
    await app.close();
  });

  /* ------------------------------ 排行榜 ------------------------------ */

  it('排行榜：types 返回 7 种；board shape 正确；非法 type 400', async () => {
    const types = await adminGet('/leaderboards/types').expect(200);
    expect(types.body.data).toHaveLength(7);

    const board = await adminGet('/leaderboards/board?type=today_answered&topN=100').expect(200);
    const data = board.body.data as { type: string; unit: string; date: string; total: number; top: unknown[] };
    expect(data.type).toBe('today_answered');
    expect(data.unit).toBe('题');
    expect(typeof data.date).toBe('string');
    expect(Array.isArray(data.top)).toBe(true);

    await adminGet('/leaderboards/board?type=bad_type').expect(400);
  });

  it('排行榜：按邮箱查用户 7 榜名次；空 keyword 400', async () => {
    const res = await adminGet(`/leaderboards/user?keyword=${encodeURIComponent(CLIENT_EMAIL)}`).expect(200);
    const data = res.body.data as { users: Array<{ email: string; ranks: unknown[] }> };
    expect(data.users).toHaveLength(1);
    expect(data.users[0].email).toBe(CLIENT_EMAIL);
    expect(data.users[0].ranks).toHaveLength(7);

    await adminGet('/leaderboards/user?keyword=').expect(400);
  });

  /* ------------------------------ 打卡 ------------------------------ */

  it('打卡：stats 返回 30 天日历 + 今日汇总', async () => {
    const res = await adminGet('/checkins/stats?days=30').expect(200);
    const stats = res.body.data as { days: Array<{ date: string }>; totalUsers: number; today: { date: string } };
    expect(stats.days).toHaveLength(30);
    expect(stats.totalUsers).toBeGreaterThan(0);
    expect(stats.today.date).toBe(shiftDate(0));
  });

  it('打卡：补签幂等 + 记录可搜到；未来日期 400；未知邮箱 404', async () => {
    const first = await adminPost('/checkins/backfill', {
      email: CLIENT_EMAIL,
      date: BACKFILL_DATE,
      reason: 'e2e 补签测试',
    }).expect(200);
    const firstData = first.body.data as { created: boolean; doneCount: number; goalCount: number; streak: number };
    expect(firstData.created).toBe(true);
    expect(firstData.doneCount).toBe(firstData.goalCount);
    expect(firstData.streak).toBeGreaterThanOrEqual(1);

    // 幂等：再补一次 created=false
    const second = await adminPost('/checkins/backfill', {
      email: CLIENT_EMAIL,
      date: BACKFILL_DATE,
      reason: 'e2e 幂等',
    }).expect(200);
    expect((second.body.data as { created: boolean }).created).toBe(false);

    // 记录里能搜到
    const records = await adminGet(`/checkins/records?keyword=${encodeURIComponent(CLIENT_EMAIL)}`).expect(200);
    const recData = records.body.data as {
      list: Array<{ checkinDate: string; doneCount: number; goalCount: number }>;
      total: number;
    };
    expect(recData.list.some((r) => r.checkinDate === BACKFILL_DATE && r.doneCount >= r.goalCount)).toBe(true);

    // 未来日期 400；未知邮箱 404；坏日期格式 400
    await adminPost('/checkins/backfill', { email: CLIENT_EMAIL, date: shiftDate(1), reason: 'xx' }).expect(400);
    await adminPost('/checkins/backfill', { email: 'nobody@example.com', date: BACKFILL_DATE, reason: 'xx' }).expect(
      404,
    );
    await adminPost('/checkins/backfill', { email: CLIENT_EMAIL, date: '2026-13-99', reason: 'xx' }).expect(400);
  });

  it('打卡：撤销幂等，撤销后记录消失', async () => {
    const first = await adminPost('/checkins/revoke', {
      email: CLIENT_EMAIL,
      date: BACKFILL_DATE,
      reason: 'e2e 撤销',
    }).expect(200);
    expect((first.body.data as { revoked: boolean }).revoked).toBe(true);

    const records = await adminGet(`/checkins/records?keyword=${encodeURIComponent(CLIENT_EMAIL)}`).expect(200);
    const recData = records.body.data as { list: Array<{ checkinDate: string }> };
    expect(recData.list.some((r) => r.checkinDate === BACKFILL_DATE)).toBe(false);

    const second = await adminPost('/checkins/revoke', {
      email: CLIENT_EMAIL,
      date: BACKFILL_DATE,
      reason: 'e2e 幂等',
    }).expect(200);
    expect((second.body.data as { revoked: boolean }).revoked).toBe(false);
  });

  it('客户端 token 访问后台榜单/打卡接口被拒（双体系隔离）', async () => {
    for (const path of ['/leaderboards/board?type=today_answered', '/checkins/stats']) {
      const res = await request(app.getHttpServer()).get(`${API}${path}`).set('authorization', `Bearer ${clientToken}`);
      expect([401, 403]).toContain(res.status);
    }
  });
});
