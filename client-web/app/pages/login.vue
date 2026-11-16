<script setup lang="ts">
/**
 * 登录页（客户端用户体系，独立于后台 admin）。
 * 结构由 AuthShell 提供：品牌 + 标题 + 表单，居中对称单列。
 *
 * 两种登录方式：密码登录 / 邮箱验证码登录（同页切换，验证码只服务已注册用户）。
 * 吉祥物闭眼：聚焦密码/验证码框时 Logo 闭眼（「我不看」），失焦恢复。
 */
import { useAuthStore } from '~/stores/auth';
import { getToken } from '~/composables/useApi';
import { setTokenCookie } from '~/utils/auth-cookie';
import { useEmailCode } from '~/composables/useEmailCode';
import { secretInputHandlers } from '~/composables/useLogoEyes';

definePageMeta({ layout: 'auth' });

usePageSeo({
  title: '登录',
  description: '登录短句，继续今天的刷题。每天 20 句，看图学地道英语口语。',
  indexable: true,
});

const auth = useAuthStore();
const route = useRoute();
const tokenCookie = useCookie<string | null>('ss_token');

/** 登录方式：password 密码 / code 邮箱验证码 */
type LoginMode = 'password' | 'code';
const mode = ref<LoginMode>('password');

const email = ref('');
const password = ref('');
const errorMessage = ref('');
const submitting = ref(false);

/** 邮箱验证码（验证码登录用；purpose=login） */
const {
  code: emailCode,
  sending: codeSending,
  send: sendEmailCode,
  sendText: codeSendText,
  canSend: canSendCode,
} = useEmailCode('login');

/** 敏感输入聚焦闭眼（密码框 / 验证码框） */
const secretFocus = secretInputHandlers();

/** 跳到注册页时保留 redirect，登录成功后能回到原去处。 */
function registerHref(): string {
  const redirect = redirectTarget();
  return redirect === '/' ? '/register' : `/register?redirect=${encodeURIComponent(redirect)}`;
}

/** 跳回来源页（缺省首页）。 */
function redirectTarget(): string {
  return typeof route.query.redirect === 'string' ? route.query.redirect : '/';
}

/**
 * 旧会话迁移（一次性）：本次改动前令牌只存在 localStorage，服务端守卫读不到 Cookie，
 * 会把已登录用户踢到登录页。这里检测到「有 localStorage 令牌但无 Cookie」时补写 Cookie 并回跳。
 * 用 sessionStorage 标记只尝试一次，避免浏览器禁用 Cookie 时形成重定向环。
 */
onMounted(() => {
  const legacy = getToken();
  if (tokenCookie.value || !legacy || sessionStorage.getItem('ss_cookie_migrated')) {
    return;
  }
  sessionStorage.setItem('ss_cookie_migrated', '1');
  setTokenCookie(legacy);
  void navigateTo(redirectTarget());
});

/** 发送验证码（验证码登录用；失败原因直接展示）。 */
async function onSendCode(): Promise<void> {
  errorMessage.value = '';
  const failure = await sendEmailCode(email.value);
  if (failure) {
    errorMessage.value = failure;
  }
}

/** 切换登录方式时清掉旧模式的错误与已填的密码/验证码，避免串味。 */
function switchMode(next: LoginMode): void {
  if (mode.value === next) {
    return;
  }
  mode.value = next;
  errorMessage.value = '';
  password.value = '';
  emailCode.value = '';
}

/** 登录成功后跳回来源页。 */
async function onSubmit(): Promise<void> {
  if (submitting.value) {
    return;
  }
  if (mode.value === 'code' && emailCode.value.trim().length !== 6) {
    errorMessage.value = '请填写 6 位邮箱验证码';
    return;
  }
  submitting.value = true;
  errorMessage.value = '';
  try {
    if (mode.value === 'code') {
      await auth.loginByCode(email.value.trim(), emailCode.value.trim());
    } else {
      await auth.login(email.value.trim(), password.value);
    }
    await navigateTo(redirectTarget());
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '登录失败';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthShell title="欢迎回来">
    <UCard
      :ui="{
        body: 'p-6',
        // 边框与投影必须写在 root 上：@nuxt/ui 的 UCard ui 只有
        // root/header/title/description/body/footer 这几个 slot，
        // 写 `ring` / `shadow` 是**静默无效**的（加 type-check 后才发现这件事）
        root: 'ring-1 ring-slate-200/80 shadow-xl shadow-slate-900/5 dark:ring-slate-700/80',
      }"
    >
      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormField label="邮箱">
          <UInput
            v-model="email"
            type="email"
            required
            autocomplete="email"
            size="lg"
            class="w-full"
            icon="i-lucide-mail"
            placeholder="输入邮箱地址"
          />
        </UFormField>

        <!-- 密码登录 -->
        <UFormField v-if="mode === 'password'" label="密码">
          <div @focusin="secretFocus.onFocus" @focusout="secretFocus.onBlur">
            <UInput
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              size="lg"
              class="w-full"
              icon="i-lucide-lock"
              placeholder="输入密码"
            />
          </div>
        </UFormField>

        <!-- 邮箱验证码登录 -->
        <UFormField v-else label="邮箱验证码" help="6 位数字，5 分钟内有效；收不到请检查垃圾箱">
          <div class="flex gap-2" @focusin="secretFocus.onFocus" @focusout="secretFocus.onBlur">
            <UInput
              v-model="emailCode"
              type="text"
              inputmode="numeric"
              maxlength="6"
              autocomplete="one-time-code"
              size="lg"
              class="flex-1"
              icon="i-lucide-shield-check"
              placeholder="邮箱收到的验证码"
            />
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              size="lg"
              class="shrink-0"
              :loading="codeSending"
              :disabled="!email || !canSendCode"
              @click="onSendCode"
            >
              {{ codeSendText }}
            </UButton>
          </div>
        </UFormField>

        <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />

        <UButton
          type="submit"
          block
          size="lg"
          :loading="submitting"
          :disabled="!email || (mode === 'password' ? !password : emailCode.length !== 6)"
        >
          {{ submitting ? '登录中…' : '登录' }}
          <template #trailing>
            <UIcon name="i-lucide-arrow-right" class="h-4 w-4" />
          </template>
        </UButton>
      </form>

      <!-- 登录方式切换 -->
      <p class="mt-4 text-center text-sm text-slate-400">
        <button
          v-if="mode === 'password'"
          type="button"
          class="cursor-pointer font-medium text-sky-600 transition hover:text-sky-500 dark:text-sky-300"
          @click="switchMode('code')"
        >
          使用邮箱验证码登录
        </button>
        <button
          v-else
          type="button"
          class="cursor-pointer font-medium text-sky-600 transition hover:text-sky-500 dark:text-sky-300"
          @click="switchMode('password')"
        >
          使用密码登录
        </button>
      </p>

      <p class="mt-1 text-center text-sm text-slate-400">
        还没有账号？
        <NuxtLink :to="registerHref()" class="font-medium">注册</NuxtLink>
      </p>
    </UCard>
  </AuthShell>
</template>
