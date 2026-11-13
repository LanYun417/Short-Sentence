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

const { data: team, refresh } = await useSsrApi<TeamView>('ss:team-my', '/client/team/my');
const busy = ref(false);
const error = ref('');
/** 正在编辑小队名（点小队名进入行内编辑）。 */
const renaming = ref(false);
const nameDraft = ref('');
/** 待确认的危险动作：leave 退出 / rematch 换一批队友。空串 = 无待确认。 */
const confirming = ref<'' | 'leave' | 'rematch'>('');
/** 空态下展开的面板：'' 无 / 'find' 找队友 / 'create' 创建小队。 */
const chooser = ref<'' | 'find' | 'create'>('');
const createName = ref('');
const joinCode = ref('');

/** 小队名归一（与服务端同口径，这里只用于即时反馈；服务端会再归一一次）。 */
function normalizeName(raw: string): string {
  return (
    (raw ?? '')
      // eslint-disable-next-line no-control-regex -- 故意匹配控制字符（换行/制表等）以便剥掉
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

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

/** 自建队伍：单人也可成队，之后拿组队码邀请别人。 */
async function createTeam(): Promise<void> {
  if (busy.value) return;
  const name = normalizeName(createName.value);
  if ([...name].length < 2) {
    error.value = '小队名至少 2 个字';
    return;
  }
  if ([...name].length > 20) {
    error.value = '小队名最多 20 个字';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    team.value = await apiFetch<TeamView>('/client/team/create', { method: 'POST', body: { name } });
    createName.value = '';
    chooser.value = '';
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败，请稍后重试';
  } finally {
    busy.value = false;
  }
}

/** 凭组队码加入。 */
async function joinByCode(): Promise<void> {
  if (busy.value) return;
  const code = joinCode.value.trim().toUpperCase();
  if (code.length < 4) {
    error.value = '请输入组队码';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    team.value = await apiFetch<TeamView>('/client/team/join', { method: 'POST', body: { code } });
    joinCode.value = '';
    chooser.value = '';
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加入失败，请检查组队码';
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

/** 进入行内改名。 */
function startRename(): void {
  if (busy.value) return;
  nameDraft.value = team.value?.name ?? '';
  renaming.value = true;
  error.value = '';
}

/** 保存小队名（PATCH 返回最新小队视图，直接采用，免一次刷新）。 */
async function saveRename(): Promise<void> {
  if (busy.value) return;
  const name = normalizeName(nameDraft.value);
  if ([...name].length < 2) {
    error.value = '小队名至少 2 个字';
    return;
  }
  if ([...name].length > 20) {
    error.value = '小队名最多 20 个字';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    team.value = await apiFetch<TeamView>('/client/team/name', { method: 'PATCH', body: { name } });
    renaming.value = false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '修改失败，请稍后重试';
  } finally {
    busy.value = false;
  }
}

/** 执行待确认的动作（确认框里点「确定」）。 */
async function runConfirmed(): Promise<void> {
  const action = confirming.value;
  confirming.value = '';
  if (action === 'leave') await run('leave');
  else if (action === 'rematch') await rematch();
}

/** 改名输入框：Enter 保存，Esc 取消。 */
function onNameKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    void saveRename();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    renaming.value = false;
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

    <!-- 未组队：找队友 / 创建小队 两个入口并排 -->
    <div v-if="!team" class="text-center">
      <p class="mb-1 text-sm text-slate-600 dark:text-slate-300">和节奏相近的人，一起把每天坚持下来</p>
      <p class="mb-3 text-xs leading-relaxed text-slate-400">
        最多 10 人：随机匹配、组队码加入或自建队伍，队伍内还能群聊。<br />
        全员完成，每人额外 +15 XP，小队连续天数一起涨。
      </p>
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:opacity-50"
          :disabled="busy"
          @click="chooser = chooser === 'find' ? '' : 'find'"
        >
          找队友
        </button>
        <button
          type="button"
          class="flex-1 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
          :disabled="busy"
          @click="chooser = chooser === 'create' ? '' : 'create'"
        >
          创建小队
        </button>
      </div>

      <!-- 找队友展开：随机匹配 / 组队码加入 -->
      <div v-if="chooser === 'find'" class="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-left dark:bg-slate-800/60">
        <UButton size="sm" class="w-full" :loading="busy" @click="run('match')">随机匹配（按近 7 天节奏）</UButton>
        <div class="flex gap-2">
          <input
            v-model="joinCode"
            type="text"
            maxlength="8"
            placeholder="6 位组队码"
            class="min-w-0 flex-1 rounded-lg bg-white px-2 py-1.5 font-mono text-xs uppercase tracking-widest ring-1 ring-slate-200 outline-none transition focus:ring-sky-400 dark:bg-slate-900 dark:ring-slate-700 dark:text-slate-100"
            @keyup.enter="joinByCode"
          />
          <UButton size="sm" :loading="busy" @click="joinByCode">加入</UButton>
        </div>
      </div>

      <!-- 创建小队展开：队名 + 创建（单人也可成队，之后拿组队码邀请别人） -->
      <div v-if="chooser === 'create'" class="mt-3 flex gap-2">
        <input
          v-model="createName"
          type="text"
          maxlength="20"
          placeholder="小队名 2~20 字"
          class="min-w-0 flex-1 rounded-lg bg-slate-50 px-2 py-1.5 text-sm ring-1 ring-slate-200 outline-none transition focus:ring-sky-400 dark:bg-slate-800 dark:ring-slate-700 dark:text-slate-100"
          @keyup.enter="createTeam"
        />
        <UButton size="sm" :loading="busy" @click="createTeam">创建</UButton>
      </div>
    </div>

    <!-- 已组队 -->
    <div v-else>
      <div class="mb-3 flex items-center justify-between gap-2">
        <!-- 小队名：点一下行内改名 -->
        <template v-if="!renaming">
          <button
            type="button"
            class="group flex min-w-0 items-center gap-1 text-sm font-semibold text-slate-800 transition hover:text-sky-600 disabled:opacity-50 dark:text-slate-100 dark:hover:text-sky-400"
            :disabled="busy"
            title="修改小队名"
            @click="startRename"
          >
            <span class="truncate">{{ team.name }}</span>
            <UIcon name="i-lucide-pencil" class="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-60" />
          </button>
        </template>
        <form v-else class="flex min-w-0 flex-1 items-center gap-1.5" @submit.prevent="saveRename">
          <input
            v-model="nameDraft"
            type="text"
            maxlength="20"
            autofocus
            placeholder="小队名 2~20 字"
            aria-label="小队名"
            class="min-w-0 flex-1 rounded-lg bg-slate-50 px-2 py-1 text-sm text-slate-800 outline-none ring-1 ring-slate-200 transition focus:ring-sky-400 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
            @keydown="onNameKeydown"
          />
          <button
            type="submit"
            class="shrink-0 rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-sky-700 disabled:opacity-50"
            :disabled="busy"
          >
            保存
          </button>
          <button
            type="button"
            class="shrink-0 rounded-lg px-1.5 py-1 text-[11px] text-slate-400 transition hover:text-slate-600 disabled:opacity-50 dark:hover:text-slate-300"
            :disabled="busy"
            @click="renaming = false"
          >
            取消
          </button>
        </form>
        <span
          class="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium tabular-nums text-amber-600 ring-1 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20"
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

      <div class="mt-3 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs tabular-nums text-slate-400">
            今日 {{ team.doneCount }} / {{ team.memberCount }} 人完成 · 满 {{ team.maxMembers }} 人
          </span>
          <!-- 换一批队友：会丢当前队伍与连续天数，必须二次确认 -->
          <button
            v-if="!confirming"
            type="button"
            class="text-xs text-slate-400 underline-offset-2 transition hover:text-sky-600 hover:underline disabled:opacity-50"
            :disabled="busy"
            @click="confirming = 'rematch'"
          >
            换一批队友
          </button>
        </div>

        <!-- 二级确认：退出 / 换队都是「丢掉当前小队」的不可逆动作 -->
        <div
          v-if="confirming"
          class="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/60"
        >
          <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 shrink-0 text-amber-500" />
          <p class="min-w-0 flex-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {{
              confirming === 'leave'
                ? '退出后当前小队与连续天数会清零，之后可以重新匹配。'
                : '会退出当前小队并按当前节奏重新匹配，连续天数清零。'
            }}
          </p>
          <button
            type="button"
            class="shrink-0 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
            :disabled="busy"
            @click="runConfirmed"
          >
            {{ busy ? '处理中…' : '确定' }}
          </button>
          <button
            type="button"
            class="shrink-0 rounded-lg px-1.5 py-1 text-[11px] text-slate-400 transition hover:text-slate-600 disabled:opacity-50 dark:hover:text-slate-300"
            :disabled="busy"
            @click="confirming = ''"
          >
            取消
          </button>
        </div>

        <!-- 退出小队：同样是危险动作，走同一套确认 -->
        <div v-else class="flex justify-end">
          <button
            type="button"
            class="text-xs text-slate-400 underline-offset-2 transition hover:text-rose-600 hover:underline disabled:opacity-50"
            :disabled="busy"
            @click="confirming = 'leave'"
          >
            退出小队
          </button>
        </div>
      </div>
    </div>

    <p v-if="error" class="mt-3 text-xs text-rose-500">{{ error }}</p>
  </div>
</template>
