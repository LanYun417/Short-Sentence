/**
 * 会员支付服务（/client/pay）。
 *
 * 口径：金额与套餐一律服务端下发，前端只传 skuCode；小程序走 JSAPI（wx.requestPayment）。
 */
import { request } from '../utils/request';
import type { PaySku, VipStatus, WechatPayParams } from './types';

/** 套餐列表 + 当前会员状态。 */
export interface VipSkuList {
  /** 支付是否已配置（未配置时显示「暂未开放」） */
  enabled: boolean;
  skus: PaySku[];
  vip: VipStatus;
}

/** 下单结果（小程序只会有 payParams）。 */
export interface PayOrderCreated {
  orderNo: string;
  /** 分 */
  amount: number;
  channel: string;
  expiresAt: string;
  payParams?: WechatPayParams;
}

/** 订单状态查询结果。 */
export interface PayOrderStatus {
  orderNo: string;
  status: string;
  amount: number;
  paidAt: string | null;
  vip: VipStatus;
}

/** 会员套餐列表。 */
export function fetchVipSkus(): Promise<VipSkuList> {
  return request<VipSkuList>('/client/pay/skus');
}

/** 创建会员订单（小程序渠道）。 */
export function createPayOrder(skuCode: string): Promise<PayOrderCreated> {
  return request<PayOrderCreated>('/client/pay/create', {
    method: 'POST',
    data: { skuCode, channel: 'miniapp' },
  });
}

/** 查询订单状态（支付后确认到账；后端会主动向微信补单）。 */
export function fetchPayOrderStatus(orderNo: string): Promise<PayOrderStatus> {
  return request<PayOrderStatus>(`/client/pay/status/${orderNo}`);
}
