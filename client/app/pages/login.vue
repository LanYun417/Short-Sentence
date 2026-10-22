<script setup lang="ts">
/**
 * 登录页（客户端用户体系，独立于后台 admin）。
 */
import { useAuthStore } from '~/stores/auth';

definePageMeta({ layout: false });

const auth = useAuthStore();
const route = useRoute();

const email = ref('');
const password = ref('');
const errorMessage = ref('');
const submitting = ref(false);

/** 登录成功后跳回来源页（缺省首页）。 */
async function onSubmit(): Promise<void> {
  if (submitting.value) {
    return;
  }
  submitting.value = true;
  errorMessage.value = '';
  try {
    await auth.login(email.value.trim(), password.value);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await navigateTo(redirect);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '登录失败';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
    <UCard class="w-full max-w-sm" :ui="{ body: 'p-8' }">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">登录短句</h1>
        <p class="mt-1 text-sm text-slate-400">每天 20 句，看图学地道英语</p>
      </div>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormField label="邮箱">
          <UInput v-model="email" type="email" required autocomplete="email" size="lg" class="w-full" />
        </UFormField>

        <UFormField label="密码">
          <UInput
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />

        <UButton type="submit" block size="lg" :loading="submitting" :disabled="!email || !password">
          {{ submitting ? '登录中…' : '登录' }}
        </UButton>
      </form>

      <p class="mt-4 text-center text-sm text-slate-400">
        还没有账号？
        <NuxtLink to="/register" class="text-sky-600 hover:underline dark:text-sky-400">注册</NuxtLink>
      </p>
    </UCard>
  </div>
</template>
