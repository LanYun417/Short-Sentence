<script setup lang="ts">
/**
 * 分享卡片视觉（html2canvas 的截图目标）。
 *
 * 刻意**不跟随明暗主题**：分享出去的是一张图片，用固定的深色品牌底色 + 琥珀点缀，
 * 保证任何用户的系统主题下出图一致、且与「句签」的收藏卡质感统一。
 * 也不使用 backdrop-blur / 滤镜——html2canvas 对这些支持不佳，会画出偏差。
 *
 * 重要：本组件是 html2canvas 的截图目标，**禁止使用会被 Tailwind v4 编译成
 * `oklch()` 的颜色工具类**（如 text-white / bg-amber-400/20 / text-amber-300 等），
 * 也禁止用带透明度的工具类修饰符（会生成 color-mix / oklab）。
 * html2canvas 1.4.1 无法解析 oklch/oklab/color-mix，会抛
 * "Attempting to parse an unsupported color function" 导致导出失败。
 * 因此所有颜色一律用显式 hex（#rrggbb / #rrggbbaa）或内联 rgb/rgba。
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
  <div class="w-[340px] overflow-hidden" style="color: #fff; background-color: #0b1220">
    <!-- 配图 + 标题 -->
    <div class="relative aspect-video w-full overflow-hidden" style="background-color: #111c2e">
      <img v-if="card.imageUrl" :src="card.imageUrl" :alt="card.title" class="h-full w-full object-cover" />
      <!-- 底部渐隐：用内联 rgb，避免 Tailwind 透明修饰符生成的 color-mix/oklab -->
      <div
        class="absolute inset-0"
        style="background: linear-gradient(to top, #0b1220 0%, rgb(11 18 32 / 30%) 50%, rgb(11 18 32 / 0%) 100%)"
      />
      <div class="absolute inset-x-0 bottom-0 p-4">
        <span
          class="mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style="color: #fcd34d; background-color: rgb(251 191 36 / 20%)"
        >
          每日句签
        </span>
        <h3 class="text-lg leading-tight font-bold" style="color: #fff">{{ card.titleZh }}</h3>
        <p class="text-[11px]" style="color: rgb(255 255 255 / 60%)">{{ card.title }}</p>
      </div>
    </div>

    <!-- 文案 -->
    <div class="px-5 pt-4 pb-5">
      <p class="text-[17px] leading-snug font-semibold" style="color: #fff">{{ card.sentenceEn }}</p>
      <p class="mt-1.5 text-[13px] leading-relaxed" style="color: #cbd5e1">{{ card.translationZh }}</p>
      <p
        v-if="card.blessing"
        class="mt-3 rounded-xl px-3 py-2 text-center text-[12px]"
        style="color: #fde68a; background-color: rgb(255 255 255 / 5%)"
      >
        「{{ card.blessing }}」
      </p>
      <div class="mt-4 flex items-center justify-between border-t pt-3" style="border-color: rgb(255 255 255 / 10%)">
        <span class="text-[12px] font-semibold tracking-wide" style="color: #fcd34d">短句 · 每日一句</span>
        <span class="text-[11px]" style="color: rgb(255 255 255 / 50%)">{{ dateText }}</span>
      </div>
    </div>
  </div>
</template>
