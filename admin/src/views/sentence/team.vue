<script setup lang="ts">
/**
 * 学习小队管理页（「短句」运营后台，路由 /sentence/team）。
 * 顶部统计卡（进行中/已解散小队、在队用户、今日全员达成）；
 * 下方小队分页表（按状态/队名/最少人数筛选），抽屉看成员与今日打卡，
 * 可解散违规/不当小队、修正队名。
 *
 * 权限：team:view 查看，team:handle 解散/改名（v-permission，与种子菜单一致）。
 */
import BasicDialog from '@/components/BasicDialog/index.vue';
import { ElMessage, ElMessageBox } from '@/utils/element';
import { dissolveTeamApi, getTeamDetailApi, getTeamListApi, getTeamStatsApi, renameTeamApi } from '@/api/team';
import { useTable } from '@/composables/useTable';
import { useTablePage } from '@/composables/useTablePage';
import { formatDateTime } from '@/utils/format';
import type { TeamAdminDetail, TeamAdminItem, TeamAdminStats } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'SentenceTeam' });

const { tableHeight } = useTablePage();

/* ------------------------------ 统计卡 ------------------------------ */
const stats = ref<TeamAdminStats | null>(null);
async function loadStats(): Promise<void> {
  stats.value = await getTeamStatsApi();
}

/* ------------------------------ 小队列表 ------------------------------ */
const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getTeamListApi({
      page: p.page,
      pageSize: p.pageSize,
      status: p.status || 'active',
      keyword: p.keyword?.trim() || undefined,
      minMembers: p.minMembers || undefined,
    }),
  { status: 'active', keyword: '', minMembers: undefined as number | undefined },
);

const TEAM_STATUS_META: Record<string, { label: string; type: 'success' | 'info' }> = {
  active: { label: '进行中', type: 'success' },
  dissolved: { label: '已解散', type: 'info' },
};

/* ------------------------------ 详情抽屉 ------------------------------ */
const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<TeamAdminDetail | null>(null);

async function openDetail(row: TeamAdminItem): Promise<void> {
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  try {
    detail.value = await getTeamDetailApi(row.id);
  } finally {
    detailLoading.value = false;
  }
}

/* ------------------------------ 解散 / 改名 ------------------------------ */
async function dissolve(row: TeamAdminItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定解散「${row.name}」吗？\n会清空全部 ${row.memberCount} 名成员（他们可重新匹配），小队置为已解散。`,
      '解散小队',
      { type: 'warning', confirmButtonText: '解散', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  await dissolveTeamApi(row.id);
  ElMessage.success('已解散');
  await Promise.all([getList(), loadStats()]);
  if (detailVisible.value && detail.value?.id === row.id) detailVisible.value = false;
}

const renameVisible = ref(false);
const renameTarget = ref<TeamAdminItem | null>(null);
const renameValue = ref('');
const renaming = ref(false);

function openRename(row: TeamAdminItem): void {
  renameTarget.value = row;
  renameValue.value = row.name;
  renameVisible.value = true;
}

async function saveRename(): Promise<void> {
  const name = renameValue.value.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 20) {
    ElMessage.warning('小队名 2~20 个字');
    return;
  }
  if (!renameTarget.value) return;
  renaming.value = true;
  try {
    await renameTeamApi(renameTarget.value.id, name);
    ElMessage.success('已更新小队名');
    renameVisible.value = false;
    await Promise.all([getList(), loadStats()]);
    if (detail.value?.id === renameTarget.value.id) {
      detail.value = await getTeamDetailApi(renameTarget.value.id);
    }
  } finally {
    renaming.value = false;
  }
}

onMounted(() => {
  void loadStats();
  void getList();
});
</script>

<template>
  <div class="sentence-team-page table-page">
    <!-- 统计卡 -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <el-card shadow="never" class="stat-card">
        <p class="text-xs text-gray-400">进行中小队</p>
        <p class="mt-1 text-2xl font-bold text-ink">{{ stats?.activeTeamCount ?? '—' }}</p>
      </el-card>
      <el-card shadow="never" class="stat-card">
        <p class="text-xs text-gray-400">在队用户</p>
        <p class="mt-1 text-2xl font-bold text-ink">{{ stats?.inTeamUserCount ?? '—' }}</p>
      </el-card>
      <el-card shadow="never" class="stat-card">
        <p class="text-xs text-gray-400">今日全员达成</p>
        <p class="mt-1 text-2xl font-bold text-emerald-500">{{ stats?.todayFullTeamCount ?? '—' }}</p>
      </el-card>
      <el-card shadow="never" class="stat-card">
        <p class="text-xs text-gray-400">已解散小队</p>
        <p class="mt-1 text-2xl font-bold text-gray-400">{{ stats?.dissolvedTeamCount ?? '—' }}</p>
      </el-card>
    </div>

    <SearchForm class="mt-4 table-page__filter" @search="search" @reset="reset">
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 130px">
          <el-option label="进行中" value="active" />
          <el-option label="已解散" value="dissolved" />
        </el-select>
      </el-form-item>
      <el-form-item label="队名">
        <el-input v-model="query.keyword" placeholder="关键词" clearable style="width: 160px" @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="最少人数">
        <el-input
          v-model.number="query.minMembers"
          placeholder="如 3"
          clearable
          style="width: 100px"
          @keyup.enter="search"
        />
      </el-form-item>
    </SearchForm>

    <el-card shadow="never" class="mt-4 table-page__card">
      <div class="mb-3 flex items-center justify-between">
        <span class="text-[15px] font-semibold text-ink">学习小队（共 {{ total }} 支）</span>
        <div class="flex gap-2">
          <el-button :loading="loading" @click="getList">刷新</el-button>
        </div>
      </div>

      <div class="table-page__table">
        <el-table v-loading="loading" :data="list" border row-key="id" :height="tableHeight">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="name" label="队名" min-width="160" show-overflow-tooltip />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="TEAM_STATUS_META[row.status]?.type ?? 'info'" size="small">
                {{ TEAM_STATUS_META[row.status]?.label ?? row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="人数" width="90" align="center">
            <template #default="{ row }">{{ row.memberCount }} / {{ row.maxMembers }}</template>
          </el-table-column>
          <el-table-column prop="streak" label="连续天数" width="90" align="center" />
          <el-table-column prop="bucket" label="分桶" width="70" align="center" />
          <el-table-column label="创建时间" width="165">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openDetail(row as TeamAdminItem)">详情</el-button>
              <el-button v-permission="'team:handle'" link type="primary" @click="openRename(row as TeamAdminItem)"
                >改名</el-button
              >
              <el-button
                v-if="row.status === 'active'"
                v-permission="'team:handle'"
                link
                type="danger"
                @click="dissolve(row as TeamAdminItem)"
              >
                解散
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

    <!-- 小队详情抽屉 -->
    <el-drawer v-model="detailVisible" title="小队详情" size="480px">
      <el-scrollbar v-loading="detailLoading" class="h-full">
        <div v-if="detail" class="space-y-4 pr-2">
          <div class="rounded-xl bg-gray-50 p-3 text-xs leading-relaxed dark:bg-gray-800">
            <p><b>队名：</b>{{ detail.name }}（#{{ detail.id }}）</p>
            <p>
              <b>状态：</b>{{ TEAM_STATUS_META[detail.status]?.label ?? detail.status }} · 连续 {{ detail.streak }} 天
            </p>
            <p v-if="detail.lastFullDate"><b>最近全员：</b>{{ detail.lastFullDate }}</p>
          </div>
          <div>
            <p class="mb-2 text-xs font-semibold text-gray-500">成员（{{ detail.members.length }}）</p>
            <div
              v-for="m in detail.members"
              :key="m.userId"
              class="mb-2 flex items-center gap-2 rounded-xl border border-gray-200 p-2.5 dark:border-gray-700"
            >
              <div
                class="grid size-8 shrink-0 place-items-center rounded-full bg-indigo-400 text-xs font-bold text-white"
              >
                {{ m.nickname.slice(0, 1) }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">
                  {{ m.nickname }} <span class="text-xs text-gray-400">#{{ m.userId }}</span>
                </p>
                <p class="text-[11px] text-gray-400">加入于 {{ m.joinedDate }} · XP {{ m.xp }}</p>
              </div>
              <el-tag :type="m.checkedIn ? 'success' : 'info'" size="small">{{
                m.checkedIn ? '今日已打卡' : '待打卡'
              }}</el-tag>
            </div>
          </div>
        </div>
      </el-scrollbar>
    </el-drawer>

    <!-- 改名对话框 -->
    <BasicDialog v-model="renameVisible" title="修改小队名" width="420px" :close-on-click-modal="false">
      <el-form label-width="70px">
        <el-form-item label="新队名">
          <el-input
            v-model="renameValue"
            maxlength="20"
            placeholder="2~20 个字"
            show-word-limit
            @keyup.enter="saveRename"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="renameVisible = false">取消</el-button>
        <el-button type="primary" :loading="renaming" @click="saveRename">保存</el-button>
      </template>
    </BasicDialog>
  </div>
</template>
