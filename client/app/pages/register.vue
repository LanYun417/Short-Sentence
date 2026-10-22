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
    <UCard class="w-full max-w-sm" :ui="{ body: 'p-8' }">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">注册短句</h1>
        <p class="mt-1 text-sm text-slate-400">一个账号，同步收藏与打卡</p>
      </div>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormField label="邮箱">
          <UInput v-model="email" type="email" required autocomplete="email" size="lg" class="w-full" />
        </UFormField>

        <UFormField label="昵称（可选）">
          <UInput v-model="nickname" type="text" maxlength="50" size="lg" class="w-full" />
        </UFormField>

        <UFormField label="密码" help="6~32 位，需同时包含字母和数字">
          <UInput
            v-model="password"
            type="password"
            required
            minlength="6"
            autocomplete="new-password"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />

        <UButton type="submit" block size="lg" :loading="submitting" :disabled="!email || password.length < 6">
          {{ submitting ? '注册中…' : '注册并登录' }}
        </UButton>
      </form>

      <p class="mt-4 text-center text-sm text-slate-400">
        已有账号？
        <NuxtLink to="/login" class="text-sky-600 hover:underline dark:text-sky-400">登录</NuxtLink>
      </p>
    </UCard>
  </div>
</template>
