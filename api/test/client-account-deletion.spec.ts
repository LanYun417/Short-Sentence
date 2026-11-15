import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/common/config/config.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { JwtService } from '../src/common/auth/jwt.service.js';
import type { TokenBlacklistService } from '../src/common/auth/token-blacklist.service.js';
import type { ClientAuthService } from '../src/common/auth/client-auth.service.js';
import type { CaptchaService } from '../src/common/auth/captcha.service.js';
import type { AccountLockService } from '../src/common/auth/account-lock.service.js';
import type { IpBanService } from '../src/common/security/ip-ban.service.js';
import type { EmailCodeService } from '../src/modules/client/auth/email-code.service.js';
import type { WechatService } from '../src/common/auth/wechat.service.js';
import type { FilesService } from '../src/modules/files/files.service.js';
import { ClientAuthUserService } from '../src/modules/client/auth/client-auth.service.js';

/**
 * 账号注销：钉住「不可逆操作必须二次校验身份」。
 *
 * 这里守的不是功能，而是**安全边界**：
 * 1. 只凭 accessToken（可能是捡到的手机）不能注销账号；
 * 2. 邮箱账号必须验本人邮箱验证码；
 * 3. 微信账号必须 openid 一致；
 * 4. 注销记录里不能出现任何用户标识（隐私政策承诺「注销即脱钩」）。
 */

/** 直接改 config 里的微信密钥（`as const` 只是编译期约束，运行时是普通对象）。 */
const miniProgram = config.wechat.miniProgram as unknown as { appId: string; appSecret: string };

interface Harness {
  service: ClientAuthUserService;
  /** 落库的注销记录 */
  created: Array<Record<string, unknown>>;
  /** 匿名化更新的 data */
  updated: Array<Record<string, unknown>>;
  recordLogout: ReturnType<typeof vi.fn>;
  verify: ReturnType<typeof vi.fn>;
  code2Session: ReturnType<typeof vi.fn>;
}

function makeService(options: { email?: string; openid?: string | null; codeOk?: boolean } = {}): Harness {
  const email = options.email ?? 'user@example.com';
  const openid = options.openid ?? null;

  const created: Array<Record<string, unknown>> = [];
  const updated: Array<Record<string, unknown>> = [];
  const recordLogout = vi.fn(async () => undefined);
  const verify = vi.fn(async () => options.codeOk ?? true);
  const code2Session = vi.fn(async () => ({ openid: 'o-matched', sessionKey: 'sk' }));

  const tx = {
    clientAccountDeletion: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return data;
      }),
    },
    clientUser: {
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        updated.push(data);
        return data;
      }),
    },
    sentenceRecord: { deleteMany: vi.fn(async () => ({ count: 0 })) },
  };

  const prisma = {
    clientUser: {
      findUnique: vi.fn(async () => ({
        email,
        wechatOpenid: openid,
        xp: 120,
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
      })),
    },
    userCheckin: { count: vi.fn(async () => 7) },
    sentenceRecord: { count: vi.fn(async () => 42) },
    $transaction: vi.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  const service = new ClientAuthUserService(
    prisma as unknown as PrismaService,
    {} as unknown as JwtService,
    { recordLogout } as unknown as TokenBlacklistService,
    {} as unknown as ClientAuthService,
    {} as unknown as FilesService,
    {} as unknown as CaptchaService,
    {} as unknown as AccountLockService,
    {} as unknown as IpBanService,
    { verify } as unknown as EmailCodeService,
    { code2Session } as unknown as WechatService,
  );

  return { service, created, updated, recordLogout, verify, code2Session };
}

afterEach(() => {
  vi.restoreAllMocks();
  miniProgram.appId = '';
  miniProgram.appSecret = '';
});

describe('账号注销 · 二次身份校验', () => {
  it('邮箱账号不带验证码 → 拒绝，且不产生任何写操作', async () => {
    const h = makeService();
    await expect(h.service.deleteAccount(1, {})).rejects.toThrow(/验证码/);
    expect(h.created).toHaveLength(0);
    expect(h.updated).toHaveLength(0);
  });

  it('邮箱账号验证码错误 → 拒绝', async () => {
    const h = makeService({ codeOk: false });
    await expect(h.service.deleteAccount(1, { emailCode: '000000' })).rejects.toThrow(/验证码/);
    expect(h.created).toHaveLength(0);
  });

  it('邮箱账号验证码正确 → 落匿名记录 + 匿名化身份 + 令牌失效', async () => {
    const h = makeService();
    await h.service.deleteAccount(1, { emailCode: '123456', reasonType: 'too_hard', reasonDetail: ' 太难了 ' });

    expect(h.verify).toHaveBeenCalledWith('user@example.com', 'delete', '123456');
    expect(h.created[0]).toMatchObject({
      reasonType: 'too_hard',
      reasonDetail: '太难了',
      xp: 120,
      checkinDays: 7,
      answerCount: 42,
    });
    // 隐私边界：记录里不能有 userId / 邮箱
    expect(Object.keys(h.created[0])).not.toContain('userId');
    expect(Object.keys(h.created[0])).not.toContain('email');

    expect(h.updated[0]).toMatchObject({ nickname: '已注销用户', wechatOpenid: null });
    expect(h.updated[0].deletedAt).toBeInstanceOf(Date);
    expect(h.recordLogout).toHaveBeenCalledWith(1, 'client');
  });

  it('未选原因 → 落 unspecified（不能拿问卷卡住注销）', async () => {
    const h = makeService();
    await h.service.deleteAccount(1, { emailCode: '123456' });
    expect(h.created[0]).toMatchObject({ reasonType: 'unspecified', reasonDetail: null });
  });

  it('微信账号且服务端未配密钥 → 兜底放行（否则这类用户永远注销不掉）', async () => {
    miniProgram.appId = '';
    miniProgram.appSecret = '';
    const h = makeService({ email: 'o_abc@wx.local', openid: 'o_abc' });
    await h.service.deleteAccount(1, {});
    expect(h.created).toHaveLength(1);
  });

  it('微信账号缺 wechatCode → 拒绝', async () => {
    miniProgram.appId = 'app-id';
    miniProgram.appSecret = 'app-secret';
    const h = makeService({ email: 'o_abc@wx.local', openid: 'o_abc' });
    await expect(h.service.deleteAccount(1, {})).rejects.toThrow(/微信身份/);
    expect(h.created).toHaveLength(0);
  });

  it('微信账号 openid 不一致 → 拒绝（换号也注销不了别人的账号）', async () => {
    miniProgram.appId = 'app-id';
    miniProgram.appSecret = 'app-secret';
    const h = makeService({ email: 'o_abc@wx.local', openid: 'o_abc' });
    h.code2Session.mockResolvedValueOnce({ openid: 'o-someone-else', sessionKey: 'sk' });
    await expect(h.service.deleteAccount(1, { wechatCode: 'code' })).rejects.toThrow(/微信身份/);
    expect(h.created).toHaveLength(0);
  });

  it('微信账号 openid 一致 → 通过', async () => {
    miniProgram.appId = 'app-id';
    miniProgram.appSecret = 'app-secret';
    const h = makeService({ email: 'o_abc@wx.local', openid: 'o-matched' });
    await h.service.deleteAccount(1, { wechatCode: 'code' });
    expect(h.created).toHaveLength(1);
  });
});
