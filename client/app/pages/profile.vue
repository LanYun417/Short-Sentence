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
    <UCard :ui="{ body: 'p-6' }">
      <div class="mb-6 flex items-center gap-4">
        <UAvatar size="xl" color="primary" variant="soft" :text="(auth.user?.nickname ?? '?').slice(0, 1)" />
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

      <UFormField label="昵称">
        <UInput v-model="nickname" maxlength="50" class="w-full" />
      </UFormField>

      <UFormField label="出生年月日">
        <UInput v-model="birthday" type="date" class="w-full" />
      </UFormField>

      <UFormField label="性别">
        <USelect v-model="gender" :items="GENDERS" value-key="value" label-key="label" class="w-full" />
      </UFormField>

      <UFormField label="个性签名">
        <UTextarea v-model="signature" rows="3" maxlength="200" autoresize class="w-full" />
      </UFormField>

      <div class="mt-4 flex items-center gap-3">
        <UButton color="primary" :loading="saving" @click="onSave">保存资料</UButton>
        <span v-if="saveMessage" class="text-sm text-slate-400">{{ saveMessage }}</span>
      </div>
    </UCard>

    <UCard :ui="{ body: 'p-6' }" class="mt-6">
      <h2 class="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">修改密码</h2>
      <UFormField label="原密码">
        <UInput v-model="oldPassword" type="password" autocomplete="current-password" class="w-full" />
      </UFormField>
      <UFormField label="新密码" help="6~32 位，需同时包含字母和数字">
        <UInput v-model="newPassword" type="password" autocomplete="new-password" class="w-full" />
      </UFormField>
      <div class="mt-4 flex items-center gap-3">
        <UButton color="neutral" variant="solid" @click="onChangePassword">修改密码</UButton>
        <span v-if="passwordMessage" class="text-sm text-slate-400">{{ passwordMessage }}</span>
      </div>
    </UCard>
  </div>
</template>
