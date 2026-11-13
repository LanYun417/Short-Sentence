<script setup lang="ts">
/**
 * 音标管理页（「短句」运营后台）。
 * 模块职责：音标库内容编辑（类型/示例词/要点/排序；symbol 为业务主键不可改）+ 重置种子 +
 * 学习统计（总览卡 + 近 7 天趋势 + 学会人数 Top5）+ 学习记录审计。
 *
 * 数据从哪来：/api/ipa（IpaAdminController）。音标库是 48 条种子写入的静态参考数据，
 * 后台只开放内容编辑、不开放增删；改 symbol 会让 XP 幂等键失效导致重复发奖，故不开放。
 *
 * 权限：v-permission（sentence:ipa / sentence:ipa:edit / sentence:ipa:handle），与种子菜单一致。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import {
  getIpaPhonemeListApi,
  getIpaRecordListApi,
  getIpaStatsApi,
  resetIpaSeedsApi,
  updateIpaPhonemeApi,
} from '@/api/ipa';
import { useTable } from '@/composables/useTable';
import { useTablePage } from '@/composables/useTablePage';
import { formatDateTime } from '@/utils/format';
import type { IpaAdminPhoneme, IpaAdminStats } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import BasicDialog from '@/components/BasicDialog/index.vue';
import StatCard from '@/views/home/components/StatCard.vue';
import { computed, onMounted, ref, watch } from 'vue';

defineOptions({ name: 'SentenceIpa' });

const { tableHeight } = useTablePage();

/** 音标类型选项（与后端 IPA_PHONEME_TYPES 一致）。 */
const TYPE_OPTIONS = [
  { label: '单元音', value: 'vowel' },
  { label: '双元音', value: 'diphthong' },
  { label: '清辅音', value: 'consonant_voiceless' },
  { label: '浊辅音', value: 'consonant_voiced' },
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));
const TYPE_TAG: Record<string, 'primary' | 'success' | 'warning' | 'info'> = {
  vowel: 'primary',
  diphthong: 'success',
  consonant_voiceless: 'warning',
  consonant_voiced: 'info',
};

/* ------------------------------ 统计总览 ------------------------------ */

const stats = ref<IpaAdminStats | null>(null);

async function loadStats(): Promise<void> {
  stats.value = await getIpaStatsApi();
}

onMounted(loadStats);

const maxTrend = computed(() => Math.max(1, ...(stats.value?.trend ?? []).map((t) => t.count)));
const maxTop = computed(() => Math.max(1, ...(stats.value?.top ?? []).map((t) => t.count)));

/** 趋势柱高度（百分比，最低 6% 保证 0 值也看得见柱子）。 */
function trendHeight(count: number): number {
  return Math.max(6, Math.round((count / maxTrend.value) * 100));
}

/* ------------------------------ 音标列表 ------------------------------ */

const { loading, list, total, query, search, reset, changePage, changePageSize } = useTable(
  (p) =>
    getIpaPhonemeListApi({
      page: p.page,
      pageSize: p.pageSize,
      keyword: p.keyword?.trim() || undefined,
      type: p.type || undefined,
    }),
  { keyword: '', type: undefined as string | undefined },
);

/* ------------------------------ 编辑 ------------------------------ */

const editVisible = ref(false);
const saving = ref(false);
const editing = ref<IpaAdminPhoneme | null>(null);
const form = ref<{ type: string; exampleWords: string[]; tips: string; sort: number }>({
  type: 'vowel',
  exampleWords: [],
  tips: '',
  sort: 0,
});

function handleEdit(row: IpaAdminPhoneme): void {
  editing.value = row;
  form.value = { type: row.type, exampleWords: [...row.exampleWords], tips: row.tips, sort: row.sort };
  editVisible.value = true;
}

async function handleSave(): Promise<void> {
  if (!editing.value) {
    return;
  }
  const words = form.value.exampleWords.map((w) => w.trim()).filter(Boolean);
  if (words.length < 2) {
    ElMessage.warning('示例词至少 2 个');
    return;
  }
  if (words.length > 6) {
    ElMessage.warning('示例词最多 6 个');
    return;
  }
  saving.value = true;
  try {
    await updateIpaPhonemeApi(editing.value.id, {
      type: form.value.type,
      exampleWords: words,
      tips: form.value.tips.trim(),
      sort: form.value.sort,
    });
    ElMessage.success('保存成功');
    editVisible.value = false;
    await search();
    await loadStats();
  } finally {
    saving.value = false;
  }
}

/* ------------------------------ 重置种子 ------------------------------ */

async function handleResetSeeds(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '按内置种子重置全部 48 个音标的内容（类型/示例词/要点/排序）？手动修改会被覆盖。',
      '重置音标种子',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  const res = await resetIpaSeedsApi();
  ElMessage.success(`已重置 ${res.updated} 个音标`);
  await search();
  await loadStats();
}

/* ------------------------------ 学习记录 ------------------------------ */

const recordsVisible = ref(false);
const {
  loading: recordsLoading,
  list: records,
  total: recordsTotal,
  query: recordsQuery,
  search: searchRecords,
  changePage: changeRecordsPage,
  changePageSize: changeRecordsPageSize,
} = useTable(
  (p) =>
    getIpaRecordListApi({
      page: p.page,
      pageSize: p.pageSize,
      keyword: p.keyword?.trim() || undefined,
    }),
  { keyword: '' },
  { immediate: false },
);

watch(recordsVisible, (visible) => {
  if (visible) {
    searchRecords();
  }
});
</script>

<template>
  <div class="sentence-ipa-page table-page">
    <!-- 统计总览 -->
    <div class="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard title="音标总数" :value="stats?.totalPhonemes ?? '—'" icon="mic" color="#6366f1" />
      <StatCard title="累计学会标记" :value="stats?.totalLearned ?? '—'" icon="award" color="#f59e0b" />
      <StatCard title="学习用户数" :value="stats?.learnerCount ?? '—'" icon="people" color="#10b981" />
      <StatCard title="今日学会" :value="stats?.todayLearned ?? '—'" icon="lightning-charge" color="#ef4444" />
    </div>

    <!-- 趋势 + Top5 -->
    <div class="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
      <el-card shadow="never" class="table-page__card">
        <p class="mb-3 text-[13px] font-semibold text-ink">近 7 天学会标记</p>
        <div class="flex h-24 items-end gap-2">
          <div v-for="t in stats?.trend ?? []" :key="t.date" class="flex flex-1 flex-col items-center gap-1">
            <span class="text-[10px] tabular-nums text-muted">{{ t.count }}</span>
            <div
              class="w-full rounded-t bg-[var(--el-color-primary)] opacity-80"
              :style="{ height: `${trendHeight(t.count)}%` }"
            ></div>
            <span class="text-[10px] text-muted">{{ t.date }}</span>
          </div>
        </div>
      </el-card>
      <el-card shadow="never" class="table-page__card">
        <p class="mb-3 text-[13px] font-semibold text-ink">学会人数最多 Top5</p>
        <div v-if="stats?.top?.length" class="space-y-2.5">
          <div v-for="t in stats.top" :key="t.symbol" class="flex items-center gap-2">
            <span class="w-14 shrink-0 font-mono text-sm text-ink">/{{ t.symbol }}/</span>
            <el-progress
              class="flex-1"
              :percentage="Math.round((t.count / maxTop) * 100)"
              :stroke-width="8"
              :show-text="false"
            />
            <span class="w-10 shrink-0 text-right text-xs tabular-nums text-muted">{{ t.count }}</span>
          </div>
        </div>
        <p v-else class="py-6 text-center text-sm text-muted">暂无学习记录</p>
      </el-card>
    </div>

    <!-- 音标库 -->
    <el-card shadow="never" class="table-page__card">
      <SearchForm class="table-page__filter" @search="search" @reset="reset">
        <el-form-item label="关键字">
          <el-input
            v-model="query.keyword"
            placeholder="音标 / 示例词 / 要点"
            clearable
            style="width: 200px"
            @keyup.enter="search"
          />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="query.type" placeholder="全部" clearable style="width: 130px">
            <el-option v-for="o in TYPE_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
      </SearchForm>

      <div class="table-page__toolbar mb-3 flex flex-wrap items-center justify-between gap-y-2">
        <span class="text-[15px] font-semibold text-ink">音标库（共 {{ total }} 个）</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button @click="recordsVisible = true">学习记录</el-button>
          <el-button v-permission="'sentence:ipa:handle'" type="warning" plain @click="handleResetSeeds">
            重置种子
          </el-button>
          <el-button :loading="loading" @click="search">刷新</el-button>
        </div>
      </div>

      <div class="table-page__table">
        <el-table v-loading="loading" :data="list" border row-key="id" :height="tableHeight">
          <el-table-column label="音标" width="110">
            <template #default="{ row }">
              <span class="font-mono text-[15px] font-semibold text-ink">/{{ row.symbol }}/</span>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="90">
            <template #default="{ row }">
              <el-tag :type="TYPE_TAG[row.type] ?? 'info'" size="small">{{ TYPE_LABEL[row.type] ?? row.type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="示例词" min-width="180">
            <template #default="{ row }">
              <el-tag v-for="w in row.exampleWords" :key="w" size="small" type="info" class="mr-1">{{ w }}</el-tag>
              <span v-if="!row.exampleWords.length" class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="tips" label="发音要点" min-width="220" show-overflow-tooltip />
          <el-table-column prop="sort" label="排序" width="70" />
          <el-table-column prop="learnedCount" label="学会人数" width="90" />
          <el-table-column label="创建时间" width="160">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="90" fixed="right">
            <template #default="{ row }">
              <el-button
                v-permission="'sentence:ipa:edit'"
                link
                type="primary"
                @click="handleEdit(row as IpaAdminPhoneme)"
              >
                编辑
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <Pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        class="table-page__pagination"
        :total="total"
        @size-change="changePageSize"
        @current-change="changePage"
      />
    </el-card>

    <!-- 编辑音标 -->
    <BasicDialog v-model="editVisible" title="编辑音标" width="560px" :confirm-loading="saving" @confirm="handleSave">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="mb-4"
        :title="`/${editing?.symbol}/ —— 符号是业务主键（XP 发奖幂等键的一部分），不可修改`"
      />
      <el-form label-width="90px">
        <el-form-item label="类型">
          <el-select v-model="form.type" style="width: 200px">
            <el-option v-for="o in TYPE_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="示例词">
          <el-select
            v-model="form.exampleWords"
            multiple
            filterable
            allow-create
            :multiple-limit="6"
            placeholder="输入示例词后回车添加（2~6 个）"
            style="width: 100%"
          >
            <el-option v-for="w in form.exampleWords" :key="w" :label="w" :value="w" />
          </el-select>
        </el-form-item>
        <el-form-item label="发音要点">
          <el-input
            v-model="form.tips"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="口型要点、常见错误"
          />
        </el-form-item>
        <el-form-item label="组内排序">
          <el-input-number v-model="form.sort" :min="0" :max="999" />
        </el-form-item>
      </el-form>
    </BasicDialog>

    <!-- 学习记录 -->
    <BasicDialog v-model="recordsVisible" title="音标学习记录" width="860px" :show-footer="false">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <el-input
          v-model="recordsQuery.keyword"
          placeholder="搜索音标 / 用户邮箱或昵称"
          clearable
          style="width: 260px"
          @keyup.enter="searchRecords"
          @clear="searchRecords"
        />
        <el-button type="primary" :loading="recordsLoading" @click="searchRecords">搜索</el-button>
      </div>
      <el-table v-loading="recordsLoading" :data="records" border :height="380" row-key="id">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="用户" min-width="200">
          <template #default="{ row }">
            <div class="text-sm text-ink">{{ row.nickname || `用户 ${row.userId}` }}</div>
            <div class="text-xs text-muted">{{ row.email }}</div>
          </template>
        </el-table-column>
        <el-table-column label="音标" width="110">
          <template #default="{ row }">
            <span class="font-mono text-sm">/{{ row.symbol }}/</span>
          </template>
        </el-table-column>
        <el-table-column label="学会时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.learnedAt) }}</template>
        </el-table-column>
      </el-table>
      <Pagination
        v-model:current-page="recordsQuery.page"
        v-model:page-size="recordsQuery.pageSize"
        class="mt-3"
        :total="recordsTotal"
        @size-change="changeRecordsPageSize"
        @current-change="changeRecordsPage"
      />
    </BasicDialog>
  </div>
</template>
