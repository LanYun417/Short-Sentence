/**
 * 会员中心（小程序）。
 *
 * 支付方式：JSAPI（后端返回 payParams → wx.requestPayment）。
 * 一期只卖会员（月/年/终身，不做自动续费）；iOS 小程序受苹果虚拟支付政策限制，
 * 隐藏购买按钮并引导到网页版 / 安卓端（权益按 userId 三端通用）。
 */
import { createPayOrder, fetchPayOrderStatus, fetchVipSkus } from '../../services/pay';
import type { PaySku, VipStatus } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError, toast } from '../../utils/feedback';
import { goLogin } from '../../utils/nav';

/** 渲染用套餐（价格/副标题已格式化）。 */
interface PlanItem extends PaySku {
  priceText: string;
  subText: string;
  badge: string;
  benefits: string[];
}

interface VipData {
  loading: boolean;
  enabled: boolean;
  /** iOS 不展示购买按钮（苹果虚拟支付限制） */
  ios: boolean;
  paying: boolean;
  paid: boolean;
  selectedCode: string;
  plans: PlanItem[];
  vip: VipStatus;
  vipTitle: string;
  vipText: string;
  errorText: string;
}

interface VipCustom {
  load(): Promise<void>;
  onSelect(e: WechatMiniprogram.TouchEvent): void;
  onBuy(): Promise<void>;
  confirmPaid(orderNo: string, times: number): Promise<void>;
  onGoPractice(): void;
}

/** 分 → 元（整数元去掉 .00）。 */
function priceText(cent: number): string {
  return (cent / 100).toFixed(2).replace(/\.00$/, '');
}

/** 套餐副标题。 */
function planSubtitle(sku: PaySku): string {
  if (sku.durationDays === 0) {
    return '一次买断，永久有效';
  }
  if (sku.durationDays >= 365) {
    return `约 ¥${(sku.price / 12 / 100).toFixed(1)} / 月`;
  }
  return `${sku.durationDays} 天`;
}

/** 会员状态文案。 */
function vipCopy(vip: VipStatus): { title: string; text: string } {
  if (!vip.vip) {
    return { title: '解锁更强的 AI 私教', text: '尚未开通会员' };
  }
  if (vip.lifetime) {
    return { title: '会员已生效', text: '终身会员 · 永久有效' };
  }
  return {
    title: '会员已生效',
    text: `有效期至 ${(vip.expiresAt ?? '').slice(0, 10).replace(/-/g, '/')}`,
  };
}

Page<VipData, VipCustom>({
  data: {
    loading: true,
    enabled: false,
    ios: false,
    paying: false,
    paid: false,
    selectedCode: 'vip_year',
    plans: [],
    vip: { vip: false, lifetime: false, expiresAt: null, skuCode: null },
    vipTitle: '解锁更强的 AI 私教',
    vipText: '尚未开通会员',
    errorText: '',
  },

  async onLoad() {
    // 平台判断：iOS 端隐藏购买入口（微信小程序虚拟支付政策）
    try {
      const info = wx.getSystemInfoSync();
      this.setData({ ios: info.platform === 'ios' });
    } catch {
      // 取不到平台信息按非 iOS 处理，避免误伤安卓
    }

    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    await this.load();
  },

  /** 拉套餐与会员状态。 */
  async load(): Promise<void> {
    this.setData({ loading: true, errorText: '' });
    try {
      const data = await fetchVipSkus();
      const plans: PlanItem[] = data.skus.map((sku) => ({
        ...sku,
        priceText: priceText(sku.price),
        subText: planSubtitle(sku),
        badge: sku.code === 'vip_year' ? '最划算' : '',
        benefits: sku.benefits.slice(0, 3),
      }));
      const copy = vipCopy(data.vip);
      const selectedExists = plans.some((item) => item.code === this.data.selectedCode);
      this.setData({
        enabled: data.enabled,
        plans,
        vip: data.vip,
        vipTitle: copy.title,
        vipText: copy.text,
        selectedCode: selectedExists ? this.data.selectedCode : (plans[0]?.code ?? ''),
      });
    } catch (error) {
      this.setData({ errorText: '会员信息加载失败，请稍后重试' });
      showError(error, '会员信息加载失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 选择套餐。 */
  onSelect(e: WechatMiniprogram.TouchEvent) {
    const code = String(e.currentTarget.dataset.code ?? '');
    if (code) {
      this.setData({ selectedCode: code, paid: false });
    }
  },

  /** 下单并拉起微信支付。 */
  async onBuy(): Promise<void> {
    if (this.data.paying) {
      return;
    }
    if (this.data.ios) {
      toast('iOS 请在网页版或安卓端开通');
      return;
    }
    if (!this.data.selectedCode) {
      return;
    }
    this.setData({ paying: true, paid: false });
    try {
      const order = await createPayOrder(this.data.selectedCode);
      const params = order.payParams;
      if (!params) {
        throw new Error('下单失败：缺少支付参数');
      }
      await new Promise<void>((resolve, reject) => {
        wx.requestPayment({
          timeStamp: params.timeStamp,
          nonceStr: params.nonceStr,
          package: params.package,
          signType: params.signType,
          paySign: params.paySign,
          success: () => resolve(),
          fail: (err) => reject(err),
        });
      });
      // 支付成功后轮询确认入账（后端会主动向微信补单，最多等 ~9 秒）
      await this.confirmPaid(order.orderNo, 6);
    } catch (error) {
      const errMsg = String((error as { errMsg?: string })?.errMsg ?? '');
      if (errMsg.includes('cancel')) {
        toast('已取消支付');
      } else {
        showError(error, '支付未完成，请稍后重试');
      }
    } finally {
      this.setData({ paying: false });
    }
  },

  /** 轮询订单状态直到 paid（或次数用尽）。 */
  async confirmPaid(orderNo: string, times: number): Promise<void> {
    for (let i = 0; i < times; i += 1) {
      try {
        const status = await fetchPayOrderStatus(orderNo);
        if (status.status === 'paid') {
          const copy = vipCopy(status.vip);
          this.setData({ paid: true, vip: status.vip, vipTitle: copy.title, vipText: copy.text });
          toast('支付成功，会员已到账');
          return;
        }
      } catch {
        // 网络抖动继续下一轮
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    // 到账可能延迟：提示用户稍后下拉刷新（避免误以为没付成功又重复付款）
    toast('支付已提交，到账稍有延迟，请稍后刷新');
  },

  /** 开通后去练一句。 */
  onGoPractice() {
    wx.switchTab({ url: '/pages/index/index' });
  },
});
