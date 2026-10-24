<script setup lang="ts">
/**
 * 首页仪表盘。
 * 模块职责：聚合统计卡片、登录趋势、操作类型分布与各角色用户数四项数据，
 * 并交给对应图表子组件渲染。
 */

import {
  getAnalyticsOverviewApi,
  getDashboardStatsApi,
  getLoginTrendApi,
  getOperationDistributionApi,
  getRoleUserCountApi,
} from '@/api/dashboard';
import type { AnalyticsOverview, DashboardStats, LoginTrend, NameValue, RoleUserCount } from '@/types/api';
import { useUserStore } from '@/store/modules/user';
import StatCard from './components/StatCard.vue';
import TrendChart from './components/TrendChart.vue';
import PieChart from './components/PieChart.vue';
import BarChart from './components/BarChart.vue';

defineOptions({ name: 'HomePage' });

const userStore = useUserStore();

const loading = ref(false);
const stats = ref<DashboardStats>({
  userTotal: 0,
  roleTotal: 0,
  menuTotal: 0,
  todayLoginCount: 0,
});
const trend = ref<LoginTrend>({ dates: [], counts: [] });
const distribution = ref<NameValue[]>([]);
const roleUserCount = ref<RoleUserCount>({ names: [], counts: [] });

/** 客户端内容总览（题库 / 用户 / AI / 句签），与系统统计并列展示。 */
const overview = ref<AnalyticsOverview | null>(null);

/** 加载全部仪表盘数据 */
async function loadData(): Promise<void> {
  loading.value = true;
  const tasks = await Promise.allSettled([
    getDashboardStatsApi(),
    getLoginTrendApi(7),
    getOperationDistributionApi(),
    getRoleUserCountApi(),
    getAnalyticsOverviewApi(),
  ]);
  if (tasks[0].status === 'fulfilled') {
    stats.value = tasks[0].value;
  }
  if (tasks[1].status === 'fulfilled') {
    trend.value = tasks[1].value;
  }
  if (tasks[2].status === 'fulfilled') {
    distribution.value = tasks[2].value;
  }
  if (tasks[3].status === 'fulfilled') {
    roleUserCount.value = tasks[3].value;
  }
  if (tasks[4].status === 'fulfilled') {
    overview.value = tasks[4].value;
  }
  loading.value = false;
}

onMounted(() => {
  void loadData();
});

/** 按时段问候 */
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) {
    return '夜深了';
  }
  if (hour < 9) {
    return '早上好';
  }
  if (hour < 12) {
    return '上午好';
  }
  if (hour < 14) {
    return '中午好';
  }
  if (hour < 18) {
    return '下午好';
  }
  return '晚上好';
});

/** 今日日期（2026年9月23日 星期三） */
const todayText = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}).format(new Date());
</script>

<template>
  <div v-loading="loading" class="home-page">
    <header class="mb-4">
      <h2 class="text-xl font-bold text-ink">{{ greeting }}，{{ userStore.nickname }}</h2>
      <p class="mt-1.5 text-[13px] text-muted">今天是 {{ todayText }}，欢迎回来</p>
    </header>

    <!-- 系统统计（后台自身） -->
    <p class="anim-in mb-2 mt-1 text-xs font-medium text-faint">后台系统</p>
    <el-row :gutter="16">
      <el-col :xs="24" :sm="12" :md="6" class="my-1">
        <StatCard title="用户总数" :value="stats.userTotal" icon="person" color="#409eff" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="6" class="my-1">
        <StatCard title="角色总数" :value="stats.roleTotal" icon="folder" color="#67c23a" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="6" class="my-1">
        <StatCard title="菜单总数" :value="stats.menuTotal" icon="list" color="#e6a23c" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="6" class="my-1">
        <StatCard title="今日登录" :value="stats.todayLoginCount" icon="graph-up" color="#f56c6c" />
      </el-col>
    </el-row>

    <!-- 客户端内容统计（「短句」）；overview 拉取失败时整块不显示，不阻塞首页 -->
    <template v-if="overview">
      <p class="anim-in mb-2 mt-4 text-xs font-medium text-faint">短句</p>
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12" :md="6" class="my-1">
          <StatCard
            title="客户端用户"
            :value="overview.userTotal"
            :sub="`今日新增 ${overview.userToday} · 今日活跃 ${overview.activeToday}`"
            icon="person"
            color="#409eff"
          />
        </el-col>
        <el-col :xs="24" :sm="12" :md="6" class="my-1">
          <StatCard
            title="题库总量"
            :value="overview.sentenceTotal"
            :sub="`就绪 ${overview.sentenceReady} · 待生图 ${overview.sentencePending}`"
            icon="journal-text"
            color="#67c23a"
          />
        </el-col>
        <el-col :xs="24" :sm="12" :md="6" class="my-1">
          <StatCard
            title="今日 AI 调用"
            :value="overview.aiCallToday"
            :sub="`token ${overview.aiTokenToday.toLocaleString('zh-CN')}`"
            icon="cpu"
            color="#e6a23c"
          />
        </el-col>
        <el-col :xs="24" :sm="12" :md="6" class="my-1">
          <StatCard
            title="句签"
            :value="overview.cardToday"
            :sub="`今日领取 · 累计 ${overview.cardTotal} 张`"
            icon="calendar-month"
            color="#f56c6c"
          />
        </el-col>
      </el-row>
    </template>

    <el-row :gutter="16" class="mt-4">
      <el-col :xs="24" :md="16">
        <el-card shadow="never">
          <template #header>近 7 日登录趋势</template>
          <TrendChart :data="trend" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never">
          <template #header>操作类型分布</template>
          <PieChart :data="distribution" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mt-4">
      <el-col :span="24">
        <el-card shadow="never">
          <template #header>各角色用户数</template>
          <BarChart :data="roleUserCount" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>
