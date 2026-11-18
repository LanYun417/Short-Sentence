/**
 * 支付模块：微信支付回调（公开）+ 后台订单/退款/支付设置（RBAC）。
 * 客户端购买端点挂在 ClientModule（/api/client/pay，需 client 令牌）；
 * 订单/权益/微信支付能力本身都在 CommonModule（@Global），本模块只装配控制器。
 */
import { Module } from '@nestjs/common';
import { PayNotifyController } from './pay-notify.controller.js';
import { PayAdminController, PaySettingsController } from './pay-admin.controller.js';

@Module({
  controllers: [PayNotifyController, PayAdminController, PaySettingsController],
})
export class PayModule {}
