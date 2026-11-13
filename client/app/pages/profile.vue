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
import { PASSWORD_HINT } from '~/utils/password';
import type { ClientUserProfile, MissingSentenceCards, SentenceCard, TodayCheckin } from '~/types';

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
/** 每日学习提醒邮件开关（1 订阅 / 0 不订阅，随「保存资料」一起提交） */
const emailReminder = ref(false);
const saving = ref(false);
const saveMessage = ref('');

const oldPassword = ref('');
const newPassword = ref('');
const passwordMessage = ref('');
/** 改密邮箱验证码（发到账号邮箱；5 分钟有效、一次性） */
const {
  code: passwordEmailCode,
  sending: passwordCodeSending,
  send: sendPasswordCode,
  sendText: passwordCodeSendText,
  canSend: canSendPasswordCode,
} = useEmailCode('reset');

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
/** 头像地址（/static 资源，防盗链按 Referer 白名单放行）。 */
const avatarSrc = computed(() => auth.user?.avatarUrl ?? undefined);

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
  emailReminder.value = user.emailReminder === 1;
}

/**
 * SSR 预取资料与今日数据：首屏 HTML 直接带头像/昵称/统计。
 * ss:me 与外壳共享同一 key（一次请求两处用）；令牌过期时返回 null，挂载后走客户端流程兜底。
 */
const { data: ssrUser } = await useSsrApi<ClientUserProfile>('ss:me', '/client/auth/me');
const { data: ssrToday } = await useSsrApi<TodayCheckin>('ss:today', '/client/checkin/today');
const { data: ssrSentenceCards } = await useSsrApi<SentenceCard[]>('ss:sentenceCards', '/client/sentence-card/mine');
// 消息中心未读数（红点）：服务端口径，SSR 预取让首屏就带红点，不用等水合
const { data: ssrNoticeUnread } = await useSsrApi<{ count: number }>(
  'ss:notices-unread',
  '/client/notices/unread-count',
);
const noticeUnread = ref(ssrNoticeUnread.value?.count ?? 0);

/** 我的句签（SSR 预取首屏；客户端进入时异步到位后再更新）。 */
const sentenceCards = ref<SentenceCard[]>(ssrSentenceCards.value ?? []);

/** 句签图片地址（/static 资源，防盗链按 Referer 白名单放行）。 */
function sentenceCardImg(url: string | null): string | undefined {
  return url ?? undefined;
}

/** 预览中的句签（点缩略图放大看 3D 视差效果）。 */
const previewCard = ref<SentenceCard | null>(null);

/** 打开预览。 */
function openPreview(card: SentenceCard): void {
  previewCard.value = card;
}

/** 关闭预览。 */
function closePreview(): void {
  previewCard.value = null;
}

/** 分享中的句签（点「分享卡片」后打开的出图弹层）。 */
const sharingCard = ref<SentenceCard | null>(null);

/** 打开分享弹层。 */
function openShare(card: SentenceCard): void {
  sharingCard.value = card;
}

/* ------------------------------ 未拥有的句签 ------------------------------ */

const missingVisible = ref(false);
const missingCards = ref<SentenceCard[]>([]);
const missingTotal = ref(0);
const missingLoading = ref(false);
const missingError = ref('');

/**
 * 打开「未拥有」弹窗并拉取。
 * 每次打开都重新拉：漏领状态会随运营补发 / 当日领取变化，缓存会骗人。
 */
async function openMissing(): Promise<void> {
  missingVisible.value = true;
  if (missingLoading.value) {
    return;
  }
  missingLoading.value = true;
  missingError.value = '';
  try {
    const data = await apiFetch<MissingSentenceCards>('/client/sentence-card/missing');
    missingCards.value = data.list;
    missingTotal.value = data.total;
  } catch (error) {
    missingError.value = error instanceof Error ? error.message : '加载失败，请稍后重试';
  } finally {
    missingLoading.value = false;
  }
}

/** 弹窗描述：总数 + 是否只显示最近一批（加载中/失败时 total 为 0，走默认文案）。 */
const missingDescription = computed(() => {
  if (missingTotal.value === 0) {
    return '完成每日目标即可获得当日句签。';
  }
  const shown = missingCards.value.length;
  const partial = shown < missingTotal.value ? `，此处显示最近 ${shown} 张` : '';
  return `共 ${missingTotal.value} 张未获得${partial}；漏掉的日期可联系运营补发。`;
});

/* ------------------------------ 句签背景图 ------------------------------ */

/** 当前自定义背景（句签配图）；null = 用默认品牌渐变。 */
const bgImageUrl = computed(() => auth.user?.bgImageUrl ?? null);

/** 背景设置保存中。 */
const settingBg = ref(false);
/** 背景设置结果提示（2s 后自动消失）。 */
const bgMessage = ref('');

/**
 * 设为个人主页背景（cardId = 0 恢复默认渐变）。
 * 接口直接返回最新资料，用 setProfile 整体覆盖本地态（同时刷新 localStorage 缓存），
 * 封面立刻切换，不必再拉一次 /me。
 */
async function setBackground(cardId: number): Promise<void> {
  if (settingBg.value) {
    return;
  }
  settingBg.value = true;
  bgMessage.value = '';
  try {
    const profile = await apiFetch<ClientUserProfile>('/client/auth/me/background', {
      method: 'PUT',
      body: { cardId },
    });
    auth.setProfile(profile);
    bgMessage.value = cardId > 0 ? '已设为个人主页背景' : '已恢复默认背景';
    setTimeout(() => {
      bgMessage.value = '';
    }, 2000);
  } catch (error) {
    bgMessage.value = error instanceof Error ? error.message : '设置失败，请稍后重试';
  } finally {
    settingBg.value = false;
  }
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
  // 未读数每次进入都重取：SSR 快照可能已过期（多了公告 / 在别处读过），
  // 红点只在「刚发的公告」才亮起来才有意义
  void apiFetch<{ count: number }>('/client/notices/unread-count')
    .then((data) => {
      noticeUnread.value = data.count ?? 0;
    })
    .catch(() => undefined);
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
      emailReminder: emailReminder.value ? 1 : 0,
    });
    saveMessage.value = '已保存';
  } catch (error) {
    saveMessage.value = error instanceof Error ? error.message : '保存失败';
  } finally {
    saving.value = false;
  }
}

/** 当前账号邮箱（提示验证码发到哪个邮箱；拿不到时为空）。 */
const accountEmail = computed(() => auth.user?.email ?? '');

/** 邮箱验证码字段帮助文案：明确展示目标邮箱。 */
const passwordCodeHelp = computed(() => {
  const target = accountEmail.value ? `账号邮箱 ${accountEmail.value}，` : '你的账号邮箱，';
  return `发送到${target}6 位数字，5 分钟内有效（改密需验证邮箱归属）`;
});

/** 发验证码到当前账号邮箱（改密必须验证邮箱归属，光有旧密码不够）。 */
async function onSendPasswordCode(): Promise<void> {
  passwordMessage.value = '';
  const email = auth.user?.email ?? '';
  if (!email) {
    passwordMessage.value = '未获取到账号邮箱，请刷新后重试';
    return;
  }
  const failure = await sendPasswordCode(email);
  if (failure) {
    passwordMessage.value = failure;
  }
}

/** 修改密码（需邮箱验证码；成功后 store 会清本地态并需重新登录）。 */
async function onChangePassword(): Promise<void> {
  if (passwordEmailCode.value.length !== 6) {
    passwordMessage.value = '请填写 6 位邮箱验证码';
    return;
  }
  passwordMessage.value = '';
  try {
    await auth.changePassword(oldPassword.value, newPassword.value, passwordEmailCode.value.trim());
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
      <!--
        渐变英雄区：头像与身份信息都压在渐变上。
        此前是「空渐变封面 + 下方窄白条放昵称」，信息与装饰割裂；
        现在渐变区自身承载身份，视觉重心回到卡片上部。
      -->
      <div
        class="relative overflow-hidden bg-linear-to-br from-sky-500 via-indigo-500 to-violet-500 px-5 pt-6 pb-16 md:px-7 md:pt-7 md:pb-20"
      >
        <!-- 自定义背景（句签配图）：铺满封面 + 压一层深色蒙版保证文字可读 -->
        <template v-if="bgImageUrl">
          <img :src="bgImageUrl" alt="" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover" />
          <div class="absolute inset-0 bg-linear-to-br from-slate-950/60 via-slate-900/45 to-slate-950/65" />
        </template>
        <template v-else>
          <!-- 默认渐变时的装饰：换成照片后撤掉，避免光斑与同心环糊在图上显得脏 -->
          <div
            class="anim-drift pointer-events-none absolute -right-10 -top-14 size-40 rounded-full bg-white/20 blur-2xl"
          />
          <div
            class="anim-drift pointer-events-none absolute -bottom-16 -left-6 size-36 rounded-full bg-sky-200/25 blur-2xl"
            style="animation-delay: -5s"
          />
          <div
            class="anim-drift pointer-events-none absolute right-1/3 top-2 size-16 rounded-full bg-violet-200/20 blur-xl"
            style="animation-delay: -9s"
          />
          <!--
          同心环装饰：替代此前「昵称首字水印」——
          超大首字水印放在 overflow-hidden 的封面里会被裁成一根竖条（观感像渲染错误），已移除。
        -->
          <div
            class="pointer-events-none absolute -top-10 right-5 hidden size-56 rounded-full border border-white/20 sm:block"
          />
          <div
            class="pointer-events-none absolute -top-1 right-14 hidden size-40 rounded-full border border-white/10 sm:block"
          />
        </template>

        <!-- 头像 + 身份 -->
        <div class="relative flex items-end gap-4">
          <div class="relative shrink-0">
            <!-- 头像即入口：移入 / 聚焦时浮出「设置头像」遮罩（原来的相机小圆钮已移除） -->
            <button
              type="button"
              class="group/avatar relative block cursor-pointer rounded-full bg-white/95 p-1.5 shadow-xl ring-2 ring-white/25 backdrop-blur-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-default"
              :disabled="uploading"
              aria-label="设置头像"
              @click="pickAvatar"
            >
              <span
                class="grid size-24 place-items-center overflow-hidden rounded-full bg-slate-100 text-3xl font-bold text-slate-400 dark:bg-slate-800 dark:text-slate-500"
              >
                <img v-if="avatarSrc" :src="avatarSrc" alt="头像" class="h-full w-full object-cover" />
                <span v-else aria-hidden="true">{{ avatarText }}</span>
              </span>
              <!-- 悬停 / 聚焦遮罩：提示可设置头像；上传中常显并换文案 -->
              <span
                class="pointer-events-none absolute inset-1.5 grid place-items-center rounded-full bg-slate-950/55 text-[11px] font-medium text-white opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100"
                :class="uploading && 'opacity-100'"
              >
                <span v-if="uploading" class="flex flex-col items-center gap-1">
                  <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin" />
                  上传中
                </span>
                <span v-else>设置头像</span>
              </span>
            </button>
            <input
              ref="fileInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              class="hidden"
              @change="onAvatarChange"
            />
          </div>

          <div class="min-w-0 flex-1 pb-1">
            <h1 class="truncate text-2xl font-bold text-white drop-shadow-sm md:text-[28px]">
              {{ auth.user?.nickname }}
            </h1>
            <!-- 邮箱压在自定义背景（句签配图）上容易糊，加一层 text-shadow 保证可读；
                 用任意属性而非 drop-shadow：后者是 filter，会连邮件图标一起糊掉 -->
            <p
              class="mt-0.5 flex items-center gap-1.5 truncate text-sm text-white/75 [text-shadow:0_1px_3px_rgba(0,0,0,0.55)]"
            >
              <UIcon name="i-lucide-mail" class="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span class="truncate">{{ auth.user?.email }}</span>
            </p>
          </div>
        </div>
      </div>

      <!--
        统计面板：通栏叠压在渐变下缘。
        此前面板左右内缩（px-5）而渐变仍是整块通栏，导致渐变底边在面板两侧
        露出一截紫色「硬边」；改为面板也通栏、只保留上圆角，渐变底边被完整盖住。
      -->
      <div class="relative">
        <div
          class="-mt-10 rounded-t-2xl bg-white px-5 pt-5 pb-5 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/70 ring-t-0 md:-mt-12 md:px-7 md:pt-6 md:pb-6 dark:bg-slate-900 dark:shadow-none dark:ring-slate-800"
        >
          <!-- 今日统计 -->
          <template v-if="today">
            <div class="grid grid-cols-3">
              <div
                v-for="(s, i) in STATS"
                :key="s.key"
                class="anim-pop flex flex-col items-center gap-0.5 border-l border-slate-100 py-1 text-center first:border-l-0 dark:border-slate-800"
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
            <div class="mt-4 border-t border-slate-100 pt-3.5 dark:border-slate-800">
              <div class="mb-1.5 flex items-center justify-between text-xs text-slate-400">
                <span class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-target" class="h-3.5 w-3.5" />
                  今日目标
                </span>
                <span class="tabular-nums">{{ goalPercent }}%</span>
              </div>
              <UProgress :model-value="goalPercent" size="sm" />
            </div>
          </template>

          <!-- 签名 -->
          <p
            v-if="auth.user?.signature"
            class="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400"
          >
            <UIcon name="i-lucide-quote" class="mt-0.5 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
            <span class="min-w-0 wrap-break-word">{{ auth.user.signature }}</span>
          </p>
        </div>
      </div>
    </section>

    <!-- 收藏与复习：低频的「回看 / 巩固」动作，收进「我的」做二级入口，
         顶部导航只留核心四项（刷题 / 功能 / 排行榜 / 我的）。
         别把排行榜 / 情景闯关 / 句子接龙再放回来：它们分别常驻导航 Tab 与「功能」页，
         放这里只会重复。 -->
    <NuxtLink
      to="/favorites"
      class="anim-in mt-5 flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-slate-200/70 transition hover:ring-sky-300 dark:bg-slate-900 dark:ring-slate-800/80 dark:hover:ring-sky-500/40"
      style="animation-delay: 90ms"
    >
      <UIcon name="i-lucide-star" class="h-5 w-5 shrink-0 text-sky-500" />
      <span class="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">我的收藏</span>
      <UIcon name="i-lucide-chevron-right" class="h-4 w-4 shrink-0 text-slate-400" />
    </NuxtLink>

    <NuxtLink
      to="/review"
      class="anim-in mt-3 flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-slate-200/70 transition hover:ring-sky-300 dark:bg-slate-900 dark:ring-slate-800/80 dark:hover:ring-sky-500/40"
      style="animation-delay: 95ms"
    >
      <UIcon name="i-lucide-refresh-cw" class="h-5 w-5 shrink-0 text-sky-500" />
      <span class="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">复习</span>
      <UIcon name="i-lucide-chevron-right" class="h-4 w-4 shrink-0 text-slate-400" />
    </NuxtLink>

    <!-- 消息中心入口：未读红点来自服务端口径（SSR 预取，首屏即带） -->
    <NuxtLink
      to="/notices"
      class="anim-in mt-3 flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-slate-200/70 transition hover:ring-sky-300 dark:bg-slate-900 dark:ring-slate-800/80 dark:hover:ring-sky-500/40"
      style="animation-delay: 100ms"
    >
      <UIcon name="i-lucide-bell" class="h-5 w-5 shrink-0 text-sky-500" />
      <span class="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">消息中心</span>
      <span
        v-if="noticeUnread > 0"
        class="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold leading-5 text-white"
      >
        {{ noticeUnread > 99 ? '99+' : noticeUnread }}
      </span>
      <UIcon name="i-lucide-chevron-right" class="h-4 w-4 shrink-0 text-slate-400" />
    </NuxtLink>

    <!-- 意见反馈入口：提交建议与问题，并在同一页看到运营回复 -->
    <NuxtLink
      to="/feedback"
      class="anim-in mt-3 flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-slate-200/70 transition hover:ring-sky-300 dark:bg-slate-900 dark:ring-slate-800/80 dark:hover:ring-sky-500/40"
      style="animation-delay: 110ms"
    >
      <UIcon name="i-lucide-message-square-text" class="h-5 w-5 shrink-0 text-sky-500" />
      <span class="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">意见反馈</span>
      <UIcon name="i-lucide-chevron-right" class="h-4 w-4 shrink-0 text-slate-400" />
    </NuxtLink>

    <!-- 下载 App 入口：点击后取最新上架版本并提供安装包下载 -->
    <AppDownloadEntry />

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
                <!-- rows 用 :rows 绑定：静态属性会以字符串 "1" 传入，与 number 类型不符 -->
                <UTextarea v-model="signature" :rows="1" maxlength="200" autoresize class="w-full" />
              </UFormField>
            </div>

            <div class="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <UButton icon="i-lucide-check" :loading="saving" @click="onSave">保存资料</UButton>
              <span v-if="saveMessage" class="text-sm text-slate-400">{{ saveMessage }}</span>
            </div>
          </div>

          <!-- 每日学习提醒（邮件）：由服务端定时任务发送，不需要页面在前台 -->
          <div
            class="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80 md:p-6"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <UIcon name="i-lucide-mail" class="h-4 w-4 text-sky-500" />
                  每日学习提醒（邮件）
                </p>
                <p class="mt-1 text-xs text-slate-400">
                  每天 18:00 一封邮件，当天还没完成目标时提醒你补上（发送到
                  {{ auth.user?.email }}）
                </p>
              </div>
              <USwitch v-model="emailReminder" />
            </div>
            <p class="mt-3 text-xs text-slate-400">开关随「保存资料」一起提交。</p>
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
              <UFormField label="新密码" :help="PASSWORD_HINT">
                <UInput
                  v-model="newPassword"
                  type="password"
                  icon="i-lucide-key-round"
                  autocomplete="new-password"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UFormField label="邮箱验证码" class="mt-4" :help="passwordCodeHelp">
              <div class="flex gap-2">
                <UInput
                  v-model="passwordEmailCode"
                  type="text"
                  inputmode="numeric"
                  maxlength="6"
                  autocomplete="one-time-code"
                  icon="i-lucide-shield-check"
                  placeholder="邮箱收到的验证码"
                  class="flex-1"
                />
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  class="shrink-0"
                  :loading="passwordCodeSending"
                  :disabled="!canSendPasswordCode"
                  @click="onSendPasswordCode"
                >
                  {{ passwordCodeSendText }}
                </UButton>
              </div>
            </UFormField>

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
            <!-- 头部：数量 + 「查看未拥有」 -->
            <div class="mb-3 flex items-center justify-between gap-2">
              <p class="text-sm text-slate-400">共 {{ sentenceCards.length }} 张</p>
              <button
                type="button"
                class="inline-flex cursor-pointer items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:text-sky-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-sky-300"
                @click="openMissing"
              >
                <UIcon name="i-lucide-lock" class="h-3.5 w-3.5" />
                查看未拥有
              </button>
            </div>

            <div v-if="sentenceCards.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button
                v-for="item in sentenceCards"
                :key="item.id"
                type="button"
                class="group overflow-hidden rounded-2xl bg-slate-50 text-left ring-1 ring-slate-200/70 transition hover:ring-amber-300 dark:bg-slate-800 dark:ring-slate-700/70 dark:hover:ring-amber-500/40"
                @click="openPreview(item)"
              >
                <div class="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-700">
                  <img
                    v-if="item.imageUrl"
                    :src="sentenceCardImg(item.imageUrl)"
                    :alt="item.title"
                    class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div v-else class="flex h-full items-center justify-center text-slate-300 dark:text-slate-600">
                    <UIcon name="i-lucide-image-off" class="h-6 w-6" />
                  </div>
                  <!-- 当前正被用作个人主页背景的那张 -->
                  <span
                    v-if="auth.user?.bgCardId === item.id"
                    class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[10px] font-medium text-white backdrop-blur"
                  >
                    <UIcon name="i-lucide-check" class="h-3 w-3" />
                    背景中
                  </span>
                  <span
                    class="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-medium text-white opacity-0 backdrop-blur transition-opacity duration-200 group-hover:opacity-100"
                  >
                    <UIcon name="i-lucide-expand" class="h-3 w-3" />
                    3D 预览
                  </span>
                </div>
                <div class="p-3">
                  <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{{ item.titleZh }}</p>
                  <p class="truncate text-xs text-slate-400">{{ item.bizDate }}</p>
                </div>
              </button>
            </div>
            <div v-else class="flex flex-col items-center gap-2 py-10 text-center text-slate-400">
              <UIcon name="i-lucide-sparkles" class="h-8 w-8" />
              <p class="text-sm">还没有句签，完成每日目标即可获得当日 AI 闪卡</p>
            </div>
          </div>
        </template>
      </UTabs>
    </section>

    <!-- 句签预览：3D 视差大图 -->
    <Teleport to="body">
      <Transition name="ss-celebrate">
        <div
          v-if="previewCard"
          class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          @click.self="closePreview"
        >
          <div class="flex w-[min(92vw,26rem)] flex-col items-center gap-3">
            <SentenceCard :card="previewCard" />

            <div class="flex flex-wrap items-center justify-center gap-2">
              <!-- 朗读：句签就是一句英文短句，听读是核心场景；与下方操作按钮同排 -->
              <TtsButton :text="previewCard.sentenceEn" lang="en-US" />
              <!-- 设为个人主页背景；已是当前背景则提供恢复默认 -->
              <UButton
                v-if="auth.user?.bgCardId !== previewCard.id"
                :loading="settingBg"
                icon="i-lucide-layers"
                @click="setBackground(previewCard.id)"
              >
                设为个人主页背景
              </UButton>
              <UButton
                v-else
                :loading="settingBg"
                color="neutral"
                variant="soft"
                icon="i-lucide-rotate-ccw"
                @click="setBackground(0)"
              >
                恢复默认背景
              </UButton>
              <UButton color="neutral" variant="soft" icon="i-lucide-share-2" @click="openShare(previewCard)">
                分享卡片
              </UButton>
            </div>

            <p v-if="bgMessage" class="text-xs text-white/85">{{ bgMessage }}</p>
            <p class="text-center text-xs text-white/60">移动鼠标可看到 3D 视差效果</p>
          </div>
          <button
            type="button"
            class="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
            aria-label="关闭预览"
            @click="closePreview"
          >
            <UIcon name="i-lucide-x" class="h-5 w-5" />
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- 分享卡片：出图 + 保存 / 系统分享 -->
    <ShareCardSheet :card="sharingCard" @close="sharingCard = null" />

    <!-- 未拥有的句签 -->
    <UModal
      v-model:open="missingVisible"
      title="未拥有的句签"
      :description="missingDescription"
      :ui="{ content: 'max-w-xl' }"
    >
      <template #body>
        <div v-if="missingLoading" class="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
          <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin" />
          加载中…
        </div>
        <p v-else-if="missingError" class="py-8 text-center text-sm text-rose-500">{{ missingError }}</p>
        <div v-else-if="missingCards.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div
            v-for="item in missingCards"
            :key="item.id"
            class="overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 dark:bg-slate-800 dark:ring-slate-700/70"
          >
            <div class="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-700">
              <img
                v-if="item.imageUrl"
                :src="sentenceCardImg(item.imageUrl)"
                :alt="item.titleZh"
                class="h-full w-full object-cover"
                loading="lazy"
              />
              <div v-else class="flex h-full items-center justify-center text-slate-300 dark:text-slate-600">
                <UIcon name="i-lucide-image-off" class="h-5 w-5" />
              </div>
              <span
                class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-medium text-white backdrop-blur"
              >
                <UIcon name="i-lucide-lock" class="h-3 w-3" />
                未获得
              </span>
            </div>
            <div class="p-3">
              <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{{ item.titleZh }}</p>
              <p class="truncate text-xs text-slate-400">{{ item.bizDate }}</p>
            </div>
          </div>
        </div>
        <div v-else class="flex flex-col items-center gap-2 py-10 text-center text-slate-400">
          <UIcon name="i-lucide-check-check" class="h-8 w-8" />
          <p class="text-sm">已收集全部句签，一张不漏</p>
        </div>
      </template>
    </UModal>
  </div>
</template>
