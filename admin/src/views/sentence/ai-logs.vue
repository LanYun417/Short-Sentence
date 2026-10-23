<script setup lang="ts">
/**
 * AI 调用日志页（「短句」运营后台）。
 * 模块职责：按类型 / 状态筛选，分页查看 AI 调用记录（token、耗时、错误摘要）。
 */
import { getAiCallStatsApi, getAiLogListApi } from '@/api/analytics';
import { useTable } from '@/composables/useTable';
import { formatDateTime } from '@/utils/format';
import type { AiCallStat } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import { ref } from 'vue';

defineOptions({ name: 'AiCallLogList' });

/** 调用类型文案 */
const TYPE_LABEL: Record<string, string> = {
  sentence_gen: '生题',
  image_gen: '生图',
  expand: '造句',
  word_root: '词根',
};

const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getAiLogListApi({ page: p.page, pageSize: p.pageSize, type: p.type || undefined, status: p.status || undefined }),
  { type: '', status: '' },
);

/** 近 7 日按类型汇总 */
const stats = ref<AiCallStat[]>([]);

async function loadStats(): Promise<void> {
  stats.value = await getAiCallStatsApi(7).catch(() => []);
}

onMounted(async () => {
  await Promise.all([getList(), loadStats()]);
});
</script>

<template>
  <div class="sentence-ai-logs-page">
    <!-- 近 7 日汇总 -->
    <div class="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div v-for="item in stats" :key="item.name" class="rounded-lg border border-gray-200 p-3">
        <p class="text-xs text-gray-400">{{ item.name }}（近 7 日）</p>
        <p class="mt-1 text-xl font-semibold">{{ item.calls }}</p>
        <p class="text-xs text-gray-400">
          失败 {{ item.failed }} · token {{ item.promptTokens + item.completionTokens }}
        </p>
      </div>
      <div
        v-if="stats.length === 0"
        class="col-span-full rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400"
      >
        近 7 日暂无 AI 调用记录
      </div>
    </div>

    <SearchForm @search="search" @reset="reset">
      <el-form-item label="类型">
        <el-select v-model="query.type" placeholder="全部" clearable style="width: 140px">
          <el-option label="生题" value="sentence_gen" />
          <el-option label="生图" value="image_gen" />
          <el-option label="造句" value="expand" />
          <el-option label="词根" value="word_root" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 120px">
          <el-option label="成功" value="success" />
          <el-option label="失败" value="failed" />
        </el-select>
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
