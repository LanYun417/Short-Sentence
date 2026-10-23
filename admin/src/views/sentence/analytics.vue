<script setup lang="ts">
/**
 * 业务数据分析页（「短句」运营后台）。
 * 模块职责：总览指标 / 答题趋势 / 难度分布 / 分类运营 / 打卡 / AI 调用。
 */
import {
  getAnalyticsOverviewApi,
  getAnswerTrendApi,
  getAiCallStatsApi,
  getCategoryStatsApi,
  getCheckinStatApi,
  getDifficultyApi,
} from '@/api/analytics';
import type { AiCallStat, AnalyticsOverview, AnswerTrend, CategoryStat, CheckinStat, NameValue } from '@/types/api';
import PieChart from '@/views/home/components/PieChart.vue';
import BarChart from '@/views/home/components/BarChart.vue';
import AnswerTrendChart from './components/AnswerTrendChart.vue';
import { computed, ref } from 'vue';

defineOptions({ name: 'SentenceAnalytics' });

const loading = ref(false);

const overview = ref<AnalyticsOverview | null>(null);
const trend = ref<AnswerTrend>({ dates: [], answers: [], corrects: [] });
const difficulty = ref<NameValue[]>([]);
const categories = ref<CategoryStat[]>([]);
const aiStats = ref<AiCallStat[]>([]);
const checkin = ref<CheckinStat | null>(null);

/** 趋势天数 */
const trendDays = ref(7);

/** 分类图数据（题目数） */
const categoryChart = computed(() => ({
  names: categories.value.map((item) => item.name),
  counts: categories.value.map((item) => item.sentenceCount),
}));

/** 今日正确率 */
const todayAccuracy = computed(() => {
  const data = overview.value;
  if (!data || data.answerToday === 0) {
    return '—';
  }
  return `${((data.correctToday / data.answerToday) * 100).toFixed(1)}%`;
});

/** 指标卡配置 */
const CARDS = computed(() => {
  const data = overview.value;
  return [
    {
      label: '题库总量',
      value: data?.sentenceTotal ?? 0,
      sub: `就绪 ${data?.sentenceReady ?? 0} · 待生图 ${data?.sentencePending ?? 0}`,
      tone: 'text-blue-600',
    },
    {
      label: '客户端用户',
      value: data?.userTotal ?? 0,
      sub: `今日新增 ${data?.userToday ?? 0}`,
      tone: 'text-emerald-600',
    },
    { label: '今日活跃', value: data?.activeToday ?? 0, sub: '有答题的用户数', tone: 'text-amber-600' },
    { label: '今日答题', value: data?.answerToday ?? 0, sub: `正确率 ${todayAccuracy.value}`, tone: 'text-violet-600' },
    {
      label: '今日打卡',
      value: data?.checkinToday ?? 0,
      sub: `累计 ${checkin.value?.totalCheckins ?? 0} 人次`,
      tone: 'text-rose-600',
    },
    { label: '词根词条', value: data?.wordRootTotal ?? 0, sub: 'AI 解析入库', tone: 'text-cyan-600' },
    { label: '今日 AI 调用', value: data?.aiCallToday ?? 0, sub: '生题 / 生图 / 造句 / 词根', tone: 'text-indigo-600' },
    { label: '已下架', value: data?.sentenceOffline ?? 0, sub: '不参与抽题', tone: 'text-gray-500' },
  ];
});

/** 加载全部数据。 */
async function loadAll(): Promise<void> {
  loading.value = true;
  try {
    const [o, t, d, c, a, ck] = await Promise.all([
      getAnalyticsOverviewApi(),
      getAnswerTrendApi(trendDays.value),
      getDifficultyApi(),
      getCategoryStatsApi(),
      getAiCallStatsApi(7),
      getCheckinStatApi(),
    ]);
    overview.value = o;
    trend.value = t;
    difficulty.value = d;
    categories.value = c;
    aiStats.value = a;
    checkin.value = ck;
  } finally {
    loading.value = false;
  }
}

/** 切换趋势天数。 */
async function changeTrendDays(days: number): Promise<void> {
  trendDays.value = days;
  trend.value = await getAnswerTrendApi(days);
}

onMounted(() => {
  void loadAll();
});
</script>

<template>
  <div v-loading="loading" class="p-4">
    <!-- 指标卡 -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div v-for="card in CARDS" :key="card.label" class="rounded-lg border border-gray-200 p-3">
        <p class="text-xs text-gray-400">{{ card.label }}</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums" :class="card.tone">{{ card.value }}</p>
        <p class="mt-0.5 text-xs text-gray-400">{{ card.sub }}</p>
      </div>
    </div>

    <!-- 答题趋势 -->
    <div class="mt-4 rounded-lg border border-gray-200 p-4">
      <div class="mb-2 flex items-center justify-between">
        <p class="text-sm font-medium">答题趋势</p>
        <el-radio-group :model-value="trendDays" size="small" @update:model-value="(v) => changeTrendDays(Number(v))">
          <el-radio-button :value="7">近 7 日</el-radio-button>
          <el-radio-button :value="14">近 14 日</el-radio-button>
          <el-radio-button :value="30">近 30 日</el-radio-button>
        </el-radio-group>
      </div>
      <AnswerTrendChart :data="trend" />
    </div>

    <!-- 难度 + 分类 -->
    <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="rounded-lg border border-gray-200 p-4">
        <p class="mb-2 text-sm font-medium">题目难度分布</p>
        <PieChart :data="difficulty" />
      </div>
      <div class="rounded-lg border border-gray-200 p-4">
        <p class="mb-2 text-sm font-medium">各场景题目数</p>
        <BarChart :data="categoryChart" />
      </div>
    </div>

    <!-- 分类运营明细 + AI 调用 -->
    <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="rounded-lg border border-gray-200 p-4">
        <p class="mb-2 text-sm font-medium">分类运营明细</p>
        <el-table :data="categories" border size="small" max-height="320">
          <el-table-column prop="name" label="场景" min-width="110" />
          <el-table-column prop="sentenceCount" label="题目数" width="90" />
          <el-table-column prop="answerCount" label="答题数" width="90" />
          <el-table-column label="正确率" width="90">
            <template #default="{ row }">
              {{ row.answerCount > 0 ? `${((row.correctCount / row.answerCount) * 100).toFixed(0)}%` : '—' }}
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="rounded-lg border border-gray-200 p-4">
        <p class="mb-2 text-sm font-medium">AI 调用（近 7 日）</p>
        <el-table :data="aiStats" border size="small" max-height="320">
          <el-table-column prop="name" label="类型" width="90" />
          <el-table-column prop="calls" label="次数" width="80" />
          <el-table-column prop="failed" label="失败" width="80" />
          <el-table-column label="Token" width="110">
            <template #default="{ row }">{{ row.promptTokens + row.completionTokens }}</template>
          </el-table-column>
          <el-table-column label="成功率" min-width="90">
            <template #default="{ row }">
              {{ row.calls > 0 ? `${(((row.calls - row.failed) / row.calls) * 100).toFixed(0)}%` : '—' }}
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 打卡 -->
    <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="rounded-lg border border-gray-200 p-3">
        <p class="text-xs text-gray-400">今日打卡人数</p>
        <p class="mt-1 text-xl font-semibold">{{ checkin?.todayUsers ?? 0 }}</p>
      </div>
      <div class="rounded-lg border border-gray-200 p-3">
        <p class="text-xs text-gray-400">今日平均连续天数</p>
        <p class="mt-1 text-xl font-semibold">{{ checkin?.avgStreak ?? 0 }}</p>
      </div>
      <div class="rounded-lg border border-gray-200 p-3">
        <p class="text-xs text-gray-400">今日最长连续天数</p>
        <p class="mt-1 text-xl font-semibold">{{ checkin?.maxStreak ?? 0 }}</p>
      </div>
      <div class="rounded-lg border border-gray-200 p-3">
        <p class="text-xs text-gray-400">累计打卡人次</p>
        <p class="mt-1 text-xl font-semibold">{{ checkin?.totalCheckins ?? 0 }}</p>
      </div>
    </div>
  </div>
</template>
