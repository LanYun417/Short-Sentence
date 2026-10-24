/**
 * 客户端鉴权控制器（/api/client/auth）。
 * 权限口径：全部接口或公开（登录/注册/刷新）或「登录即可」（资料/密码/登出），
 * 不使用后台 RBAC 权限码——客户端数据按 userId 天然隔离。
 */
import { Body, Controller, Get, Post, Put, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import { Public } from '../../../common/auth/auth.guard.js';
import { type ResponseEnvelope } from '../../../common/http/response.interceptor.js';
import { AppException } from '../../../common/exception/app.exception.js';
import { UPLOAD_MULTER_OPTIONS } from '../../../common/file/upload.config.js';
import type { ClientUserContext } from '../../../common/types.js';
import { ClientAuthUserService, type ClientUserProfile } from './client-auth.service.js';
import {
  ChangeClientPasswordDto,
  ClientLoginDto,
  ClientRefreshDto,
  ClientRegisterDto,
  SetClientBackgroundDto,
  UpdateClientProfileDto,
} from './dto.js';

/** 登录/注册响应。 */
export interface ClientAuthResult {
  accessToken: string;
  refreshToken: string;
  user: ClientUserProfile;
}

@Controller('client/auth')
export class ClientAuthController {
  constructor(private readonly clientAuth: ClientAuthUserService) {}

  /** 注册。 */
  @Public()
  @Post('register')
  async register(@Body() dto: ClientRegisterDto): Promise<ResponseEnvelope<ClientAuthResult>> {
    const tokens = await this.clientAuth.register(dto.email, dto.password, dto.nickname);
    const user = await this.clientAuth.getProfile(this.userIdOf(tokens.accessToken));
    return { __raw: true, data: { ...tokens, user }, message: '注册成功' };
  }

  /** 登录。 */
  @Public()
  @Post('login')
  async login(@Body() dto: ClientLoginDto): Promise<ResponseEnvelope<ClientAuthResult>> {
    const tokens = await this.clientAuth.login(dto.email, dto.password);
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

  /** 我的资料。 */
  @Get('me')
  me(@CurrentClientUser() user: ClientUserContext): Promise<ClientUserProfile> {
    return this.clientAuth.getProfile(user.userId);
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
    await this.clientAuth.changePassword(user.userId, dto.oldPassword, dto.newPassword);
    return { __raw: true, data: null, message: '密码已修改，请重新登录' };
  }

  /** 登出（服务端令旧令牌失效）。 */
  @Post('logout')
  async logout(@CurrentClientUser() user: ClientUserContext): Promise<ResponseEnvelope<null>> {
    await this.clientAuth.logout(user.userId);
    return { __raw: true, data: null, message: '已退出登录' };
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
