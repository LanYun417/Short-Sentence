<script setup lang="ts">
/**
 * 下载页独立布局（脱离 default 应用外壳）。
 *
 * 与 `auth` 布局同理：给页面一块没有「顶栏导航 + 移动端底部 Tab」的全屏画布，
 * 让 /download 成为一个真正的独立落地页，而不是嵌在 App 外壳里。
 *
 * 区别是这里保留了一根**极简**顶栏：品牌（点回首页）+ 主题切换——落地页仍需
 * 品牌识别与暗色切换，但不放刷题/题库/AI/我的这类应用内导航，也不放登录/头像。
 *
 * 滚动与 default 布局保持一致：外壳定高（h-dvh + overflow-hidden），内容交给
 * `AppScrollArea` 内部滚动——它隐藏原生滚动条、自绘悬浮细滚动条，不占布局宽度，
 * 与站内其它页面手感统一（原生滚动条会挤动布局且观感割裂）。
 */
const colorMode = useColorMode();

/**
 * 切换亮/暗：把 class 切换包进 View Transitions，与 default 布局同一手感
 * （见 main.css 的 ::view-transition 片段）。不支持的浏览器直接切换。
 */
function toggleTheme(): void {
  const next = colorMode.value === 'dark' ? 'light' : 'dark';
  const apply = (): void => {
    colorMode.preference = next;
    document.documentElement.classList.toggle('dark', next === 'dark');
  };
  const doc = document as Document & { startViewTransition?: (update: () => void) => unknown };
  if (typeof doc.startViewTransition === 'function') {
    doc.startViewTransition(apply);
  } else {
    apply();
  }
}
</script>

<template>
  <div
    class="relative flex h-dvh flex-col overflow-hidden bg-linear-to-b from-sky-50/60 via-slate-50 to-slate-50 text-slate-900 transition-colors dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 dark:text-slate-100"
  >
    <!--
      环境背景：多层柔光光斑 + 细点纹理，避免整页纯色单调。
      固定铺满外壳（不随内容滚动），pointer-events-none 且置于内容之下。
    -->
    <div class="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div
        class="anim-drift absolute -top-28 -left-24 size-[30rem] rounded-full bg-sky-300/40 blur-3xl dark:bg-sky-500/15"
      />
      <div
        class="anim-drift absolute top-8 -right-32 size-[28rem] rounded-full bg-indigo-300/35 blur-3xl dark:bg-indigo-500/15"
        style="animation-delay: -7s"
      />
      <div
        class="anim-drift absolute -bottom-40 left-1/3 size-[32rem] rounded-full bg-violet-300/30 blur-3xl dark:bg-violet-500/12"
        style="animation-delay: -12s"
      />
      <!-- 细点纹理：顶部渐隐，给纯色底一点质感（暗色下减淡） -->
      <div
        class="absolute inset-0 opacity-40 dark:opacity-20"
        style="
          background-image: radial-gradient(circle at 1px 1px, rgb(100 116 139 / 22%) 1px, transparent 0);
          background-size: 22px 22px;
          mask-image: radial-gradient(ellipse 85% 65% at 50% 0%, #000 25%, transparent 78%);
          mask-image: radial-gradient(ellipse 85% 65% at 50% 0%, #000 25%, transparent 78%);
        "
      />
    </div>

    <!-- 极简顶栏：品牌（回首页）+ 主题切换，无应用内导航 / 登录态 -->
    <header
      class="anim-fade relative z-10 shrink-0 border-b border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-900/80"
    >
      <div class="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <NuxtLink to="/" class="group flex items-center gap-2">
          <AppLogo class="h-8 w-8 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110" />
          <span
            class="bg-linear-to-r from-sky-600 to-indigo-600 bg-clip-text text-lg font-bold tracking-tight text-transparent dark:from-sky-400 dark:to-indigo-400"
            >短句</span
          >
        </NuxtLink>

        <UButton
          color="neutral"
          variant="ghost"
          :icon="colorMode === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
          class="[&_svg]:transition-transform [&_svg]:duration-500"
          :class="colorMode === 'dark' && '[&_svg]:rotate-180'"
          :aria-label="colorMode === 'dark' ? '切换到亮色主题' : '切换到暗色主题'"
          title="切换主题"
          @click="toggleTheme"
        />
      </div>
    </header>

    <!-- 内容区自己滚：与 default 布局同款自绘滚动条（隐藏原生滚动条、不占布局宽度） -->
    <main class="relative z-10 min-h-0 flex-1">
      <AppScrollArea>
        <slot />
      </AppScrollArea>
    </main>
  </div>
</template>
