/**
 * 客户端支付 DTO。
 * 金额不在这里——客户端只传 SKU code 与渠道，价格一律服务端查 `pay_sku`。
 */
import { IsIn, IsString, Length } from 'class-validator';

/** 支付渠道（web / android 走 Native 扫码；miniapp 走 JSAPI）。 */
export const PAY_CHANNELS = ['web', 'android', 'miniapp'] as const;

export type PayChannelValue = (typeof PAY_CHANNELS)[number];

/** 创建支付订单。 */
export class CreatePayOrderDto {
  /** 套餐编码（vip_month / vip_year / vip_lifetime） */
  @IsString()
  @Length(2, 30, { message: '套餐编码长度须在 2~30 字符之间' })
  skuCode!: string;

  /** 渠道：web 网页 / android 安卓 / miniapp 微信小程序 */
  @IsIn(PAY_CHANNELS, { message: '不支持的支付渠道' })
  channel!: PayChannelValue;
}
