<script setup lang="ts">
/**
 * 学习小队（路由 /team）。
 *
 * 三种组队方式：随机匹配（按近 7 天节奏）、自建队伍（生成组队码）、凭组队码加入。
 * 队伍内群聊：游标分页、引用、本人 2 分钟内撤回；记录仅保留最近 30 天。
 * 私有页：不进 sitemap / 禁止抓取（nuxt.config.ts 的 robots/sitemap 已排除）。
 */
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { apiFetch } from '~/composables/useApi';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '学习小队',
  description: '随机匹配或凭组队码加入小队，和队友一起打卡、群聊。',
});

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
  code: string;
  source: string;
  isOwner: boolean;
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

interface TeamMessage {
  id: number;
  userId: number;
  nickname: string;
  avatarFileId: number;
  isMe: boolean;
  content: string;
  status: string;
  canRecall: boolean;
  quote: { id: number; nickname: string; content: string; status: string } | null;
  createdAt: string;
}

const { data: teamData } = await useSsrApi<TeamView | null>('ss:team', '/client/team/my');
const team = ref<TeamView | null>(teamData.value ?? null);

onMounted(async () => {
  if (teamData.value === null) {
    team.value = await apiFetch<TeamView | null>('/client/team/my').catch(() => null);
  }
});

const busy = ref(false);
const error = ref('');
const flash = ref('');

/** 未组队：自建 / 凭码加入 两个表单的草稿。 */
const createName = ref('');
const joinCode = ref('');

/** 小队名行内改名。 */
const renaming = ref(false);
const nameDraft = ref('');

/** 危险动作二次确认：leave 退出 / rematch 换一批。 */
const confirming = ref<'' | 'leave' | 'rematch'>('');

function setTeam(next: TeamView | null): void {
  team.value = next;
  teamData.value = next;
}

function normalizeName(raw: string): string {
  return (
    (raw ?? '')
      // eslint-disable-next-line no-control-regex -- 故意匹配控制字符以便剥掉
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/* ------------------------------ 组队 ------------------------------ */

async function runAction(action: 'match' | 'leave'): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  flash.value = '';
  try {
    const result = await apiFetch<TeamView | { left: boolean }>(`/client/team/${action}`, { method: 'POST' });
    setTeam(action === 'leave' ? null : (result as TeamView));
    if (action === 'leave') resetChat();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败，请稍后重试';
  } finally {
    busy.value = false;
  }
}

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
    const result = await apiFetch<TeamView>('/client/team/create', { method: 'POST', body: { name } });
    setTeam(result);
    createName.value = '';
    flash.value = '小队已创建，把组队码发给队友吧。';
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败，请稍后重试';
  } finally {
    busy.value = false;
  }
}

async function joinTeam(): Promise<void> {
  if (busy.value) return;
  const code = joinCode.value.trim().toUpperCase();
  if (code.length < 4) {
    error.value = '请输入组队码';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    const result = await apiFetch<TeamView>('/client/team/join', { method: 'POST', body: { code } });
    setTeam(result);
    joinCode.value = '';
    flash.value = '已加入小队。';
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加入失败，请检查组队码';
  } finally {
    busy.value = false;
  }
}

async function rematch(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await apiFetch('/client/team/leave', { method: 'POST' });
    const result = await apiFetch<TeamView>('/client/team/match', { method: 'POST' });
    setTeam(result);
    resetChat();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败，请稍后重试';
  } finally {
    busy.value = false;
  }
}

async function runConfirmed(): Promise<void> {
  const action = confirming.value;
  confirming.value = '';
  if (action === 'leave') await runAction('leave');
  else if (action === 'rematch') await rematch();
}

function startRename(): void {
  if (busy.value) return;
  nameDraft.value = team.value?.name ?? '';
  renaming.value = true;
  error.value = '';
}

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
    setTeam(await apiFetch<TeamView>('/client/team/name', { method: 'PATCH', body: { name } }));
    renaming.value = false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '修改失败，请稍后重试';
  } finally {
    busy.value = false;
  }
}

/** 复制组队码。 */
async function copyCode(): Promise<void> {
  const code = team.value?.code;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    flash.value = '组队码已复制';
  } catch {
    flash.value = `组队码：${code}`;
  }
}

/* ------------------------------ 群聊 ------------------------------ */

const messages = ref<TeamMessage[]>([]);
const hasMore = ref(false);
const loadingMessages = ref(false);
const sending = ref(false);
const draft = ref('');
const quoteTarget = ref<TeamMessage | null>(null);
const scroller = ref<HTMLElement | null>(null);

function resetChat(): void {
  messages.value = [];
  hasMore.value = false;
  quoteTarget.value = null;
  draft.value = '';
  stopPolling();
}

async function scrollToBottom(): Promise<void> {
  await nextTick();
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
}

/** 合并一批消息（同一 id 以服务端为准，新 id 追加）。 */
function mergeIncoming(incoming: TeamMessage[]): void {
  const map = new Map(messages.value.map((m) => [m.id, m]));
  let appended = false;
  for (const msg of incoming) {
    if (map.has(msg.id)) {
      map.set(msg.id, msg);
    } else {
      map.set(msg.id, msg);
      appended = true;
    }
  }
  messages.value = [...map.values()].sort((a, b) => a.id - b.id);
  if (appended) void scrollToBottom();
}

async function loadLatest(): Promise<void> {
  const page = await apiFetch<{ list: TeamMessage[]; hasMore: boolean }>('/client/team/messages?limit=30');
  mergeIncoming([...page.list].reverse());
  hasMore.value = page.hasMore;
}

/** 首次加载（升序展示）。 */
async function loadMessages(): Promise<void> {
  loadingMessages.value = true;
  try {
    const page = await apiFetch<{ list: TeamMessage[]; hasMore: boolean }>('/client/team/messages?limit=30');
    messages.value = [...page.list].reverse();
    hasMore.value = page.hasMore;
    await scrollToBottom();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '聊天加载失败';
  } finally {
    loadingMessages.value = false;
  }
}

/** 加载更早的消息（before = 当前最老 id）。 */
async function loadOlder(): Promise<void> {
  if (loadingMessages.value || messages.value.length === 0) return;
  loadingMessages.value = true;
  try {
    const before = messages.value[0]?.id;
    if (before === undefined) return;
    const page = await apiFetch<{ list: TeamMessage[]; hasMore: boolean }>(
      `/client/team/messages?limit=30&before=${before}`,
    );
    messages.value = [...[...page.list].reverse(), ...messages.value];
    hasMore.value = page.hasMore;
  } catch {
    // 加载更早失败不打断当前阅读
  } finally {
    loadingMessages.value = false;
  }
}

async function send(): Promise<void> {
  const content = draft.value.trim();
  if (!content || sending.value) return;
  sending.value = true;
  error.value = '';
  try {
    const created = await apiFetch<TeamMessage>('/client/team/messages', {
      method: 'POST',
      body: { content, quoteId: quoteTarget.value?.id },
    });
    // 本地补齐引用信息（服务端 sendMessage 不回传 quote）
    created.quote = quoteTarget.value
      ? {
          id: quoteTarget.value.id,
          nickname: quoteTarget.value.nickname,
          content: quoteTarget.value.content,
          status: quoteTarget.value.status,
        }
      : null;
    messages.value = [...messages.value, created];
    draft.value = '';
    quoteTarget.value = null;
    await scrollToBottom();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '发送失败，请稍后重试';
  } finally {
    sending.value = false;
  }
}

async function recall(msg: TeamMessage): Promise<void> {
  try {
    const updated = await apiFetch<TeamMessage>(`/client/team/messages/${msg.id}/recall`, { method: 'POST' });
    messages.value = messages.value.map((m) =>
      m.id === msg.id ? { ...m, status: updated.status, content: '', canRecall: false } : m,
    );
  } catch (e) {
    error.value = e instanceof Error ? e.message : '撤回失败';
  }
}

function quoteOf(msg: TeamMessage): void {
  quoteTarget.value = msg;
}

function timeOf(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** 轮询新消息（仅在有队伍时；页面卸载时清理）。 */
let pollTimer: ReturnType<typeof setInterval> | null = null;
function startPolling(): void {
  stopPolling();
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && team.value) void loadLatest().catch(() => {});
  }, 5000);
}
function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

onMounted(() => {
  if (team.value) {
    void loadMessages();
    startPolling();
  }
});

onUnmounted(stopPolling);

const toneClass: Record<TeamView['hintTone'], string> = {
  urge: 'bg-orange-50 text-orange-700 ring-orange-200/70 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20',
  success:
    'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-200/70 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20',
};
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 sm:py-8">
    <header class="mb-4 flex items-center gap-2">
      <UIcon name="i-lucide-users-round" class="h-5 w-5 text-sky-500" />
      <div>
        <h1 class="text-lg font-bold text-slate-800 dark:text-slate-100">学习小队</h1>
        <p class="text-xs text-slate-400">随机匹配或组队码加入，最多 10 人，一起打卡群聊</p>
      </div>
    </header>

    <p
      v-if="flash"
      class="mb-3 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
    >
      {{ flash }}
    </p>
    <p v-if="error" class="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40">
      {{ error }}
    </p>

    <!-- 未组队：三种组队方式 -->
    <template v-if="!team">
      <div class="space-y-3">
        <!-- 随机匹配 -->
        <section
          class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
        >
          <h2 class="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <UIcon name="i-lucide-shuffle" class="h-4 w-4 text-sky-500" />
            随机匹配
          </h2>
          <p class="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            按近 7 天练习节奏，匹配节奏相近的陌生人，一起把每天坚持下来。
          </p>
          <UButton class="mt-3" size="sm" :loading="busy" @click="runAction('match')">开始匹配</UButton>
        </section>

        <!-- 自建队伍 -->
        <section
          class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
        >
          <h2 class="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <UIcon name="i-lucide-flag" class="h-4 w-4 text-indigo-500" />
            自建队伍
          </h2>
          <p class="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            自己起个队名，建好后会生成组队码，发给朋友就能加入。
          </p>
          <div class="mt-3 flex gap-2">
            <input
              v-model="createName"
              type="text"
              maxlength="20"
              placeholder="小队名 2~20 字"
              class="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none ring-1 ring-slate-200 transition focus:ring-sky-400 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
              @keyup.enter="createTeam"
            />
            <UButton size="sm" :loading="busy" @click="createTeam">创建</UButton>
          </div>
        </section>

        <!-- 组队码加入 -->
        <section
          class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
        >
          <h2 class="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <UIcon name="i-lucide-key-round" class="h-4 w-4 text-emerald-500" />
            输入组队码加入
          </h2>
          <p class="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            朋友给了你组队码？输入即可加入对方的小队。
          </p>
          <div class="mt-3 flex gap-2">
            <input
              v-model="joinCode"
              type="text"
              maxlength="8"
              placeholder="6 位组队码"
              class="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2 font-mono text-sm tracking-widest text-slate-800 uppercase outline-none ring-1 ring-slate-200 transition focus:ring-sky-400 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
              @keyup.enter="joinTeam"
            />
            <UButton size="sm" :loading="busy" @click="joinTeam">加入</UButton>
          </div>
        </section>
      </div>
    </template>

    <!-- 已组队 -->
    <template v-else>
      <!-- 队伍信息 -->
      <section
        class="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
      >
        <div class="flex items-center justify-between gap-2">
          <template v-if="!renaming">
            <button
              type="button"
              class="group flex min-w-0 items-center gap-1 text-sm font-semibold text-slate-800 transition hover:text-sky-600 disabled:opacity-50 dark:text-slate-100"
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
              placeholder="小队名 2~20 字"
              class="min-w-0 flex-1 rounded-lg bg-slate-50 px-2 py-1 text-sm text-slate-800 outline-none ring-1 ring-slate-200 transition focus:ring-sky-400 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
            />
            <UButton size="xs" :loading="busy" @click="saveRename">保存</UButton>
            <button type="button" class="px-1 text-xs text-slate-400" @click="renaming = false">取消</button>
          </form>
          <span
            class="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium tabular-nums text-amber-600 ring-1 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300"
          >
            连续 {{ team.streak }} 天
          </span>
        </div>

        <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            {{ team.source === 'create' ? '自建队伍' : '随机匹配' }}
          </span>
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            {{ team.memberCount }} / {{ team.maxMembers }} 人
          </span>
          <button
            v-if="team.code"
            type="button"
            class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-mono tracking-widest text-emerald-700 ring-1 ring-emerald-200/70 transition hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300"
            @click="copyCode"
          >
            <UIcon name="i-lucide-key-round" class="h-3 w-3" />
            {{ team.code }}
            <UIcon name="i-lucide-copy" class="h-3 w-3 opacity-60" />
          </button>
        </div>

        <div class="mt-3 rounded-xl px-3 py-2.5 text-xs font-medium ring-1" :class="toneClass[team.hintTone]">
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

        <div class="mt-3 grid grid-cols-2 gap-2">
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
              <div
                class="text-[10px]"
                :class="m.checkedIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'"
              >
                {{ m.checkedIn ? '今日已打卡' : '待打卡' }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 群聊 -->
      <section
        class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/80"
      >
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <h2 class="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <UIcon name="i-lucide-messages-square" class="h-4 w-4 text-sky-500" />
            小队群聊
          </h2>
          <span class="text-[11px] text-slate-400">仅保留最近 30 天</span>
        </div>

        <!-- 消息区 -->
        <div ref="scroller" class="max-h-[420px] min-h-[180px] space-y-3 overflow-y-auto px-4 py-3">
          <div v-if="hasMore" class="text-center">
            <button
              type="button"
              class="text-[11px] text-slate-400 underline-offset-2 transition hover:text-sky-600 hover:underline disabled:opacity-50"
              :disabled="loadingMessages"
              @click="loadOlder"
            >
              {{ loadingMessages ? '加载中…' : '加载更早的消息' }}
            </button>
          </div>

          <p v-if="loadingMessages && messages.length === 0" class="py-8 text-center text-xs text-slate-400">
            正在加载聊天…
          </p>
          <p v-else-if="messages.length === 0" class="py-8 text-center text-xs text-slate-400">
            还没有消息，先跟队友打个招呼吧。
          </p>

          <div
            v-for="msg in messages"
            :key="msg.id"
            class="flex gap-2"
            :class="msg.isMe ? 'flex-row-reverse' : 'flex-row'"
          >
            <div
              class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
              :class="msg.isMe ? 'bg-sky-500' : 'bg-indigo-400'"
            >
              {{ msg.nickname.slice(0, 1) }}
            </div>
            <div class="min-w-0 max-w-[78%]" :class="msg.isMe ? 'items-end text-right' : ''">
              <div class="mb-0.5 flex items-center gap-1.5" :class="msg.isMe ? 'justify-end' : ''">
                <span class="text-[10px] text-slate-400">{{ msg.nickname }}</span>
                <span class="text-[10px] text-slate-300 dark:text-slate-600">{{ timeOf(msg.createdAt) }}</span>
              </div>

              <!-- 引用块 -->
              <div
                v-if="msg.quote"
                class="mb-1 rounded-lg border-l-2 border-slate-300 bg-slate-50 px-2 py-1 text-left text-[11px] text-slate-500 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-400"
              >
                <span class="font-medium">{{ msg.quote.nickname }}：</span>
                <span v-if="msg.quote.status === 'normal'">{{ msg.quote.content }}</span>
                <span v-else class="italic">原消息已撤回</span>
              </div>

              <!-- 气泡 -->
              <div
                v-if="msg.status === 'normal'"
                class="inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-left text-sm leading-relaxed"
                :class="
                  msg.isMe
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                "
              >
                {{ msg.content }}
              </div>
              <div
                v-else
                class="inline-block rounded-2xl bg-slate-100 px-3 py-1.5 text-left text-[11px] italic text-slate-400 dark:bg-slate-800"
              >
                {{ msg.status === 'recalled' ? '你撤回了一条消息' : '该消息已被隐藏' }}
              </div>

              <!-- 操作 -->
              <div class="mt-0.5 flex items-center gap-2" :class="msg.isMe ? 'justify-end' : ''">
                <button
                  v-if="msg.status === 'normal'"
                  type="button"
                  class="text-[10px] text-slate-300 transition hover:text-sky-500 dark:text-slate-600"
                  @click="quoteOf(msg)"
                >
                  引用
                </button>
                <button
                  v-if="msg.canRecall"
                  type="button"
                  class="text-[10px] text-slate-300 transition hover:text-rose-500 dark:text-slate-600"
                  @click="recall(msg)"
                >
                  撤回
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="border-t border-slate-100 px-3 py-2.5 dark:border-slate-800">
          <div
            v-if="quoteTarget"
            class="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500 dark:bg-slate-800/60"
          >
            <UIcon name="i-lucide-quote" class="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span class="min-w-0 flex-1 truncate">
              引用 {{ quoteTarget.nickname }}：{{ quoteTarget.content || '原消息已撤回' }}
            </span>
            <button type="button" class="shrink-0 text-slate-400 hover:text-rose-500" @click="quoteTarget = null">
              <UIcon name="i-lucide-x" class="h-3.5 w-3.5" />
            </button>
          </div>
          <div class="flex items-end gap-2">
            <textarea
              v-model="draft"
              rows="1"
              maxlength="500"
              placeholder="说点什么…（Ctrl/⌘ + Enter 发送）"
              class="max-h-24 min-h-9 flex-1 resize-none rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none ring-1 ring-transparent transition focus:ring-sky-300 dark:bg-slate-800 dark:text-slate-100"
              @keydown.ctrl.enter.prevent="send"
              @keydown.meta.enter.prevent="send"
            />
            <UButton size="sm" :loading="sending" :disabled="!draft.trim()" @click="send">发送</UButton>
          </div>
        </div>
      </section>

      <!-- 危险动作 -->
      <div class="mt-3 flex items-center justify-end gap-3">
        <button
          v-if="!confirming"
          type="button"
          class="text-xs text-slate-400 underline-offset-2 transition hover:text-sky-600 hover:underline disabled:opacity-50"
          :disabled="busy"
          @click="confirming = 'rematch'"
        >
          换一批队友
        </button>
        <button
          v-if="!confirming"
          type="button"
          class="text-xs text-slate-400 underline-offset-2 transition hover:text-rose-600 hover:underline disabled:opacity-50"
          :disabled="busy"
          @click="confirming = 'leave'"
        >
          退出小队
        </button>
      </div>

      <div
        v-if="confirming"
        class="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/60"
      >
        <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 shrink-0 text-amber-500" />
        <p class="min-w-0 flex-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {{
            confirming === 'leave'
              ? '退出后当前小队与聊天记录会看不到了，之后可以重新组队。'
              : '会退出当前小队并重新随机匹配，连续天数清零。'
          }}
        </p>
        <UButton size="xs" color="error" :loading="busy" @click="runConfirmed">确定</UButton>
        <button type="button" class="shrink-0 px-1 text-[11px] text-slate-400" @click="confirming = ''">取消</button>
      </div>
    </template>
  </div>
</template>
