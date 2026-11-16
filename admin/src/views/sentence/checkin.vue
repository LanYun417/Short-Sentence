<script setup lang="ts">
/**
 * 打卡管理页（「短句」运营后台）。
 * 模块职责：近 30 天打卡热力图 + 今日汇总 + 打卡记录审计 + 补签 / 撤销（幂等、重算 streak、操作日志留痕）。
 *
 * 补签不会触发小队结算（队伍连续天数以真实答题链路为准），原因写在操作日志 params 里。
 *
 * 权限：v-permission（sentence:checkin 查看 / sentence:checkin:handle 补签撤销），与种子菜单一致。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import { backfillCheckinApi, getCheckinRecordListApi, getCheckinStatsApi, revokeCheckinApi } from '@/api/checkin';
import { useTable } from '@/composables/useTable';
import { useTablePage } from '@/composables/useTablePage';
import type { CheckinAdminStats } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import BasicDialog from '@/components/BasicDialog/index.vue';
import StatCard from '@/views/home/components/StatCard.vue';
import { computed, onMounted, ref } from 'vue';

defineOptions({ name: 'SentenceCheckin' });

const { tableHeight } = useTablePage();

/* ------------------------------ 统计 + 热力图 ------------------------------ */

const stats = ref<CheckinAdminStats | null>(null);

async function loadStats(): Promise<void> {
  stats.value = await getCheckinStatsApi(30);
}

onMounted(loadStats);

/** 热力图颜色：按完成率分 5 档。 */
function heatColor(rate: number): string {
  if (rate >= 60) return 'var(--el-color-primary)';
  if (rate >= 40) return 'color-mix(in srgb, var(--el-color-primary) 70%, white)';
  if (rate >= 20) return 'color-mix(in srgb, var(--el-color-primary) 45%, white)';
  if (rate > 0) return 'color-mix(in srgb, var(--el-color-primary) 20%, white)';
  return 'var(--el-fill-color-light)';
}

const heatDays = computed(() => stats.value?.days ?? []);

/* ------------------------------ 记录列表 ------------------------------ */

const { loading, list, total, query, search, reset, changePage, changePageSize } = useTable(
  (p) =>
    getCheckinRecordListApi({
      page: p.page,
      pageSize: p.pageSize,
      keyword: p.keyword?.trim() || undefined,
      dateFrom: p.dateRange?.[0] || undefined,
      dateTo: p.dateRange?.[1] || undefined,
      completed: p.completed || undefined,
    }),
  {
    keyword: '',
    completed: undefined as string | undefined,
    dateRange: null as [string, string] | null,
  },
);

/* ------------------------------ 补签 / 撤销 ------------------------------ */

const opVisible = ref(false);
const opMode = ref<'backfill' | 'revoke'>('backfill');
const opSaving = ref(false);
const opForm = ref<{ email: string; date: string; reason: string }>({ email: '', date: '', reason: '' });

function openOp(mode: 'backfill' | 'revoke'): void {
  opMode.value = mode;
  opForm.value = { email: '', date: '', reason: '' };
  opVisible.value = true;
}

async function handleOpConfirm(): Promise<void> {
  if (!opForm.value.email.trim()) {
    ElMessage.warning('请输入用户邮箱');
    return;
  }
  if (!opForm.value.date) {
    ElMessage.warning('请选择日期');
    return;
  }
  if (opForm.value.reason.trim().length < 2) {
    ElMessage.warning('请填写原因（至少 2 字，写入操作日志）');
    return;
  }
  if (opMode.value === 'revoke') {
    try {
      await ElMessageBox.confirm(`确定撤销该用户 ${opForm.value.date} 的打卡记录吗？连续天数会重算。`, '撤销打卡', {
        type: 'warning',
      });
    } catch {
      return;
    }
  }
  opSaving.value = true;
  try {
    const payload = { email: opForm.value.email.trim(), date: opForm.value.date, reason: opForm.value.reason.trim() };
    const res = opMode.value === 'backfill' ? await backfillCheckinApi(payload) : await revokeCheckinApi(payload);
    ElMessage.success(
      opMode.value === 'backfill' ? '补签完成' : (res as { revoked: boolean }).revoked ? '已撤销' : '当日无记录',
    );
    opVisible.value = false;
    await search();
    await loadStats();
  } finally {
    opSaving.value = false;
  }
}
</script>

<template>
  <div class="sentence-checkin-page table-page">
    <!-- 今日汇总 -->
    <div class="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard title="今日打卡人数" :value="stats?.today.total ?? '—'" icon="calendar-check" color="#6366f1" />
      <StatCard title="今日完成目标" :value="stats?.today.completed ?? '—'" icon="check2-circle" color="#10b981" />
      <StatCard
        title="今日完成率"
        :value="stats ? `${stats.today.rate}%` : '—'"
        :sub="stats ? `启用用户 ${stats.totalUsers} 人` : undefined"
        icon="percent"
        color="#f59e0b"
      />
      <StatCard title="启用用户总数" :value="stats?.totalUsers ?? '—'" icon="people" color="#ef4444" />
    </div>

    <!-- 近 30 天热力图（固定高度展示块：标 extra，不抢打卡记录表的高度） -->
    <el-card shadow="never" class="table-page__extra mb-3">
      <p class="mb-3 text-[13px] font-semibold text-ink">近 30 天打卡热力图（颜色 = 当日完成目标人数占比）</p>
      <div class="flex flex-wrap gap-1.5">
        <div
          v-for="d in heatDays"
          :key="d.date"
          class="flex h-9 w-9 flex-col items-center justify-center rounded-md"
          :style="{ backgroundColor: heatColor(d.rate) }"
          :title="`${d.date}：打卡 ${d.total} 人，完成 ${d.completed} 人（${d.rate}%）`"
        >
          <span class="text-[9px] leading-none" :class="d.rate >= 40 ? 'text-white' : 'text-muted'">
            {{ d.date.slice(8) }}
          </span>
        </div>
      </div>
    </el-card>

    <!-- 打卡记录 -->
    <el-card shadow="never" class="table-page__card">
      <SearchForm class="table-page__filter" @search="search" @reset="reset">
        <el-form-item label="用户">
          <el-input
            v-model="query.keyword"
            placeholder="邮箱 / 昵称"
            clearable
            style="width: 200px"
            @keyup.enter="search"
          />
        </el-form-item>
        <el-form-item label="是否完成">
          <el-select v-model="query.completed" placeholder="全部" clearable style="width: 110px">
            <el-option label="已完成" value="1" />
            <el-option label="未完成" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="query.dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 240px"
            @change="search"
          />
        </el-form-item>
      </SearchForm>

      <div class="mb-3 flex flex-wrap items-center justify-between gap-y-2">
        <span class="text-[15px] font-semibold text-ink">打卡记录（共 {{ total }} 条）</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button v-permission="'sentence:checkin:handle'" type="primary" @click="openOp('backfill')"
            >补签</el-button
          >
          <el-button v-permission="'sentence:checkin:handle'" type="danger" plain @click="openOp('revoke')"
            >撤销</el-button
          >
          <el-button :loading="loading" @click="search">刷新</el-button>
        </div>
      </div>

      <div class="table-page__table">
        <el-table v-loading="loading" :data="list" border row-key="id" :height="tableHeight">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column label="用户" min-width="200">
            <template #default="{ row }">
              <div class="text-sm text-ink">{{ row.nickname || `用户 ${row.userId}` }}</div>
              <div class="text-xs text-muted">{{ row.email }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="checkinDate" label="日期" width="110" />
          <el-table-column label="进度" width="140">
            <template #default="{ row }">{{ row.doneCount }} / {{ row.goalCount }}</template>
          </el-table-column>
          <el-table-column label="是否完成" width="90">
            <template #default="{ row }">
              <el-tag :type="row.completed ? 'success' : 'info'" size="small">{{
                row.completed ? '已完成' : '未完成'
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="streak" label="连续天数" width="90" />
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

    <!-- 补签 / 撤销 -->
    <BasicDialog
      v-model="opVisible"
      :title="opMode === 'backfill' ? '补签' : '撤销打卡'"
      width="480px"
      :confirm-loading="opSaving"
      :confirm-text="opMode === 'backfill' ? '补签' : '撤销'"
      @confirm="handleOpConfirm"
    >
      <el-alert
        :type="opMode === 'backfill' ? 'info' : 'warning'"
        :closable="false"
        show-icon
        class="mb-4"
        :title="
          opMode === 'backfill'
            ? '把该用户指定日期的进度补齐到当日目标，并重算连续天数（幂等；不触发小队结算）'
            : '删除该用户指定日期的打卡记录，并重算连续天数（幂等；不可恢复）'
        "
      />
      <el-form label-width="80px">
        <el-form-item label="用户邮箱">
          <el-input v-model="opForm.email" placeholder="client_user 邮箱" clearable />
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="opForm.date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="原因">
          <el-input
            v-model="opForm.reason"
            type="textarea"
            :rows="2"
            maxlength="200"
            show-word-limit
            placeholder="原因（必填，写入操作日志 params 审计）"
          />
        </el-form-item>
      </el-form>
    </BasicDialog>
  </div>
</template>
