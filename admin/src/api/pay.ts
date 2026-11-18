/**
 * 会员支付管理接口（「短句」运营后台）。
 * 权限口径：pay:order:* / pay:settings:*（菜单与按钮权限码见 seed.service.ts）。
 */
import { get, post, put } from './request';
import type {
  PayOrderItem,
  PayOrderQuery,
  PayOrderStats,
  PaySettingsInfo,
  PaySkuItem,
  PageResult,
  SavePaySettingsPayload,
} from '@/types/api';

/** 分页查询支付订单 */
export function getPayOrdersApi(params: PayOrderQuery): Promise<PageResult<PayOrderItem>> {
  return get<PageResult<PayOrderItem>>('/pay/orders', params);
}

/** 收入概览（累计/今日/有效会员/待支付） */
export function getPayOrderStatsApi(): Promise<PayOrderStats> {
  return get<PayOrderStats>('/pay/orders/stats');
}

/** 会员套餐列表（含支付是否已配置） */
export function getPaySkusApi(): Promise<{ enabled: boolean; skus: PaySkuItem[] }> {
  return get<{ enabled: boolean; skus: PaySkuItem[] }>('/pay/orders/skus');
}

/** 手动同步订单（回调丢失时向微信查单补单） */
export function syncPayOrderApi(orderNo: string): Promise<PayOrderItem> {
  return post<PayOrderItem>(`/pay/orders/${orderNo}/sync`);
}

/** 全额退款（订单转已退款并撤销该笔权益） */
export function refundPayOrderApi(orderNo: string, reason?: string): Promise<PayOrderItem> {
  return post<PayOrderItem>(`/pay/orders/${orderNo}/refund`, { reason });
}

/** 读取微信支付配置（密钥只回掩码） */
export function getPaySettingsApi(): Promise<PaySettingsInfo> {
  return get<PaySettingsInfo>('/pay/settings');
}

/** 保存微信支付配置（保存后立即生效，无需重启） */
export function savePaySettingsApi(payload: SavePaySettingsPayload): Promise<PaySettingsInfo> {
  return put<PaySettingsInfo>('/pay/settings', payload);
}
