/**
 * App 版本管理模块。
 * 模块职责：注册 `/api/app-versions`（后台维护）与 `/api/client/app`（用户端下载）两组路由。
 */
import { Module } from '@nestjs/common';
import { AppVersionsController } from './app-versions.controller.js';
import { ClientAppController } from './client-app.controller.js';
import { AppVersionsService } from './app-versions.service.js';

@Module({
  controllers: [AppVersionsController, ClientAppController],
  providers: [AppVersionsService],
})
export class AppVersionsModule {}
