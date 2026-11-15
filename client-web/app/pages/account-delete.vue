<script setup lang="ts">
/**
 * 注销账号（路由 /account-delete）。
 *
 * 不可逆，所以三道关：
 * 1. **必须填邮箱验证码**——光有登录态不够，那可能只是别人开着的电脑；
 * 2. **原因可选**——不能拿问卷卡住用户的注销权利，但选了会匿名留存；
 * 3. **提交前弹窗再确认**——不是防用户，是防手滑。
 *
 * 与小程序 `pages/account-delete` 同一套接口与语义；后端校验逻辑见
 * `ClientAuthUserService.assertDeletionIdentity`。
 */
import { apiFetch } from '~/composables/useApi';
import { useAuthStore } from '~/stores/auth';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '注销账号',
  description: '注销账号并清除学习记录、成就与收藏。',
});

const auth = useAuthStore();

/** 注销原因（与后端 DELETION_REASON_TYPES 对齐；不选则不传）。 */
const REASONS = [
  { value: 'no_time', label: '没时间练' },
  { value: 'too_hard', label: '内容太难' },
  { value: 'content', label: '内容不满意' },
  { value: 'bugs', label: '使用有问题' },
  { value: 'privacy', label: '隐私顾虑' },
  { value: 'other', label: '其他原因' },
] as const;

/** 选中的原因（空字符串 = 未选择） */
const reason = ref('');
const detail = ref('');
const emailCode = ref('');
const sending = ref(false);
const submitting = ref(false);
/** 重发倒计时（秒） */
const countdown = ref(0);
const message = ref('');
const confirmOpen = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
});

/** 选/取消选原因（允许「不想说」）。 */
function toggleReason(value: string): void {
  reason.value = reason.value === value ? '' : value;
}

/** 发注销验证码（服务端只发给本人邮箱）。 */
async function onSendCode(): Promise<void> {
  if (sending.value || countdown.value > 0) {
    return;
  }
  sending.value = true;
  message.value = '';
  try {
    await apiFetch<null>('/client/auth/deletion-code', { method: 'POST' });
    message.value = '验证码已发送，请查收邮箱';
    countdown.value = 60;
    if (timer) {
      clearInterval(timer);
    }
    timer = setInterval(() => {
      countdown.value -= 1;
      if (countdown.value <= 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    }, 1000);
  } catch (error) {
    message.value = error instanceof Error ? error.message : '发送失败，请稍后重试';
  } finally {
    sending.value = false;
  }
}

/** 点击注销：先校验，再弹确认。 */
function onSubmit(): void {
  if (submitting.value) {
    return;
  }
  message.value = '';
  if (!emailCode.value.trim()) {
    message.value = '请先获取并填写邮箱验证码';
    return;
  }
  confirmOpen.value = true;
}

/** 执行注销。 */
async function doDelete(): Promise<void> {
  submitting.value = true;
  try {
    const body: Record<string, unknown> = { emailCode: emailCode.value.trim() };
    if (reason.value) {
      body.reasonType = reason.value;
    }
    if (detail.value.trim()) {
      body.reasonDetail = detail.value.trim();
    }
    await apiFetch<null>('/client/auth/me', { method: 'DELETE', body });
    confirmOpen.value = false;
    // 服务端已令令牌失效；logout 的接口调用会被静默忽略，这里主要是清本地态
    await auth.logout();
    await navigateTo('/login', { replace: true });
  } catch (error) {
    confirmOpen.value = false;
    message.value = error instanceof Error ? error.message : '注销失败，请稍后重试';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 sm:py-8">
    <h1 class="text-lg font-bold text-slate-800 dark:text-slate-100">注销账号</h1>
    <p class="mt-1 mb-4 text-sm text-slate-400">注销不可逆，请先确认已知悉下面的影响。</p>

    <!-- 影响说明 -->
    <section class="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200/70 dark:bg-rose-950/30 dark:ring-rose-900/60">
      <p class="text-sm font-semibold text-rose-700 dark:text-rose-300">注销后会发生什么</p>
      <ul class="mt-2 space-y-1 text-sm leading-relaxed text-rose-700/90 dark:text-rose-300/90">
        <li>· 学习记录、错题本与收藏会被清除</li>
        <li>· 经验值、成就、打卡与排行榜名次会消失</li>
        <li>· 账号无法找回；原邮箱可重新注册一个全新账号</li>
      </ul>
    </section>

    <!-- 原因（可选） -->
    <section
      class="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
    >
      <div class="flex items-baseline justify-between gap-2">
        <p class="text-sm font-medium text-slate-700 dark:text-slate-200">为什么离开</p>
        <span class="text-xs text-slate-400">可选，不填也能注销</span>
      </div>
      <div class="mt-2 flex flex-wrap gap-2">
        <UButton
          v-for="item in REASONS"
          :key="item.value"
          size="sm"
          :color="reason === item.value ? 'primary' : 'neutral'"
          :variant="reason === item.value ? 'solid' : 'outline'"
          @click="toggleReason(item.value)"
        >
          {{ item.label }}
        </UButton>
      </div>
      <UTextarea
        v-model="detail"
        class="mt-3 w-full"
        :rows="3"
        :maxlength="200"
        placeholder="想补充两句？我们会认真看（可不填）"
      />
      <p class="mt-1 text-right text-xs text-slate-400">{{ detail.length }}/200</p>
    </section>

    <!-- 身份校验 -->
    <section
      class="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
    >
      <p class="text-sm font-medium text-slate-700 dark:text-slate-200">身份校验</p>
      <p class="mt-1 text-xs text-slate-400">验证码将发送到 {{ auth.user?.email }}</p>
      <div class="mt-2 flex gap-2">
        <UInput
          v-model="emailCode"
          type="text"
          inputmode="numeric"
          maxlength="6"
          autocomplete="one-time-code"
          icon="i-lucide-shield-check"
          placeholder="邮箱收到的 6 位验证码"
          class="flex-1"
        />
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          class="shrink-0"
          :loading="sending"
          :disabled="countdown > 0"
          @click="onSendCode"
        >
          {{ countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
        </UButton>
      </div>
    </section>

    <p v-if="message" class="mt-3 text-sm text-slate-500 dark:text-slate-400">{{ message }}</p>

    <UButton color="error" size="lg" block class="mt-4" :loading="submitting" @click="onSubmit"> 注销账号 </UButton>
    <p class="mt-3 text-center text-xs text-slate-400">注销后如需继续练习，可用原邮箱重新注册。</p>

    <!-- 二次确认 -->
    <UModal v-model:open="confirmOpen" title="确认注销？" description="这一步之后账号无法找回。">
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="confirmOpen = false">再想想</UButton>
          <UButton color="error" :loading="submitting" @click="doDelete">确认注销</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
