/**
 * 客户端用户鉴权服务。
 * 模块职责：注册 / 登录 / 刷新 / 登出 / 资料读写 / 修改密码。
 * 与后台 AuthService 的关键差异：
 * - 用户表是 client_user（与 sys_user 隔离）；
 * - 令牌带 tokenType='client'，黑名单按 scope='client' 隔离；
 * - 不接图形验证码与 RBAC（客户端凭邮箱+密码，数据按 userId 天然隔离）。
 */
import { Injectable, Logger } from '@nestjs/common';
import crypto from 'node:crypto';
import { JwtService } from '../../../common/auth/jwt.service.js';
import { TokenBlacklistService } from '../../../common/auth/token-blacklist.service.js';
import { ClientAuthService } from '../../../common/auth/client-auth.service.js';
import { WechatService } from '../../../common/auth/wechat.service.js';
import { AppException } from '../../../common/exception/app.exception.js';
import { Status } from '../../../common/config/constants.js';
import { config } from '../../../common/config/config.js';
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_LENGTH_MESSAGE,
  assertPasswordNotContainsAccount,
} from '../../../common/auth/password-policy.js';
import { comparePassword, hashPassword } from '../../../common/utils/utils.js';
import type { Express } from 'express';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { FilesService } from '../../files/files.service.js';
import { AccountLockService } from '../../../common/auth/account-lock.service.js';
import { IpBanService } from '../../../common/security/ip-ban.service.js';
import { EmailCodeService } from './email-code.service.js';
import type { DeleteClientAccountDto } from './dto.js';
import { CaptchaService } from '../../../common/auth/captcha.service.js';
import type { CaptchaResult } from '../../../common/types.js';

/** 微信建号用的占位邮箱后缀（这类账号没有可收信的真实邮箱，不能发验证码）。 */
const WECHAT_EMAIL_SUFFIX = '@wx.local';

/** 对外返回的客户端用户信息（不含口令）。 */
export interface ClientUserProfile {
  id: number;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  birthday: string | null;
  gender: string;
  signature: string | null;
  /** 每日学习提醒邮件：1 订阅 / 0 不订阅 */
  emailReminder: number;
  /** 每周学习报告邮件：1 订阅 / 0 不订阅 */
  weeklyReportEmail: number;
  createdAt: Date;
  /** 个人主页背景句签 id（0 = 未设置，用默认品牌渐变） */
  bgCardId: number;
  /** 背景句签配图 URL（未设置 / 配图缺失时为 null，前端回退渐变） */
  bgImageUrl: string | null;
  /** 背景句签标题（未设置为 null） */
  bgCardTitle: string | null;
}

/** 登录/刷新返回的令牌对。 */
export interface ClientTokenPair {
  accessToken: string;
  refreshToken: string;
}

/** 个人数据导出结构（账号注销合规 / 商店审核用，一键下载 JSON）。 */
export interface ClientExportData {
  exportedAt: string;
  schemaVersion: number;
  profile: {
    id: number;
    email: string;
    nickname: string;
    gender: string;
    birthday: string | null;
    signature: string | null;
    xp: number;
    emailReminder: number;
    weeklyReportEmail: number;
    createdAt: string;
  };
  checkins: { date: string; doneCount: number; goalCount: number; streak: number }[];
  achievements: { code: string; unlockedAt: string }[];
  studyRecords: {
    sentenceId: number;
    userAnswer: string;
    isCorrect: boolean;
    elapsedMs: number;
    reviewLevel: number;
    createdAt: string;
  }[];
  collectedCards: { sentenceCardId: number; obtainedAt: string }[];
  chainEntries: { id: number; contentEn: string; contentZh: string | null; status: string; createdAt: string }[];
}

@Injectable()
export class ClientAuthUserService {
  private readonly logger = new Logger(ClientAuthUserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly blacklist: TokenBlacklistService,
    private readonly clientAuth: ClientAuthService,
    private readonly filesService: FilesService,
    private readonly captchaService: CaptchaService,
    private readonly accountLock: AccountLockService,
    private readonly ipBan: IpBanService,
    private readonly emailCode: EmailCodeService,
    private readonly wechat: WechatService,
  ) {}

  /** 图形验证码（登录/注册用；服务端关闭验证码时 enabled=false，前端不渲染输入框）。 */
  async createCaptcha(): Promise<CaptchaResult> {
    return this.captchaService.createCaptcha();
  }

  /** 注册（邮箱唯一；昵称缺省取邮箱前缀）。注册时必须已同意用户协议与隐私政策。 */
  async register(
    email: string,
    password: string,
    nickname?: string,
    emailCode?: string,
    clientIp?: string,
    agreed?: boolean,
  ): Promise<ClientTokenPair> {
    const normalizedEmail = email.trim().toLowerCase();
    // 记录一次注册尝试（按 IP 自然日计数；超过阈值自动封禁该 IP）
    await this.ipBan.recordRegisterAttempt(clientIp);
    // 注册必须先验证邮箱：这是「邮箱归属」的唯一凭证，也挡掉脚本批量注册
    if (!emailCode || !(await this.emailCode.verify(normalizedEmail, 'register', emailCode))) {
      throw AppException.badRequest('邮箱验证码错误或已过期');
    }
    // 同意协议是注册的前置条件（DTO 已校验，服务端再兜底一次：service 也可能被内部复用）
    if (agreed !== true) {
      throw AppException.badRequest('请先阅读并同意用户协议与隐私政策');
    }
    this.assertPasswordStrength(password, normalizedEmail);

    const existing = await this.clientAuth.findByEmail(normalizedEmail);
    if (existing) {
      throw AppException.conflict('该邮箱已注册');
    }

    const user = await this.prisma.clientUser.create({
      data: {
        email: normalizedEmail,
        password: await hashPassword(password),
        nickname: nickname?.trim() || normalizedEmail.split('@')[0].slice(0, 50),
        // 新用户默认开启「每日学习提醒（邮件）」；可在「我的 → 基本资料」随时关闭。
        // 显式写入而非依赖列默认值：线上库的列默认仍是 0，靠服务层保证注册即开启。
        emailReminder: 1,
      },
      select: { id: true },
    });

    this.logger.log(`[ClientAuth] 新用户注册: ${normalizedEmail}`);
    return this.issueTokens(Number(user.id), normalizedEmail);
  }

  /** 登录（邮箱 + 密码）。 */
  async login(email: string, password: string, clientIp?: string): Promise<ClientTokenPair> {
    const normalizedEmail = email.trim().toLowerCase();
    // 登录不再要求验证码（产品决定：输入账号密码即可），防爆破靠三层：
    // ① 按 IP 的登录限流（RateLimitMiddleware）；② 按账号的失败锁定（AccountLockService）；
    // ③ 按 IP 的失败计数（IpBanService，超阈值封 IP，兜底挡「换账号爆破」）。
    // 按账号维度的失败锁定（与按 IP 的限流互补；不透露账号是否存在）
    await this.accountLock.assertNotLocked('client', normalizedEmail);

    const user = await this.clientAuth.findByEmail(normalizedEmail);
    // 统一文案：不区分「邮箱不存在」与「密码错误」，防账号枚举
    if (!user || !(await comparePassword(password, user.password))) {
      await this.accountLock.recordFailure('client', normalizedEmail);
      // 攻击信号：单 IP 短时登录失败过多 → 自动封禁该 IP
      await this.ipBan.recordAttack(clientIp, 'login');
      throw AppException.unauthorized('邮箱或密码错误');
    }
    if (user.status !== Status.ENABLED) {
      throw AppException.unauthorized('账号已被禁用');
    }
    // 登录成功即建立新会话：清掉旧登出标记（iat 秒级精度防误杀，同后台口径）
    await this.blacklist.clearLogout(Number(user.id), 'client');
    await this.accountLock.clear('client', normalizedEmail);
    // 登录成功：清空该 IP 的登录失败计数，避免误伤共享 IP 的正常用户
    await this.ipBan.clearAttack(clientIp, 'login');
    await this.prisma.clientUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueTokens(Number(user.id), normalizedEmail);
  }

  /**
   * 邮箱验证码登录（先调 `POST /client/auth/email-code`（purpose=login）拿码）。
   *
   * 与密码登录共用防爆破三层（限流 / 账号锁定 / IP 封禁），但**不自动建号**——
   * 建号必须走注册（含协议勾选同意时点），验证码登录只服务已注册用户；
   * 邮箱已被验证码证明归属，未注册时明确提示去注册。
   */
  async loginByCode(email: string, emailCode: string, clientIp?: string): Promise<ClientTokenPair> {
    const normalizedEmail = email.trim().toLowerCase();
    await this.accountLock.assertNotLocked('client', normalizedEmail);

    // 先验码：码不对就记失败/攻击信号（与密码登录同一套防爆破口径）
    if (!(await this.emailCode.verify(normalizedEmail, 'login', emailCode))) {
      await this.accountLock.recordFailure('client', normalizedEmail);
      await this.ipBan.recordAttack(clientIp, 'login');
      throw AppException.unauthorized('邮箱或验证码错误');
    }

    const user = await this.clientAuth.findByEmail(normalizedEmail);
    if (!user) {
      throw AppException.badRequest('该邮箱未注册，请先注册');
    }
    if (user.status !== Status.ENABLED) {
      throw AppException.unauthorized('账号已被禁用');
    }
    // 与密码登录同一套会话清理
    await this.blacklist.clearLogout(Number(user.id), 'client');
    await this.accountLock.clear('client', normalizedEmail);
    await this.ipBan.clearAttack(clientIp, 'login');
    await this.prisma.clientUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueTokens(Number(user.id), normalizedEmail);
  }

  /** 刷新令牌（refreshToken 必须也是 client 类型）。 */
  async refresh(refreshToken: string): Promise<ClientTokenPair> {
    let payload;
    try {
      payload = await this.jwtService.verifyRefreshToken(refreshToken);
    } catch {
      throw AppException.unauthorized('刷新令牌无效或已过期');
    }
    // 关键：客户端 refreshToken 不能被用来刷新后台令牌（反之亦然）
    if (payload.tokenType !== 'client') {
      throw AppException.unauthorized('刷新令牌无效或已过期');
    }
    const user = await this.clientAuth.loadClientUser(payload.userId);
    if (!user || user.status !== Status.ENABLED) {
      throw AppException.unauthorized('账号不存在或已被禁用');
    }
    if (user.passwordChangedAt && payload.iat * 1000 < new Date(user.passwordChangedAt).getTime()) {
      throw AppException.unauthorized('密码已修改，请重新登录');
    }
    if (await this.blacklist.isTokenRevoked(payload.userId, payload.iat, 'client')) {
      throw AppException.unauthorized('登录状态已失效，请重新登录');
    }
    return this.issueTokens(payload.userId, user.email);
  }

  /** 登出（写入 scope=client 黑名单，令旧令牌立即失效）。 */
  async logout(userId: number): Promise<void> {
    await this.blacklist.recordLogout(userId, 'client');
  }

  /**
   * 微信小程序登录（code → openid → 我们自己的 JWT 双 token）。
   * - 已有 openid 的用户：直接签发令牌（status≠启用仍判禁用）；
   * - 新用户：用 openid 派生唯一占位邮箱（无密码，纯微信登录），自动建号——
   *   自动建号即注册，**必须已勾选同意协议**（老用户登录无同意时点，不要求）。
   * 复用与邮箱登录同一套令牌体系（tokenType='client'），后续所有 /api/client/* 通用。
   */
  async loginWithWechat(code: string, agreed?: boolean): Promise<ClientTokenPair> {
    const session = await this.wechat.code2Session(code);
    const existing = await this.clientAuth.findByWechatOpenid(session.openid);
    if (existing) {
      if (existing.status !== Status.ENABLED) {
        throw AppException.unauthorized('账号已被禁用');
      }
      await this.blacklist.clearLogout(Number(existing.id), 'client');
      await this.prisma.clientUser.update({
        where: { id: existing.id },
        data: { lastLoginAt: new Date() },
      });
      return this.issueTokens(Number(existing.id), existing.email);
    }

    // 新用户：openid 作为唯一凭据派生邮箱占位；口令随机不可登录，仅微信通道可用
    // 自动建号 = 注册，未勾选同意协议一律拦住（DTO 老用户不校验，只在此裁决）
    if (agreed !== true) {
      throw AppException.badRequest('请先阅读并同意用户协议与隐私政策');
    }
    const email = `${session.openid}${WECHAT_EMAIL_SUFFIX}`;
    const created = await this.prisma.clientUser.create({
      data: {
        email,
        password: await hashPassword(crypto.randomBytes(24).toString('hex')),
        nickname: '微信用户',
        wechatOpenid: session.openid,
        wechatUnionid: session.unionid ?? null,
        // 新用户默认开启每日学习提醒邮件（与邮箱注册一致）
        emailReminder: 1,
      },
      select: { id: true, email: true },
    });
    this.logger.log(`[ClientAuth] 微信新用户注册: ${session.openid}`);
    return this.issueTokens(Number(created.id), created.email);
  }

  /**
   * 发送注销验证码（**只发给当前登录用户本人**）。
   *
   * 为什么不复用公开的 `POST /client/auth/email-code`：那个端点无需登录，
   * 一旦允许 purpose=delete，任何人都能给任意邮箱发「注销账号验证码」——
   * 既是骚扰，也会让用户收到一封莫名其妙的邮件。这里锁定本人邮箱。
   */
  async sendDeletionCode(userId: number): Promise<void> {
    const user = await this.prisma.clientUser.findUnique({
      where: { id: BigInt(userId) },
      select: { email: true },
    });
    if (!user) {
      throw AppException.unauthorized('用户不存在');
    }
    if (user.email.endsWith(WECHAT_EMAIL_SUFFIX)) {
      throw AppException.badRequest('微信账号没有绑定邮箱，请用微信身份校验');
    }
    await this.emailCode.issue(user.email, 'delete');
  }

  /**
   * 注销账号（软删）。
   * - **先做二次身份校验**（见 assertDeletionIdentity）：注销不可逆，不能只凭 accessToken；
   * - 令所有令牌立即失效（scope=client 黑名单）；
   * - 匿名化身份字段（昵称/邮箱/签名/头像/背景），清空微信绑定，使旧微信无法再登录原账号；
   * - 删除学习历史（sentence_record，含用户输入的个人数据）；打卡/成就/句签/接龙等保留——
   *   其作者身份已随账号匿名化（显示「已注销用户」），符合「投稿/接龙保留匿名」的隐私政策口径；
   * - 落一条**不含任何用户标识**的注销记录，供产品分析与合规审计。
   */
  async deleteAccount(userId: number, dto: DeleteClientAccountDto = {}): Promise<void> {
    const uid = BigInt(userId);
    const user = await this.prisma.clientUser.findUnique({
      where: { id: uid },
      select: { email: true, wechatOpenid: true, xp: true, createdAt: true },
    });
    if (!user) {
      throw AppException.unauthorized('用户不存在');
    }

    await this.assertDeletionIdentity(userId, user, dto);

    // 快照必须在删除前取：记录写完后 sentence_record 已被清空，就查不到了
    const [checkinDays, answerCount] = await Promise.all([
      this.prisma.userCheckin.count({ where: { userId: uid } }),
      this.prisma.sentenceRecord.count({ where: { userId: uid } }),
    ]);

    // 先令所有旧令牌失效，避免注销后仍能凭旧 token 操作
    await this.blacklist.recordLogout(userId, 'client');
    const random = crypto.randomBytes(6).toString('hex');
    await this.prisma.$transaction(async (tx) => {
      // 匿名留痕：刻意不写 userId / 邮箱，注销后与身份彻底脱钩
      await tx.clientAccountDeletion.create({
        data: {
          reasonType: dto.reasonType ?? 'unspecified',
          reasonDetail: dto.reasonDetail?.trim() || null,
          xp: user.xp,
          checkinDays,
          answerCount,
          registeredAt: user.createdAt,
        },
      });
      await tx.clientUser.update({
        where: { id: uid },
        data: {
          deletedAt: new Date(),
          nickname: '已注销用户',
          // 释放原邮箱：占位邮箱唯一，允许后续用原邮箱重新注册
          email: `deleted_${userId}_${random}@deleted.local`,
          password: await hashPassword(crypto.randomBytes(24).toString('hex')),
          signature: null,
          birthday: null,
          gender: 'secret',
          avatarFileId: 0n,
          bgCardId: 0n,
          wechatOpenid: null,
          wechatUnionid: null,
          emailReminder: 0,
        },
      });
      // 学习历史属个人数据，随注销清除
      await tx.sentenceRecord.deleteMany({ where: { userId: uid } });
    });
    this.logger.log(`[ClientAuth] 用户注销: ${userId}（原因: ${dto.reasonType ?? '未选择'}）`);
  }

  /**
   * 注销前的二次身份校验：按账号类型选一条**可验证**的通道。
   *
   * - 邮箱账号 → 邮箱验证码（先调 sendDeletionCode 发送，5 分钟有效、一次性）；
   * - 微信账号 → 小程序 `wx.login` 的 code 反查 openid，必须与账号绑定的一致；
   *   这条比验证码更顺：wx.login 无感，用户只需点一次授权。
   * - 兜底：微信建号的账号在「服务端已停用微信登录」时没有任何可验证通道，
   *   此时仅凭登录态放行并告警——否则这类用户永远注销不掉，违反隐私政策承诺。
   */
  private async assertDeletionIdentity(
    userId: number,
    user: { email: string; wechatOpenid: string | null },
    dto: DeleteClientAccountDto,
  ): Promise<void> {
    if (!user.email.endsWith(WECHAT_EMAIL_SUFFIX)) {
      if (!dto.emailCode) {
        throw AppException.badRequest('请输入邮箱验证码（先点「获取验证码」再提交）');
      }
      const ok = await this.emailCode.verify(user.email, 'delete', dto.emailCode);
      if (!ok) {
        throw AppException.badRequest('验证码错误或已过期，请重新获取');
      }
      return;
    }

    if (!user.wechatOpenid) {
      // 既没有真实邮箱、也没有微信绑定：属于历史脏数据，无任何通道可验
      this.logger.warn(`[ClientAuth] 账号无可验证通道，仅凭登录态注销: ${userId}`);
      return;
    }

    const { appId, appSecret } = config.wechat.miniProgram;
    if (!appId || !appSecret) {
      this.logger.warn(`[ClientAuth] 微信登录未配置，跳过二次校验直接注销: ${userId}`);
      return;
    }

    if (!dto.wechatCode) {
      throw AppException.badRequest('请重新授权微信身份后再注销');
    }
    const session = await this.wechat.code2Session(dto.wechatCode);
    if (session.openid !== user.wechatOpenid) {
      throw AppException.badRequest('微信身份校验失败，请用注册本账号的微信号操作');
    }
  }

  /**
   * 导出本人全部个人数据（JSON，供下载）。
   * 仅聚合本用户维度的数据：资料 / 打卡 / 成就 / 学习记录 / 收藏句签 / 接龙投稿。
   */
  async exportData(userId: number): Promise<ClientExportData> {
    const uid = BigInt(userId);
    const [profile, checkins, achievements, records, cards, chains] = await Promise.all([
      this.prisma.clientUser.findUnique({
        where: { id: uid },
        select: {
          id: true,
          email: true,
          nickname: true,
          gender: true,
          birthday: true,
          signature: true,
          xp: true,
          emailReminder: true,
          weeklyReportEmail: true,
          createdAt: true,
        },
      }),
      this.prisma.userCheckin.findMany({ where: { userId: uid }, orderBy: { checkinDate: 'asc' } }),
      this.prisma.userAchievement.findMany({ where: { userId: uid }, orderBy: { unlockedAt: 'asc' } }),
      this.prisma.sentenceRecord.findMany({ where: { userId: uid }, orderBy: { createdAt: 'asc' } }),
      this.prisma.userSentenceCard.findMany({ where: { userId: uid }, orderBy: { obtainedAt: 'asc' } }),
      this.prisma.chainEntry.findMany({ where: { userId: uid }, orderBy: { createdAt: 'asc' } }),
    ]);
    if (!profile) {
      throw AppException.unauthorized('用户不存在');
    }
    return {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      profile: {
        id: Number(profile.id),
        email: profile.email,
        nickname: profile.nickname,
        gender: profile.gender,
        birthday: profile.birthday ? profile.birthday.toISOString().slice(0, 10) : null,
        signature: profile.signature,
        xp: profile.xp,
        emailReminder: profile.emailReminder,
        weeklyReportEmail: profile.weeklyReportEmail,
        createdAt: profile.createdAt.toISOString(),
      },
      checkins: checkins.map((c) => ({
        date: c.checkinDate,
        doneCount: c.doneCount,
        goalCount: c.goalCount,
        streak: c.streak,
      })),
      achievements: achievements.map((a) => ({
        code: a.achievementCode,
        unlockedAt: a.unlockedAt.toISOString(),
      })),
      studyRecords: records.map((r) => ({
        sentenceId: Number(r.sentenceId),
        userAnswer: r.userAnswer,
        isCorrect: r.isCorrect === 1,
        elapsedMs: r.elapsedMs,
        reviewLevel: r.reviewLevel,
        createdAt: r.createdAt.toISOString(),
      })),
      collectedCards: cards.map((c) => ({
        sentenceCardId: Number(c.sentenceCardId),
        obtainedAt: c.obtainedAt.toISOString(),
      })),
      chainEntries: chains.map((c) => ({
        id: Number(c.id),
        contentEn: c.contentEn,
        contentZh: c.contentZh,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }

  /** 我的资料。 */
  async getProfile(userId: number): Promise<ClientUserProfile> {
    const row = await this.prisma.clientUser.findUnique({
      where: { id: BigInt(userId) },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarFileId: true,
        birthday: true,
        gender: true,
        signature: true,
        emailReminder: true,
        weeklyReportEmail: true,
        bgCardId: true,
        createdAt: true,
      },
    });
    if (!row) {
      throw AppException.unauthorized('用户不存在');
    }
    return {
      id: Number(row.id),
      email: row.email,
      nickname: row.nickname,
      avatarUrl: row.avatarFileId > 0n ? await this.resolveFileUrl(Number(row.avatarFileId)) : null,
      birthday: row.birthday ? row.birthday.toISOString().slice(0, 10) : null,
      gender: row.gender,
      signature: row.signature,
      emailReminder: row.emailReminder,
      weeklyReportEmail: row.weeklyReportEmail,
      createdAt: row.createdAt,
      ...(await this.resolveBackground(Number(row.bgCardId))),
    };
  }

  /**
   * 设置个人主页背景句签（cardId = 0 表示恢复默认渐变）。
   * 只允许用**本人已获得**的句签——否则等于能拿别人的收藏当背景。
   */
  async setBackgroundCard(userId: number, cardId: number): Promise<ClientUserProfile> {
    const uid = BigInt(userId);
    const normalized = Math.max(0, Math.floor(cardId));
    if (normalized > 0) {
      const owned = await this.prisma.userSentenceCard.findUnique({
        where: { userId_sentenceCardId: { userId: uid, sentenceCardId: BigInt(normalized) } },
        select: { id: true },
      });
      if (!owned) {
        throw AppException.badRequest('只能用已获得的句签作为背景');
      }
    }
    await this.prisma.clientUser.update({
      where: { id: uid },
      data: { bgCardId: BigInt(normalized) },
    });
    return this.getProfile(userId);
  }

  /** 解析背景句签（配图 URL + 标题）；未设置或配图缺失时回退到 null。 */
  private async resolveBackground(bgCardId: number): Promise<{
    bgCardId: number;
    bgImageUrl: string | null;
    bgCardTitle: string | null;
  }> {
    if (bgCardId <= 0) {
      return { bgCardId: 0, bgImageUrl: null, bgCardTitle: null };
    }
    const card = await this.prisma.dailySentenceCard.findUnique({
      where: { id: BigInt(bgCardId) },
      select: { titleZh: true, imageFileId: true },
    });
    if (!card) {
      return { bgCardId: 0, bgImageUrl: null, bgCardTitle: null };
    }
    return {
      bgCardId,
      bgImageUrl: card.imageFileId > 0n ? await this.resolveFileUrl(Number(card.imageFileId)) : null,
      bgCardTitle: card.titleZh,
    };
  }

  /**
   * 上传头像：落盘 → 关联到当前用户 → 清理被替换的旧头像 → 返回最新资料。
   * 复用 admin 的 FilesService（幻数校验 / 秒传去重 / 目录分组不重造一套）。
   */
  async uploadAvatar(userId: number, files: Express.Multer.File[]): Promise<ClientUserProfile> {
    if (!files || files.length === 0) {
      throw AppException.badRequest('请选择要上传的头像');
    }
    const previous = await this.prisma.clientUser.findUnique({
      where: { id: BigInt(userId) },
      select: { avatarFileId: true },
    });

    const [saved] = await this.filesService.saveFiles(files, userId, { bizType: 'client-avatar' });
    if (!saved) {
      throw AppException.badRequest('头像保存失败');
    }
    const profile = await this.updateProfile(userId, { avatarFileId: saved.id });

    // 旧头像已被替换：清掉孤儿文件，避免 uploads 只增不减
    const previousId = previous ? Number(previous.avatarFileId) : 0;
    if (previousId > 0 && previousId !== saved.id) {
      await this.filesService.deleteFile(previousId).catch((error: unknown) => {
        this.logger.warn(`旧头像清理失败（不影响本次上传）: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
    return profile;
  }

  /** 更新资料（只更新传入的字段）。 */
  async updateProfile(
    userId: number,
    input: {
      nickname?: string;
      avatarFileId?: number;
      birthday?: string;
      gender?: string;
      signature?: string;
      emailReminder?: number;
      weeklyReportEmail?: number;
    },
  ): Promise<ClientUserProfile> {
    const data: Record<string, unknown> = {};
    if (input.nickname !== undefined) {
      data.nickname = input.nickname.trim();
    }
    if (input.avatarFileId !== undefined) {
      data.avatarFileId = BigInt(Math.max(0, Math.floor(input.avatarFileId)));
    }
    if (input.birthday !== undefined) {
      data.birthday = new Date(input.birthday);
    }
    if (input.gender !== undefined) {
      data.gender = input.gender;
    }
    if (input.signature !== undefined) {
      data.signature = input.signature.trim() || null;
    }
    if (input.emailReminder !== undefined) {
      data.emailReminder = input.emailReminder === 1 ? 1 : 0;
    }
    if (input.weeklyReportEmail !== undefined) {
      data.weeklyReportEmail = input.weeklyReportEmail === 1 ? 1 : 0;
    }
    if (Object.keys(data).length === 0) {
      return this.getProfile(userId);
    }
    await this.prisma.clientUser.update({ where: { id: BigInt(userId) }, data });
    return this.getProfile(userId);
  }

  /** 修改密码（校验旧密码；改后旧令牌因 passwordChangedAt 全部失效）。 */
  async changePassword(userId: number, oldPassword: string, newPassword: string, emailCode: string): Promise<void> {
    const user = await this.prisma.clientUser.findUnique({
      where: { id: BigInt(userId) },
      select: { id: true, email: true, password: true },
    });
    if (!user) {
      throw AppException.unauthorized('用户不存在');
    }
    if (!(await comparePassword(oldPassword, user.password))) {
      throw AppException.unauthorized('原密码不正确');
    }
    // 邮箱验证码：光有旧密码不够（密码可能已泄露），必须证明对邮箱的控制权
    if (!(await this.emailCode.verify(user.email, 'reset', emailCode))) {
      throw AppException.badRequest('邮箱验证码错误或已过期');
    }
    this.assertPasswordStrength(newPassword, user.email);
    await this.prisma.clientUser.update({
      where: { id: user.id },
      data: { password: await hashPassword(newPassword), passwordChangedAt: new Date() },
    });
  }

  /** 签发 client 体系令牌对。 */
  private async issueTokens(userId: number, email: string): Promise<ClientTokenPair> {
    const payload = { userId, username: email, tokenType: 'client' as const };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAccessToken(payload),
      this.jwtService.signRefreshToken(payload),
    ]);
    return { accessToken, refreshToken };
  }

  /** 头像文件 id → 访问 URL（文件不存在时返回 null）。 */
  private async resolveFileUrl(fileId: number): Promise<string | null> {
    const file = await this.prisma.file.findUnique({
      where: { id: BigInt(fileId) },
      select: { fileUrl: true },
    });
    return file?.fileUrl ?? null;
  }

  /** 口令强度校验（与后台同策略；账号片段取邮箱前缀）。 */
  private assertPasswordStrength(password: string, email: string): void {
    if (password.length < config.password.minLength || password.length > config.password.maxLength) {
      throw AppException.badRequest(PASSWORD_LENGTH_MESSAGE);
    }
    if (!PASSWORD_COMPLEXITY_REGEX.test(password)) {
      throw AppException.badRequest(PASSWORD_COMPLEXITY_MESSAGE);
    }
    assertPasswordNotContainsAccount(password, email.split('@')[0]);
  }
}
