<script setup lang="ts">
/**
 * 业务数据分析页（「短句」运营后台）。
 * 模块职责：总览指标 / 答题趋势 / 难度分布 / 分类运营 / 打卡 / AI 调用。
 */
import {
  getActiveTrendApi,
  getAnalyticsOverviewApi,
  getAnswerTrendApi,
  getAiCallStatsApi,
  getCategoryStatsApi,
  getCheckinStatApi,
  getDifficultyApi,
  getFunnelApi,
  getRetentionApi,
} from '@/api/analytics';
import type {
  ActiveTrend,
  AiCallStat,
  AnalyticsOverview,
  AnswerTrend,
  CategoryStat,
  CheckinStat,
  FunnelResult,
  NameValue,
  RetentionResult,
} from '@/types/api';
import PieChart from '@/views/home/components/PieChart.vue';
import BarChart from '@/views/home/components/BarChart.vue';
import StatCard from '@/views/home/components/StatCard.vue';
import AnswerTrendChart from './components/AnswerTrendChart.vue';
import ActiveTrendChart from './components/ActiveTrendChart.vue';
import FunnelChart from './components/FunnelChart.vue';
import { computed, ref } from 'vue';

defineOptions({ name: 'SentenceAnalytics' });

const loading = ref(false);

const overview = ref<AnalyticsOverview | null>(null);
const trend = ref<AnswerTrend>({ dates: [], answers: [], corrects: [] });
const difficulty = ref<NameValue[]>([]);
const categories = ref<CategoryStat[]>([]);
const aiStats = ref<AiCallStat[]>([]);
const checkin = ref<CheckinStat | null>(null);
const activeTrend = ref<ActiveTrend>({ dates: [], newUsers: [], activeUsers: [] });
const funnel = ref<FunnelResult>({ registered: 0, stages: [] });
const retention = ref<RetentionResult>({ rows: [], avg: { d0: null, d1: null, d3: null, d7: null } });

/** 趋势天数 */
const trendDays = ref(7);
/** 留存分析窗口（漏斗与队列留存共用） */
const cohortDays = ref(30);

/** 队列留存表格：最新队列在前。 */
const retentionRows = computed(() => [...retention.value.rows].reverse());

/** 留存率显示：null（未到期/空队列）→ —，否则 N%。 */
function formatRate(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

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
      title: '题库总量',
      value: data?.sentenceTotal ?? 0,
      sub: `就绪 ${data?.sentenceReady ?? 0} · 待生图 ${data?.sentencePending ?? 0}`,
      icon: 'journal-text',
      color: '#2563eb',
    },
    {
      title: '客户端用户',
      value: data?.userTotal ?? 0,
      sub: `今日新增 ${data?.userToday ?? 0}`,
      icon: 'people',
      color: '#059669',
    },
    { title: '今日活跃', value: data?.activeToday ?? 0, sub: '有答题的用户数', icon: 'activity', color: '#d97706' },
    {
      title: '今日答题',
      value: data?.answerToday ?? 0,
      sub: `正确率 ${todayAccuracy.value}`,
      icon: 'pencil-square',
      color: '#7c3aed',
    },
    {
      title: '今日打卡',
      value: data?.checkinToday ?? 0,
      sub: `累计 ${checkin.value?.totalCheckins ?? 0} 人次`,
      icon: 'calendar-check',
      color: '#e11d48',
    },
    { title: '词根词条', value: data?.wordRootTotal ?? 0, sub: 'AI 解析入库', icon: 'book', color: '#0891b2' },
    {
      title: '今日 AI 调用',
      value: data?.aiCallToday ?? 0,
      sub: '生题 / 生图 / 造句 / 词根',
      icon: 'cpu',
      color: '#4f46e5',
    },
    { title: '已下架', value: data?.sentenceOffline ?? 0, sub: '不参与抽题', icon: 'archive', color: '#6b7280' },
  ];
});

/** 加载全部数据。 */
async function loadAll(): Promise<void> {
  loading.value = true;
  try {
    const [o, t, d, c, a, ck, at, f, r] = await Promise.all([
      getAnalyticsOverviewApi(),
      getAnswerTrendApi(trendDays.value),
      getDifficultyApi(),
      getCategoryStatsApi(),
      getAiCallStatsApi(7),
      getCheckinStatApi(),
      getActiveTrendApi(14),
      getFunnelApi(cohortDays.value),
      getRetentionApi(cohortDays.value),
    ]);
    overview.value = o;
    trend.value = t;
    difficulty.value = d;
    categories.value = c;
    aiStats.value = a;
    checkin.value = ck;
    activeTrend.value = at;
    funnel.value = f;
    retention.value = r;
  } finally {
    loading.value = false;
  }
}

/** 切换趋势天数。 */
async function changeTrendDays(days: number): Promise<void> {
  trendDays.value = days;
  trend.value = await getAnswerTrendApi(days);
}

/** 切换留存分析窗口（漏斗 + 队列留存一起刷新）。 */
async function changeCohortDays(days: number): Promise<void> {
  cohortDays.value = days;
  const [f, r] = await Promise.all([getFunnelApi(days), getRetentionApi(days)]);
  funnel.value = f;
  retention.value = r;
}

onMounted(() => {
  void loadAll();
});
</script>

<template>
  <div v-loading="loading" class="sentence-analytics-page">
    <header class="mb-4">
      <h2 class="text-xl font-bold text-ink">数据分析</h2>
      <p class="mt-1.5 text-[13px] text-muted">题库、答题、打卡与 AI 调用的运营概览</p>
    </header>

    <!-- 指标卡 -->
    <el-row :gutter="16">
      <el-col v-for="card in CARDS" :key="card.title" :xs="24" :sm="12" :md="6" class="my-1">
        <StatCard :title="card.title" :value="card.value" :sub="card.sub" :icon="card.icon" :color="card.color" />
      </el-col>
    </el-row>

    <!-- 答题趋势 -->
    <el-card shadow="never" class="mt-4">
      <template #header>
        <div class="flex items-center justify-between">
          <span>答题趋势</span>
          <el-radio-group :model-value="trendDays" size="small" @update:model-value="(v) => changeTrendDays(Number(v))">
            <el-radio-button :value="7">近 7 日</el-radio-button>
            <el-radio-button :value="14">近 14 日</el-radio-button>
            <el-radio-button :value="30">近 30 日</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <AnswerTrendChart :data="trend" />
    </el-card>

    <!-- 活跃趋势（新增 / 日活） -->
    <el-card shadow="never" class="mt-4">
      <template #header>活跃趋势（近 14 日）</template>
      <ActiveTrendChart :data="activeTrend" />
    </el-card>

    <!-- 留存：漏斗 + 队列留存 -->
    <el-row :gutter="16" class="mt-4">
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between">
              <span>留存漏斗</span>
              <el-radio-group
                :model-value="cohortDays"
                size="small"
                @update:model-value="(v) => changeCohortDays(Number(v))"
              >
                <el-radio-button :value="14">近 14 日</el-radio-button>
                <el-radio-button :value="30">近 30 日</el-radio-button>
                <el-radio-button :value="60">近 60 日</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <FunnelChart :stages="funnel.stages" />
          <p class="mt-2 text-xs text-muted">窗口内注册 {{ funnel.registered }} 人；逐级要求满足上一级（嵌套漏斗）。</p>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>队列留存（按注册日，%）</template>
          <el-table :data="retentionRows" border size="small" max-height="320">
            <el-table-column prop="date" label="注册日" width="106" />
            <el-table-column prop="cohort" label="队列" width="66" />
            <el-table-column label="D0" width="66">
              <template #default="{ row }">{{ formatRate(row.d0) }}</template>
            </el-table-column>
            <el-table-column label="D1" width="66">
              <template #default="{ row }">{{ formatRate(row.d1) }}</template>
            </el-table-column>
            <el-table-column label="D3" width="66">
              <template #default="{ row }">{{ formatRate(row.d3) }}</template>
            </el-table-column>
            <el-table-column label="D7" min-width="66">
              <template #default="{ row }">{{ formatRate(row.d7) }}</template>
            </el-table-column>
          </el-table>
          <p class="mt-2 text-xs text-muted">
            平均：D0 {{ formatRate(retention.avg.d0) }} · D1 {{ formatRate(retention.avg.d1) }} · D3
            {{ formatRate(retention.avg.d3) }} · D7 {{ formatRate(retention.avg.d7) }}（仅统计已到期队列）
          </p>
        </el-card>
      </el-col>
    </el-row>

    <!-- 难度 + 分类 -->
    <el-row :gutter="16" class="mt-4">
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>题目难度分布</template>
          <PieChart :data="difficulty" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>各场景题目数</template>
          <BarChart :data="categoryChart" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 分类运营明细 + AI 调用 -->
    <el-row :gutter="16" class="mt-4">
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>分类运营明细</template>
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
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>AI 调用（近 7 日）</template>
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
        </el-card>
      </el-col>
    </el-row>

    <!-- 打卡 -->
    <el-row :gutter="16" class="mt-4">
      <el-col :xs="24" :sm="12" :md="6" class="my-1">
        <StatCard title="今日打卡人数" :value="checkin?.todayUsers ?? 0" icon="person-check" color="#e11d48" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="6" class="my-1">
        <StatCard title="今日平均连续天数" :value="checkin?.avgStreak ?? 0" icon="fire" color="#f97316" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="6" class="my-1">
        <StatCard title="今日最长连续天数" :value="checkin?.maxStreak ?? 0" icon="trophy" color="#eab308" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="6" class="my-1">
        <StatCard title="累计打卡人次" :value="checkin?.totalCheckins ?? 0" icon="calendar2-check" color="#0891b2" />
      </el-col>
    </el-row>
  </div>
</template>
