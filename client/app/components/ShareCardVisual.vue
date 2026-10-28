<script setup lang="ts">
/**
 * 分享卡片视觉（html2canvas 的截图目标）。
 *
 * 刻意**不跟随明暗主题**：分享出去的是一张图片，用固定的深色品牌底色 + 琥珀点缀，
 * 保证任何用户的系统主题下出图一致、且与「句签」的收藏卡质感统一。
 * 也不使用 backdrop-blur / 滤镜——html2canvas 对这些支持不佳，会画出偏差。
 */
import type { SentenceCard } from '~/types';

const props = defineProps<{
  /** 要分享的句签 */
  card: SentenceCard;
}>();

/** YYYY-MM-DD → 「2026年10月28日」。 */
const dateText = computed(() => {
  const [year, month, day] = props.card.bizDate.split('-');
  return year && month && day ? `${year}年${Number(month)}月${Number(day)}日` : props.card.bizDate;
});
</script>

<template>
  <div class="w-[340px] overflow-hidden bg-[#0b1220] text-white">
    <!-- 配图 + 标题 -->
    <div class="relative aspect-video w-full overflow-hidden bg-[#111c2e]">
      <img v-if="card.imageUrl" :src="card.imageUrl" :alt="card.title" class="h-full w-full object-cover" />
      <div class="absolute inset-0 bg-linear-to-t from-[#0b1220] via-[#0b1220]/30 to-transparent" />
      <div class="absolute inset-x-0 bottom-0 p-4">
        <span
          class="mb-1 inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300"
        >
          每日句签
        </span>
        <h3 class="text-lg leading-tight font-bold">{{ card.titleZh }}</h3>
        <p class="text-[11px] text-white/60">{{ card.title }}</p>
      </div>
    </div>

    <!-- 文案 -->
    <div class="px-5 pt-4 pb-5">
      <p class="text-[17px] leading-snug font-semibold">{{ card.sentenceEn }}</p>
      <p class="mt-1.5 text-[13px] leading-relaxed text-slate-300">{{ card.translationZh }}</p>
      <p v-if="card.blessing" class="mt-3 rounded-xl bg-white/5 px-3 py-2 text-center text-[12px] text-amber-200">
        「{{ card.blessing }}」
      </p>
      <div class="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
        <span class="text-[12px] font-semibold tracking-wide text-amber-300">短句 · 每日一句</span>
        <span class="text-[11px] text-white/50">{{ dateText }}</span>
      </div>
    </div>
  </div>
</template>
