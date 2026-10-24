<script setup lang="ts">
/**
 * 客户端用户管理页（「短句」运营后台）。
 * 模块职责：分页筛选 / 详情（学习数据 + 成长 + 句签 + 最近答题）/ 启停 / 重置密码 /
 * 强制下线 / 删除 / 补发漏签句签。
 * 权限：v-permission（client:user:*），与种子菜单一致。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import {
  backfillClientUserSentenceCardsApi,
  deleteClientUserApi,
  forceClientUserOfflineApi,
  getClientUserAiQuotaApi,
  exportClientUsersApi,
  getClientUserDetailApi,
  getClientUserGrowthApi,
  getClientUserListApi,
  getClientUserSentenceCardsApi,
  resetClientUserPasswordApi,
  setClientUserStatusApi,
} from '@/api/client-user';
import { useTable } from '@/composables/useTable';
import { formatDate, formatDateTime } from '@/utils/format';
import { downloadBlob } from '@/utils/download';
import type {
  AiQuotaUsage,
  BackfillSentenceCardsResult,
  ClientUserDetail,
  ClientUserGrowth,
  ClientUserItem,
  ClientUserSentenceCard,
} from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { ref } from 'vue';

defineOptions({ name: 'ClientUserList' });

const GENDER_LABEL: Record<string, string> = { male: '男', female: '女', secret: '保密' };

const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getClientUserListApi({
      page: p.page,
      pageSize: p.pageSize,
      keyword: p.keyword?.trim() || undefined,
      status: p.status,
      gender: p.gender || undefined,
    }),
  { keyword: '', status: undefined as number | undefined, gender: '' },
);

/** 正确率（百分比，保留一位小数） */
function correctRate(row: ClientUserItem): string {
  if (row.answerCount === 0) {
    return '—';
  }
  return `${((row.correctCount / row.answerCount) * 100).toFixed(1)}%`;
}

/* ------------------------------ 详情（含成长 / 句签） ------------------------------ */

const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<ClientUserDetail | null>(null);

/** 今日 AI 额度用量（与客户端每日额度同一数据源）。 */
const aiQuota = ref<AiQuotaUsage | null>(null);

/** 成长概览（对应客户端个人中心「成长」Tab）。 */
const growth = ref<ClientUserGrowth | null>(null);
const growthLoading = ref(false);
const growthError = ref('');

/** 已获得的句签。 */
const cards = ref<ClientUserSentenceCard[]>([]);
const cardsLoading = ref(false);
const cardsError = ref('');

/** 补发漏签中。 */
const backfilling = ref(false);

async function loadGrowth(id: number): Promise<void> {
  growthLoading.value = true;
  growthError.value = '';
  try {
    growth.value = await getClientUserGrowthApi(id);
  } catch (error) {
    growth.value = null;
    growthError.value = error instanceof Error ? error.message : '加载失败';
  } finally {
    growthLoading.value = false;
  }
}

async function loadCards(id: number): Promise<void> {
  cardsLoading.value = true;
  cardsError.value = '';
  try {
    cards.value = await getClientUserSentenceCardsApi(id);
  } catch (error) {
    cards.value = [];
    cardsError.value = error instanceof Error ? error.message : '加载失败';
  } finally {
    cardsLoading.value = false;
  }
}

/** 导出客户端用户 CSV（按当前筛选条件）。 */
const exporting = ref(false);

async function handleExport(): Promise<void> {
  if (exporting.value) {
    return;
  }
  exporting.value = true;
  try {
    const blob = await exportClientUsersApi({
      keyword: typeof query.keyword === 'string' ? query.keyword.trim() || undefined : undefined,
      status: query.status ?? undefined,
      gender: query.gender || undefined,
    } as never);
    downloadBlob(blob, `客户端用户_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}.csv`);
    ElMessage.success('导出成功');
  } catch {
    ElMessage.error('导出失败（可能超过单次导出行数上限，请补充筛选条件）');
  } finally {
    exporting.value = false;
  }
}

/** 加载今日 AI 额度（失败静默：这是辅助信息，不该让详情弹窗报错）。 */
async function loadAiQuota(id: number): Promise<void> {
  aiQuota.value = await getClientUserAiQuotaApi(id).catch(() => null);
}

async function handleDetail(row: ClientUserItem): Promise<void> {
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  growth.value = null;
  growthError.value = '';
  cards.value = [];
  cardsError.value = '';
  aiQuota.value = null;
  try {
    detail.value = await getClientUserDetailApi(row.id);
  } finally {
    detailLoading.value = false;
  }
  // 成长 / 句签 / AI 额度与主详情解耦加载：任一侧失败都不影响另一侧展示
  void loadGrowth(row.id);
  void loadCards(row.id);
  void loadAiQuota(row.id);
}

/* ------------------------------ 补发漏签句签 ------------------------------ */

async function handleBackfill(): Promise<void> {
  const target = detail.value;
  if (!target) {
    return;
  }
  try {
    await ElMessageBox.confirm(
      '将扫描该用户历史「已完成每日目标但未领取」的日期，并补发当日句签；已拥有的不会重复发。确定继续？',
      '解锁漏签句签',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  backfilling.value = true;
  try {
    const result: BackfillSentenceCardsResult = await backfillClientUserSentenceCardsApi(target.id);
    if (result.granted > 0) {
      ElMessage.success(`已补发 ${result.granted} 张：${result.bizDates.join('、')}`);
      await loadCards(target.id);
    } else {
      ElMessage.info('没有漏签的句签（该用户均已领取）');
    }
  } finally {
    backfilling.value = false;
  }
}

/* ------------------------------ 启停 ------------------------------ */

async function handleToggleStatus(row: ClientUserItem): Promise<void> {
  const next = row.status === 1 ? 0 : 1;
  try {
    await ElMessageBox.confirm(`确定${next === 1 ? '启用' : '禁用'}「${row.nickname}」吗？`, '提示', {
      type: 'warning',
    });
  } catch {
    return;
  }
  await setClientUserStatusApi(row.id, next);
  ElMessage.success(next === 1 ? '已启用' : '已禁用');
  await getList();
}

/* ------------------------------ 删除 ------------------------------ */

const deleting = ref(false);

async function handleDelete(row: ClientUserItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除「${row.nickname}（${row.email}）」吗？\n将同时清空其答题记录、收藏、打卡、举报、句签、经验与成就数据，且不可恢复（日志类记录保留）。`,
      '删除用户',
      { type: 'warning', confirmButtonText: '确认删除', confirmButtonClass: 'el-button--danger' },
    );
  } catch {
    return;
  }
  deleting.value = true;
  try {
    await deleteClientUserApi(row.id);
    ElMessage.success('已删除');
    detailVisible.value = false;
    await getList();
  } finally {
    deleting.value = false;
  }
}

/* ------------------------------ 重置密码 ------------------------------ */

const pwdVisible = ref(false);
const pwdSaving = ref(false);
const pwdTarget = ref<ClientUserItem | null>(null);
const pwdForm = ref({ password: '' });

function handleResetPwd(row: ClientUserItem): void {
  pwdTarget.value = row;
  pwdForm.value.password = '';
  pwdVisible.value = true;
}

async function submitResetPwd(): Promise<void> {
  if (!pwdTarget.value) {
    return;
  }
  const password = pwdForm.value.password.trim();
  if (password.length < 6 || password.length > 32) {
    ElMessage.warning('密码长度需为 6~32 位');
    return;
  }
  pwdSaving.value = true;
  try {
    await resetClientUserPasswordApi(pwdTarget.value.id, password);
    ElMessage.success('密码已重置，该用户需重新登录');
    pwdVisible.value = false;
  } finally {
    pwdSaving.value = false;
  }
}

/* ------------------------------ 强制下线 ------------------------------ */

async function handleOffline(row: ClientUserItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`强制「${row.nickname}」下线？其当前登录状态将立即失效（密码不变）。`, '提示', {
      type: 'warning',
    });
  } catch {
    return;
  }
  await forceClientUserOfflineApi(row.id);
  ElMessage.success('已强制下线');
}

onMounted(() => {
  void getList();
});
</script>

<template>
  <div class="sentence-clients-page">
    <!-- 查询 -->
    <SearchForm @search="search" @reset="reset">
      <el-form-item label="关键词">
        <el-input v-model="query.keyword" placeholder="邮箱 / 昵称" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 120px">
          <el-option label="启用" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item label="性别">
        <el-select v-model="query.gender" placeholder="全部" clearable style="width: 120px">
          <el-option label="男" value="male" />
          <el-option label="女" value="female" />
          <el-option label="保密" value="secret" />
        </el-select>
      </el-form-item>
    </SearchForm>

    <el-card shadow="never" class="mt-4">
      <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3">
        <span class="text-[15px] font-semibold text-ink">客户端用户（共 {{ total }}）</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button :loading="exporting" @click="handleExport">导出</el-button>
          <el-button :loading="loading" @click="getList">刷新</el-button>
        </div>
      </div>

      <!-- 表格 -->
      <el-table v-loading="loading" :data="list" border row-key="id">
        <el-table-column label="用户" min-width="200">
          <template #default="{ row }">
            <div class="flex items-center gap-2">
              <el-avatar :size="32" :src="row.avatarUrl || undefined">
                {{ (row.nickname || '?').slice(0, 1) }}
              </el-avatar>
              <div class="min-w-0">
                <p class="truncate font-medium">{{ row.nickname }}</p>
                <p class="truncate text-xs text-gray-400">{{ row.email }}</p>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="性别" width="70">
          <template #default="{ row }">{{ GENDER_LABEL[row.gender] ?? row.gender }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="answerCount" label="答题数" width="90" />
        <el-table-column label="正确率" width="90">
          <template #default="{ row }">{{ correctRate(row as ClientUserItem) }}</template>
        </el-table-column>
        <el-table-column prop="favoriteCount" label="收藏" width="80" />
        <el-table-column prop="streak" label="连续打卡" width="100" />
        <el-table-column label="最后登录" width="170">
          <template #default="{ row }">{{ row.lastLoginAt ? formatDateTime(row.lastLoginAt) : '—' }}</template>
        </el-table-column>
        <el-table-column label="注册时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="290" fixed="right">
          <template #default="{ row }">
            <el-button
              v-permission="'client:user:query'"
              link
              type="primary"
              @click="handleDetail(row as ClientUserItem)"
            >
              详情
            </el-button>
            <el-button
              v-permission="'client:user:edit'"
              link
              type="warning"
              @click="handleToggleStatus(row as ClientUserItem)"
            >
              {{ row.status === 1 ? '禁用' : '启用' }}
            </el-button>
            <el-button
              v-permission="'client:user:reset'"
              link
              type="primary"
              @click="handleResetPwd(row as ClientUserItem)"
            >
              重置密码
            </el-button>
            <el-button
              v-permission="'client:user:offline'"
              link
              type="danger"
              @click="handleOffline(row as ClientUserItem)"
            >
              下线
            </el-button>
            <el-button
              v-permission="'client:user:delete'"
              link
              type="danger"
              :loading="deleting"
              @click="handleDelete(row as ClientUserItem)"
            >
              删除
            </el-button>
          </template>
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

    <!-- 详情 -->
    <BasicDialog v-model="detailVisible" title="用户详情" width="860px" :show-footer="false">
      <div v-loading="detailLoading" class="max-h-[62vh] overflow-y-auto pr-1">
        <template v-if="detail">
          <div class="mb-4 flex items-center gap-3">
            <el-avatar :size="48" :src="detail.avatarUrl || undefined">
              {{ (detail.nickname || '?').slice(0, 1) }}
            </el-avatar>
            <div>
              <p class="text-base font-semibold">{{ detail.nickname }}</p>
              <p class="text-sm text-gray-400">{{ detail.email }}</p>
              <p v-if="detail.signature" class="mt-0.5 text-xs text-gray-400">{{ detail.signature }}</p>
            </div>
          </div>

          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="累计答题">{{ detail.answerCount }}</el-descriptions-item>
            <el-descriptions-item label="累计答对">{{ detail.correctCount }}</el-descriptions-item>
            <el-descriptions-item label="正确率">{{ correctRate(detail) }}</el-descriptions-item>
            <el-descriptions-item label="收藏数">{{ detail.favoriteCount }}</el-descriptions-item>
            <el-descriptions-item label="连续打卡">{{ detail.streak }} 天</el-descriptions-item>
            <el-descriptions-item label="累计打卡">{{ detail.checkinDays }} 天</el-descriptions-item>
            <el-descriptions-item label="性别">{{ GENDER_LABEL[detail.gender] ?? detail.gender }}</el-descriptions-item>
            <el-descriptions-item label="生日">{{ detail.birthday ?? '—' }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="detail.status === 1 ? 'success' : 'info'" size="small">
                {{ detail.status === 1 ? '启用' : '禁用' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="最后登录">
              {{ detail.lastLoginAt ? formatDateTime(detail.lastLoginAt) : '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="注册时间">{{ formatDateTime(detail.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="今日 AI">
              <span v-if="aiQuota">{{ aiQuota.used }} / {{ aiQuota.limit }} 次</span>
              <span v-else class="text-gray-400">—</span>
            </el-descriptions-item>
            <el-descriptions-item label="AI 剩余">
              <span v-if="aiQuota" :class="aiQuota.remaining > 0 ? '' : 'text-red-500'">
                {{ aiQuota.remaining }} 次
              </span>
              <span v-else class="text-gray-400">—</span>
            </el-descriptions-item>
          </el-descriptions>

          <p class="mb-2 mt-4 text-sm font-medium">最近答题</p>
          <el-table :data="detail.recentAnswers" border size="small" max-height="260">
            <el-table-column prop="sentenceEn" label="英文句子" min-width="200" show-overflow-tooltip />
            <el-table-column prop="translationZh" label="中文释义" min-width="140" show-overflow-tooltip />
            <el-table-column label="结果" width="80">
              <template #default="{ row }">
                <el-tag :type="row.isCorrect ? 'success' : 'danger'" size="small">
                  {{ row.isCorrect ? '答对' : '答错' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="时间" width="170">
              <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
            </el-table-column>
          </el-table>

          <!-- 成长（与客户端个人中心「成长」Tab 同源） -->
          <div class="mt-5">
            <div class="mb-2 flex flex-wrap items-center justify-between gap-y-1">
              <p class="text-sm font-medium">成长（客户端个人中心）</p>
              <span v-if="growth" class="text-xs text-muted">
                成就 {{ growth.unlockedAchievements }}/{{ growth.totalAchievements }} · 场景探索
                {{ growth.unlockedScenes }}/{{ growth.totalScenes }}
              </span>
            </div>

            <div v-if="growthLoading" class="py-6 text-center text-sm text-faint">加载中…</div>
            <p v-else-if="growthError" class="py-4 text-center text-sm text-danger">
              成长数据加载失败：{{ growthError }}
            </p>
            <template v-else-if="growth">
              <el-descriptions :column="3" border size="small">
                <el-descriptions-item label="经验值">{{ growth.xp }} XP</el-descriptions-item>
                <el-descriptions-item label="当前等级">
                  <el-tag size="small" type="primary" effect="dark">
                    {{ growth.level.name }} · {{ growth.level.code }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="距下一级">
                  <span v-if="growth.level.next" class="text-xs text-muted">还差 {{ growth.level.toNext }} XP</span>
                  <span v-else class="text-xs text-muted">已满级</span>
                </el-descriptions-item>
              </el-descriptions>
              <el-progress :percentage="growth.level.progress" :stroke-width="10" class="my-3" />

              <p class="mb-2 text-sm text-muted">
                成就（{{ growth.unlockedAchievements }}/{{ growth.totalAchievements }}）
              </p>
              <div class="mb-4 flex flex-wrap gap-1.5">
                <el-tag
                  v-for="item in growth.achievements"
                  :key="item.code"
                  size="small"
                  :type="item.unlocked ? 'success' : 'info'"
                  :effect="item.unlocked ? 'dark' : 'plain'"
                  :title="item.description"
                >
                  {{ item.name }}
                  <span class="ml-1 opacity-60">+{{ item.rewardXp }}</span>
                </el-tag>
              </div>

              <p class="mb-2 text-sm text-muted">场景探索（{{ growth.unlockedScenes }}/{{ growth.totalScenes }}）</p>
              <el-table :data="growth.sceneMap" border size="small" max-height="200">
                <el-table-column prop="name" label="场景" min-width="120" show-overflow-tooltip />
                <el-table-column label="状态" width="90">
                  <template #default="{ row }">
                    <el-tag :type="row.unlocked ? 'success' : 'info'" size="small">
                      {{ row.unlocked ? '已解锁' : '未解锁' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="practicedCount" label="已练句子" width="90" />
              </el-table>
            </template>
          </div>

          <!-- 句签 -->
          <div class="mt-5">
            <div class="mb-2 flex flex-wrap items-center justify-between gap-y-1">
              <p class="text-sm font-medium">句签（{{ cards.length }}）</p>
              <el-button size="small" type="warning" :loading="backfilling" @click="handleBackfill">
                解锁漏签句签
              </el-button>
            </div>

            <div v-if="cardsLoading" class="py-6 text-center text-sm text-faint">加载中…</div>
            <p v-else-if="cardsError" class="py-4 text-center text-sm text-danger">
              句签数据加载失败：{{ cardsError }}
            </p>
            <template v-else-if="cards.length">
              <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
                <div
                  v-for="card in cards"
                  :key="card.id"
                  class="overflow-hidden rounded-md border border-line-lighter bg-fill-light"
                >
                  <div class="flex-center aspect-video bg-page text-muted">
                    <img
                      v-if="card.imageUrl"
                      :src="card.imageUrl"
                      :alt="card.titleZh"
                      class="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <span v-else class="text-[20px]">
                      <el-icon aria-hidden="true"><i class="bi bi-file-earmark-image" /></el-icon>
                    </span>
                  </div>
                  <div class="p-2">
                    <p class="truncate text-xs font-medium" :title="card.titleZh">{{ card.titleZh }}</p>
                    <p class="truncate text-xs text-faint">{{ card.bizDate }}</p>
                  </div>
                </div>
              </div>
            </template>
            <p v-else class="py-6 text-center text-sm text-faint">还没有句签，完成每日目标即可获得当日 AI 闪卡</p>
          </div>
        </template>
      </div>
    </BasicDialog>

    <!-- 重置密码 -->
    <BasicDialog v-model="pwdVisible" title="重置密码" width="420px" :show-footer="false">
      <el-form label-width="80px">
        <el-form-item label="用户">
          <span>{{ pwdTarget?.nickname }}（{{ pwdTarget?.email }}）</span>
        </el-form-item>
        <el-form-item label="新密码" required>
          <el-input
            v-model="pwdForm.password"
            type="password"
            show-password
            maxlength="32"
            placeholder="6~32 位，需含字母与数字"
          />
        </el-form-item>
        <el-form-item>
          <span class="text-xs text-gray-400">重置后该用户的旧登录状态会立即失效。</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdSaving" @click="submitResetPwd">确定重置</el-button>
      </template>
    </BasicDialog>
  </div>
</template>
