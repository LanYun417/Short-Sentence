/**
 * 后台支付管理控制器（/api/pay/orders 与 /api/pay/settings）。
 * 权限口径：RBAC 权限码 pay:order:* / pay:settings:*（超管直通）；写操作留痕。
 */
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import type { PageResult } from '../../common/types.js';
import {
  PayOrderService,
  type PayOrderListQuery,
  type PayOrderView,
  type PayStats,
} from '../../common/pay/pay-order.service.js';
import { PaySettingsService } from '../../common/pay/pay-settings.service.js';
import type { PaySettingsView } from '../../common/pay/pay-settings.js';
import { PaySkuService, type PaySkuView } from '../../common/pay/pay-sku.service.js';
import { RefundPayOrderDto, SavePaySettingsDto } from './dto.js';

@Controller('pay/orders')
export class PayAdminController {
  constructor(
    private readonly payOrders: PayOrderService,
    private readonly paySkus: PaySkuService,
    private readonly paySettings: PaySettingsService,
  ) {}

  /** 订单列表（分页；可按状态/渠道/用户/订单号/交易号/日期筛选）。 */
  @Get()
  @RequirePermissions('pay:order:query')
  list(@Query() query: PayOrderListQuery): Promise<PageResult<PayOrderView>> {
    return this.payOrders.listOrders(query);
  }

  /** 收入概览（累计/今日/有效会员/待支付）。 */
  @Get('stats')
  @RequirePermissions('pay:order:query')
  stats(): Promise<PayStats> {
    return this.payOrders.stats();
  }

  /** 会员套餐列表（含下架项；后台只读，改价走数据库种子约定）。 */
  @Get('skus')
  @RequirePermissions('pay:order:query')
  async skus(): Promise<{ enabled: boolean; skus: PaySkuView[] }> {
    return { enabled: this.paySettings.enabled, skus: await this.paySkus.listEnabled() };
  }

  /** 手动同步订单（回调丢失时向微信查单补单）。 */
  @Post(':orderNo/sync')
  @RequirePermissions('pay:order:edit')
  @OperationLog('支付订单', '同步订单')
  sync(@Param('orderNo') orderNo: string): Promise<PayOrderView> {
    return this.payOrders.syncOrder(orderNo);
  }

  /** 全额退款（微信受理即返回；订单置已退款并撤销该笔权益）。 */
  @Post(':orderNo/refund')
  @RequirePermissions('pay:order:refund')
  @OperationLog('支付订单', '退款')
  refund(@Param('orderNo') orderNo: string, @Body() dto: RefundPayOrderDto): Promise<PayOrderView> {
    return this.payOrders.refund(orderNo, dto.reason ?? '');
  }
}

@Controller('pay')
export class PaySettingsController {
  constructor(private readonly paySettings: PaySettingsService) {}

  /** 读取微信支付配置（密钥只回掩码；附带缺项提示）。 */
  @Get('settings')
  @RequirePermissions('pay:settings:query')
  get(): PaySettingsView {
    return this.paySettings.toView();
  }

  /** 保存微信支付配置（整表提交；保存后立即生效，无需重启）。 */
  @Put('settings')
  @RequirePermissions('pay:settings:edit')
  @OperationLog('支付设置', '保存配置')
  async save(@Body() dto: SavePaySettingsDto): Promise<PaySettingsView> {
    const current = this.paySettings.current;
    await this.paySettings.save({
      // 未传的字段沿用现值（整表提交语义里前端会全量回填；这里再兜一层避免误清空）
      appId: dto.appId ?? current.appId,
      mchId: dto.mchId ?? current.mchId,
      serialNo: dto.serialNo ?? current.serialNo,
      privateKey: dto.privateKey ?? current.privateKey,
      apiv3Key: dto.apiv3Key ?? current.apiv3Key,
      notifyUrl: dto.notifyUrl ?? current.notifyUrl,
    });
    return this.paySettings.toView();
  }
}
