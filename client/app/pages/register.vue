<script setup lang="ts">
/**
 * 注册页（邮箱 + 密码 + 昵称；昵称缺省取邮箱前缀）。
 * 与登录页共用 AuthShell：版式完全同构，仅标题与字段数不同。
 */
import { useAuthStore } from '~/stores/auth';

definePageMeta({ layout: 'auth' });

usePageSeo({
  title: '注册',
  description: '注册短句，一个账号同步收藏、打卡与复习进度。',
  indexable: true,
});

const auth = useAuthStore();
const route = useRoute();

const email = ref('');
const password = ref('');
const nickname = ref('');
const errorMessage = ref('');
const submitting = ref(false);

/** 注册成功后跳回来源页（缺省首页）。 */
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
  <AuthShell title="创建账号">
    <UCard
      :ui="{
        body: 'p-6',
        ring: 'ring-1 ring-slate-200/80 dark:ring-slate-700/80',
        shadow: 'shadow-xl shadow-slate-900/5',
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
          />
        </UFormField>

        <UFormField label="昵称（可选）">
          <UInput v-model="nickname" type="text" maxlength="50" size="lg" class="w-full" icon="i-lucide-user" />
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
            icon="i-lucide-lock"
          />
        </UFormField>

        <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />

        <UButton type="submit" block size="lg" :loading="submitting" :disabled="!email || password.length < 6">
          {{ submitting ? '注册中…' : '注册并登录' }}
          <template #trailing>
            <UIcon name="i-lucide-arrow-right" class="h-4 w-4" />
          </template>
        </UButton>
      </form>

      <p class="mt-4 text-center text-sm text-slate-400">
        已有账号？
        <ULink to="/login" class="font-medium">登录</ULink>
      </p>
    </UCard>
  </AuthShell>
</template>
