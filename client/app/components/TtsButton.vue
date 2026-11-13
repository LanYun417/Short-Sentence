<script setup lang="ts">
/**
 * 朗读按钮：点击朗读传入文本，再次点击停止。
 * 基于 useTts（浏览器原生 speechSynthesis，零依赖零成本）。
 *
 * 降级策略：环境不支持 speechSynthesis，或仍处于 SSR/首帧（尚未挂载）时，
 * 整个按钮不渲染——避免水合不一致与「点了没反应」的空按钮。
 *
 * `compact`：紧凑模式，只留图标（xs 尺寸）。用于把发音按钮塞进小标签内的场景
 * （如音标卡的示例词、词组列表），默认模式（带「朗读」文字）用于卡片级按钮。
 */
import { onMounted, ref } from 'vue';

import { useTts } from '~/composables/useTts';

const props = withDefaults(
  defineProps<{
    /** 要朗读的文本 */
    text: string;
    /** 朗读语言（BPC 47，默认美式英语） */
    lang?: string;
    /** 语速，默认 1 */
    rate?: number;
    /** 紧凑模式：仅图标（xs），适合放进小标签 / 行内场景 */
    compact?: boolean;
  }>(),
  { lang: 'en-US', rate: 1, compact: false },
);

const { isSupported, isSpeaking, isFallback, speak, stop } = useTts();

/** 仅在客户端挂载后渲染：服务端渲染为 false，首帧（水合）也为 false，挂载后才判断。 */
const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

function toggle(): void {
  if (isSpeaking.value) {
    stop();
  } else {
    speak(props.text, { lang: props.lang, rate: props.rate });
  }
}
</script>

<template>
  <UButton
    v-if="mounted && isSupported"
    :icon="isSpeaking ? 'i-lucide-stop-circle' : 'i-lucide-volume-2'"
    :color="isSpeaking ? 'warning' : 'neutral'"
    :variant="isSpeaking ? 'solid' : 'soft'"
    :size="compact ? 'xs' : 'sm'"
    :square="compact"
    :aria-label="isSpeaking ? '停止朗读' : '朗读'"
    :title="isFallback ? '当前使用系统语音朗读（安装英文语音包效果更好）' : isSpeaking ? '停止朗读' : '朗读'"
    @click="toggle"
  >
    {{ compact ? '' : isSpeaking ? '停止' : '朗读' }}
  </UButton>
</template>
