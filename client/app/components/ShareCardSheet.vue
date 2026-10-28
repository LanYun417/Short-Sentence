<script setup lang="ts">
/**
 * 分享卡片弹层：把「句签」渲染成一张图片，支持「保存」与「分享」。
 *
 * 出图走 html2canvas（已在依赖里；题目配图是 `/static` 同源资源，不会因跨域被污染）。
 * 分享优先用 Web Share API（移动端可直接进系统分享面板）；不支持文件分享的浏览器
 * 退化为下载图片。用户取消分享（AbortError）不算失败、不提示错误。
 */
import html2canvas from 'html2canvas';
import type { SentenceCard } from '~/types';

const props = defineProps<{
  /** 要分享的句签（null = 不显示） */
  card: SentenceCard | null;
}>();

const emit = defineEmits<{ (e: 'close'): void }>();

const visualRef = useTemplateRef<HTMLElement>('visual');
/** 出图 / 分享进行中 */
const busy = ref(false);
/** 结果提示 */
const message = ref('');
/** 当前浏览器是否支持「分享文件」（决定是否显示「分享」按钮） */
const canShareFiles = ref(false);

onMounted(() => {
  try {
    const probe = new File([new Blob()], 'probe.png', { type: 'image/png' });
    canShareFiles.value =
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [probe] });
  } catch {
    canShareFiles.value = false;
  }
});

/** 文件名（短句-YYYY-MM-DD.png）。 */
function filename(): string {
  return `短句-${props.card?.bizDate ?? '卡片'}.png`;
}

/** 把分享卡渲染成 PNG Blob。 */
async function toBlob(): Promise<Blob> {
  const element = visualRef.value;
  if (!element) {
    throw new Error('卡片尚未就绪');
  }
  const canvas = await html2canvas(element, {
    scale: 3,
    backgroundColor: '#0b1220',
    useCORS: true,
    logging: false,
    imageTimeout: 10_000,
  });
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('图片导出失败'))), 'image/png', 0.95);
  });
}

/** 触发浏览器下载。 */
function download(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename();
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** 保存图片。 */
async function save(): Promise<void> {
  if (busy.value) {
    return;
  }
  busy.value = true;
  message.value = '';
  try {
    download(await toBlob());
    message.value = '已保存到下载';
  } catch (error) {
    message.value = error instanceof Error ? error.message : '导出失败，请重试';
  } finally {
    busy.value = false;
  }
}

/** 系统分享（不支持则退化为下载）。 */
async function share(): Promise<void> {
  if (busy.value) {
    return;
  }
  busy.value = true;
  message.value = '';
  try {
    const blob = await toBlob();
    const file = new File([blob], filename(), { type: 'image/png' });
    if (canShareFiles.value && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: '短句 · 每日一句', text: props.card?.sentenceEn ?? '' });
      message.value = '已分享';
    } else {
      download(blob);
      message.value = '当前浏览器不支持直接分享，已改为保存图片';
    }
  } catch (error) {
    // 用户主动取消分享不算失败
    if ((error as Error)?.name !== 'AbortError') {
      message.value = error instanceof Error ? error.message : '分享失败，请重试';
    }
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="ss-celebrate">
      <div
        v-if="card"
        class="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-slate-950/70 p-4 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <div ref="visual" class="overflow-hidden rounded-3xl shadow-2xl">
          <ShareCardVisual :card="card" />
        </div>

        <div class="flex items-center gap-3">
          <UButton icon="i-lucide-download" :loading="busy" @click="save">保存图片</UButton>
          <UButton
            v-if="canShareFiles"
            color="neutral"
            variant="soft"
            icon="i-lucide-share-2"
            :loading="busy"
            @click="share"
          >
            分享
          </UButton>
        </div>
        <p v-if="message" class="text-xs text-white/85">{{ message }}</p>

        <button
          type="button"
          class="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
          aria-label="关闭"
          @click="emit('close')"
        >
          <UIcon name="i-lucide-x" class="h-5 w-5" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
