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

/** 已选区横向滚动容器，新词追加到末尾后用于自动滚到最右 */
const selectedRef = ref<HTMLElement | null>(null);

/** 已选区横向滚动到末尾（新选词追加到末尾时调用，确保刚选的词可见） */
function scrollSelectedToEnd(): void {
  const el = selectedRef.value;
  if (!el) {
    return;
  }
  el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
}

/**
 * 词库（**全部**词块，固定原位，保持下发的乱序）。
 * 选中的词块不从词库里移除——只把对应槽位标灰、置为不可点，
 * 避免剩余词块自动重排「递进」（与 App 端一致）。
 */
const bank = ref<WordChip[]>([]);
/** 已选区（按用户排列的顺序） */
const selected = ref<WordChip[]>([]);

// 换题或切模式时 words 会整体换新，此时重置两侧
watch(
  () => props.words,
  (words) => {
    bank.value = (words ?? []).map((text, index) => ({ index, text }));
    selected.value = [];
    sync();
  },
  { immediate: true },
);

/** 把当前拼接结果同步给父组件（与输入框的 v-model 语义一致）。 */
function sync(): void {
  emit('update:answer', selected.value.map((chip) => chip.text).join(' '));
}

/**
 * 词库中「已被选走」的槽位下标。
 * 按「文本 → 已选次数」逐槽消耗：同一单词出现多次时依次标灰，不串位。
 */
const usedIndexes = computed(() => {
  const taken = new Map<string, number>();
  for (const chip of selected.value) {
    taken.set(chip.text, (taken.get(chip.text) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const used = new Set<number>();
  for (const chip of bank.value) {
    const order = (seen.get(chip.text) ?? 0) + 1;
    seen.set(chip.text, order);
    if ((taken.get(chip.text) ?? 0) >= order) {
      used.add(chip.index);
    }
  }
  return used;
});

/** 该词库槽位是否已被选走（标灰、不可点）。 */
function isUsed(chip: WordChip): boolean {
  return usedIndexes.value.has(chip.index);
}

/** 从词库选入（追加到末尾；已选走的槽位不可再点）。 */
function pick(chip: WordChip): void {
  if (props.disabled || isUsed(chip)) {
    return;
  }
  selected.value = [...selected.value, chip];
  sync();
  // 新词追加到末尾后，横向滚动容器自动滚到最右，确保用户看到刚选的词
  nextTick(scrollSelectedToEnd);
}

/** 从已选区移出（词库对应槽位自动恢复为可选）。 */
function unpick(chip: WordChip): void {
  if (props.disabled) {
    return;
  }
  selected.value = selected.value.filter((item) => item.index !== chip.index);
  sync();
}
</script>

<template>
  <div>
    <!-- 答题区：已选词块按顺序排列；空时给出引导文案 -->
    <TransitionGroup
      ref="selectedRef"
      name="chip"
      tag="div"
      class="no-scrollbar relative flex min-h-13 flex-nowrap items-center gap-1.5 overflow-x-auto rounded-2xl border border-dashed p-2.5 transition-colors"
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
        class="flex items-center justify-center rounded-lg bg-white px-2.5 py-1.5 text-[15px] font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:ring-rose-300 active:scale-95 disabled:opacity-60 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600"
        @click="unpick(chip)"
      >
        {{ chip.text }}
      </button>
    </TransitionGroup>

    <!-- 词库：**全部**词块固定原位；已选走的原地标灰、不可点（不消失、不重排） -->
    <!-- py-2 给 hover 上浮（-translate-y-0.5）留出空间：容器 overflow-x-auto 会顺带把 overflow-y 算成 auto，不加竖边距上浮会被裁 -->
    <div class="no-scrollbar mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto py-2" aria-label="可选词块">
      <button
        v-for="chip in bank"
        :key="chip.index"
        type="button"
        :disabled="disabled || isUsed(chip)"
        class="flex items-center justify-center rounded-lg px-2.5 py-1.5 text-[15px] font-medium ring-1 transition"
        :class="
          isUsed(chip)
            ? 'cursor-default bg-slate-100 text-slate-300 ring-slate-200 dark:bg-slate-800/50 dark:text-slate-600 dark:ring-slate-700'
            : 'bg-white text-slate-700 shadow-sm ring-slate-200 hover:-translate-y-0.5 hover:ring-sky-300 active:scale-95 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600'
        "
        @click="pick(chip)"
      >
        {{ chip.text }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 横向滑动容器隐藏滚动条（项目滚动条统一隐藏） */
.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}

/*
 * 词块「移入答题框」动效：
 * - 进场（词块被选入答题框）：从下方 10px、缩小到 0.88、透明，弹性落到位；
 * - 离场（从答题框移出）：淡出并轻微上浮缩小，绝对定位避免挤压兄弟元素；
 * - 移动（兄弟词块补位）：FLIP 位移，让其余词块平滑让位。
 * 注：词库侧不再移除词块（已选走只标灰原位保留），故 leave/move 只作用于答题框。
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
