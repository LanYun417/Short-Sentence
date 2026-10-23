<script setup lang="ts">
/**
 * 个人中心：头像上传 + 资料编辑 + 修改密码 + 今日数据。
 *
 * 版式：渐变封面 + 悬浮头像 + 统计条 + 分区表单卡。
 */
import { useAuthStore } from '~/stores/auth';
import { apiFetch } from '~/composables/useApi';
import { useCountUp } from '~/composables/useCountUp';
import { withUploadToken } from '~/utils/upload-token';
import type { ClientUserProfile, TodayCheckin } from '~/types';

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
  { key: 'done', label: '今日完成', icon: 'i-lucide-check-circle-2', tone: 'text-sky-500 dark:text-sky-400' },
  { key: 'streak', label: '连续打卡', icon: 'i-lucide-flame', tone: 'text-amber-500 dark:text-amber-400' },
  { key: 'goal', label: '每日目标', icon: 'i-lucide-target', tone: 'text-emerald-500 dark:text-emerald-400' },
];

/** 统计数字滚动动画。 */
const doneDisplay = useCountUp(computed(() => today.value?.doneCount ?? 0));
const streakDisplay = useCountUp(computed(() => today.value?.streak ?? 0));
const goalDisplay = useCountUp(computed(() => today.value?.goalCount ?? 0));
const displays = computed(() => ({
  done: doneDisplay.value,
  streak: streakDisplay.value,
  goal: goalDisplay.value,
}));

const avatarText = computed(() => (auth.user?.nickname ?? '?').slice(0, 1));
/** 头像地址：/static 资源需要带令牌才能访问 */
const avatarSrc = computed(() => (auth.user?.avatarUrl ? withUploadToken(auth.user.avatarUrl) : undefined));

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

onMounted(async () => {
  await auth.fetchMe();
  fillForm();
  today.value = await apiFetch<TodayCheckin>('/client/checkin/today');
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
  <div class="mx-auto max-w-xl px-4 py-6 md:py-8">
    <!-- 身份卡：封面 + 悬浮头像 + 统计条 -->
    <UCard class="anim-in overflow-hidden" :ui="{ body: 'p-0' }">
      <!-- 封面 -->
      <div class="relative h-24 overflow-hidden bg-linear-to-br from-sky-500 via-indigo-500 to-violet-500">
        <div
          class="anim-drift pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-white/20 blur-2xl"
        />
        <div
          class="anim-drift pointer-events-none absolute -bottom-10 left-6 h-24 w-24 rounded-full bg-sky-200/25 blur-2xl"
          style="animation-delay: -5s"
        />
      </div>

      <div class="relative px-6 pb-6">
        <!-- 头像（上浮，点击上传） -->
        <div class="-mt-10 flex items-end gap-4">
          <div class="relative shrink-0">
            <div class="rounded-full bg-white p-1 shadow-lg dark:bg-slate-900">
              <UAvatar size="2xl" :src="avatarSrc" :text="avatarText" />
            </div>
            <button
              type="button"
              class="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-white text-slate-500 shadow-md ring-1 ring-slate-200 transition hover:text-sky-600 hover:shadow-lg active:scale-90 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700 dark:hover:text-sky-400"
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

          <div class="min-w-0 pb-1">
            <p class="truncate text-lg font-semibold text-slate-800 dark:text-slate-100">{{ auth.user?.nickname }}</p>
            <p class="truncate text-sm text-slate-400">{{ auth.user?.email }}</p>
          </div>
        </div>

        <p v-if="auth.user?.signature" class="mt-3 text-sm text-slate-500 dark:text-slate-400">
          {{ auth.user.signature }}
        </p>

        <!-- 今日统计（数字滚动） -->
        <div v-if="today" class="mt-5 grid grid-cols-3 gap-3">
          <div
            v-for="(s, i) in STATS"
            :key="s.key"
            class="anim-pop rounded-2xl bg-slate-50 p-3 text-center dark:bg-slate-800/60"
            :style="{ animationDelay: `${120 + i * 90}ms` }"
          >
            <UIcon :name="s.icon" class="mx-auto h-5 w-5" :class="s.tone" />
            <p class="mt-1.5 text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
              {{ displays[s.key] }}
            </p>
            <p class="text-xs text-slate-400">{{ s.label }}</p>
          </div>
        </div>
      </div>
    </UCard>

    <!-- 基本资料 -->
    <UCard class="anim-in mt-4" :ui="{ body: 'p-6' }" :style="{ animationDelay: '120ms' }">
      <h2 class="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
        <span
          class="grid h-7 w-7 place-items-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
        >
          <UIcon name="i-lucide-user-round" class="h-4 w-4" />
        </span>
        基本资料
      </h2>

      <div class="space-y-4">
        <UFormField label="昵称">
          <UInput v-model="nickname" maxlength="50" class="w-full" />
        </UFormField>

        <UFormField label="出生年月日">
          <BirthdayPicker v-model="birthday" />
        </UFormField>

        <UFormField label="性别">
          <USelect v-model="gender" :items="GENDERS" value-key="value" label-key="label" class="w-full" />
        </UFormField>

        <UFormField label="个性签名">
          <UTextarea v-model="signature" rows="3" maxlength="200" autoresize class="w-full" />
        </UFormField>
      </div>

      <div class="mt-5 flex items-center gap-3">
        <UButton icon="i-lucide-check" :loading="saving" @click="onSave">保存资料</UButton>
        <span v-if="saveMessage" class="text-sm text-slate-400">{{ saveMessage }}</span>
      </div>
    </UCard>

    <!-- 账号安全 -->
    <UCard class="anim-in mt-4" :ui="{ body: 'p-6' }" :style="{ animationDelay: '200ms' }">
      <h2 class="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
        <span
          class="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
        >
          <UIcon name="i-lucide-shield-check" class="h-4 w-4" />
        </span>
        账号安全
      </h2>

      <div class="space-y-4">
        <UFormField label="原密码">
          <UInput v-model="oldPassword" type="password" autocomplete="current-password" class="w-full" />
        </UFormField>
        <UFormField label="新密码" help="6~32 位，需同时包含字母和数字">
          <UInput v-model="newPassword" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
      </div>

      <div class="mt-5 flex items-center gap-3">
        <UButton color="neutral" variant="outline" icon="i-lucide-key" @click="onChangePassword"> 修改密码 </UButton>
        <span v-if="passwordMessage" class="text-sm text-slate-400">{{ passwordMessage }}</span>
      </div>
    </UCard>
  </div>
</template>
