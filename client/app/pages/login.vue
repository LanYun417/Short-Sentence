<script setup lang="ts">
/**
 * 登录页（客户端用户体系，独立于后台 admin）。
 * 结构由 AuthShell 提供：品牌 + 标题 + 表单，居中对称单列。
 */
import { useAuthStore } from '~/stores/auth';
import { getToken } from '~/composables/useApi';
import { setTokenCookie } from '~/utils/auth-cookie';

definePageMeta({ layout: 'auth' });

usePageSeo({
  title: '登录',
  description: '登录短句，继续今天的刷题。每天 20 句，看图学地道英语口语。',
  indexable: true,
});

const auth = useAuthStore();
const route = useRoute();
const tokenCookie = useCookie<string | null>('ss_token');

const email = ref('');
const password = ref('');
const errorMessage = ref('');
const submitting = ref(false);

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

/** 登录成功后跳回来源页。 */
async function onSubmit(): Promise<void> {
  if (submitting.value) {
    return;
  }
  submitting.value = true;
  errorMessage.value = '';
  try {
    await auth.login(email.value.trim(), password.value);
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

        <UFormField label="密码">
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
        </UFormField>

        <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />

        <UButton type="submit" block size="lg" :loading="submitting" :disabled="!email || !password">
          {{ submitting ? '登录中…' : '登录' }}
          <template #trailing>
            <UIcon name="i-lucide-arrow-right" class="h-4 w-4" />
          </template>
        </UButton>
      </form>

      <p class="mt-4 text-center text-sm text-slate-400">
        还没有账号？
        <ULink to="/register" class="font-medium">注册</ULink>
      </p>
    </UCard>
  </AuthShell>
</template>
