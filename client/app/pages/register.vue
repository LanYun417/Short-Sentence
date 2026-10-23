<script setup lang="ts">
/**
 * 注册页（邮箱 + 密码 + 昵称；昵称缺省取邮箱前缀）。
 */
import { useAuthStore } from '~/stores/auth';

definePageMeta({ layout: false });

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

/** 品牌分栏卖点。 */
const FEATURES = [
  { icon: 'i-lucide-image', title: '场景记句', desc: '看图联想语境，一句一画记得更牢' },
  { icon: 'i-lucide-refresh-cw', title: '间隔复习', desc: '按遗忘曲线安排错题，滚动巩固' },
  { icon: 'i-lucide-sparkles', title: 'AI 拓展', desc: '场景造句、词根拆解随时问' },
];

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
  <!-- 页面本身不滚：品牌栏固定，表单列内容区自己滚 -->
  <div class="grid h-dvh grid-cols-1 overflow-hidden lg:grid-cols-2">
    <!-- 品牌分栏（桌面端，固定不滚） -->
    <aside
      class="anim-fade relative hidden h-full overflow-hidden bg-linear-to-br from-violet-600 via-indigo-600 to-sky-500 p-10 text-white lg:flex lg:flex-col lg:justify-between"
    >
      <div
        class="anim-drift pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"
      />
      <div
        class="anim-drift pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-violet-300/20 blur-3xl"
        style="animation-delay: -7s"
      />

      <div class="anim-in relative flex items-center gap-2.5">
        <img src="/favicon.svg" alt="短句" class="h-10 w-10 transition-transform duration-300 hover:rotate-6" />
        <span class="text-xl font-bold tracking-tight">短句</span>
      </div>

      <div class="anim-in relative" style="animation-delay: 100ms">
        <h2 class="text-4xl font-bold leading-tight">加入短句<br />开始你的场景英语之旅</h2>
        <p class="mt-4 max-w-sm text-white/80">一个账号，同步收藏、打卡与复习进度。</p>
      </div>

      <ul class="relative space-y-4">
        <li
          v-for="(f, i) in FEATURES"
          :key="f.title"
          class="anim-stagger flex items-start gap-3"
          :style="{ '--d': `${200 + i * 120}ms` }"
        >
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur">
            <UIcon :name="f.icon" class="h-5 w-5" />
          </span>
          <div>
            <p class="font-semibold">{{ f.title }}</p>
            <p class="text-sm text-white/75">{{ f.desc }}</p>
          </div>
        </li>
      </ul>
    </aside>

    <!-- 表单列：内容区自己滚，超出时出现悬浮滚动条 -->
    <AppScrollArea>
      <div class="flex min-h-full items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
        <div class="w-full max-w-sm">
          <!-- 移动端品牌头 -->
          <div class="anim-in mb-8 flex flex-col items-center text-center lg:hidden">
            <img src="/favicon.svg" alt="短句" class="h-12 w-12" />
            <h2 class="mt-3 text-xl font-bold text-slate-800 dark:text-slate-100">加入短句</h2>
            <p class="mt-1 text-sm text-slate-400">一个账号，同步收藏与打卡</p>
          </div>

          <div class="anim-in mb-6 hidden lg:block" style="animation-delay: 80ms">
            <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">创建账号</h1>
            <p class="mt-1 text-sm text-slate-400">几十秒即可开始刷题</p>
          </div>

          <div class="anim-in" style="animation-delay: 160ms">
            <UCard :ui="{ body: 'p-6' }">
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
                <ULink to="/login" class="font-medium">登录</ULink>
              </p>
            </UCard>
          </div>
        </div>
      </div>
    </AppScrollArea>
  </div>
</template>
