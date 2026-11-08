<script setup lang="ts">
/**
 * 弱连接学习小队卡片：不做好友、不做聊天，只把「节奏相近的陌生人」凑成小队，
 * 用彼此的打卡状态形成轻量社会承诺。提醒走应用内醒目条（hint），
 * 配合已有每日邮件提醒开关闭环，不引入浏览器/系统推送依赖。
 */
import { computed, ref } from 'vue';
import { apiFetch } from '~/composables/useApi';

interface TeamMemberView {
  userId: number;
  nickname: string;
  avatarFileId: number;
  xp: number;
  checkedIn: boolean;
  isMe: boolean;
}
interface TeamView {
  id: number;
  name: string;
  streak: number;
  memberCount: number;
  maxMembers: number;
  doneCount: number;
  todayFull: boolean;
  myCheckedIn: boolean;
  hint: string;
  hintTone: 'info' | 'urge' | 'success';
  members: TeamMemberView[];
}

const { data: team, refresh } = await useFetch<TeamView | null>('/api/client/team/my', {
  default: () => null,
});
const busy = ref(false);
const error = ref('');

async function run(action: 'match' | 'leave'): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await apiFetch(`/client/team/${action}`, { method: 'POST' });
    await refresh();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败，请稍后重试';
  } finally {
    busy.value = false;
  }
}

/** 换队友 = 退出后立刻按当前节奏重新匹配，一步到位。 */
async function rematch(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await apiFetch('/client/team/leave', { method: 'POST' });
    await apiFetch('/client/team/match', { method: 'POST' });
    await refresh();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败，请稍后重试';
  } finally {
    busy.value = false;
  }
}

const toneClass = computed(() => {
  switch (team.value?.hintTone) {
    case 'urge':
      return 'bg-orange-50 text-orange-700 ring-orange-200/70 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20';
    case 'success':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20';
    default:
      return 'bg-sky-50 text-sky-700 ring-sky-200/70 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20';
  }
});
</script>

<template>
  <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <UIcon name="i-lucide-users-round" class="h-4 w-4 text-sky-500" />
        学习小队
      </h3>
      <span class="text-xs text-slate-400">节奏相近的伙伴</span>
    </div>

    <!-- 未组队：一句话讲清「弱连接」是什么 -->
    <div v-if="!team" class="text-center">
      <p class="mb-1 text-sm text-slate-600 dark:text-slate-300">和节奏相近的人，一起把每天坚持下来</p>
      <p class="mb-4 text-xs leading-relaxed text-slate-400">
        系统按近 7 天练习量自动匹配 2~4 人小队；不互加好友、不聊天，只看今日打卡状态。<br />
        全员完成，每人额外 +15 XP，小队连续天数一起涨。
      </p>
      <button
        type="button"
        class="rounded-xl bg-sky-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:opacity-50"
        :disabled="busy"
        @click="run('match')"
      >
        {{ busy ? '匹配中…' : '找队友' }}
      </button>
    </div>

    <!-- 已组队 -->
    <div v-else>
      <div class="mb-3 flex items-center justify-between">
        <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ team.name }}</span>
        <span
          class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium tabular-nums text-amber-600 ring-1 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20"
        >
          连续 {{ team.streak }} 天
        </span>
      </div>

      <!-- 应用内提醒条：urge 是留存关键（队友已就位、就差我） -->
      <div class="mb-4 rounded-xl px-3 py-2.5 text-xs font-medium ring-1" :class="toneClass">
        <div class="flex items-center gap-2">
          <UIcon
            :name="
              team.hintTone === 'success'
                ? 'i-lucide-circle-check-big'
                : team.hintTone === 'urge'
                  ? 'i-lucide-bell-ring'
                  : 'i-lucide-info'
            "
            class="h-4 w-4 shrink-0"
          />
          <span>{{ team.hint }}</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div
          v-for="m in team.members"
          :key="m.userId"
          class="flex items-center gap-2 rounded-xl border p-2.5"
          :class="
            m.checkedIn
              ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5'
              : 'border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/40'
          "
        >
          <div
            class="grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
            :class="m.isMe ? 'bg-sky-500' : 'bg-indigo-400'"
          >
            {{ m.nickname.slice(0, 1) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
              {{ m.nickname }}<span v-if="m.isMe" class="text-slate-400">（我）</span>
            </div>
            <div class="text-[10px]" :class="m.checkedIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'">
              {{ m.checkedIn ? '今日已打卡' : '待打卡' }}
            </div>
          </div>
        </div>
      </div>

      <div class="mt-3 flex items-center justify-between">
        <span class="text-xs tabular-nums text-slate-400">
          今日 {{ team.doneCount }} / {{ team.memberCount }} 人完成 · 满 {{ team.maxMembers }} 人
        </span>
        <button
          type="button"
          class="text-xs text-slate-400 underline-offset-2 transition hover:text-sky-600 hover:underline disabled:opacity-50"
          :disabled="busy"
          @click="rematch"
        >
          {{ busy ? '处理中…' : '换一批队友' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="mt-3 text-xs text-rose-500">{{ error }}</p>
  </div>
</template>
