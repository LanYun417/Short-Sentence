/**
 * 站点公开配置（/api/client/site）——游客可访问。
 *
 * 备案号（ICP / 公安备案）由后台「系统管理 → 参数管理」里的
 * `site.icp` / `site.policeIcp` 维护，客户端页脚与 App「关于」页据此展示；
 * 值为空串表示未设置、前端不渲染。
 */
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../../common/auth/auth.guard.js';
import { ConfigService } from '../../config/config.service.js';

/** 站点公开配置视图。 */
export interface SitePublicConfig {
  /** 网站备案号（ICP），空串 = 未设置不展示 */
  icp: string;
  /** 公安备案号，空串 = 未设置不展示 */
  policeIcp: string;
}

@Controller('client/site')
export class SiteController {
  constructor(private readonly config: ConfigService) {}

  /** 读取站点公开配置（备案号）。每次实时读库，改完参数立即生效。 */
  @Public()
  @Get()
  async get(): Promise<SitePublicConfig> {
    const [icp, policeIcp] = await Promise.all([
      this.config.getConfigData('site.icp'),
      this.config.getConfigData('site.policeIcp'),
    ]);
    return {
      icp: icp?.configValue.trim() ?? '',
      policeIcp: policeIcp?.configValue.trim() ?? '',
    };
  }
}
