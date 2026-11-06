/**
 * 安全模块（IP 黑名单管理）。
 * 模块职责：承载 /api/ip-ban 后台管理接口。IpBanService 由全局 CommonModule 提供并导出，
 * 本模块无需重复 import 即可注入。
 */
import { Module } from '@nestjs/common';
import { IpBanController } from './ip-ban.controller.js';

@Module({
  controllers: [IpBanController],
})
export class SecurityModule {}
