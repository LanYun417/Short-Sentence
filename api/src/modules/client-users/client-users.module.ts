/**
 * 客户端用户管理模块。
 */
import { Module } from '@nestjs/common';
import { ClientUsersController } from './client-users.controller.js';
import { ClientUsersService } from './client-users.service.js';

@Module({
  controllers: [ClientUsersController],
  providers: [ClientUsersService],
})
export class ClientUsersModule {}
