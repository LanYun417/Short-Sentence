<script setup lang="ts">
/**
 * AI 调用日志页（「短句」运营后台）。
 * 模块职责：按类型 / 状态 / 关联 id / 日期区间筛选，分页查看 AI 调用记录
 * （token、耗时、错误摘要），并给出**当前筛选范围**的汇总。
 *
 * 「关联 id」按类型解释：expand / word_root 是客户端用户 id，
 * sentence_gen / sentence_polish / sentence_review 是批次 id，image_gen 恒 0。
 * 因此「按用户查 AI 用量」时要把类型一起限定在 expand / word_root。
 */
import { getAiCallStatsApi, getAiLogListApi, getAiLogSummaryApi } from '@/api/analytics';
import { useTable } from '@/composables/useTable';
import { formatDateTime } from '@/utils/format';
import type { AiCallLogSummary, AiCallStat } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import StatCard from '@/views/home/components/StatCard.vue';
import { ref } from 'vue';

defineOptions({ name: 'AiCallLogList' });

/** 调用类型文案 */
const TYPE_LABEL: Record<string, string> = {
  sentence_gen: '生题',
  sentence_polish: '优化',
  sentence_review: '审核',
  image_gen: '生图',
  expand: '造句',
  word_root: '词根',
  sentence_card_gen: '句签',
};

/**
 * 关联 ID 按类型解释（表格列上做 title 提示，避免运营对着一串数字猜）。
 * 注意：`word_root` 同时覆盖「AI 拆解」与「词典查词失败后的实时解析」两条路径
 * （上游 Provider 只记一个 type），所以带 ID 的是用户触发的那些，不带的多为每日收录任务。
 */
const BIZ_HINT: Record<string, string> = {
  expand: '客户端用户 id',
  word_root: '客户端用户 id（用户触发时）',
  sentence_gen: '生成批次 id',
  sentence_polish: '生成批次 id',
  sentence_review: '生成批次 id',
  sentence_card_gen: '句签业务日期',
  image_gen: '无关联（恒 0）',
};

/** 统计卡配色（按类型轮换） */
const STAT_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706'];

/** 筛选条件（关联 id 用字符串承接，提交时转数字；空串不下传） */
const filters = ref({ type: '', status: '', bizId: '', dateStart: '', dateEnd: '' });

/** 列表参数：把空串去掉，避免把空值传给后端 */
function listParams(p: { page: number; pageSize: number }): Record<string, unknown> {
  const f = filters.value;
  const out: Record<string, unknown> = { page: p.page, pageSize: p.pageSize };
  if (f.type) {
    out.type = f.type;
  }
  if (f.status) {
    out.status = f.status;
  }
  if (f.bizId && Number(f.bizId) > 0) {
    out.bizId = Number(f.bizId);
  }
  if (f.dateStart) {
    out.dateStart = f.dateStart;
  }
  if (f.dateEnd) {
    out.dateEnd = f.dateEnd;
  }
  return out;
}

const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) => getAiLogListApi(listParams(p) as never),
  { ...filters.value },
);

/** 当前筛选范围的汇总（每次搜索后重算）。 */
const summary = ref<AiCallLogSummary | null>(null);

/** 近 7 日按类型汇总（与筛选无关，作为大盘参考）。 */
const stats = ref<AiCallStat[]>([]);

/** 近 7 日全部类型的调用合计。 */
const statsTotal = computed(() => stats.value.reduce((sum, item) => sum + item.calls, 0));

async function loadSummary(): Promise<void> {
  summary.value = await getAiLogSummaryApi(listParams({ page: 1, pageSize: 1 }) as never).catch(() => null);
}

async function loadStats(): Promise<void> {
  stats.value = await getAiCallStatsApi(7).catch(() => []);
}

/** 搜索：同步筛选条件 → 刷新列表 + 汇总。 */
async function onSearch(): Promise<void> {
  Object.assign(query, filters.value);
  await search();
  await loadSummary();
}

/** 重置：清空筛选 → 刷新列表 + 汇总。 */
async function onReset(): Promise<void> {
  filters.value = { type: '', status: '', bizId: '', dateStart: '', dateEnd: '' };
  Object.assign(query, filters.value);
  await reset();
  await loadSummary();
}

/** token 数千分位。 */
function tokenText(value: number): string {
  return value.toLocaleString('zh-CN');
}

onMounted(async () => {
  await Promise.all([getList(), loadStats(), loadSummary()]);
});
</script>

<template>
  <div class="sentence-ai-logs-page">
    <!-- 当前筛选范围汇总：改任何筛选条件都会重算 -->
    <el-row :gutter="16" class="mb-4">
      <el-col :xs="12" :sm="6" class="my-1">
        <StatCard
          title="当前范围调用"
          :value="summary?.calls ?? 0"
          :sub="`失败 ${summary?.failed ?? 0}`"
          icon="cpu"
          :color="STAT_COLORS[0]"
        />
      </el-col>
      <el-col :xs="12" :sm="6" class="my-1">
        <StatCard
          title="Token 合计"
          :value="tokenText(summary?.totalTokens ?? 0)"
          :sub="`入 ${tokenText(summary?.promptTokens ?? 0)} · 出 ${tokenText(summary?.completionTokens ?? 0)}`"
          icon="coin"
          :color="STAT_COLORS[1]"
        />
      </el-col>
      <el-col :xs="12" :sm="6" class="my-1">
        <StatCard
          title="失败率"
          :value="`${summary?.failRate ?? 0}%`"
          :sub="`平均耗时 ${summary?.avgLatencyMs ?? 0}ms`"
          icon="activity"
          :color="STAT_COLORS[2]"
        />
      </el-col>
      <el-col :xs="12" :sm="6" class="my-1">
        <StatCard
          title="近 7 日调用"
          :value="statsTotal"
          sub="全部类型合计"
          icon="graph-up-arrow"
          :color="STAT_COLORS[3]"
        />
      </el-col>
    </el-row>

    <!-- 近 7 日按类型拆分 -->
    <el-row :gutter="16" class="mb-4">
      <el-col v-for="(item, index) in stats" :key="item.name" :xs="24" :sm="12" :md="6" class="my-1">
        <StatCard
          :title="`${TYPE_LABEL[item.name] ?? item.name}（近 7 日）`"
          :value="item.calls"
          :sub="`失败 ${item.failed} · token ${item.promptTokens + item.completionTokens}`"
          icon="cpu"
          :color="STAT_COLORS[index % STAT_COLORS.length]"
        />
      </el-col>
    </el-row>
    <el-card v-if="stats.length === 0" shadow="never" class="mb-4">
      <p class="py-6 text-center text-sm text-muted">近 7 日暂无 AI 调用记录</p>
    </el-card>

    <SearchForm @search="onSearch" @reset="onReset">
      <el-form-item label="类型">
        <el-select v-model="filters.type" placeholder="全部" clearable style="width: 130px">
          <el-option label="生题" value="sentence_gen" />
          <el-option label="优化" value="sentence_polish" />
          <el-option label="审核" value="sentence_review" />
          <el-option label="生图" value="image_gen" />
          <el-option label="造句" value="expand" />
          <el-option label="词根" value="word_root" />
          <el-option label="句签" value="sentence_card_gen" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="filters.status" placeholder="全部" clearable style="width: 110px">
          <el-option label="成功" value="success" />
          <el-option label="失败" value="failed" />
        </el-select>
      </el-form-item>
      <el-form-item label="关联 ID">
        <el-input
          v-model="filters.bizId"
          placeholder="用户 id / 批次 id"
          clearable
          style="width: 150px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="日期">
        <el-date-picker
          v-model="filters.dateStart"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="开始"
          style="width: 140px"
        />
        <span class="mx-1 text-muted">~</span>
        <el-date-picker
          v-model="filters.dateEnd"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="结束"
          style="width: 140px"
        />
      </el-form-item>
    </SearchForm>

    <el-card shadow="never" class="mt-4">
      <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3">
        <span class="text-[15px] font-semibold text-ink">AI 调用日志（共 {{ total }} 条）</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button :loading="loading" @click="getList">刷新</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border row-key="id">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="类型" width="90">
          <template #default="{ row }">{{ TYPE_LABEL[row.type] ?? row.type }}</template>
        </el-table-column>
        <el-table-column prop="provider" label="提供方" width="100" />
        <el-table-column prop="model" label="模型" min-width="180" show-overflow-tooltip />
        <el-table-column label="关联 ID" width="110">
          <template #default="{ row }">
            <span v-if="row.bizId > 0" :title="BIZ_HINT[row.type] ?? ''">{{ row.bizId }}</span>
            <span v-else class="text-faint">—</span>
          </template>
        </el-table-column>
        <el-table-column label="Token" width="130">
          <template #default="{ row }">{{ row.promptTokens }} / {{ row.completionTokens }}</template>
        </el-table-column>
        <el-table-column label="耗时" width="100">
          <template #default="{ row }">{{ row.latencyMs }} ms</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">
              {{ row.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="errorMessage" label="错误摘要" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.errorMessage ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>

      <Pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @size-change="changePageSize"
        @current-change="changePage"
      />
    </el-card>
  </div>
</template>
