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
    <form class="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl dark:bg-slate-800" @submit.prevent="onSubmit">
      <h1 class="mb-1 text-2xl font-bold text-slate-800 dark:text-slate-100">登录短句</h1>
      <p class="mb-6 text-sm text-slate-400">每天 20 句，看图学地道英语</p>

      <label class="mb-1 block text-sm text-slate-500 dark:text-slate-400">邮箱</label>
      <input
        v-model="email"
        type="email"
        required
        autocomplete="email"
        class="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-900"
      />

      <label class="mb-1 block text-sm text-slate-500 dark:text-slate-400">密码</label>
      <input
        v-model="password"
        type="password"
        required
        autocomplete="current-password"
        class="mb-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-900"
      />

      <p v-if="errorMessage" class="mb-3 text-sm text-rose-500">{{ errorMessage }}</p>

      <button
        type="submit"
        class="mt-2 w-full rounded-xl bg-sky-600 py-3 font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
        :disabled="submitting || !email || !password"
      >
        {{ submitting ? '登录中…' : '登录' }}
      </button>

      <p class="mt-4 text-center text-sm text-slate-400">
        还没有账号？
        <NuxtLink to="/register" class="text-sky-600 hover:underline dark:text-sky-400">注册</NuxtLink>
      </p>
    </form>
  </div>
</template>
