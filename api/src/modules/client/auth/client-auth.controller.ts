/**
 * 客户端鉴权控制器（/api/client/auth）。
 * 权限口径：全部接口或公开（登录/注册/刷新）或「登录即可」（资料/密码/登出），
 * 不使用后台 RBAC 权限码——客户端数据按 userId 天然隔离。
 */
import { Body, Controller, Delete, Get, Post, Put, Req, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Express, Request, Response } from 'express';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import { getClientIp } from '../../../common/log/operation-log.interceptor.js';
import { Public } from '../../../common/auth/auth.guard.js';
import { type ResponseEnvelope, RawResponse } from '../../../common/http/response.interceptor.js';
import { AppException } from '../../../common/exception/app.exception.js';
import { UPLOAD_MULTER_OPTIONS } from '../../../common/file/upload.config.js';
import type { CaptchaResult } from '../../../common/types.js';
import type { ClientUserContext } from '../../../common/types.js';
import { ClientAuthUserService, type ClientUserProfile } from './client-auth.service.js';
import { EmailCodeService } from './email-code.service.js';
import {
  ChangeClientPasswordDto,
  ClientLoginDto,
  ClientRefreshDto,
  ClientRegisterDto,
  DeleteClientAccountDto,
  SendEmailCodeDto,
  SetClientBackgroundDto,
  UpdateClientProfileDto,
  WechatLoginDto,
} from './dto.js';

/** 登录/注册响应。 */
export interface ClientAuthResult {
  accessToken: string;
  refreshToken: string;
  user: ClientUserProfile;
}

@Controller('client/auth')
export class ClientAuthController {
  constructor(
    private readonly clientAuth: ClientAuthUserService,
    private readonly emailCode: EmailCodeService,
  ) {}

  /** 发送邮箱验证码（注册/登录/重置密码；同邮箱同用途 60 秒只能发一次）。 */
  @Public()
  @Post('email-code')
  async sendEmailCode(@Body() dto: SendEmailCodeDto): Promise<ResponseEnvelope<null>> {
    await this.emailCode.issue(dto.email, dto.purpose);
    return { __raw: true, data: null, message: '验证码已发送，请查收邮箱' };
  }

  /** 图形验证码（登录/注册前拉取；关闭验证码时 enabled=false）。 */
  @Public()
  @Get('captcha')
  captcha(): Promise<CaptchaResult> {
    return this.clientAuth.createCaptcha();
  }

  /** 注册。 */
  @Public()
  @Post('register')
  async register(@Body() dto: ClientRegisterDto, @Req() req: Request): Promise<ResponseEnvelope<ClientAuthResult>> {
    const tokens = await this.clientAuth.register(
      dto.email,
      dto.password,
      dto.nickname,
      dto.emailCode,
      getClientIp(req),
      dto.agreed,
    );
    const user = await this.clientAuth.getProfile(this.userIdOf(tokens.accessToken));
    return { __raw: true, data: { ...tokens, user }, message: '注册成功' };
  }

  /** 登录。 */
  @Public()
  @Post('login')
  async login(@Body() dto: ClientLoginDto, @Req() req: Request): Promise<ResponseEnvelope<ClientAuthResult>> {
    const tokens = await this.clientAuth.login(dto.email, dto.password, getClientIp(req));
    const user = await this.clientAuth.getProfile(this.userIdOf(tokens.accessToken));
    return { __raw: true, data: { ...tokens, user }, message: '登录成功' };
  }

  /** 刷新令牌。 */
  @Public()
  @Post('refresh')
  async refresh(
    @Body() dto: ClientRefreshDto,
  ): Promise<ResponseEnvelope<{ accessToken: string; refreshToken: string }>> {
    const tokens = await this.clientAuth.refresh(dto.refreshToken);
    return { __raw: true, data: tokens, message: '刷新成功' };
  }

  /**
   * 微信小程序登录（wx.login 的 code → 我们自己的 JWT 双 token）。
   * 复用与邮箱登录完全相同的令牌体系，小程序后续所有 /api/client/* 接口通用。
   */
  @Public()
  @Post('wechat')
  async wechatLogin(@Body() dto: WechatLoginDto): Promise<ResponseEnvelope<ClientAuthResult>> {
    const tokens = await this.clientAuth.loginWithWechat(dto.code, dto.agreed);
    const user = await this.clientAuth.getProfile(this.userIdOf(tokens.accessToken));
    return { __raw: true, data: { ...tokens, user }, message: '登录成功' };
  }

  /** 我的资料。 */
  @Get('me')
  me(@CurrentClientUser() user: ClientUserContext): Promise<ClientUserProfile> {
    return this.clientAuth.getProfile(user.userId);
  }

  /**
   * 导出本人全部个人数据（JSON 附件下载；账号注销合规 / 商店审核用）。
   * 通过 @RawResponse 跳过统一响应体包装，直接以附件形式下发 JSON。
   */
  @Get('me/export')
  @RawResponse()
  async exportData(
    @CurrentClientUser() user: ClientUserContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const data = await this.clientAuth.exportData(user.userId);
    const filename = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return JSON.stringify(data, null, 2);
  }

  /** 更新资料。 */
  @Put('me')
  async updateProfile(
    @CurrentClientUser() user: ClientUserContext,
    @Body() dto: UpdateClientProfileDto,
  ): Promise<ResponseEnvelope<ClientUserProfile>> {
    const profile = await this.clientAuth.updateProfile(user.userId, dto);
    return { __raw: true, data: profile, message: '资料已更新' };
  }

  /** 上传头像（单文件；自动替换旧头像并清理原文件）。 */
  @Post('avatar')
  @UseInterceptors(AnyFilesInterceptor(UPLOAD_MULTER_OPTIONS))
  async uploadAvatar(
    @CurrentClientUser() user: ClientUserContext,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ResponseEnvelope<ClientUserProfile>> {
    const profile = await this.clientAuth.uploadAvatar(user.userId, files ?? []);
    return { __raw: true, data: profile, message: '头像已更新' };
  }

  /** 设置个人主页背景句签（cardId=0 恢复默认渐变；仅限已获得的句签）。 */
  @Put('me/background')
  async setBackground(
    @CurrentClientUser() user: ClientUserContext,
    @Body() dto: SetClientBackgroundDto,
  ): Promise<ResponseEnvelope<ClientUserProfile>> {
    const profile = await this.clientAuth.setBackgroundCard(user.userId, dto.cardId);
    return {
      __raw: true,
      data: profile,
      message: dto.cardId > 0 ? '背景已更新' : '已恢复默认背景',
    };
  }

  /** 修改密码。 */
  @Put('password')
  async changePassword(
    @CurrentClientUser() user: ClientUserContext,
    @Body() dto: ChangeClientPasswordDto,
  ): Promise<ResponseEnvelope<null>> {
    await this.clientAuth.changePassword(user.userId, dto.oldPassword, dto.newPassword, dto.emailCode);
    return { __raw: true, data: null, message: '密码已修改，请重新登录' };
  }

  /** 登出（服务端令旧令牌失效）。 */
  @Post('logout')
  async logout(@CurrentClientUser() user: ClientUserContext): Promise<ResponseEnvelope<null>> {
    await this.clientAuth.logout(user.userId);
    return { __raw: true, data: null, message: '已退出登录' };
  }

  /**
   * 发送注销验证码（只发给当前登录用户本人的邮箱）。
   * 与公开的 `email-code` 分开：注销验证码不能允许给任意邮箱发。
   */
  @Post('deletion-code')
  async sendDeletionCode(@CurrentClientUser() user: ClientUserContext): Promise<ResponseEnvelope<null>> {
    await this.clientAuth.sendDeletionCode(user.userId);
    return { __raw: true, data: null, message: '验证码已发送，请查收邮箱' };
  }

  /**
   * 注销账号（软删：令牌失效 + 身份匿名化 + 清空微信绑定 + 清除学习历史）。
   * **需二次身份校验**：邮箱账号传 emailCode（先调 `deletion-code`），
   * 微信账号传 wechatCode（wx.login 的 code），两者都不传会被拒。
   * 注销后原邮箱可重新注册；原微信因 openid 已解绑，再登录将生成全新账号。
   */
  @Delete('me')
  async deleteAccount(
    @CurrentClientUser() user: ClientUserContext,
    @Body() dto: DeleteClientAccountDto,
  ): Promise<ResponseEnvelope<null>> {
    await this.clientAuth.deleteAccount(user.userId, dto);
    return { __raw: true, data: null, message: '账号已注销' };
  }

  /**
   * 从 accessToken 解析 userId（注册/登录后回查资料用）。
   * 这里刻意不在控制器层验签：令牌是本服务刚签发的，直接解 payload 即可。
   */
  private userIdOf(accessToken: string): number {
    const parts = accessToken.split('.');
    if (parts.length !== 3) {
      throw AppException.unauthorized('令牌格式异常');
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { userId?: number };
    if (typeof payload.userId !== 'number') {
      throw AppException.unauthorized('令牌载荷异常');
    }
    return payload.userId;
  }
}
