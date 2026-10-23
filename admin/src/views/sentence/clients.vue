<script setup lang="ts">
/**
 * 客户端用户管理页（「短句」运营后台）。
 * 模块职责：分页筛选 / 详情（学习数据 + 最近答题）/ 启停 / 重置密码 / 强制下线。
 * 权限：v-permission（client:user:*），与种子菜单一致。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import {
  forceClientUserOfflineApi,
  getClientUserDetailApi,
  getClientUserListApi,
  resetClientUserPasswordApi,
  setClientUserStatusApi,
} from '@/api/client-user';
import { useTable } from '@/composables/useTable';
import { formatDateTime } from '@/utils/format';
import { withUploadToken } from '@/utils/uploadToken';
import type { ClientUserDetail, ClientUserItem } from '@/types/api';
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

/* ------------------------------ 详情 ------------------------------ */

const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<ClientUserDetail | null>(null);

async function handleDetail(row: ClientUserItem): Promise<void> {
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  try {
    detail.value = await getClientUserDetailApi(row.id);
  } finally {
    detailLoading.value = false;
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
          <el-button :loading="loading" @click="getList">刷新</el-button>
        </div>
      </div>

      <!-- 表格 -->
      <el-table v-loading="loading" :data="list" border row-key="id">
        <el-table-column label="用户" min-width="200">
          <template #default="{ row }">
            <div class="flex items-center gap-2">
              <el-avatar :size="32" :src="withUploadToken(row.avatarUrl) || undefined">
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
        <el-table-column label="操作" width="230" fixed="right">
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
    <BasicDialog v-model="detailVisible" title="用户详情" width="720px" :show-footer="false">
      <div v-loading="detailLoading">
        <template v-if="detail">
          <div class="mb-4 flex items-center gap-3">
            <el-avatar :size="48" :src="withUploadToken(detail.avatarUrl) || undefined">
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
