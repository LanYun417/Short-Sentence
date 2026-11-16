<script setup lang="ts">
/**
 * 成长体系管理页（「短句」运营后台）。
 * 模块职责：成就展示字段编辑（code 为判定键不可改）/ XP 账本审计 / 手动补偿 XP / 统计总览。
 *
 * 红线（与 gamify.prisma 一致）：只加不减——后台不提供扣减入口，手动操作只有正向补偿；
 * 补偿绕过每日上限（运营主动行为），但走唯一 event_key 幂等 + remark 审计。
 *
 * 权限：v-permission（sentence:gamify / sentence:gamify:edit / sentence:gamify:handle），与种子菜单一致。
 */
import { ElMessage } from '@/utils/element';
import {
  getAchievementListApi,
  getGamifyStatsApi,
  getXpLogListApi,
  grantXpApi,
  updateAchievementApi,
} from '@/api/gamify';
import { useTable } from '@/composables/useTable';
import { formatDateTime } from '@/utils/format';
import type { AchievementAdminItem, GamifyAdminStats } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import BasicDialog from '@/components/BasicDialog/index.vue';
import StatCard from '@/views/home/components/StatCard.vue';
import { computed, onMounted, ref } from 'vue';

defineOptions({ name: 'SentenceGamify' });

const CATEGORY_LABEL: Record<string, string> = { persist: '坚持', behavior: '行为', luck: '运气' };
const CATEGORY_TAG: Record<string, 'warning' | 'primary' | 'success'> = {
  persist: 'warning',
  behavior: 'primary',
  luck: 'success',
};

/* ------------------------------ 统计总览 ------------------------------ */

const stats = ref<GamifyAdminStats | null>(null);

/** 事件类型下拉选项（来自统计聚合，永远与库里实际口径一致）。 */
const eventTypeOptions = computed(() =>
  (stats.value?.byEventType ?? []).map((e) => ({ value: e.eventType, label: e.label || e.eventType })),
);

async function loadStats(): Promise<void> {
  stats.value = await getGamifyStatsApi();
}

onMounted(async () => {
  await loadStats();
  await loadAchievements();
});

/* ------------------------------ 成就列表 ------------------------------ */

const achievements = ref<AchievementAdminItem[]>([]);
const achievementsLoading = ref(false);

async function loadAchievements(): Promise<void> {
  achievementsLoading.value = true;
  try {
    achievements.value = await getAchievementListApi();
  } finally {
    achievementsLoading.value = false;
  }
}

const editVisible = ref(false);
const saving = ref(false);
const editingCode = ref('');
const form = ref<{ name: string; description: string; icon: string; category: string; rewardXp: number; sort: number }>(
  {
    name: '',
    description: '',
    icon: '',
    category: 'behavior',
    rewardXp: 0,
    sort: 0,
  },
);

function handleEdit(row: AchievementAdminItem): void {
  editingCode.value = row.code;
  form.value = {
    name: row.name,
    description: row.description,
    icon: row.icon,
    category: row.category,
    rewardXp: row.rewardXp,
    sort: row.sort,
  };
  editVisible.value = true;
}

async function handleSaveAchievement(): Promise<void> {
  if (!form.value.name.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  if (!form.value.icon.trim()) {
    ElMessage.warning('图标名不能为空（lucide 图标名，如 trophy）');
    return;
  }
  saving.value = true;
  try {
    await updateAchievementApi(editingCode.value, {
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      icon: form.value.icon.trim(),
      category: form.value.category,
      rewardXp: form.value.rewardXp,
      sort: form.value.sort,
    });
    ElMessage.success('已保存');
    editVisible.value = false;
    await loadAchievements();
  } finally {
    saving.value = false;
  }
}

/* ------------------------------ XP 账本 ------------------------------ */

const { loading, list, total, query, search, reset, changePage, changePageSize } = useTable(
  (p) =>
    getXpLogListApi({
      page: p.page,
      pageSize: p.pageSize,
      keyword: p.keyword?.trim() || undefined,
      eventType: p.eventType || undefined,
      dateFrom: p.dateRange?.[0] || undefined,
      dateTo: p.dateRange?.[1] || undefined,
    }),
  { keyword: '', eventType: undefined as string | undefined, dateRange: null as [string, string] | null },
);

/* ------------------------------ 手动补偿 XP ------------------------------ */

const grantVisible = ref(false);
const granting = ref(false);
const grantForm = ref<{ email: string; amount: number; reason: string }>({ email: '', amount: 50, reason: '' });

function openGrant(): void {
  grantForm.value = { email: '', amount: 50, reason: '' };
  grantVisible.value = true;
}

async function handleGrant(): Promise<void> {
  if (!grantForm.value.email.trim()) {
    ElMessage.warning('请输入目标用户邮箱');
    return;
  }
  if (grantForm.value.reason.trim().length < 2) {
    ElMessage.warning('请填写补偿原因（至少 2 字，写入账本审计）');
    return;
  }
  granting.value = true;
  try {
    const res = await grantXpApi({
      email: grantForm.value.email.trim(),
      amount: grantForm.value.amount,
      reason: grantForm.value.reason.trim(),
    });
    ElMessage.success(res.granted ? `已补偿，用户当前 XP ${res.balance}` : '重复提交，未重复发放');
    grantVisible.value = false;
    await search();
    await loadStats();
  } finally {
    granting.value = false;
  }
}
</script>

<template>
  <!--
    多区块页面：统计卡 + 来源分布 + 成就表 + XP 账本。
    不套 .table-page 固定布局——那套只适合「筛选 + 单表 + 分页」的三段式页面，
    这里若沿用会让几个卡片争抢剩余高度，账本表被压成一条。
    改为整页正常滚动，两块表格各自给固定高度、表体内部滚动。
  -->
  <div class="sentence-gamify-page">
    <!-- 统计总览 -->
    <div class="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard title="累计发放 XP" :value="stats?.totalXpIssued ?? '—'" icon="award" color="#f59e0b" />
      <StatCard title="今日发放 XP" :value="stats?.todayXp ?? '—'" icon="lightning-charge" color="#ef4444" />
      <StatCard title="账本条数" :value="stats?.logCount ?? '—'" icon="list-ol" color="#6366f1" />
      <StatCard title="成就解锁人次" :value="stats?.unlockTotal ?? '—'" icon="trophy" color="#10b981" />
    </div>

    <!-- 按事件类型聚合 -->
    <el-card v-if="stats?.byEventType?.length" shadow="never" class="mb-3">
      <p class="mb-2 text-[13px] font-semibold text-ink">XP 来源分布（按事件类型）</p>
      <div class="flex flex-wrap gap-2">
        <el-tag v-for="e in stats.byEventType" :key="e.eventType" size="small" type="info">
          {{ e.label || e.eventType }}：{{ e.sum }} XP / {{ e.count }} 次
        </el-tag>
      </div>
    </el-card>

    <!-- 成就列表 -->
    <el-card shadow="never" class="mb-3">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-y-2">
        <span class="text-[15px] font-semibold text-ink"
          >成就定义（共 {{ achievements.length }} 个，code 为判定键不可改）</span
        >
        <el-button :loading="achievementsLoading" @click="loadAchievements">刷新</el-button>
      </div>
      <el-table v-loading="achievementsLoading" :data="achievements" border row-key="code" :max-height="360">
        <el-table-column label="图标" width="60">
          <template #default="{ row }">
            <el-icon :size="18"><i :class="`bi bi-${row.icon}`" /></el-icon>
          </template>
        </el-table-column>
        <el-table-column prop="code" label="code" width="150" />
        <el-table-column prop="name" label="名称" width="140" />
        <el-table-column label="分组" width="80">
          <template #default="{ row }">
            <el-tag :type="CATEGORY_TAG[row.category] ?? 'info'" size="small">
              {{ CATEGORY_LABEL[row.category] ?? row.category }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="条件描述" min-width="220" show-overflow-tooltip />
        <el-table-column prop="rewardXp" label="奖励XP" width="80" />
        <el-table-column prop="sort" label="排序" width="70" />
        <el-table-column prop="unlockCount" label="解锁人数" width="90" />
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button
              v-permission="'sentence:gamify:edit'"
              link
              type="primary"
              @click="handleEdit(row as AchievementAdminItem)"
            >
              编辑
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- XP 账本 -->
    <el-card shadow="never">
      <SearchForm @search="search" @reset="reset">
        <el-form-item label="用户">
          <el-input
            v-model="query.keyword"
            placeholder="邮箱 / 昵称"
            clearable
            style="width: 200px"
            @keyup.enter="search"
          />
        </el-form-item>
        <el-form-item label="事件类型">
          <el-select v-model="query.eventType" placeholder="全部" clearable style="width: 200px">
            <el-option v-for="t in eventTypeOptions" :key="t.value" :label="t.label" :value="t.value" />
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
        <span class="text-[15px] font-semibold text-ink">XP 账本（共 {{ total }} 条，只加不减）</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button v-permission="'sentence:gamify:handle'" type="primary" @click="openGrant">手动补偿 XP</el-button>
          <el-button :loading="loading" @click="search">刷新</el-button>
        </div>
      </div>

      <!-- 固定高度：给足可视行数，数据多时表体内部滚动（不再被上面的卡片挤扁） -->
      <el-table v-loading="loading" :data="list" border row-key="id" height="560">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="事件类型" width="180">
          <template #default="{ row }">
            <el-tooltip :content="row.eventType" placement="top" :show-after="400">
              <span>{{ row.eventLabel || row.eventType }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="XP" width="70">
          <template #default="{ row }">
            <span class="font-semibold text-amber-600">+{{ row.amount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="190">
          <template #default="{ row }">
            <div class="text-sm text-ink">{{ row.nickname || `用户 ${row.userId}` }}</div>
            <div class="text-xs text-muted">{{ row.email }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '—' }}</template>
        </el-table-column>
        <el-table-column prop="eventKey" label="幂等键" min-width="180" show-overflow-tooltip />
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>

      <Pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        class="mt-3"
        :total="total"
        @size-change="changePageSize"
        @current-change="changePage"
      />
    </el-card>

    <!-- 编辑成就 -->
    <BasicDialog
      v-model="editVisible"
      title="编辑成就"
      width="560px"
      :confirm-loading="saving"
      @confirm="handleSaveAchievement"
    >
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="mb-4"
        :title="`成就 code：${editingCode} —— code 是判定映射键（ACHIEVEMENT_CONDITIONS），不可修改，也不可新增/删除`"
      />
      <el-form label-width="90px">
        <el-form-item label="名称">
          <el-input v-model="form.name" maxlength="50" show-word-limit placeholder="成就名称" />
        </el-form-item>
        <el-form-item label="条件描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            maxlength="200"
            show-word-limit
            placeholder="展示给用户的达成条件描述"
          />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="form.icon" maxlength="100" placeholder="lucide 图标名，如 trophy、flame" />
        </el-form-item>
        <el-form-item label="分组">
          <el-select v-model="form.category" style="width: 160px">
            <el-option label="坚持" value="persist" />
            <el-option label="行为" value="behavior" />
            <el-option label="运气" value="luck" />
          </el-select>
        </el-form-item>
        <el-form-item label="奖励 XP">
          <el-input-number v-model="form.rewardXp" :min="0" :max="10000" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="9999" />
        </el-form-item>
      </el-form>
    </BasicDialog>

    <!-- 手动补偿 XP -->
    <BasicDialog
      v-model="grantVisible"
      title="手动补偿 XP"
      width="480px"
      :confirm-loading="granting"
      @confirm="handleGrant"
    >
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        class="mb-4"
        title="只加不减：本操作只有正向补偿，无扣减入口；补偿绕过每日上限，但写入账本（event_key 幂等 + remark 审计）"
      />
      <el-form label-width="90px">
        <el-form-item label="用户邮箱">
          <el-input v-model="grantForm.email" placeholder="client_user 邮箱" clearable />
        </el-form-item>
        <el-form-item label="补偿 XP">
          <el-input-number v-model="grantForm.amount" :min="1" :max="100000" />
        </el-form-item>
        <el-form-item label="原因">
          <el-input
            v-model="grantForm.reason"
            type="textarea"
            :rows="2"
            maxlength="200"
            show-word-limit
            placeholder="补偿原因（必填，写入账本 remark 审计）"
          />
        </el-form-item>
      </el-form>
    </BasicDialog>
  </div>
</template>
