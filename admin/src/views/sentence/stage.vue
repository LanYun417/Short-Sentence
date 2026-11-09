<script setup lang="ts">
/**
 * 情景闯关管理页（「短句」运营后台，路由 /sentence/stage）。
 * 两个 Tab：
 * 1. 关卡总览——每章一张表，看每关的参与/通关/无翻译/待领奖统计；
 * 2. 对话会话——分页抽查用户的场景对话（筛选关卡/状态/用户/无翻译），
 *    点开抽屉看完整消息流（查 AI 质量、处理客诉），可强制结束异常会话。
 *
 * 权限：stage:view 查看，stage:handle 强制结束（v-permission，与种子菜单一致）。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import {
  closeStageSessionApi,
  getStageOverviewApi,
  getStageSessionDetailApi,
  getStageSessionListApi,
} from '@/api/stage';
import { useTable } from '@/composables/useTable';
import { formatDateTime } from '@/utils/format';
import type { StageAdminChapter, StageAdminItem, StageSessionDetail, StageSessionItem } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'SentenceStage' });

// 注意：本页**不**用 table-page 布局——总览 Tab 是多张章节表堆叠、会很长，table-page 会把
// 内容区 overflow:hidden 只允许单表格内部滚动，套 el-tabs 后高度链断裂导致整页滚不动。
// 这里整页正常滚动（content-scrollbar 默认 overflow:auto）。

const activeTab = ref<'overview' | 'sessions'>('overview');

/* ------------------------------ Tab1 关卡总览 ------------------------------ */
const chapters = ref<StageAdminChapter[]>([]);
const overviewLoading = ref(false);

async function loadOverview(): Promise<void> {
  overviewLoading.value = true;
  try {
    chapters.value = await getStageOverviewApi();
  } finally {
    overviewLoading.value = false;
  }
}

/** 总览里的关卡下拉（给会话筛选用）。 */
const stageOptions = computed(() =>
  chapters.value.flatMap((c) => c.stages.map((s) => ({ id: s.id, title: `${c.name} · ${s.title}` }))),
);

function clearRate(stage: StageAdminItem): string {
  if (stage.participantCount === 0) return '—';
  return `${Math.round((stage.clearedCount / stage.participantCount) * 100)}%`;
}

/* ------------------------------ Tab2 对话会话 ------------------------------ */
const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getStageSessionListApi({
      page: p.page,
      pageSize: p.pageSize,
      categoryId: p.categoryId || undefined,
      status: p.status || undefined,
      userId: p.userId || undefined,
      noTranslation: p.noTranslation ? '1' : undefined,
      keyword: p.keyword?.trim() || undefined,
    }),
  {
    categoryId: undefined as number | undefined,
    status: '',
    userId: undefined as number | undefined,
    keyword: '',
    noTranslation: false,
  },
);

const SESSION_STATUS_META: Record<string, { label: string; type: 'success' | 'info' | 'warning' | 'danger' }> = {
  active: { label: '进行中', type: 'warning' },
  completed: { label: '已通关', type: 'success' },
  ended: { label: '未达成结束', type: 'info' },
  abandoned: { label: '已放弃', type: 'info' },
};

/** 会话详情抽屉 */
const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<StageSessionDetail | null>(null);

async function openDetail(row: StageSessionItem): Promise<void> {
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  try {
    detail.value = await getStageSessionDetailApi(row.id);
  } finally {
    detailLoading.value = false;
  }
}

/** 强制结束进行中的会话（二次确认）。 */
async function closeSession(row: StageSessionItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定强制结束用户「${row.nickname}」在「${row.stageTitle}」的这条会话吗？\n只会把会话置为结束，不影响通关与进度。`,
      '强制结束会话',
      { type: 'warning', confirmButtonText: '结束会话', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  await closeStageSessionApi(row.id);
  ElMessage.success('已结束该会话');
  await getList();
  if (detail.value?.id === row.id) {
    detail.value = await getStageSessionDetailApi(row.id);
  }
}

onMounted(() => {
  void loadOverview();
  void getList();
});
</script>

<template>
  <div class="sentence-stage-page">
    <el-tabs v-model="activeTab" class="mt-1">
      <!-- ===================== Tab1：关卡总览 ===================== -->
      <el-tab-pane label="关卡总览" name="overview">
        <el-card v-loading="overviewLoading" shadow="never" class="mt-4">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-[15px] font-semibold text-ink">关卡数据统计</span>
            <el-button :loading="overviewLoading" @click="loadOverview">刷新</el-button>
          </div>

          <div v-for="chapter in chapters" :key="chapter.key" class="mb-6 last:mb-0">
            <div class="mb-2 flex items-baseline gap-2">
              <h3 class="text-sm font-bold text-ink">{{ chapter.name }}</h3>
              <span class="text-xs text-gray-400">{{ chapter.subtitle }}</span>
            </div>
            <el-table :data="chapter.stages" border size="small">
              <el-table-column prop="title" label="关卡" min-width="160" show-overflow-tooltip />
              <el-table-column label="目标" min-width="220" show-overflow-tooltip>
                <template #default="{ row }">
                  <span class="text-xs text-gray-500">{{ row.goal }}</span>
                </template>
              </el-table-column>
              <el-table-column label="参与用户" width="90" align="center" prop="participantCount" />
              <el-table-column label="会话数" width="80" align="center" prop="sessionCount" />
              <el-table-column label="进行中" width="80" align="center" prop="activeSessionCount" />
              <el-table-column label="通关人数" width="90" align="center" prop="clearedCount" />
              <el-table-column label="通关率" width="80" align="center">
                <template #default="{ row }">{{ clearRate(row as StageAdminItem) }}</template>
              </el-table-column>
              <el-table-column label="平均轮数" width="90" align="center">
                <template #default="{ row }">{{ row.avgClearedTurns ?? '—' }}</template>
              </el-table-column>
              <el-table-column label="无翻译通关" width="100" align="center" prop="noTranslationClearedCount" />
              <el-table-column label="待领奖" width="80" align="center" prop="claimableCount" />
              <el-table-column label="奖励XP" width="80" align="center" prop="rewardXp" />
            </el-table>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- ===================== Tab2：对话会话抽查 ===================== -->
      <el-tab-pane label="对话会话" name="sessions">
        <SearchForm class="mt-4" @search="search" @reset="reset">
          <el-form-item label="关卡">
            <el-select v-model="query.categoryId" placeholder="全部" clearable style="width: 220px">
              <el-option v-for="opt in stageOptions" :key="opt.id" :label="opt.title" :value="opt.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="query.status" placeholder="全部" clearable style="width: 130px">
              <el-option label="进行中" value="active" />
              <el-option label="已通关" value="completed" />
              <el-option label="未达成结束" value="ended" />
              <el-option label="已放弃" value="abandoned" />
            </el-select>
          </el-form-item>
          <el-form-item label="用户ID">
            <el-input
              v-model.number="query.userId"
              placeholder="精确用户"
              clearable
              style="width: 110px"
              @keyup.enter="search"
            />
          </el-form-item>
          <el-form-item label="昵称">
            <el-input
              v-model="query.keyword"
              placeholder="用户昵称"
              clearable
              style="width: 140px"
              @keyup.enter="search"
            />
          </el-form-item>
          <el-form-item label="无翻译通关">
            <el-checkbox v-model="query.noTranslation" label="只看无翻译通关" />
          </el-form-item>
        </SearchForm>

        <el-card shadow="never" class="mt-4">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-[15px] font-semibold text-ink">对话会话（共 {{ total }} 条）</span>
            <el-button :loading="loading" @click="getList">刷新</el-button>
          </div>

          <div>
            <el-table v-loading="loading" :data="list" border row-key="id">
              <el-table-column prop="id" label="ID" width="70" />
              <el-table-column label="用户" min-width="140">
                <template #default="{ row }">
                  <span class="text-sm">{{ row.nickname }}</span>
                  <span class="ml-1 text-xs text-gray-400">#{{ row.userId }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="stageTitle" label="关卡" min-width="140" show-overflow-tooltip />
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="SESSION_STATUS_META[row.status]?.type ?? 'info'" size="small">
                    {{ SESSION_STATUS_META[row.status]?.label ?? row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="轮数" width="70" align="center" prop="turnCount" />
              <el-table-column label="通关" width="70" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.cleared" type="success" size="small">是</el-tag>
                  <span v-else class="text-gray-300">—</span>
                </template>
              </el-table-column>
              <el-table-column label="用过翻译" width="90" align="center">
                <template #default="{ row }">
                  <span :class="row.translationUsed ? 'text-amber-500' : 'text-emerald-600'">
                    {{ row.translationUsed ? '是' : '否' }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="消息数" width="80" align="center" prop="messageCount" />
              <el-table-column label="开始时间" width="165">
                <template #default="{ row }">{{ formatDateTime(row.startedAt) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="170" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" @click="openDetail(row as StageSessionItem)">详情</el-button>
                  <el-button
                    v-if="row.status === 'active'"
                    v-permission="'stage:handle'"
                    link
                    type="danger"
                    @click="closeSession(row as StageSessionItem)"
                  >
                    强制结束
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <Pagination
            v-model:current-page="query.page"
            v-model:page-size="query.pageSize"
            class="mt-3"
            :total="total"
            @size-change="changePageSize"
            @current-change="changePage"
          />
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 会话详情抽屉：完整消息流 -->
    <el-drawer v-model="detailVisible" title="会话详情" size="560px">
      <el-scrollbar v-loading="detailLoading" class="h-full">
        <div v-if="detail" class="space-y-4 pr-2">
          <div class="rounded-xl bg-gray-50 p-3 text-xs leading-relaxed dark:bg-gray-800">
            <p><b>用户：</b>{{ detail.nickname }}（#{{ detail.userId }}）</p>
            <p><b>关卡：</b>{{ detail.stageTitle }}</p>
            <p><b>目标：</b>{{ detail.goal }}</p>
            <p>
              <b>状态：</b>{{ SESSION_STATUS_META[detail.status]?.label ?? detail.status }} · {{ detail.turnCount }} 轮
              · 通关：{{ detail.cleared ? '是' : '否' }} · 用过翻译：{{ detail.translationUsed ? '是' : '否' }}
            </p>
            <p v-if="detail.summary"><b>复盘：</b>{{ detail.summary }}</p>
          </div>

          <div class="space-y-2.5">
            <div
              v-for="msg in detail.messages"
              :key="msg.id"
              class="rounded-xl border p-2.5"
              :class="
                msg.role === 'user'
                  ? 'border-sky-200 bg-sky-50/60 dark:border-sky-800 dark:bg-sky-950/30'
                  : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
              "
            >
              <p class="mb-1 text-[11px] font-medium text-gray-400">
                {{ msg.role === 'user' ? '用户' : (msg.speaker ?? 'NPC') }} · {{ formatDateTime(msg.createdAt) }}
              </p>
              <p class="text-sm leading-relaxed">{{ msg.contentEn }}</p>
              <p v-if="msg.contentZh" class="mt-0.5 text-xs text-gray-400">{{ msg.contentZh }}</p>
            </div>
          </div>
        </div>
      </el-scrollbar>
    </el-drawer>
  </div>
</template>
