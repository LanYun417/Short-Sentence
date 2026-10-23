<script setup lang="ts">
/**
 * 个人中心：身份卡（头像/资料/今日目标）+ Tab 表单（基本资料 / 账号安全）。
 *
 * 版式：渐变封面身份卡承载「我是谁 + 今天练了多少」，
 * 两个表单收进 Tabs 减少堆卡感；移动端单列，桌面端 max-w-2xl 居中。
 */
import { useAuthStore } from '~/stores/auth';
import { apiFetch } from '~/composables/useApi';
import { useCountUp } from '~/composables/useCountUp';
import { withUploadToken } from '~/utils/upload-token';
import type { ClientUserProfile, SentenceCard, TodayCheckin } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '个人中心',
  description: '管理个人资料与密码，查看今日完成、连续打卡等学习数据。',
});

const auth = useAuthStore();

const nickname = ref('');
const birthday = ref('');
const gender = ref('secret');
const signature = ref('');
const saving = ref(false);
const saveMessage = ref('');

const oldPassword = ref('');
const newPassword = ref('');
const passwordMessage = ref('');

const today = ref<TodayCheckin | null>(null);

/** 头像上传。 */
const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

const GENDERS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'secret', label: '保密' },
];

/** 三项统计。 */
const STATS = [
  { key: 'done', label: '今日完成', icon: 'i-lucide-check-circle-2' },
  { key: 'streak', label: '连续打卡', icon: 'i-lucide-flame' },
  { key: 'goal', label: '每日目标', icon: 'i-lucide-target' },
] as const;

/** 统计数字滚动动画。 */
const doneDisplay = useCountUp(computed(() => today.value?.doneCount ?? 0));
const streakDisplay = useCountUp(computed(() => today.value?.streak ?? 0));
const goalDisplay = useCountUp(computed(() => today.value?.goalCount ?? 0));
const displays = computed<Record<(typeof STATS)[number]['key'], number>>(() => ({
  done: doneDisplay.value,
  streak: streakDisplay.value,
  goal: goalDisplay.value,
}));

/** 今日目标进度（0~100）。 */
const goalPercent = computed(() => {
  const t = today.value;
  if (!t || t.goalCount <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((t.doneCount / t.goalCount) * 100));
});

const avatarText = computed(() => (auth.user?.nickname ?? '?').slice(0, 1));
// 头像令牌走 Cookie：SSR 渲染的头像 URL 带令牌，首屏即显示（服务端读不到 localStorage）
const tokenCookie = useCookie<string | null>('ss_token');
/** 头像地址：/static 资源需要带令牌才能访问 */
const avatarSrc = computed(() =>
  auth.user?.avatarUrl ? withUploadToken(auth.user.avatarUrl, tokenCookie.value) : undefined,
);

/** 表单 Tab（slot 字段指定内容插槽名）。 */
const TABS = [
  { label: '基本资料', icon: 'i-lucide-user-round', slot: 'profile' },
  { label: '成长', icon: 'i-lucide-trending-up', slot: 'growth' },
  { label: '我的句签', icon: 'i-lucide-sparkles', slot: 'sentenceCards' },
  { label: '账号安全', icon: 'i-lucide-shield-check', slot: 'security' },
];

/** 回填表单。 */
function fillForm(): void {
  const user = auth.user;
  if (!user) {
    return;
  }
  nickname.value = user.nickname;
  birthday.value = user.birthday ?? '';
  gender.value = user.gender;
  signature.value = user.signature ?? '';
}

/**
 * SSR 预取资料与今日数据：首屏 HTML 直接带头像/昵称/统计。
 * ss:me 与外壳共享同一 key（一次请求两处用）；令牌过期时返回 null，挂载后走客户端流程兜底。
 */
const { data: ssrUser } = await useSsrApi<ClientUserProfile>('ss:me', '/client/auth/me');
const { data: ssrToday } = await useSsrApi<TodayCheckin>('ss:today', '/client/checkin/today');
const { data: ssrSentenceCards } = await useSsrApi<SentenceCard[]>('ss:sentenceCards', '/client/sentence-card/mine');

/** 我的句签（SSR 预取首屏；客户端进入时异步到位后再更新）。 */
const sentenceCards = ref<SentenceCard[]>(ssrSentenceCards.value ?? []);

/** 句签图片地址（/static 需带令牌）。 */
function sentenceCardImg(url: string | null): string | undefined {
  return url ? withUploadToken(url, tokenCookie.value) : undefined;
}

if (ssrUser.value) {
  auth.user = ssrUser.value;
}
if (ssrToday.value) {
  today.value = ssrToday.value;
}
fillForm();

// 客户端路由进入时数据是异步到达的：到位后再回填表单与统计
watch(ssrUser, (profile) => {
  if (profile) {
    auth.user = profile;
    fillForm();
  }
});
watch(ssrToday, (data) => {
  if (data) {
    today.value = data;
  }
});
watch(ssrSentenceCards, (data) => {
  if (data) {
    sentenceCards.value = data;
  }
});

onMounted(() => {
  // SSR 资料：顺带刷新 localStorage 缓存（离线兜底也保持新鲜）
  if (ssrUser.value) {
    auth.setProfile(ssrUser.value);
  } else if (!auth.user && auth.loggedIn) {
    // SSR 预取失败（Cookie 令牌过期等）：走既有客户端流程（含无感刷新）
    void auth.fetchMe().then(fillForm);
  }
  if (!today.value) {
    void apiFetch<TodayCheckin>('/client/checkin/today').then((data) => {
      today.value = data;
    });
  }
});

/** 打开文件选择。 */
function pickAvatar(): void {
  fileInput.value?.click();
}

/** 上传头像（FormData 直传，成功后用返回的最新资料覆盖本地态）。 */
async function onAvatarChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }
  uploading.value = true;
  saveMessage.value = '';
  try {
    const form = new FormData();
    form.append('file', file);
    const profile = await apiFetch<ClientUserProfile>('/client/auth/avatar', {
      method: 'POST',
      body: form,
    });
    auth.setProfile(profile);
  } catch (error) {
    saveMessage.value = error instanceof Error ? error.message : '头像上传失败';
  } finally {
    uploading.value = false;
    // 清空 value，允许再次选择同一个文件
    input.value = '';
  }
}

/** 保存资料。 */
async function onSave(): Promise<void> {
  saving.value = true;
  saveMessage.value = '';
  try {
    await auth.updateProfile({
      nickname: nickname.value,
      birthday: birthday.value || undefined,
      gender: gender.value,
      signature: signature.value,
    });
    saveMessage.value = '已保存';
  } catch (error) {
    saveMessage.value = error instanceof Error ? error.message : '保存失败';
  } finally {
    saving.value = false;
  }
}

/** 修改密码（成功后 store 会清本地态并需重新登录）。 */
async function onChangePassword(): Promise<void> {
  passwordMessage.value = '';
  try {
    await auth.changePassword(oldPassword.value, newPassword.value);
    passwordMessage.value = '密码已修改，请重新登录';
  } catch (error) {
    passwordMessage.value = error instanceof Error ? error.message : '修改失败';
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 md:py-8">
    <!-- ============ 身份卡 ============ -->
    <section
      class="anim-in overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
    >
      <!-- 渐变封面 -->
      <div class="relative h-32 overflow-hidden bg-linear-to-br from-sky-500 via-indigo-500 to-violet-500 md:h-36">
        <div
          class="anim-drift pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-white/20 blur-2xl"
        />
        <div
          class="anim-drift pointer-events-none absolute -bottom-12 left-8 h-28 w-28 rounded-full bg-sky-200/25 blur-2xl"
          style="animation-delay: -5s"
        />
        <div
          class="anim-drift pointer-events-none absolute right-1/3 top-4 h-16 w-16 rounded-full bg-violet-200/20 blur-xl"
          style="animation-delay: -9s"
        />
        <!-- 昵称首字水印 -->
        <span
          class="pointer-events-none absolute -bottom-5 right-5 select-none text-[7rem] leading-none font-black text-white/10"
          aria-hidden="true"
        >
          {{ avatarText }}
        </span>
      </div>

      <div class="relative px-5 pb-5 md:px-7 md:pb-6">
        <!-- 头像 + 身份信息（头像手搓 96px：v4 的 UAvatar 3xl 只有 48px，角标会盖掉大半） -->
        <div class="-mt-14 flex items-end gap-4">
          <div class="relative shrink-0">
            <div
              class="rounded-full bg-white p-1.5 shadow-lg ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60"
            >
              <div
                class="grid size-24 place-items-center overflow-hidden rounded-full bg-slate-100 text-3xl font-bold text-slate-400 dark:bg-slate-800 dark:text-slate-500"
              >
                <img v-if="avatarSrc" :src="avatarSrc" alt="头像" class="h-full w-full object-cover" />
                <span v-else aria-hidden="true">{{ avatarText }}</span>
              </div>
            </div>
            <button
              type="button"
              class="absolute right-0 bottom-0 grid h-9 w-9 translate-x-1/4 translate-y-1/4 place-items-center rounded-full bg-white text-slate-500 shadow-md ring-1 ring-slate-200 transition hover:scale-110 hover:text-primary active:scale-90 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700"
              :disabled="uploading"
              title="更换头像"
              aria-label="更换头像"
              @click="pickAvatar"
            >
              <UIcon v-if="!uploading" name="i-lucide-camera" class="h-4 w-4" />
              <UIcon v-else name="i-lucide-loader-circle" class="h-4 w-4 animate-spin" />
            </button>
            <input
              ref="fileInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              class="hidden"
              @change="onAvatarChange"
            />
          </div>

          <div class="min-w-0 pb-1.5">
            <h1 class="truncate text-2xl font-bold text-slate-900 dark:text-slate-50">{{ auth.user?.nickname }}</h1>
            <p class="truncate text-sm text-slate-400">{{ auth.user?.email }}</p>
          </div>
        </div>

        <!-- 签名 -->
        <p
          v-if="auth.user?.signature"
          class="mt-3 border-l-2 border-sky-300/60 pl-3 text-sm text-slate-500 dark:text-slate-400"
        >
          {{ auth.user.signature }}
        </p>

        <!-- 今日统计 -->
        <template v-if="today">
          <div class="mt-5 grid grid-cols-3">
            <div
              v-for="(s, i) in STATS"
              :key="s.key"
              class="anim-pop flex flex-col items-center gap-0.5 border-l border-slate-100 py-2 text-center first:border-l-0 dark:border-slate-800"
              :style="{ animationDelay: `${140 + i * 90}ms` }"
            >
              <UIcon :name="s.icon" class="h-4 w-4 text-slate-300 dark:text-slate-600" />
              <p class="text-2xl leading-none font-bold tabular-nums text-slate-900 dark:text-slate-50">
                {{ displays[s.key] }}
              </p>
              <p class="text-xs text-slate-400">{{ s.label }}</p>
            </div>
          </div>

          <!-- 今日目标进度 -->
          <div class="mt-3">
            <div class="mb-1.5 flex items-center justify-between text-xs text-slate-400">
              <span>今日目标</span>
              <span class="tabular-nums">{{ goalPercent }}%</span>
            </div>
            <UProgress :model-value="goalPercent" size="sm" />
          </div>
        </template>
      </div>
    </section>

    <!-- ============ 表单 Tabs ============ -->
    <section class="anim-in mt-5" style="animation-delay: 120ms">
      <UTabs :items="TABS" variant="pill" :content="true">
        <!-- 基本资料 -->
        <template #profile>
          <div
            class="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80 md:p-6"
          >
            <div class="grid gap-4 md:grid-cols-2">
              <UFormField label="昵称">
                <UInput v-model="nickname" maxlength="50" icon="i-lucide-user-round" class="w-full" />
              </UFormField>
              <UFormField label="性别">
                <USelect v-model="gender" :items="GENDERS" value-key="value" label-key="label" class="w-full" />
              </UFormField>
              <UFormField label="出生年月日">
                <BirthdayPicker v-model="birthday" />
              </UFormField>
              <UFormField label="个性签名" help="一句激励自己的话，会展示在身份卡上">
                <UTextarea v-model="signature" rows="1" maxlength="200" autoresize class="w-full" />
              </UFormField>
            </div>

            <div class="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <UButton icon="i-lucide-check" :loading="saving" @click="onSave">保存资料</UButton>
              <span v-if="saveMessage" class="text-sm text-slate-400">{{ saveMessage }}</span>
            </div>
          </div>
        </template>

        <!-- 成长：XP / 等级 / 成就 / 场景探索 -->
        <template #growth>
          <div class="mt-4">
            <GrowthPanel />
          </div>
        </template>

        <!-- 账号安全 -->
        <template #security>
          <div
            class="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80 md:p-6"
          >
            <div class="grid gap-4 md:grid-cols-2">
              <UFormField label="原密码">
                <UInput
                  v-model="oldPassword"
                  type="password"
                  icon="i-lucide-lock"
                  autocomplete="current-password"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="新密码" help="6~32 位，需同时包含字母和数字">
                <UInput
                  v-model="newPassword"
                  type="password"
                  icon="i-lucide-key-round"
                  autocomplete="new-password"
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <UButton color="neutral" variant="outline" icon="i-lucide-key-round" @click="onChangePassword">
                修改密码
              </UButton>
              <span v-if="passwordMessage" class="text-sm text-slate-400">{{ passwordMessage }}</span>
            </div>
          </div>
        </template>

        <!-- 我的句签 -->
        <template #sentenceCards>
          <div
            class="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80 md:p-6"
          >
            <div v-if="sentenceCards.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div
                v-for="item in sentenceCards"
                :key="item.id"
                class="overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 dark:bg-slate-800 dark:ring-slate-700/70"
              >
                <div class="aspect-video overflow-hidden bg-slate-100 dark:bg-slate-700">
                  <img
                    v-if="item.imageUrl"
                    :src="sentenceCardImg(item.imageUrl)"
                    :alt="item.title"
                    class="h-full w-full object-cover"
                  />
                  <div v-else class="flex h-full items-center justify-center text-slate-300 dark:text-slate-600">
                    <UIcon name="i-lucide-image-off" class="h-6 w-6" />
                  </div>
                </div>
                <div class="p-3">
                  <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{{ item.titleZh }}</p>
                  <p class="truncate text-xs text-slate-400">{{ item.bizDate }}</p>
                </div>
              </div>
            </div>
            <div v-else class="flex flex-col items-center gap-2 py-10 text-center text-slate-400">
              <UIcon name="i-lucide-sparkles" class="h-8 w-8" />
              <p class="text-sm">还没有句签，完成每日目标即可获得当日 AI 闪卡</p>
            </div>
          </div>
        </template>
      </UTabs>
    </section>
  </div>
</template>
