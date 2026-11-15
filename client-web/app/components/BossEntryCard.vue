<script setup lang="ts">
/**
 * 每日 Boss 入口卡（成长面板内）。
 *
 * 客户端拉取（不进 SSR 缓存）：状态一天只变一次，为它占一个 SSR 缓存位不值当；
 * 首帧显示骨架，拿到数据再显示「未挑战 / 已通关」。
 */
import { onMounted, ref } from 'vue';
import { apiFetch } from '~/composables/useApi';
import type { BossToday } from '~/types';

const boss = ref<BossToday | null>(null);
const failed = ref(false);

onMounted(async () => {
  try {
    boss.value = await apiFetch<BossToday>('/client/questions/boss');
  } catch {
    failed.value = true;
  }
});
</script>

<template>
  <div
    class="relative overflow-hidden rounded-2xl bg-linear-to-br from-amber-500 via-orange-500 to-rose-500 p-5 text-white shadow-lg shadow-orange-500/20"
  >
    <!-- 装饰：右上角剑影 -->
    <UIcon name="i-lucide-swords" class="pointer-events-none absolute -right-3 -top-3 h-24 w-24 text-white/15" />
    <div class="relative flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="flex items-center gap-1.5 text-sm font-bold">
          <UIcon name="i-lucide-swords" class="h-4 w-4" />
          每日 Boss
        </p>
        <p class="mt-1 text-xs text-white/85">
          <template v-if="failed">今天状态没拉到，点进去看看</template>
          <template v-else-if="!boss">加载中…</template>
          <template v-else-if="boss.cleared">今天已通关，明天再来</template>
          <template v-else-if="boss.question">一道挑战句 · 答对额外 +{{ boss.bonusXp }} 经验</template>
          <template v-else>今天的题还在准备中</template>
        </p>
      </div>
      <UButton
        to="/boss"
        color="neutral"
        variant="solid"
        size="sm"
        class="shrink-0 bg-white text-orange-600 hover:bg-white/90"
        :trailing-icon="boss?.cleared ? 'i-lucide-check' : 'i-lucide-arrow-right'"
      >
        {{ boss?.cleared ? '已通关' : '去挑战' }}
      </UButton>
    </div>
  </div>
</template>
