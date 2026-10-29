/**
 * 客户端公告链路契约（e2e）：后台发布 → 用户端可见 → 标记已读 → 撤回 → 删除。
 *
 * 为什么单独一条：这是**跨角色**链路（后台 sys_user 发布、客户端 client_user 消费），
 * 两侧的响应结构、未读数口径与「撤回后对用户不存在」都只有跑起来才能验证。
 *
 * 幂等：用固定的公告标题与固定客户端账号，跑完把公告硬删（已读记录随外键级联）。
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

/** 测试公告标题（固定前缀便于清理与识别）。 */
const NOTICE_TITLE = 'E2E 公告：新场景已上线';
const NOTICE_CONTENT = '购物消费 / 健康医疗 / 运动健身 等 8 个新场景已上线，去看看。';

/** 固定客户端账号（与 client-flow 用的账号分开，避免相互干扰）。 */
const CLIENT_EMAIL = 'e2e-notice@example.com';
const CLIENT_PASSWORD = 'E2eNotice2026';

describe('客户端公告（后台发布 → 用户端消费）(e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let adminToken: string;
  let clientToken: string;
  /** 本次创建的公告 id（跨用例共享）。 */
  let noticeId: number;

  const adminGet = (path: string): request.Test =>
    request(app.getHttpServer()).get(`${API}${path}`).set('authorization', `Bearer ${adminToken}`);
  const adminPost = (path: string, body: object): request.Test =>
    request(app.getHttpServer()).post(`${API}${path}`).set('authorization', `Bearer ${adminToken}`).send(body);
  const adminPut = (path: string, body: object): request.Test =>
    request(app.getHttpServer()).put(`${API}${path}`).set('authorization', `Bearer ${adminToken}`).send(body);
  const adminDelete = (path: string): request.Test =>
    request(app.getHttpServer()).delete(`${API}${path}`).set('authorization', `Bearer ${adminToken}`);
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
    // 注册必须邮箱验证码：e2e 不配 SES，直接把码写进 Redis（与 EmailCodeService 同 key 格式）
    await redis.set(`client:email-code:register:${CLIENT_EMAIL.toLowerCase()}`, '123456', 5 * 60 * 1000);
    const reg = await request(app.getHttpServer())
      .post(`${API}/client/auth/register`)
      .send({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD, nickname: 'E2E 公告账号', emailCode: '123456' });
    if (reg.status === 200) {
      return (reg.body.data as { accessToken: string }).accessToken;
    }
    if (reg.status !== 409) {
      throw new Error(`客户端注册失败（HTTP ${reg.status}）：${JSON.stringify(reg.body)}`);
    }
    // 登录不再需要验证码（账号 + 密码即可）
    const login = await request(app.getHttpServer())
      .post(`${API}/client/auth/login`)
      .send({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD })
      .expect(200);
    return (login.body.data as { accessToken: string }).accessToken;
  }

  /** 客户端列表里找指定公告。 */
  async function findInClientList(id: number): Promise<{ isRead: number; title: string } | undefined> {
    const res = await clientGet('/client/notices').expect(200);
    const data = res.body.data as { list: Array<{ id: number; isRead: number; title: string }> };
    return data.list.find((item) => item.id === id);
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    adminToken = await loginAdmin();
    clientToken = await loginClient();
    // 清掉上一次跑残留的同名公告（幂等）
    await prisma.clientNotice.deleteMany({ where: { title: NOTICE_TITLE } });
  });

  afterAll(async () => {
    if (prisma && noticeId) {
      await prisma.clientNotice.deleteMany({ where: { id: BigInt(noticeId) } }).catch(() => undefined);
    }
    await app?.close();
  });

  it('后台发布公告：返回新 id（置顶，便于客户端列表稳定命中）', async () => {
    const res = await adminPost('/client-notices', {
      title: NOTICE_TITLE,
      content: NOTICE_CONTENT,
      noticeType: 3,
      pinned: 1,
    }).expect(200);
    expect(res.body.code).toBe(200);
    noticeId = (res.body.data as { id: number }).id;
    expect(typeof noticeId).toBe('number');
    expect(noticeId).toBeGreaterThan(0);
  });

  it('后台列表可见：带头部状态与已读人数', async () => {
    const res = await adminGet(`/client-notices?title=${encodeURIComponent('E2E 公告')}`).expect(200);
    const data = res.body.data as {
      list: Array<{ id: number; status: number; pinned: number; readCount: number; publishedAt: string | null }>;
      total: number;
    };
    expect(data.total).toBeGreaterThanOrEqual(1);
    const hit = data.list.find((item) => item.id === noticeId);
    expect(hit).toBeTruthy();
    expect(hit?.status).toBe(1);
    expect(hit?.pinned).toBe(1);
    expect(hit?.readCount).toBe(0);
    // 发布即写入发布时间，客户端排序依赖它
    expect(typeof hit?.publishedAt).toBe('string');
  });

  it('客户端可见：出现在列表中且为未读', async () => {
    const hit = await findInClientList(noticeId);
    expect(hit, '刚发布的公告应出现在客户端列表').toBeTruthy();
    expect(hit?.isRead).toBe(0);
    expect(hit?.title).toBe(NOTICE_TITLE);
  });

  it('客户端未读数 ≥ 1', async () => {
    const res = await clientGet('/client/notices/unread-count').expect(200);
    expect((res.body.data as { count: number }).count).toBeGreaterThanOrEqual(1);
  });

  it('标记已读：列表变为已读，重复标记不报错（幂等）', async () => {
    await clientPost(`/client/notices/${noticeId}/read`).expect(200);
    const hit = await findInClientList(noticeId);
    expect(hit?.isRead).toBe(1);
    // 幂等：再点一次仍成功
    await clientPost(`/client/notices/${noticeId}/read`).expect(200);
  });

  it('后台可见已读人数变为 1', async () => {
    const res = await adminGet(`/client-notices?title=${encodeURIComponent('E2E 公告')}`).expect(200);
    const hit = (res.body.data as { list: Array<{ id: number; readCount: number }> }).list.find(
      (item) => item.id === noticeId,
    );
    expect(hit?.readCount).toBe(1);
  });

  it('撤回后：客户端列表看不到，也未计入未读数', async () => {
    await adminPut(`/client-notices/${noticeId}/status`, { status: 2 }).expect(200);
    expect(await findInClientList(noticeId)).toBeUndefined();
    const count = await clientGet('/client/notices/unread-count').expect(200);
    // 撤回的公告既不算分子也不算分母，不该出现负数或残留
    expect((count.body.data as { count: number }).count).toBe(0);
  });

  it('重新发布后客户端又能看到（已读状态保留，不重复打扰）', async () => {
    await adminPut(`/client-notices/${noticeId}/status`, { status: 1 }).expect(200);
    const hit = await findInClientList(noticeId);
    expect(hit).toBeTruthy();
    // 已读过的人保持已读，避免同一条公告反复冒红点
    expect(hit?.isRead).toBe(1);
  });

  it('权限与鉴权：客户端令牌不能访问后台公告接口；匿名访问用户端接口 401', async () => {
    await request(app.getHttpServer())
      .post(`${API}/client-notices`)
      .set('authorization', `Bearer ${clientToken}`)
      .send({ title: 'x', content: 'y', noticeType: 2 })
      .expect(401);
    await request(app.getHttpServer()).get(`${API}/client/notices`).expect(401);
  });

  it('删除公告后：标记已读返回 404（对象已不存在）', async () => {
    await adminDelete(`/client-notices/${noticeId}`).expect(200);
    await clientPost(`/client/notices/${noticeId}/read`).expect(404);
    const res = await clientGet('/client/notices').expect(200);
    const data = res.body.data as { list: Array<{ id: number }> };
    expect(data.list.some((item) => item.id === noticeId)).toBe(false);
  });
});
