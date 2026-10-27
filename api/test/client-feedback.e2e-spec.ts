/**
 * 客户端产品反馈链路契约（e2e）：用户提交 → 后台可见 → 运营处理并回复 → 用户看到回复。
 *
 * 为什么单独一条：这是**跨角色**链路（客户端 client_user 提交、后台 sys_user 处理），
 * 「回复会下发用户端、内部备注不下发」这条口径只有跑起来才能验证；
 * 校验规则（内容长度、类型白名单、纯空格）也在这里钉住。
 *
 * 幂等：固定客户端账号 + 固定内容前缀，跑前清理该账号的历史反馈、跑完再清一次。
 * 前置条件：本地 MySQL 与 Redis 可用，且已执行 prisma migrate deploy / db push 与 seed。
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisService } from '../src/common/redis/redis.service.js';
import { createTestApp } from './setup-app.js';
import { resolveSeedAdminPassword } from '../src/prisma/seed.service.js';

const API = '/api';
const CAPTCHA_KEY_PREFIX = 'auth:captcha:';

/** 反馈内容前缀（固定便于识别与清理）。 */
const FEEDBACK_PREFIX = 'E2E 反馈：';
const FEEDBACK_CONTENT = `${FEEDBACK_PREFIX}拼词模式的词块顺序偶尔和答案对不上，麻烦看下`;

/** 固定客户端账号（与其他 e2e 用的账号分开，避免相互干扰）。 */
const CLIENT_EMAIL = 'e2e-feedback@example.com';
const CLIENT_PASSWORD = 'E2eFeedback2026';

describe('客户端产品反馈（用户提交 → 后台处理）(e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let adminToken: string;
  let clientToken: string;
  let clientUserId: bigint;
  /** 本次创建的反馈 id（跨用例共享）。 */
  let feedbackId: number;

  const adminGet = (path: string): request.Test =>
    request(app.getHttpServer()).get(`${API}${path}`).set('authorization', `Bearer ${adminToken}`);
  const adminPut = (path: string, body: object): request.Test =>
    request(app.getHttpServer()).put(`${API}${path}`).set('authorization', `Bearer ${adminToken}`).send(body);
  const clientGet = (path: string): request.Test =>
    request(app.getHttpServer()).get(`${API}${path}`).set('authorization', `Bearer ${clientToken}`);
  const clientPost = (path: string, body: object = {}): request.Test =>
    request(app.getHttpServer()).post(`${API}${path}`).set('authorization', `Bearer ${clientToken}`).send(body);

  /** 取一组可用验证码（关闭验证码时返回空串）。 */
  async function captchaPair(): Promise<{ captchaId: string | null; captchaCode: string }> {
    const captcha = await request(app.getHttpServer()).get(`${API}/auth/captcha`).expect(200);
    const { enabled, captchaId } = captcha.body.data as { enabled: boolean; captchaId: string | null };
    if (!enabled || !captchaId) {
      return { captchaId: null, captchaCode: '' };
    }
    return { captchaId, captchaCode: (await redis.get(`${CAPTCHA_KEY_PREFIX}${captchaId}`)) ?? '' };
  }

  /** 后台登录（真实验证码）。 */
  async function loginAdmin(): Promise<string> {
    const pair = await captchaPair();
    const res = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ username: 'admin', password: resolveSeedAdminPassword(), ...pair })
      .expect(200);
    return (res.body.data as { accessToken: string }).accessToken;
  }

  /** 客户端注册或登录（幂等）。 */
  async function loginClient(): Promise<string> {
    const first = await captchaPair();
    const reg = await request(app.getHttpServer())
      .post(`${API}/client/auth/register`)
      .send({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD, nickname: 'E2E 反馈账号', ...first });
    if (reg.status === 200) {
      return (reg.body.data as { accessToken: string }).accessToken;
    }
    if (reg.status !== 409) {
      throw new Error(`客户端注册失败（HTTP ${reg.status}）：${JSON.stringify(reg.body)}`);
    }
    const second = await captchaPair();
    const login = await request(app.getHttpServer())
      .post(`${API}/client/auth/login`)
      .send({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD, ...second })
      .expect(200);
    return (login.body.data as { accessToken: string }).accessToken;
  }

  /** 后台列表里找指定反馈。 */
  async function findInAdminList(id: number): Promise<Record<string, unknown> | undefined> {
    const res = await adminGet(`/client-feedbacks?keyword=${encodeURIComponent(FEEDBACK_PREFIX)}`).expect(200);
    const data = res.body.data as { list: Array<Record<string, unknown>>; total: number };
    return data.list.find((item) => item.id === id);
  }

  /** 用户端「我的反馈」里找指定反馈。 */
  async function findInMine(id: number): Promise<Record<string, unknown> | undefined> {
    const res = await clientGet('/client/feedback/mine?pageSize=50').expect(200);
    const data = res.body.data as { list: Array<Record<string, unknown>> };
    return data.list.find((item) => item.id === id);
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    adminToken = await loginAdmin();
    clientToken = await loginClient();

    const user = await prisma.clientUser.findUnique({ where: { email: CLIENT_EMAIL }, select: { id: true } });
    if (!user) {
      throw new Error('客户端测试账号未创建成功');
    }
    clientUserId = user.id;
    // 清掉上一次跑的残留（幂等）
    await prisma.clientFeedback.deleteMany({ where: { userId: clientUserId } });
  });

  afterAll(async () => {
    if (prisma && clientUserId) {
      await prisma.clientFeedback.deleteMany({ where: { userId: clientUserId } }).catch(() => undefined);
    }
    await app?.close();
  });

  it('用户提交反馈：返回新 id（并记录来源端与版本）', async () => {
    const res = await clientPost('/client/feedback', {
      type: 'bug',
      content: FEEDBACK_CONTENT,
      contact: 'e2e@example.com',
      platform: 'android',
      appVersion: '1.3.0',
    }).expect(200);
    expect(res.body.code).toBe(200);
    feedbackId = (res.body.data as { id: number }).id;
    expect(feedbackId).toBeGreaterThan(0);
  });

  it('内容校验：太短 / 类型非法 / 纯空格都被拒', async () => {
    await clientPost('/client/feedback', { type: 'bug', content: '太短' }).expect(400);
    await clientPost('/client/feedback', { type: 'nope', content: FEEDBACK_CONTENT }).expect(400);
    // MinLength 挡不住「全是空格」，服务层要显式拦掉
    await clientPost('/client/feedback', { type: 'bug', content: '          ' }).expect(400);
  });

  it('后台列表可见：带提交人昵称、来源端与版本', async () => {
    const hit = await findInAdminList(feedbackId);
    expect(hit, '刚提交的反馈应出现在后台列表').toBeTruthy();
    expect(hit?.status).toBe('pending');
    expect(hit?.platform).toBe('android');
    expect(hit?.appVersion).toBe('1.3.0');
    expect(hit?.contact).toBe('e2e@example.com');
    expect((hit?.reporter as { nickname: string }).nickname).toBe('E2E 反馈账号');
    // 列表默认按时间倒序
    expect(hit?.handledAt).toBeNull();
  });

  it('后台处理：写入状态、对用户的回复与内部备注', async () => {
    await adminPut(`/client-feedbacks/${feedbackId}`, {
      status: 'resolved',
      reply: '已定位到词块打乱时未同步重置的问题，下个版本修复。',
      handleNote: '内部：待 1.3.1 发版后回访',
    }).expect(200);
    const hit = await findInAdminList(feedbackId);
    expect(hit?.status).toBe('resolved');
    expect(hit?.reply).toContain('下个版本修复');
    expect(hit?.handleNote).toContain('内部');
    expect(typeof hit?.handledAt).toBe('string');
  });

  it('用户端「我的反馈」可见状态与回复，但**看不到内部备注**', async () => {
    const mine = await findInMine(feedbackId);
    expect(mine, '自己提交的反馈应出现在「我的反馈」').toBeTruthy();
    expect(mine?.status).toBe('resolved');
    expect(mine?.reply).toContain('下个版本修复');
    expect(mine?.content).toBe(FEEDBACK_CONTENT);
    // 内部备注是运营视角的，绝不下发用户端
    expect('handleNote' in (mine ?? {})).toBe(false);
  });

  it('权限与鉴权：客户端令牌不能访问后台接口；匿名访问用户端接口 401', async () => {
    await request(app.getHttpServer())
      .get(`${API}/client-feedbacks`)
      .set('authorization', `Bearer ${clientToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`${API}/client/feedback`)
      .send({ type: 'bug', content: '匿名' })
      .expect(401);
    await request(app.getHttpServer()).get(`${API}/client/feedback/mine`).expect(401);
  });

  it('处理不存在的反馈返回 404', async () => {
    await adminPut('/client-feedbacks/999999999', { status: 'resolved' }).expect(404);
  });
});
