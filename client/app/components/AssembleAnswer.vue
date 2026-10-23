<script setup lang="ts">
/**
 * 拼词作答（多邻国式）：把打乱的词块按顺序点成一句话。
 *
 * 词块由后端在抽题时下发（`/questions/next?mode=assemble` 的 `words`），
 * 前端拿不到 `sentenceEn`——否则拼词模式就等于抄答案。
 * 拼出来的字符串与输入模式走同一条提交链路，因此答案比对口径完全一致（仍是全等）。
 *
 * 词块**保留原标点**（`I'm`、`minutes?`），拼回去与原句逐字相同。
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
    <div
      class="flex min-h-13 flex-wrap content-start gap-1.5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-2.5 transition-colors dark:border-slate-600 dark:bg-slate-900/40"
      :class="{ 'border-sky-300 dark:border-sky-700': selected.length > 0 }"
      aria-label="已选词块"
    >
      <span v-if="selected.length === 0" class="self-center text-sm text-slate-400">
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
    </div>

    <!-- 词库：剩余词块 -->
    <div class="mt-3 flex flex-wrap gap-2" aria-label="可选词块">
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
      <p v-if="allUsed" class="self-center text-sm text-slate-400">词块已用完，点「确定」检查</p>
    </div>
  </div>
</template>
