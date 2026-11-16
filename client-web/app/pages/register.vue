<script setup lang="ts">
/**
 * 注册页（邮箱 + 密码 + 昵称；昵称缺省取邮箱前缀）。
 * 与登录页共用 AuthShell：版式完全同构，仅标题与字段数不同。
 */
import { useAuthStore } from '~/stores/auth';
import { useEmailCode } from '~/composables/useEmailCode';
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH } from '~/utils/password';

definePageMeta({ layout: 'auth' });

usePageSeo({
  title: '注册',
  description: '注册短句，一个账号同步收藏、打卡与复习进度。',
  indexable: true,
});

const auth = useAuthStore();
const route = useRoute();
// 注册必须邮箱验证：验证码发到填写的邮箱，5 分钟有效、一次性
const {
  code: emailCode,
  sending: codeSending,
  send: sendEmailCode,
  sendText: codeSendText,
  canSend: canSendCode,
} = useEmailCode('register');

const email = ref('');
const password = ref('');
const nickname = ref('');
/** 是否已勾选同意用户协议与隐私政策（注册前置；不勾不给提交） */
const agreed = ref(false);
const errorMessage = ref('');
const submitting = ref(false);

/** 发送邮箱验证码（失败原因直接展示在表单里）。 */
async function onSendCode(): Promise<void> {
  errorMessage.value = '';
  const failure = await sendEmailCode(email.value);
  if (failure) {
    errorMessage.value = failure;
  }
}

/** 注册成功后跳回来源页（缺省首页）。 */
async function onSubmit(): Promise<void> {
  if (submitting.value) {
    return;
  }
  if (!emailCode.value.trim()) {
    errorMessage.value = '请填写邮箱验证码';
    return;
  }
  if (!agreed.value) {
    errorMessage.value = '请先阅读并同意用户协议与隐私政策';
    return;
  }
  submitting.value = true;
  errorMessage.value = '';
  try {
    await auth.register(
      email.value.trim(),
      password.value,
      nickname.value.trim() || undefined,
      emailCode.value.trim(),
      agreed.value,
    );
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
  <AuthShell title="创建账号" :show-legal="false">
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

        <UFormField label="昵称（可选）">
          <UInput
            v-model="nickname"
            type="text"
            maxlength="50"
            size="lg"
            class="w-full"
            icon="i-lucide-user"
            placeholder="不填则默认取邮箱前缀"
          />
        </UFormField>

        <UFormField label="密码" :help="PASSWORD_HINT">
          <UInput
            v-model="password"
            type="password"
            required
            :minlength="PASSWORD_MIN_LENGTH"
            autocomplete="new-password"
            size="lg"
            class="w-full"
            icon="i-lucide-lock"
            placeholder="设置登录密码"
          />
        </UFormField>

        <UFormField label="邮箱验证码" help="6 位数字，5 分钟内有效；收不到请检查垃圾箱">
          <div class="flex gap-2">
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

        <label class="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
          <UCheckbox v-model="agreed" class="mt-0.5" />
          <span>
            已仔细阅读并同意
            <ULink to="/terms" class="font-medium text-sky-600 dark:text-sky-300">《用户协议》</ULink>
            与
            <ULink to="/privacy" class="font-medium text-sky-600 dark:text-sky-300">《隐私政策》</ULink>
          </span>
        </label>

        <UAlert v-if="errorMessage" color="error" variant="subtle" :description="errorMessage" />

        <UButton
          type="submit"
          block
          size="lg"
          :loading="submitting"
          :disabled="!email || password.length < PASSWORD_MIN_LENGTH || emailCode.length !== 6 || !agreed"
        >
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
