<script setup lang="ts">
/**
 * 场景长对话页（路由 /stages/:id）。
 *
 * 用户扮演场景里的自己，和 1~3 个 AI 角色围绕目标对话。
 * 会话由后端持久化：刷新页面续聊，聊够轮数且目标达成才通关，结束时给中文复盘。
 *
 * 为什么不用 SSE 流式：模型输出是结构化 JSON（多角色台词 + 目标判定），
 * 必须整段解析完才能落库与展示，逐字流反而会把 JSON 拆碎。
 */
import { computed, nextTick, onMounted, ref } from 'vue';
import { apiFetch } from '~/composables/useApi';
import AppScrollbar from '~/components/AppScrollbar.vue';
import type { StageDialogue, StageDialogueMessage, StageFeedback, StageRole, StageTurnResult } from '~/types';

definePageMeta({ middleware: ['auth'] });

usePageSeo({
  title: '场景对话',
  description: '进入一个真实场景，和里面的人用英语把一件事聊成。',
});

const route = useRoute();
const stageId = computed(() => Number(route.params.id));

const dialogue = ref<StageDialogue | null>(null);
const messages = ref<StageDialogueMessage[]>([]);
const feedback = ref<StageFeedback | null>(null);
const summary = ref<string | null>(null);
const ended = ref(false);
const cleared = ref(false);
const turnCount = ref(0);
const goalReached = ref(false);
const loading = ref(true);
const sending = ref(false);
const draft = ref('');
const error = ref('');
const scroller = ref<InstanceType<typeof AppScrollbar> | null>(null);

/** 卡壳时可直接套用的英文短句（点一下填入输入框，可再改）。 */
const QUICK_PHRASES = [
  "I'm not sure. Could you help me?",
  'Could you say that again, please?',
  "I'd like a coffee, please.",
  'What do you recommend?',
];

function usePhrase(text: string): void {
  if (ended.value || sending.value) return;
  draft.value = text;
  error.value = '';
}

/** 角色英文名 → 展示信息（模型偶尔写错 speaker 时回落到第一位角色）。 */
function roleOf(speaker: string | null): StageRole {
  const list = dialogue.value?.roles ?? [];
  return list.find((role) => role.nameEn === speaker) ?? list[0] ?? { nameEn: 'NPC', name: '对方', emoji: '💬' };
}

async function scrollToBottom(): Promise<void> {
  await nextTick();
  scroller.value?.scrollToEnd();
}

/** 应用一份会话数据到页面状态。 */
function apply(view: StageDialogue): void {
  dialogue.value = view;
  messages.value = view.messages;
  turnCount.value = view.turnCount;
  goalReached.value = view.goalReached;
  cleared.value = view.cleared;
  summary.value = view.summary;
  feedback.value = view.feedback;
  ended.value = view.status !== 'active';
  void scrollToBottom();
}

/** 进入 / 续聊 / 重开一局。 */
async function start(restart = false): Promise<void> {
  loading.value = true;
  error.value = '';
  ended.value = false;
  feedback.value = null;
  summary.value = null;
  draft.value = '';
  try {
    const view = await apiFetch<StageDialogue>(`/client/stages/${stageId.value}/dialogue`, {
      method: 'POST',
      body: { restart },
    });
    apply(view);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '进入场景失败';
  } finally {
    loading.value = false;
  }
}

/** 发一句：成功后一次性追加「我 + 1~3 位角色」的消息。 */
async function send(): Promise<void> {
  const content = draft.value.trim();
  if (!content || sending.value || ended.value || loading.value) return;
  sending.value = true;
  error.value = '';
  try {
    const result = await apiFetch<StageTurnResult>(`/client/stages/${stageId.value}/dialogue/messages`, {
      method: 'POST',
      body: { content },
    });
    const now = new Date().toISOString();
    const base = messages.value.length + 1;
    messages.value.push({
      id: base,
      role: 'user',
      speaker: null,
      contentEn: content,
      contentZh: null,
      createdAt: now,
    });
    result.replies.forEach((reply, index) => {
      messages.value.push({
        id: base + index + 1,
        role: 'npc',
        speaker: reply.speaker,
        contentEn: reply.contentEn,
        contentZh: reply.contentZh || null,
        createdAt: now,
      });
    });
    draft.value = '';
    turnCount.value = result.turnCount;
    goalReached.value = result.goalReached;
    if (result.ended) {
      ended.value = true;
      cleared.value = result.cleared;
      summary.value = result.summary;
      feedback.value = result.feedback;
    }
    void scrollToBottom();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '发送失败，请重试';
  } finally {
    sending.value = false;
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    void send();
  }
}

/** 主动结束（没聊满也能结束，但不一定通关）。 */
async function finish(): Promise<void> {
  if (sending.value || ended.value) return;
  sending.value = true;
  error.value = '';
  try {
    const view = await apiFetch<StageDialogue>(`/client/stages/${stageId.value}/dialogue/end`, { method: 'POST' });
    apply(view);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '结束失败，请重试';
  } finally {
    sending.value = false;
  }
}

/** 回到关卡地图。 */
function back(): void {
  void navigateTo('/stages');
}

onMounted(async () => {
  await start();
});
</script>

<template>
  <div class="mx-auto flex h-[calc(100dvh-8.5rem)] max-w-2xl flex-col px-4 pt-4 pb-2 md:h-[calc(100dvh-4rem)]">
    <!-- 场景信息 -->
    <header class="mb-3 shrink-0">
      <div class="flex items-center gap-2">
        <NuxtLink
          to="/stages"
          class="inline-flex items-center gap-0.5 text-xs font-medium text-slate-500 hover:text-sky-600 dark:text-slate-400"
        >
          <UIcon name="i-lucide-chevron-left" class="h-3.5 w-3.5" />
          关卡地图
        </NuxtLink>
        <span class="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
          第 {{ turnCount }} 轮 · 至少 {{ dialogue?.minTurns ?? 0 }} 轮
        </span>
      </div>
      <h1 v-if="dialogue" class="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">
        {{ dialogue.title }}
      </h1>
      <p v-if="dialogue" class="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        <span class="font-semibold text-sky-600 dark:text-sky-400">目标：</span>{{ dialogue.goal }}
      </p>
      <div v-if="dialogue" class="mt-2 flex flex-wrap gap-1.5">
        <span
          v-for="role in dialogue.roles"
          :key="role.nameEn"
          class="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200/70 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800"
        >
          <span aria-hidden="true">{{ role.emoji }}</span
          >{{ role.name }}
        </span>
        <span
          v-if="goalReached"
          class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
        >
          <UIcon name="i-lucide-check" class="h-3 w-3" />目标已达成
        </span>
      </div>
    </header>

    <!-- 消息区：用统一的悬浮滚动条，与主内容区一致 -->
    <AppScrollbar
      ref="scroller"
      class="min-h-0 flex-1 rounded-2xl bg-slate-50/70 ring-1 ring-slate-200/60 dark:bg-slate-950/40 dark:ring-slate-800/60"
      viewport-class="space-y-3 p-3"
    >
      <p v-if="loading" class="py-12 text-center text-sm text-slate-400">正在进入场景…</p>
      <p v-else-if="error && !messages.length" class="py-12 text-center text-sm text-rose-500">{{ error }}</p>

      <template v-for="item in messages" :key="item.id">
        <!-- 用户 -->
        <div v-if="item.role === 'user'" class="flex justify-end">
          <div
            class="max-w-[85%] rounded-2xl rounded-br-md bg-sky-600 px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm"
          >
            {{ item.contentEn }}
          </div>
        </div>
        <!-- NPC（多人场景按角色区分头像） -->
        <div v-else class="flex items-start gap-2">
          <span
            class="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-base shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800"
            aria-hidden="true"
          >
            {{ roleOf(item.speaker).emoji }}
          </span>
          <div class="max-w-[85%]">
            <p class="mb-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {{ roleOf(item.speaker).name }}
            </p>
            <div
              class="rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800"
            >
              <p>{{ item.contentEn }}</p>
              <p v-if="item.contentZh" class="mt-1 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                {{ item.contentZh }}
              </p>
            </div>
          </div>
        </div>
      </template>

      <div v-if="sending && !ended" class="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
        <UIcon name="i-lucide-loader-circle" class="h-3.5 w-3.5 animate-spin" />
        对方正在回应…
      </div>

      <!-- 结束复盘 -->
      <div
        v-if="ended"
        class="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div class="mb-2 flex items-center gap-2">
          <UIcon
            :name="cleared ? 'i-lucide-party-popper' : 'i-lucide-message-square'"
            class="h-4 w-4"
            :class="cleared ? 'text-emerald-500' : 'text-sky-500'"
          />
          <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100">
            {{ cleared ? '这一关，通关了' : '这段对话先到这里' }}
          </h2>
        </div>
        <p class="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {{ summary || (cleared ? '目标达成，故事往前走了一段。' : '换个说法，再来一次试试。') }}
        </p>
        <div v-if="feedback" class="mt-3 grid gap-2 sm:grid-cols-2">
          <div class="rounded-xl bg-emerald-50/70 p-2.5 dark:bg-emerald-950/30">
            <p class="mb-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">做得好</p>
            <p
              v-for="(line, i) in feedback.highlights"
              :key="`h${i}`"
              class="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300"
            >
              · {{ line }}
            </p>
          </div>
          <div class="rounded-xl bg-amber-50/70 p-2.5 dark:bg-amber-950/30">
            <p class="mb-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">可以更好</p>
            <p
              v-for="(line, i) in feedback.improvements"
              :key="`i${i}`"
              class="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300"
            >
              · {{ line }}
            </p>
          </div>
        </div>
        <div class="mt-3 flex gap-2">
          <UButton size="xs" @click="start(true)">再聊一次</UButton>
          <UButton size="xs" color="neutral" variant="soft" @click="back">返回地图</UButton>
        </div>
      </div>
    </AppScrollbar>

    <!-- 输入区 -->
    <div class="mt-3 shrink-0">
      <p v-if="error && messages.length" class="mb-1.5 text-xs text-rose-500">{{ error }}</p>
      <!-- 卡壳时的英文台阶：避免用户不知道说什么就退回中文 -->
      <div v-if="!ended" class="mb-2 flex flex-wrap gap-1.5">
        <button
          v-for="phrase in QUICK_PHRASES"
          :key="phrase"
          type="button"
          :disabled="loading || sending"
          class="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200 transition hover:text-sky-600 hover:ring-sky-300 disabled:opacity-50 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800"
          @click="usePhrase(phrase)"
        >
          {{ phrase }}
        </button>
      </div>
      <div v-if="!ended" class="flex items-end gap-2">
        <textarea
          v-model="draft"
          rows="2"
          maxlength="300"
          :disabled="loading || sending"
          placeholder="用英语说一句…（Enter 发送，Shift+Enter 换行）"
          class="max-h-28 min-h-11 flex-1 resize-none rounded-2xl bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 outline-none ring-1 ring-slate-200 transition focus:ring-sky-400 disabled:opacity-60 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800"
          @keydown="onKeydown"
        />
        <UButton :loading="sending" :disabled="!draft.trim() || loading" @click="send">发送</UButton>
        <UButton color="neutral" variant="ghost" size="sm" :disabled="sending" @click="finish">结束</UButton>
      </div>
      <p class="mt-1.5 text-center text-[10px] text-slate-400 dark:text-slate-500">
        这一关请用英语对话；卡住了可以点上面的短句 · 聊够轮数并达成目标即可通关
      </p>
    </div>
  </div>
</template>
