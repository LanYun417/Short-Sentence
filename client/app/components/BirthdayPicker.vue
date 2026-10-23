<script setup lang="ts">
/**
 * 出生年月日选择器。
 * 为什么不用 <input type="date">：它渲染的是浏览器/系统原生日历弹层，
 * 各端样式差异大且与 Nuxt UI 设计语言完全不搭。这里用 Popover + 三个 Select 自绘，
 * 风格统一，也顺带解决「原生控件在高 DPI 下丑陋」的问题。
 */
const props = defineProps<{
  /** YYYY-MM-DD 或空串 */
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const open = ref(false);

const currentYear = new Date().getFullYear();
/** 可选年份：当前年往前 100 年（足够覆盖出生日期） */
const years = computed(() =>
  Array.from({ length: 100 }, (_, i) => ({ value: currentYear - i, label: `${currentYear - i} 年` })),
);
const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1} 月` }));

/** 拆解当前值。 */
const parts = computed(() => {
  if (!props.modelValue) {
    return {
      year: undefined as number | undefined,
      month: undefined as number | undefined,
      day: undefined as number | undefined,
    };
  }
  const [y, m, d] = props.modelValue.split('-').map(Number);
  return { year: y || undefined, month: m || undefined, day: d || undefined };
});

/** 所选年月的天数（自动处理闰年与大月小月）。 */
const days = computed(() => {
  const { year, month } = parts.value;
  const count = year && month ? new Date(year, month, 0).getDate() : 31;
  return Array.from({ length: count }, (_, i) => ({ value: i + 1, label: `${i + 1} 日` }));
});

/** 按钮展示文案（未选满时用占位符，避免出现 NaN）。 */
const displayText = computed(() => {
  const { year, month, day } = parts.value;
  if (!year) {
    return '请选择日期';
  }
  return `${year}-${month ? String(month).padStart(2, '0') : '--'}-${day ? String(day).padStart(2, '0') : '--'}`;
});

const yearModel = computed({
  get: () => parts.value.year,
  set: (v) => pick('year', v),
});
const monthModel = computed({
  get: () => parts.value.month,
  set: (v) => pick('month', v),
});
const dayModel = computed({
  get: () => parts.value.day,
  set: (v) => pick('day', v),
});

/** 选择某一部分：三者齐了才输出，并按当月实际天数钳制「日」。 */
function pick(part: 'year' | 'month' | 'day', value: number | undefined): void {
  const next = { ...parts.value, [part]: value };
  if (!next.year || !next.month || !next.day) {
    return;
  }
  const maxDay = new Date(next.year, next.month, 0).getDate();
  const day = Math.min(next.day, maxDay);
  emit('update:modelValue', `${next.year}-${String(next.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  open.value = false;
}

/** 清除。 */
function clear(): void {
  emit('update:modelValue', '');
  open.value = false;
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'start' }">
    <UButton color="neutral" variant="outline" class="w-full justify-between font-normal" icon="i-lucide-calendar">
      <span :class="!modelValue && 'text-slate-400'">{{ displayText }}</span>
    </UButton>

    <template #content>
      <div class="flex items-center gap-2 p-2">
        <USelect v-model="yearModel" :items="years" value-key="value" label-key="label" class="w-28" placeholder="年" />
        <USelect
          v-model="monthModel"
          :items="months"
          value-key="value"
          label-key="label"
          class="w-24"
          placeholder="月"
        />
        <USelect v-model="dayModel" :items="days" value-key="value" label-key="label" class="w-24" placeholder="日" />
        <UButton
          v-if="modelValue"
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-x"
          title="清除日期"
          aria-label="清除日期"
          @click="clear"
        />
      </div>
    </template>
  </UPopover>
</template>
