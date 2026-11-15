<script setup lang="ts">
/**
 * 周报分享海报弹窗：把周报画成一张可直接发出去的图。
 *
 * 手绘 Canvas（见 useWeeklyPoster），零依赖；支持下载 PNG 与复制到剪贴板
 * （后者在 Safari/部分浏览器不可用，降级提示改用下载）。
 */
import type { WeeklyPosterReport } from '~/composables/useWeeklyPoster';

const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{ report: WeeklyPosterReport }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const copied = ref(false);
const copyFailed = ref(false);

const model = computed(() => buildPosterModel(props.report));

async function render(): Promise<void> {
  await nextTick();
  const el = canvas.value;
  const ctx = el?.getContext('2d');
  if (!el || !ctx) {
    return;
  }
  el.width = POSTER_WIDTH;
  el.height = posterHeight(model.value);
  drawWeeklyPoster(ctx, model.value);
}

watch(open, (value) => {
  if (value) {
    void render();
  }
});

function toBlob(): Promise<Blob | null> {
  return new Promise((resolve) => {
    const el = canvas.value;
    if (!el) {
      resolve(null);
      return;
    }
    el.toBlob((blob) => resolve(blob), 'image/png');
  });
}

async function download(): Promise<void> {
  const blob = await toBlob();
  if (!blob) {
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `short-sentence-weekly-${new Date().toISOString().slice(0, 10)}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

async function copyImage(): Promise<void> {
  try {
    const blob = await toBlob();
    if (!blob || !navigator.clipboard?.write) {
      throw new Error('clipboard unavailable');
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1800);
  } catch {
    // 多数是浏览器不支持图片剪贴板：明确引导用下载，不静默失败
    copyFailed.value = true;
    setTimeout(() => (copyFailed.value = false), 2600);
  }
}
</script>

<template>
  <UModal v-model:open="open" title="本周学习报告" description="长按图片保存，或直接下载 / 复制">
    <template #body>
      <div class="flex justify-center">
        <canvas ref="canvas" class="h-auto w-full max-w-sm rounded-2xl ring-1 ring-black/5" />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <p class="text-xs text-slate-400">
          {{ copyFailed ? '当前浏览器不支持复制图片，请用下载' : '海报不含任何个人信息' }}
        </p>
        <div class="flex gap-2">
          <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-copy" @click="copyImage">
            {{ copied ? '已复制' : '复制图片' }}
          </UButton>
          <UButton size="sm" icon="i-lucide-download" @click="download">下载</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
