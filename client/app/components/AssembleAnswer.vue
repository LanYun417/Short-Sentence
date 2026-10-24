<script setup lang="ts">
/**
 * 拼词作答（多邻国式）：把打乱的词块按顺序点成一句话。
 *
 * 词块由后端在抽题时下发（`/questions/next?mode=assemble` 的 `words`），
 * 前端拿不到 `sentenceEn`——否则拼词模式就等于抄答案。
 * 拼出来的字符串与输入模式走同一条提交链路，因此答案比对口径完全一致
 * （多答案只需命中主句，见 QuestionsService.answer）。
 *
 * 词块**保留原标点**（`I'm`、`minutes?`），拼回去与原句逐字相同。
 *
 * 动效：词块选中后从词库「移入」答题框（进场抬起 + 兄弟元素 FLIP 补位 + 词库侧淡出收起），
 * 全部走 CSS Transition，带 prefers-reduced-motion 降级。
 */

/** 词块：`index` 是它在原始乱序里的下标，用于移回词库时插回原位。 */
interface WordChip {
  index: number;
  text: string;
}

const props = defineProps<{
  /** 打乱后的词块（后端下发） */
  words: string[];
  /** 提交中：禁止继续点选 */
  disabled?: boolean;
}>();

const emit = defineEmits<{ (e: 'update:answer', value: string): void }>();

/** 词库（尚未选中的词块，保持下发的乱序） */
const pool = ref<WordChip[]>([]);
/** 已选区（按用户排列的顺序） */
const selected = ref<WordChip[]>([]);

// 换题或切模式时 words 会整体换新，此时重置两侧
watch(
  () => props.words,
  (words) => {
    pool.value = (words ?? []).map((text, index) => ({ index, text }));
    selected.value = [];
    sync();
  },
  { immediate: true },
);

/** 把当前拼接结果同步给父组件（与输入框的 v-model 语义一致）。 */
function sync(): void {
  emit('update:answer', selected.value.map((chip) => chip.text).join(' '));
}

/** 从词库选入（追加到末尾）。 */
function pick(chip: WordChip): void {
  if (props.disabled) {
    return;
  }
  pool.value = pool.value.filter((item) => item.index !== chip.index);
  selected.value = [...selected.value, chip];
  sync();
}

/** 从已选区移回词库（按原下标插回原位，避免词库顺序越点越乱）。 */
function unpick(chip: WordChip): void {
  if (props.disabled) {
    return;
  }
  selected.value = selected.value.filter((item) => item.index !== chip.index);
  const next = [...pool.value];
  const at = next.findIndex((item) => item.index > chip.index);
  next.splice(at < 0 ? next.length : at, 0, chip);
  pool.value = next;
  sync();
}

/** 是否已把所有词块用上（用完了提示可以提交）。 */
const allUsed = computed(() => pool.value.length === 0 && selected.value.length > 0);
</script>

<template>
  <div>
    <!-- 答题区：已选词块按顺序排列；空时给出引导文案 -->
    <TransitionGroup
      name="chip"
      tag="div"
      class="relative flex min-h-13 flex-wrap content-start gap-1.5 rounded-2xl border border-dashed p-2.5 transition-colors"
      :class="[
        selected.length > 0
          ? 'border-sky-300 bg-sky-50/40 dark:border-sky-700 dark:bg-sky-900/20'
          : 'border-slate-300 bg-slate-50/70 dark:border-slate-600 dark:bg-slate-900/40',
      ]"
      aria-label="已选词块"
    >
      <span v-if="selected.length === 0" key="placeholder" class="self-center text-sm text-slate-400">
        点下方词块，按顺序拼成英文句子
      </span>
      <button
        v-for="chip in selected"
        :key="chip.index"
        type="button"
        :disabled="disabled"
        class="rounded-lg bg-white px-2.5 py-1.5 text-[15px] font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:ring-rose-300 active:scale-95 disabled:opacity-60 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600"
        @click="unpick(chip)"
      >
        {{ chip.text }}
      </button>
    </TransitionGroup>

    <!-- 词库：剩余词块 -->
    <TransitionGroup name="chip" tag="div" class="mt-3 flex flex-wrap gap-2" aria-label="可选词块">
      <button
        v-for="chip in pool"
        :key="chip.index"
        type="button"
        :disabled="disabled"
        class="rounded-lg bg-white px-2.5 py-1.5 text-[15px] font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-sky-300 active:scale-95 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600"
        @click="pick(chip)"
      >
        {{ chip.text }}
      </button>
      <p v-if="allUsed" key="hint" class="self-center text-sm text-slate-400">词块已用完，点「确定」检查</p>
    </TransitionGroup>
  </div>
</template>

<style scoped>
/*
 * 词块「移入答题框」动效：
 * - 进场（词块被选入答题框）：从下方 10px、缩小到 0.88、透明，弹性落到位；
 * - 离场（词块离开词库 / 移出答题框）：淡出并轻微上浮缩小，绝对定位避免挤压兄弟元素；
 * - 移动（兄弟词块补位）：FLIP 位移，让其余词块平滑让位。
 */
.chip-enter-active {
  transition:
    opacity 0.22s cubic-bezier(0.34, 1.56, 0.64, 1),
    transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.chip-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.88);
}

.chip-leave-active {
  position: absolute;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.chip-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.9);
}

.chip-move {
  transition: transform 0.22s ease;
}

@media (prefers-reduced-motion: reduce) {
  .chip-enter-active,
  .chip-leave-active,
  .chip-move {
    transition: none;
  }
}
</style>
