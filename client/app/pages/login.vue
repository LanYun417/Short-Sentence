<script setup lang="ts">
/**
 * 登录页（客户端用户体系，独立于后台 admin）。
 */
import { useAuthStore } from '~/stores/auth';
import { getToken } from '~/composables/useApi';
import { setTokenCookie } from '~/utils/auth-cookie';

definePageMeta({ layout: false });

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

/** 品牌分栏卖点。 */
const FEATURES = [
  { icon: 'i-lucide-image', title: '场景记句', desc: '看图联想语境，一句一画记得更牢' },
  { icon: 'i-lucide-refresh-cw', title: '间隔复习', desc: '按遗忘曲线安排错题，滚动巩固' },
  { icon: 'i-lucide-sparkles', title: 'AI 拓展', desc: '场景造句、词根拆解随时问' },
];

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
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
  void navigateTo(redirect);
});

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
  <!-- 页面本身不滚：品牌栏固定，表单列内容区自己滚 -->
  <div class="grid h-dvh grid-cols-1 overflow-hidden lg:grid-cols-2">
    <!-- 品牌分栏（桌面端，固定不滚） -->
    <aside
      class="anim-fade relative hidden h-full overflow-hidden bg-linear-to-br from-sky-500 via-indigo-600 to-violet-600 p-10 text-white lg:flex lg:flex-col lg:justify-between"
    >
      <div
        class="anim-drift pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"
      />
      <div
        class="anim-drift pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl"
        style="animation-delay: -7s"
      />

      <div class="anim-in relative flex items-center gap-2.5">
        <span
          class="grid h-10 w-10 place-items-center rounded-2xl bg-white/15 shadow-inner backdrop-blur transition-transform duration-300 hover:rotate-6"
        >
          <UIcon name="i-lucide-languages" class="h-6 w-6" />
        </span>
        <span class="text-xl font-bold tracking-tight">短句</span>
      </div>

      <div class="anim-in relative" style="animation-delay: 100ms">
        <h2 class="text-4xl font-bold leading-tight">每天 20 句<br />看图学地道英语</h2>
        <p class="mt-4 max-w-sm text-white/80">用场景和间隔重复，把地道表达种进长期记忆。</p>

        <!-- 产品预览：一张真实的闪卡长什么样 -->
        <div
          class="anim-in mt-7 max-w-sm rounded-2xl bg-white/10 p-3 ring-1 ring-white/20 backdrop-blur"
          style="animation-delay: 220ms"
        >
          <div class="flex items-center gap-1.5 text-[11px] text-white/70">
            <span class="rounded-full bg-white/20 px-2 py-0.5">餐饮美食</span>
            <span class="rounded-full bg-white/20 px-2 py-0.5">进阶</span>
            <span class="ml-auto tabular-nums">今日 7/20</span>
          </div>
          <p class="mt-2.5 text-center text-sm font-semibold">我要烤三文鱼，谢谢。再来一杯水。</p>
          <div class="mt-2 grid aspect-[16/9] place-items-center rounded-xl bg-white/15">
            <UIcon name="i-lucide-image" class="h-6 w-6 text-white/40" />
          </div>
          <div class="mt-2 flex gap-2">
            <div class="h-8 flex-1 rounded-lg bg-white/15" />
            <div class="grid h-8 w-16 place-items-center rounded-lg bg-white/35 text-[11px] font-medium">确定</div>
          </div>
        </div>
      </div>

      <ul class="relative mt-6 space-y-4">
        <li
          v-for="(f, i) in FEATURES"
          :key="f.title"
          class="anim-stagger flex items-start gap-3"
          :style="{ '--d': `${260 + i * 120}ms` }"
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
            <span
              class="grid h-12 w-12 place-items-center rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25"
            >
              <UIcon name="i-lucide-languages" class="h-7 w-7" />
            </span>
            <h2 class="mt-3 text-xl font-bold text-slate-800 dark:text-slate-100">短句</h2>
            <p class="mt-1 text-sm text-slate-400">每天 20 句，看图学地道英语</p>
          </div>

          <div class="anim-in mb-6 hidden lg:block" style="animation-delay: 80ms">
            <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">欢迎回来</h1>
            <p class="mt-1 text-sm text-slate-400">登录后继续今天的刷题</p>
          </div>

          <div class="anim-in" style="animation-delay: 160ms">
            <UCard :ui="{ body: 'p-6' }">
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

                <UFormField label="密码">
                  <UInput
                    v-model="password"
                    type="password"
                    required
                    autocomplete="current-password"
                    size="lg"
                    class="w-full"
                    icon="i-lucide-lock"
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
          </div>
        </div>
      </div>
    </AppScrollArea>
  </div>
</template>
