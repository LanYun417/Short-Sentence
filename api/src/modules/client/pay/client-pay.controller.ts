/**
 * 客户端会员购买控制器（/api/client/pay）。
 * 权限口径：需登录（client 令牌）；只能操作自己的订单（服务层按 userId 校验归属）。
 *
 * 渠道：web / android 返回 Native 二维码 `codeUrl`；miniapp 返回 `wx.requestPayment` 参数。
 * iOS 小程序受苹果虚拟支付政策限制，**前端**按平台隐藏购买入口（后端不做平台判断，避免误伤 H5）。
 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentClientUser } from '../../../common/auth/auth.guard.js';
import type { ClientUserContext, PageResult } from '../../../common/types.js';
import {
  PayOrderService,
  type CreateOrderResult,
  type OrderStatusResult,
  type PayOrderClientView,
} from '../../../common/pay/pay-order.service.js';
import { PaySkuService, type PaySkuView } from '../../../common/pay/pay-sku.service.js';
import { EntitlementService, type EntitlementItem, type VipStatus } from '../../../common/pay/entitlement.service.js';
import { CreatePayOrderDto } from './dto.js';

/** 套餐列表 + 当前会员状态（购买页首屏）。 */
export interface PaySkuListResult {
  /** 支付是否已配置可用（未配置时前端显示「暂未开放」） */
  enabled: boolean;
  skus: PaySkuView[];
  vip: VipStatus;
}

/** 我的权益。 */
export interface MyEntitlementResult {
  vip: VipStatus;
  items: EntitlementItem[];
}

@Controller('client/pay')
export class ClientPayController {
  constructor(
    private readonly payOrders: PayOrderService,
    private readonly paySkus: PaySkuService,
    private readonly entitlements: EntitlementService,
  ) {}

  /** 会员套餐列表（含当前会员状态；支付未配置时 enabled=false）。 */
  @Get('skus')
  async skus(@CurrentClientUser() user: ClientUserContext): Promise<PaySkuListResult> {
    const [skus, vip] = await Promise.all([this.paySkus.listEnabled(), this.entitlements.status(user.userId)]);
    return { enabled: this.paySkusEnabled(), skus, vip };
  }

  /** 创建支付订单（服务端定价；web/android 返回二维码，miniapp 返回支付参数）。 */
  @Post('create')
  create(@CurrentClientUser() user: ClientUserContext, @Body() dto: CreatePayOrderDto): Promise<CreateOrderResult> {
    return this.payOrders.create(user.userId, dto.skuCode, dto.channel);
  }

  /** 我的订单（分页倒序）。 */
  @Get('orders')
  orders(
    @CurrentClientUser() user: ClientUserContext,
    @Query() query: Record<string, unknown>,
  ): Promise<PageResult<PayOrderClientView>> {
    return this.payOrders.listMine(user.userId, query);
  }

  /** 订单状态（客户端轮询；pending 时会主动向微信补单，回调丢失也能到账）。 */
  @Get('status/:orderNo')
  status(@CurrentClientUser() user: ClientUserContext, @Param('orderNo') orderNo: string): Promise<OrderStatusResult> {
    return this.payOrders.status(user.userId, orderNo);
  }

  /** 我的权益（会员状态 + 权益明细）。 */
  @Get('entitlements')
  async mine(@CurrentClientUser() user: ClientUserContext): Promise<MyEntitlementResult> {
    const [vip, items] = await Promise.all([
      this.entitlements.status(user.userId),
      this.entitlements.listMine(user.userId),
    ]);
    return { vip, items };
  }

  /** 支付是否已配置（skus 接口用；与下单同源判断，避免两处口径漂移）。 */
  private paySkusEnabled(): boolean {
    // 延迟到运行时判断：PaySkuService 不持有支付配置，这里以能否下单为准
    return this.payOrders.payEnabled();
  }
}
