/**
 * 客户端用户鉴权服务。
 * 模块职责：注册 / 登录 / 刷新 / 登出 / 资料读写 / 修改密码。
 * 与后台 AuthService 的关键差异：
 * - 用户表是 client_user（与 sys_user 隔离）；
 * - 令牌带 tokenType='client'，黑名单按 scope='client' 隔离；
 * - 不接图形验证码与 RBAC（客户端凭邮箱+密码，数据按 userId 天然隔离）。
 */
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '../../../common/auth/jwt.service.js';
import { TokenBlacklistService } from '../../../common/auth/token-blacklist.service.js';
import { ClientAuthService } from '../../../common/auth/client-auth.service.js';
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
import { PrismaService } from '../../../prisma/prisma.service.js';

/** 对外返回的客户端用户信息（不含口令）。 */
export interface ClientUserProfile {
  id: number;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  birthday: string | null;
  gender: string;
  signature: string | null;
  createdAt: Date;
}

/** 登录/刷新返回的令牌对。 */
export interface ClientTokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class ClientAuthUserService {
  private readonly logger = new Logger(ClientAuthUserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly blacklist: TokenBlacklistService,
    private readonly clientAuth: ClientAuthService,
  ) {}

  /** 注册（邮箱唯一；昵称缺省取邮箱前缀）。 */
  async register(email: string, password: string, nickname?: string): Promise<ClientTokenPair> {
    const normalizedEmail = email.trim().toLowerCase();
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
      },
      select: { id: true },
    });

    this.logger.log(`[ClientAuth] 新用户注册: ${normalizedEmail}`);
    return this.issueTokens(Number(user.id), normalizedEmail);
  }

  /** 登录（邮箱 + 密码）。 */
  async login(email: string, password: string): Promise<ClientTokenPair> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.clientAuth.findByEmail(normalizedEmail);
    // 统一文案：不区分「邮箱不存在」与「密码错误」，防账号枚举
    if (!user || !(await comparePassword(password, user.password))) {
      throw AppException.unauthorized('邮箱或密码错误');
    }
    if (user.status !== Status.ENABLED) {
      throw AppException.unauthorized('账号已被禁用');
    }
    // 登录成功即建立新会话：清掉旧登出标记（iat 秒级精度防误杀，同后台口径）
    await this.blacklist.clearLogout(Number(user.id), 'client');
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
      createdAt: row.createdAt,
    };
  }

  /** 更新资料（只更新传入的字段）。 */
  async updateProfile(
    userId: number,
    input: { nickname?: string; avatarFileId?: number; birthday?: string; gender?: string; signature?: string },
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
    if (Object.keys(data).length === 0) {
      return this.getProfile(userId);
    }
    await this.prisma.clientUser.update({ where: { id: BigInt(userId) }, data });
    return this.getProfile(userId);
  }

  /** 修改密码（校验旧密码；改后旧令牌因 passwordChangedAt 全部失效）。 */
  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
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
