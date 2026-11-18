<script setup lang="ts">
/**
 * 会员中心（网页收银台）。
 *
 * 支付方式：Native 扫码（后端返回 code_url + 已渲染好的二维码 PNG data URL），
 * 下单后轮询订单状态；回调丢失时后端会主动向微信补单，轮询即可到账。
 *
 * 一期只卖会员（月/年/终身），不做自动续费；权益核心是 AI 私教次数提升。
 */
import { apiFetch, ApiError } from '~/composables/useApi';
import { useAuthStore } from '~/stores/auth';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '会员中心',
  description: '开通短句会员：AI 私教每日次数提升到 200 次、弱项画像与深度点评。',
});

/** 套餐（与后端 pay_sku 对齐）。 */
interface VipSku {
  code: string;
  name: string;
  kind: string;
  /** 分 */
  price: number;
  /** 0 = 终身 */
  durationDays: number;
  benefits: string[];
}

/** 会员状态。 */
interface VipStatus {
  vip: boolean;
  lifetime: boolean;
  expiresAt: string | null;
  skuCode: string | null;
}

interface SkuListPayload {
  enabled: boolean;
  skus: VipSku[];
  vip: VipStatus;
}

interface CreateOrderPayload {
  orderNo: string;
  amount: number;
  channel: string;
  expiresAt: string;
  codeUrl?: string;
  qrDataUrl?: string;
}

interface OrderStatusPayload {
  orderNo: string;
  status: string;
  amount: number;
  paidAt: string | null;
  vip: VipStatus;
}

const auth = useAuthStore();

const loading = ref(true);
const enabled = ref(false);
const skus = ref<VipSku[]>([]);
const vip = ref<VipStatus>({ vip: false, lifetime: false, expiresAt: null, skuCode: null });
const selectedCode = ref('vip_year');
const errorText = ref('');
const payOpen = ref(false);
const paying = ref(false);
const order = ref<CreateOrderPayload | null>(null);
const orderStatus = ref<'pending' | 'paid' | 'closed' | 'refunded'>('pending');
const remainingSeconds = ref(0);
const pollMessage = ref('');

/** 每次轮询/重开弹窗都递增，旧定时器据此自行退出（防重复轮询）。 */
let pollSeq = 0;

/** 分 → 元 */
function formatPrice(cent: number): string {
  return (cent / 100).toFixed(2).replace(/\.00$/, '');
}

/** 套餐副标题 */
function subtitle(sku: VipSku): string {
  if (sku.durationDays === 0) {
    return '一次买断，永久有效';
  }
  if (sku.durationDays >= 365) {
    return `约 ¥${(sku.price / 12 / 100).toFixed(1)} / 月`;
  }
  return `${sku.durationDays} 天`;
}

/** 会员到期文案 */
const vipText = computed(() => {
  if (!vip.value.vip) {
    return '尚未开通会员';
  }
  if (vip.value.lifetime) {
    return '终身会员 · 永久有效';
  }
  return `会员有效期至 ${vip.value.expiresAt?.slice(0, 10).replace(/-/g, '/') ?? '-'}`;
});

/** 剩余支付时间（mm:ss） */
const countdown = computed(() => {
  const seconds = Math.max(0, remainingSeconds.value);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
});

/** 加载套餐与会员状态。 */
async function load(): Promise<void> {
  loading.value = true;
  errorText.value = '';
  try {
    const data = await apiFetch<SkuListPayload>('/client/pay/skus');
    enabled.value = data.enabled;
    skus.value = data.skus;
    vip.value = data.vip;
    if (!skus.value.some((item) => item.code === selectedCode.value) && skus.value.length > 0) {
      selectedCode.value = skus.value[0]?.code ?? '';
    }
  } catch (error) {
    errorText.value = error instanceof ApiError ? error.message : '会员信息加载失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});

onUnmounted(() => {
  // 退出页面即停止轮询
  pollSeq += 1;
});

/** 轮询订单状态（2.5s 一次，直到支付成功/关单/过期）。 */
async function pollOrder(orderNo: string, seq: number): Promise<void> {
  if (seq !== pollSeq) {
    return;
  }
  try {
    const status = await apiFetch<OrderStatusPayload>(`/client/pay/status/${orderNo}`);
    if (seq !== pollSeq) {
      return;
    }
    orderStatus.value = status.status as typeof orderStatus.value;
    vip.value = status.vip;
    if (status.status === 'paid') {
      pollMessage.value = '支付成功，会员已到账';
      return;
    }
    if (status.status === 'closed' || status.status === 'refunded') {
      pollMessage.value = status.status === 'closed' ? '订单已关闭，请重新下单' : '订单已退款';
      return;
    }
  } catch {
    // 网络抖动不打断轮询：下一轮继续
  }
  if (remainingSeconds.value <= 0) {
    pollMessage.value = '二维码已过期，请重新下单';
    return;
  }
  setTimeout(() => {
    void pollOrder(orderNo, seq);
  }, 2500);
}

/** 下单并展示二维码。 */
async function handleBuy(): Promise<void> {
  if (!selectedCode.value) {
    return;
  }
  paying.value = true;
  errorText.value = '';
  try {
    const created = await apiFetch<CreateOrderPayload>('/client/pay/create', {
      method: 'POST',
      body: { skuCode: selectedCode.value, channel: 'web' },
    });
    order.value = created;
    orderStatus.value = 'pending';
    pollMessage.value = '';
    payOpen.value = true;
    const expires = new Date(created.expiresAt).getTime();
    remainingSeconds.value = Math.max(0, Math.floor((expires - Date.now()) / 1000));
    pollSeq += 1;
    void pollOrder(created.orderNo, pollSeq);
    // 倒计时（与轮询分开的 1s 计时器；弹窗关闭后自动失效）
    const seq = pollSeq;
    const timer = setInterval(() => {
      if (seq !== pollSeq) {
        clearInterval(timer);
        return;
      }
      remainingSeconds.value = Math.max(0, remainingSeconds.value - 1);
      if (remainingSeconds.value <= 0) {
        clearInterval(timer);
      }
    }, 1000);
  } catch (error) {
    errorText.value = error instanceof ApiError ? error.message : '下单失败，请稍后重试';
  } finally {
    paying.value = false;
  }
}

/** 关闭弹窗（同时停掉轮询）。 */
function closePay(): void {
  payOpen.value = false;
  pollSeq += 1;
  if (orderStatus.value === 'paid') {
    void load();
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 md:pt-10">
    <!-- 顶部：会员状态 -->
    <section
      class="anim-in relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 px-6 py-7 text-white shadow-xl shadow-orange-500/20"
    >
      <div class="absolute -right-8 -top-10 size-40 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
      <div class="relative flex items-start justify-between gap-4">
        <div>
          <p class="flex items-center gap-1.5 text-xs font-medium text-white/85">
            <UIcon name="i-lucide-crown" class="h-4 w-4" />
            短句会员
          </p>
          <h1 class="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
            {{ auth.user?.nickname || '你好' }}，{{ vip.vip ? '会员已生效' : '解锁更强的 AI 私教' }}
          </h1>
          <p class="mt-2 text-sm text-white/90">{{ vipText }}</p>
        </div>
        <div class="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur">
          <UIcon name="i-lucide-sparkles" class="h-7 w-7" />
        </div>
      </div>
      <div class="relative mt-5 flex flex-wrap gap-2 text-xs">
        <span class="rounded-full bg-white/20 px-3 py-1 backdrop-blur">AI 私教 200 次 / 日</span>
        <span class="rounded-full bg-white/20 px-3 py-1 backdrop-blur">弱项画像</span>
        <span class="rounded-full bg-white/20 px-3 py-1 backdrop-blur">深度点评</span>
      </div>
    </section>

    <!-- 支付未开通 -->
    <UAlert
      v-if="!loading && !enabled"
      class="mt-5"
      color="warning"
      variant="soft"
      icon="i-lucide-info"
      title="会员购买暂未开放"
      description="支付通道还在接入中，请稍后再来。"
    />

    <!-- 套餐 -->
    <section v-else class="mt-6">
      <div class="mb-3 flex items-end justify-between">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-50">选择套餐</h2>
        <span class="text-xs text-slate-400">一次购买 · 到期不自动续费</span>
      </div>

      <div v-if="loading" class="grid gap-3 md:grid-cols-3">
        <div v-for="i in 3" :key="i" class="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
      <div v-else class="grid gap-3 md:grid-cols-3">
        <button
          v-for="sku in skus"
          :key="sku.code"
          type="button"
          class="relative cursor-pointer rounded-2xl border-2 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-900"
          :class="
            selectedCode === sku.code
              ? 'border-orange-400 shadow-lg shadow-orange-500/10'
              : 'border-slate-200 dark:border-slate-700'
          "
          @click="selectedCode = sku.code"
        >
          <span
            v-if="sku.code === 'vip_year'"
            class="absolute -top-2.5 right-4 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white"
          >
            最划算
          </span>
          <p class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ sku.name }}</p>
          <p class="mt-1 flex items-baseline gap-1 text-slate-900 dark:text-slate-50">
            <span class="text-3xl font-bold">¥{{ formatPrice(sku.price) }}</span>
          </p>
          <p class="mt-1 text-xs text-slate-400">{{ subtitle(sku) }}</p>
          <ul class="mt-3 space-y-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            <li v-for="benefit in sku.benefits.slice(0, 3)" :key="benefit" class="flex items-start gap-1.5">
              <UIcon name="i-lucide-check" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span>{{ benefit }}</span>
            </li>
          </ul>
        </button>
      </div>

      <UButton
        size="lg"
        block
        class="mt-5"
        color="warning"
        icon="i-lucide-qr-code"
        :loading="paying"
        :disabled="!enabled || skus.length === 0"
        @click="handleBuy"
      >
        微信扫码支付
      </UButton>
      <p class="mt-2 text-center text-xs text-slate-400">
        使用微信「扫一扫」完成支付；支付成功后会员立即到账。需要发票或退款请联系客服。
      </p>
      <p v-if="errorText" class="mt-3 text-center text-sm text-rose-500">{{ errorText }}</p>
    </section>

    <!-- 支付二维码 -->
    <UModal v-model:open="payOpen" @update:open="(value: boolean) => !value && closePay()">
      <div class="p-6 text-center">
        <template v-if="orderStatus === 'paid'">
          <div
            class="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20"
          >
            <UIcon name="i-lucide-check" class="h-8 w-8" />
          </div>
          <h3 class="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-50">支付成功</h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ vipText }}</p>
          <UButton class="mt-5" block size="lg" @click="closePay">开始使用</UButton>
        </template>

        <template v-else>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">微信扫码支付</h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            应付 <span class="font-semibold text-orange-500">¥{{ formatPrice(order?.amount ?? 0) }}</span> · 二维码
            {{ countdown }} 后失效
          </p>
          <div class="mx-auto mt-4 w-fit rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
            <img v-if="order?.qrDataUrl" :src="order.qrDataUrl" alt="微信支付二维码" class="size-52" />
            <div v-else class="grid size-52 place-items-center text-sm text-slate-400">二维码生成中…</div>
          </div>
          <p class="mt-4 text-xs leading-5 text-slate-400">
            打开微信 → 扫一扫 → 确认支付<br />
            支付完成后本页会自动刷新，请勿关闭
          </p>
          <p v-if="pollMessage" class="mt-2 text-sm text-amber-600">{{ pollMessage }}</p>
          <UButton class="mt-4" color="neutral" variant="outline" block @click="closePay">稍后支付</UButton>
        </template>
      </div>
    </UModal>
  </div>
</template>
