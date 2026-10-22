<script setup lang="ts">
/**
 * 注册页（邮箱 + 密码 + 昵称；昵称缺省取邮箱前缀）。
 */
import { useAuthStore } from '~/stores/auth';

definePageMeta({ layout: false });

const auth = useAuthStore();
const route = useRoute();

const email = ref('');
const password = ref('');
const nickname = ref('');
const errorMessage = ref('');
const submitting = ref(false);

async function onSubmit(): Promise<void> {
  if (submitting.value) {
    return;
  }
  submitting.value = true;
  errorMessage.value = '';
  try {
    await auth.register(email.value.trim(), password.value, nickname.value.trim() || undefined);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await navigateTo(redirect);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '注册失败';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
    <form class="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl dark:bg-slate-800" @submit.prevent="onSubmit">
      <h1 class="mb-1 text-2xl font-bold text-slate-800 dark:text-slate-100">注册短句</h1>
      <p class="mb-6 text-sm text-slate-400">一个账号，同步收藏与打卡</p>

      <label class="mb-1 block text-sm text-slate-500 dark:text-slate-400">邮箱</label>
      <input
        v-model="email"
        type="email"
        required
        autocomplete="email"
        class="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-900"
      />

      <label class="mb-1 block text-sm text-slate-500 dark:text-slate-400">昵称（可选）</label>
      <input
        v-model="nickname"
        type="text"
        maxlength="50"
        class="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-900"
      />

      <label class="mb-1 block text-sm text-slate-500 dark:text-slate-400">密码</label>
      <input
        v-model="password"
        type="password"
        required
        minlength="6"
        autocomplete="new-password"
        class="mb-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-900"
      />
      <p class="mb-3 text-xs text-slate-400">6~32 位，需同时包含字母和数字</p>

      <p v-if="errorMessage" class="mb-3 text-sm text-rose-500">{{ errorMessage }}</p>

      <button
        type="submit"
        class="mt-2 w-full rounded-xl bg-sky-600 py-3 font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
        :disabled="submitting || !email || password.length < 6"
      >
        {{ submitting ? '注册中…' : '注册并登录' }}
      </button>

      <p class="mt-4 text-center text-sm text-slate-400">
        已有账号？
        <NuxtLink to="/login" class="text-sky-600 hover:underline dark:text-sky-400">登录</NuxtLink>
      </p>
    </form>
  </div>
</template>
