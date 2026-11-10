<script setup lang="ts">
/**
 * 场景详情（路由 /stages/scene/:categoryId）：点开地图上的场景卡后到这里。
 *
 * 上面是场景封面横幅，下面是该场景下的剧本卡（每本一条身份线），
 * 点开进入 `/stages/script/:scriptId` 看这本剧本的关卡。
 */
import { computed, onMounted } from 'vue';
import { apiFetch } from '~/composables/useApi';
import { sceneCoverOf } from '~/utils/stage-chapters';
import type { StageSceneDetail } from '~/types';

definePageMeta({ middleware: ['auth'] });

const route = useRoute();
const categoryId = computed(() => Number(route.params.id));

const detail = ref<StageSceneDetail | null>(null);

onMounted(async () => {
  detail.value = await apiFetch<StageSceneDetail>(`/client/stages/scenes/${categoryId.value}`).catch(() => null);
});

usePageSeo({
  title: '剧本列表',
  description: '选一本剧本，进入真实场景，和里面的人用英语把目标聊成。',
});
useHead({ title: computed(() => (scene.value ? scene.value.name : '剧本列表')) });

const scene = computed(() => detail.value?.scene ?? null);
const scripts = computed<StageScript[]>(() => detail.value?.scripts ?? []);

function enterScript(script: StageScript): void {
  void navigateTo(`/stages/script/${script.id}`);
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6 sm:py-8">
    <!-- 场景封面横幅 -->
    <header
      class="anim-in relative overflow-hidden rounded-3xl p-5 text-white shadow-sm"
      :class="[sceneCoverOf(categoryId).gradient, sceneCoverOf(categoryId).gradientDark]"
    >
      <img
        v-if="scene?.coverUrl"
        :src="scene.coverUrl"
        :alt="scene.name"
        class="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
      <div v-if="scene?.coverUrl" class="absolute inset-0 bg-black/40" />
      <div class="relative">
        <NuxtLink
          to="/stages"
          class="inline-flex items-center gap-0.5 text-xs font-medium text-white/80 transition hover:text-white"
        >
          <UIcon name="i-lucide-chevron-left" class="h-3.5 w-3.5" />
          全部场景
        </NuxtLink>
        <div class="mt-2 flex items-end justify-between gap-3">
          <div class="min-w-0">
            <h1 class="text-xl font-bold drop-shadow-sm">{{ scene?.name ?? '场景' }}</h1>
            <p class="mt-1 text-xs leading-relaxed text-white/85">
              {{ scene?.scriptCount ?? 0 }} 个剧本 · {{ scene?.stageCount ?? 0 }} 关
            </p>
          </div>
          <span v-if="!scene?.coverUrl" class="shrink-0 text-4xl drop-shadow-sm" aria-hidden="true">
            {{ scene?.icon || sceneCoverOf(categoryId).emoji }}
          </span>
        </div>
      </div>
    </header>

    <div v-if="!detail" class="py-16 text-center text-sm text-slate-400">正在加载剧本…</div>
    <div v-else-if="scripts.length === 0" class="py-16 text-center text-sm text-slate-400">
      这个场景下还没有剧本，敬请期待
    </div>

    <!-- 剧本卡列表 -->
    <div v-else class="mt-4 space-y-3">
      <button
        v-for="script in scripts"
        :key="script.id"
        type="button"
        class="group flex w-full items-center gap-3.5 overflow-hidden rounded-3xl bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-200/70 transition hover:ring-sky-300 dark:bg-slate-900 dark:ring-slate-800/80 dark:hover:ring-sky-500/40"
        @click="enterScript(script)"
      >
        <div
          class="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
          :class="[sceneCoverOf(categoryId).gradient, sceneCoverOf(categoryId).gradientDark]"
        >
          <img
            v-if="script.coverUrl"
            :src="script.coverUrl"
            :alt="script.name"
            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <span v-else class="text-4xl drop-shadow-sm" aria-hidden="true">
            {{ sceneCoverOf(categoryId).emoji }}
          </span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-2">
            <h2 class="min-w-0 truncate text-sm font-bold text-slate-800 dark:text-slate-100">
              {{ script.name }}
            </h2>
            <span class="shrink-0 text-[11px] font-semibold text-slate-400">
              {{ script.clearedCount }} / {{ script.stageCount }}
            </span>
          </div>
          <p class="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {{ script.blurb || '一段等你来聊成的故事。' }}
          </p>
          <div class="mt-2 flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400">
            查看关卡
            <UIcon
              name="i-lucide-chevron-right"
              class="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
            />
          </div>
        </div>
        <span
          v-if="script.completed"
          class="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        >
          已通关
        </span>
      </button>
    </div>
  </div>
</template>
