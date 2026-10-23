<script setup lang="ts">
/**
 * 认证页骨架（登录 / 注册共用）。
 *
 * 左栏品牌区 + 右栏表单区：桌面端左右分栏，移动端只留表单并把品牌信息压缩成顶部小标。
 * 页面只需通过默认插槽填入「标题 + 表单卡片」，可选 `#preview` 插槽补一张产品示意。
 *
 * 抽出来的原因：登录与注册的结构完全同构，此前两页各抄了一份（含光斑、动画延迟、
 * 滚动容器），改一处要同步另一处，极易漂移。
 */
import type { AuthFeature } from '~/types';

const props = defineProps<{
  /** 品牌区背景渐变（Tailwind 类） */
  gradient: string;
  /** 左下角装饰光斑的颜色（Tailwind 类） */
  driftClass: string;
  /** 主标题第一行 */
  titleLine1: string;
  /** 主标题第二行 */
  titleLine2: string;
  /** 副标题 */
  subtitle: string;
  /** 移动端顶部品牌标题 */
  mobileTitle: string;
  /** 移动端顶部品牌副标题 */
  mobileSubtitle: string;
  /** 品牌区卖点列表 */
  features: AuthFeature[];
}>();
</script>

<template>
  <!-- 页面本身不滚：品牌栏固定，表单列内容区自己滚 -->
  <div class="grid h-dvh grid-cols-1 overflow-hidden lg:grid-cols-2">
    <!-- 品牌分栏（桌面端，固定不滚） -->
    <aside
      class="anim-fade relative hidden h-full overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between"
      :class="props.gradient"
    >
      <div
        class="anim-drift pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"
      />
      <div
        class="anim-drift pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full blur-3xl"
        :class="props.driftClass"
        style="animation-delay: -7s"
      />

      <div class="anim-in relative flex items-center gap-2.5">
        <img src="/favicon.svg" alt="短句" class="h-10 w-10 transition-transform duration-300 hover:rotate-6" />
        <span class="text-xl font-bold tracking-tight">短句</span>
      </div>

      <div class="anim-in relative" style="animation-delay: 100ms">
        <h2 class="text-4xl font-bold leading-tight">{{ props.titleLine1 }}<br />{{ props.titleLine2 }}</h2>
        <p class="mt-4 max-w-sm text-white/80">{{ props.subtitle }}</p>

        <!-- 产品示意（可选）：让访客先看到一张真实闪卡长什么样 -->
        <slot name="preview" />
      </div>

      <ul class="relative mt-6 space-y-4">
        <li
          v-for="(f, i) in props.features"
          :key="f.title"
          class="anim-stagger flex items-start gap-3"
          :style="{ '--d': `${200 + i * 120}ms` }"
        >
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur">
            <UIcon :name="f.icon" class="h-5 w-5" />
          </span>
          <div>
            <p class="font-semibold">{{ f.title }}</p>
            <p class="text-sm text-white/75">{{ f.desc }}</p>
          </div>
        </li>
      </ul>
    </aside>

    <!-- 表单列：内容区自己滚，超出时出现悬浮滚动条 -->
    <AppScrollArea>
      <div
        class="relative flex min-h-full items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 dark:bg-slate-950"
      >
        <!-- 装饰光斑：给纯色背景一点纵深 -->
        <div
          class="anim-drift pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-200/45 blur-3xl dark:bg-sky-500/10"
        />
        <div
          class="anim-drift pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-indigo-200/45 blur-3xl dark:bg-indigo-500/10"
          style="animation-delay: -7s"
        />

        <div class="relative w-full max-w-sm">
          <!-- 移动端品牌头 -->
          <div class="anim-in mb-8 flex flex-col items-center text-center lg:hidden">
            <img src="/favicon.svg" alt="短句" class="h-12 w-12" />
            <h2 class="mt-3 text-xl font-bold text-slate-800 dark:text-slate-100">{{ props.mobileTitle }}</h2>
            <p class="mt-1 text-sm text-slate-400">{{ props.mobileSubtitle }}</p>
          </div>

          <slot />
        </div>
      </div>
    </AppScrollArea>
  </div>
</template>
