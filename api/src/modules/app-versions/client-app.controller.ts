/**
 * App 下载对外接口（/api/client/app）。
 *
 * 为什么下载走 api 而不是 `/static` 直链：
 * 1. `/static` 有防盗链（Referer 白名单），用户从浏览器直接点链接（无 Referer）会被 403；
 * 2. 下载量是运营指标，需要按版本计数；
 * 3. 文件名要统一成 `short-sentence-<版本>.apk`（不暴露上传时的原始文件名）。
 */
import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/auth/auth.guard.js';
import { RawResponse } from '../../common/http/response.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { AppVersionsService, type LatestAppVersion } from './app-versions.service.js';

@Controller('client/app')
export class ClientAppController {
  constructor(private readonly appVersions: AppVersionsService) {}

  /** 最新上架版本（游客可访问：下载页不需要登录）。空 = 尚未发布。 */
  @Public()
  @Get('latest')
  latest(@Query('platform') platform?: string): Promise<LatestAppVersion | null> {
    return this.appVersions.latest(platform === 'ios' ? 'ios' : 'android');
  }

  /** 下载安装包（游客可访问；每次下载计一次数）。 */
  @Public()
  @Get('download/:id')
  @RawResponse()
  async download(@Param() params: IdParamDto, @Res() res: Response): Promise<void> {
    const apk = await this.appVersions.getApkForDownload(params.id);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    // res.download 会带 Content-Disposition: attachment（浏览器触发下载而不是预览）
    res.download(apk.absolutePath, apk.downloadName);
  }
}
