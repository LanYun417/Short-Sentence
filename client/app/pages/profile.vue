<script setup lang="ts">
/**
 * 个人中心：资料编辑 + 修改密码 + 今日数据。
 * 头像上传暂未开放（缺少客户端上传接口，见 docs/client-nuxt-规范 的后续项）。
 */
import { useAuthStore } from '~/stores/auth';
import { apiFetch } from '~/composables/useApi';
import type { TodayCheckin } from '~/types';

definePageMeta({ middleware: ['auth'] });

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

const GENDERS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'secret', label: '保密' },
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

onMounted(async () => {
  await auth.fetchMe();
  fillForm();
  today.value = await apiFetch<TodayCheckin>('/client/checkin/today');
});

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
  <div class="mx-auto max-w-xl px-4 py-8">
    <div class="rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-800">
      <div class="mb-6 flex items-center gap-4">
        <div
          class="flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-xl font-bold text-sky-600 dark:bg-sky-900/40"
        >
          {{ (auth.user?.nickname ?? '?').slice(0, 1) }}
        </div>
        <div>
          <p class="text-lg font-semibold text-slate-800 dark:text-slate-100">{{ auth.user?.nickname }}</p>
          <p class="text-sm text-slate-400">{{ auth.user?.email }}</p>
        </div>
      </div>

      <div v-if="today" class="mb-6 grid grid-cols-3 gap-3 text-center">
        <div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-700/50">
          <p class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ today.doneCount }}</p>
          <p class="text-xs text-slate-400">今日完成</p>
        </div>
        <div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-700/50">
          <p class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ today.streak }}</p>
          <p class="text-xs text-slate-400">连续打卡</p>
        </div>
        <div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-700/50">
          <p class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ today.goalCount }}</p>
          <p class="text-xs text-slate-400">每日目标</p>
        </div>
      </div>

      <label class="mb-1 block text-sm text-slate-500 dark:text-slate-400">昵称</label>
      <input
        v-model="nickname"
        maxlength="50"
        class="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-900"
      />

      <label class="mb-1 block text-sm text-slate-500 dark:text-slate-400">出生年月日</label>
      <input
        v-model="birthday"
        type="date"
        class="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-900"
      />

      <label class="mb-1 block text-sm text-slate-500 dark:text-slate-400">性别</label>
      <select
        v-model="gender"
        class="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-900"
      >
        <option v-for="item in GENDERS" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>

      <label class="mb-1 block text-sm text-slate-500 dark:text-slate-400">个性签名</label>
      <textarea
        v-model="signature"
        rows="3"
        maxlength="200"
        class="mb-4 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-900"
      />

      <div class="flex items-center gap-3">
        <button
          class="rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
          :disabled="saving"
          @click="onSave"
        >
          {{ saving ? '保存中…' : '保存资料' }}
        </button>
        <span v-if="saveMessage" class="text-sm text-slate-400">{{ saveMessage }}</span>
      </div>
    </div>

    <div class="mt-6 rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-800">
      <h2 class="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">修改密码</h2>
      <input
        v-model="oldPassword"
        type="password"
        placeholder="原密码"
        autocomplete="current-password"
        class="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-900"
      />
      <input
        v-model="newPassword"
        type="password"
        placeholder="新密码（6~32 位，字母+数字）"
        autocomplete="new-password"
        class="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-900"
      />
      <div class="flex items-center gap-3">
        <button
          class="rounded-xl bg-slate-700 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-slate-600"
          @click="onChangePassword"
        >
          修改密码
        </button>
        <span v-if="passwordMessage" class="text-sm text-slate-400">{{ passwordMessage }}</span>
      </div>
    </div>
  </div>
</template>
