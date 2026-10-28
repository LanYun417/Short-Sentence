<script setup lang="ts">
/**
 * 每日句签卡（3D 视差）。
 * 指针移动时整卡随「视线」倾斜，内部各图层按不同 translateZ 分层前移形成视差，
 * 另有一层圆心跟随指针的高光。尊重 prefers-reduced-motion（降级为静态卡）。
 *
 * 结构注意：透视放在最外层容器，倾斜本体用 transform-style:preserve-3d；
 * 配图自己用 overflow-hidden 做圆角裁剪（该元素会扁平化自身子树，但不影响兄弟图层）。
 */
import type { SentenceCard } from '~/types';

const props = defineProps<{
  /** 当日句签（已领取） */
  card: SentenceCard;
}>();

/**
 * 最大倾斜角（度）与各图层前移距离（px）。
 *
 * 只有「卡面内部的图层」才需要 translateZ：配图上的标题（Z_TEXT）、
 * 角标（Z_BADGE）、镭射高光（Z_GLARE）。卡片下方的卡脚与寄语是注脚，
 * 刻意留在基准平面（不参与视差），所以没有对应的 Z 常量。
 */
const MAX_TILT = 8;
const Z_GLARE = 8;
const Z_BADGE = 30;
const Z_TEXT = 45;

const cardRef = useTemplateRef<HTMLElement>('card');
/** 指针相对卡片中心的归一化偏移（-0.5 ~ 0.5） */
const offsetX = ref(0);
const offsetY = ref(0);
/** 指针是否在卡上（控制高光显隐与过渡时长） */
const active = ref(false);
/** 系统偏好「减少动态效果」时彻底关闭视差 */
const reduceMotion = ref(false);

onMounted(() => {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduceMotion.value = query.matches;
  query.addEventListener('change', (event) => {
    reduceMotion.value = event.matches;
  });
});

/** 指针移动：记录归一化偏移。 */
function onPointerMove(event: PointerEvent): void {
  const element = cardRef.value;
  if (!element) {
    return;
  }
  const rect = element.getBoundingClientRect();
  offsetX.value = (event.clientX - rect.left) / rect.width - 0.5;
  offsetY.value = (event.clientY - rect.top) / rect.height - 0.5;
}

/** 指针离开：缓动回正。 */
function onPointerLeave(): void {
  offsetX.value = 0;
  offsetY.value = 0;
  active.value = false;
}

/** 整卡倾斜：跟手时短过渡，回正时较长过渡。 */
const cardStyle = computed(() => {
  if (reduceMotion.value) {
    return {};
  }
  return {
    transform: `rotateX(${(-offsetY.value * MAX_TILT * 2).toFixed(3)}deg) rotateY(${(offsetX.value * MAX_TILT * 2).toFixed(3)}deg)`,
    transitionProperty: 'transform',
    transitionDuration: active.value ? '90ms' : '650ms',
    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
  };
});

/** 高光：圆心跟随指针。 */
const glareStyle = computed(() => ({
  background: `radial-gradient(circle at ${(50 + offsetX.value * 90).toFixed(2)}% ${(50 + offsetY.value * 90).toFixed(2)}%, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0) 55%)`,
  opacity: active.value && !reduceMotion.value ? 1 : 0,
  transform: `translateZ(${Z_GLARE}px)`,
}));

/**
 * 镭射层：光谱带随指针在卡面上滑动。
 * 静止时常驻一层较淡的彩虹（否则「镭射」只在鼠标划过时才存在，卡片本身没有材质感），
 * 指针进入后加深并跟手。减少动态效果时锁在正中、再降一档强度。
 *
 * ⚠️ 系数只能取 90，不能再大：background-size 是 260%，而 background-position 的百分比
 * 是相对「容器尺寸 − 图尺寸」计算的。一旦算出 <0% 或 >100%，图块就盖不满元素，
 * 背景按 repeat 翻折平铺；这条渐变（115deg）的**上下边缘是实色**，于是卡面上会切出
 * 一条水平硬边——表现就是「鼠标移到中上方时，一块矩形渐变从顶部滑进来」。
 * 取 90 让位置恒落在 5%~95%，图块边缘永不进入可视区（CSS 侧再用 no-repeat 兜底）。
 */
const holoStyle = computed(() => {
  const x = reduceMotion.value ? 50 : 50 + offsetX.value * 90;
  const y = reduceMotion.value ? 50 : 50 + offsetY.value * 90;
  return {
    backgroundPosition: `${x.toFixed(2)}% ${y.toFixed(2)}%`,
    opacity: reduceMotion.value ? 0.3 : active.value ? 0.85 : 0.45,
  };
});

/** 日期（YYYY-MM-DD → 「10月23日」）。 */
const dateText = computed(() => {
  const [, month, day] = props.card.bizDate.split('-');
  return month && day ? `${Number(month)}月${Number(day)}日` : props.card.bizDate;
});
</script>

<template>
  <!-- 外层：透视容器（不加 overflow，3D 图层才能溢出产生纵深） -->
  <div
    class="perspective-[1000px]"
    @pointerenter="active = true"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
  >
    <!-- 内层：倾斜的本体 -->
    <div ref="card" class="transform-3d" :style="cardStyle">
      <div class="relative transform-3d">
        <!-- 配图层（自身圆角裁剪；内部扁平化不影响兄弟图层） -->
        <div
          class="relative aspect-video overflow-hidden rounded-3xl bg-slate-100 shadow-xl ring-1 ring-amber-200/60 dark:bg-slate-700 dark:ring-amber-500/20"
        >
          <img v-if="card.imageUrl" :src="card.imageUrl" :alt="card.title" class="h-full w-full object-cover" />
          <div v-else class="flex h-full items-center justify-center text-slate-400">
            <UIcon name="i-lucide-image-off" class="h-8 w-8" />
          </div>
          <!-- 镭射材质（贴在图面上，随卡片一起倾斜；光谱随指针滑动） -->
          <div class="ss-holo pointer-events-none absolute inset-0" :style="holoStyle" />
          <!-- 渐变蒙版：让文字在任何配图上都清晰（压在镭射之上，避免底部反光影响可读性） -->
          <div
            class="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/75 via-black/35 to-transparent"
          />
        </div>

        <!-- 高光层（圆心跟随指针） -->
        <div
          class="pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-300"
          :style="glareStyle"
        />

        <!-- 徽标（前移） -->
        <div
          class="absolute inset-x-3 top-3 flex items-center justify-between gap-2"
          :style="{ transform: `translateZ(${Z_BADGE}px)` }"
        >
          <span
            class="inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-amber-600 shadow-sm backdrop-blur dark:bg-slate-900/70 dark:text-amber-400"
          >
            <UIcon name="i-lucide-sparkles" class="h-3.5 w-3.5" />
            今日句签 · 已获得
          </span>
          <span
            class="rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium tabular-nums text-white backdrop-blur"
          >
            {{ dateText }}
          </span>
        </div>

        <!-- 文案（最前） -->
        <div class="absolute inset-x-0 bottom-0 p-4 text-white" :style="{ transform: `translateZ(${Z_TEXT}px)` }">
          <div class="flex items-baseline gap-2">
            <h3 class="text-lg font-bold drop-shadow-sm">{{ card.titleZh }}</h3>
            <span class="text-xs text-white/70">{{ card.title }}</span>
          </div>
          <p class="mt-1.5 text-base font-semibold drop-shadow-sm">{{ card.sentenceEn }}</p>
          <p class="mt-0.5 text-sm text-white/80 drop-shadow-sm">{{ card.translationZh }}</p>
        </div>
      </div>
    </div>

    <!-- 卡脚与寄语：放在**倾斜容器之外**，所以完全不倾斜。
         它们定位是卡片下方的说明文字，不是卡面的一部分；
         放在倾斜容器里（哪怕不加 translateZ）也会跟着一起歪，
         读起来别扭。移出后保持水平，只有卡片本体随指针倾斜。 -->
    <div
      class="mt-2 flex items-center gap-1.5 rounded-2xl bg-white px-4 py-2.5 text-xs text-amber-600 shadow-sm ring-1 ring-amber-200/60 dark:bg-slate-800 dark:text-amber-400 dark:ring-amber-500/20"
    >
      <UIcon name="i-lucide-party-popper" class="h-4 w-4" />
      完成今日目标，收下这张属于你的闪卡
    </div>

    <!-- 寄语：这张卡独有的一句（随卡片一起生成；老卡片为空时不占位）
         必须自带底色：它浮在弹层的半透明遮罩上，而遮罩带 backdrop-blur，
         背后配图的亮色会透上来。亮色模式下遮罩压不住亮部，amber-600 的小字
         会糊在浅底上（实测对比度约 3.97:1，低于 WCAG AA 的 4.5:1）。
         这里与上方卡脚用同一套「白底 + 细环」的外壳，保证任何背景下都可读。 -->
    <p
      v-if="card.blessing"
      class="mt-2 rounded-2xl bg-white px-4 py-2.5 text-center text-xs font-medium text-amber-700 shadow-sm ring-1 ring-amber-200/60 dark:bg-slate-800 dark:text-amber-300 dark:ring-amber-500/20"
    >
      「{{ card.blessing }}」
    </p>

    <!-- 朗读：句签本身就是一句英文短句，听读是核心场景；放在倾斜容器之外，不干扰 3D 视差 -->
    <div class="mt-2 flex justify-end">
      <TtsButton :text="card.sentenceEn" lang="en-US" />
    </div>
  </div>
</template>
