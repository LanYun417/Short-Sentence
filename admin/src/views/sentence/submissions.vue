<script setup lang="ts">
/**
 * 用户投稿审核页（「短句」运营后台）。
 * 模块职责：分页筛选用户投稿 / 通过（进投稿精选）或驳回（可带原因，下发投稿人）。
 * 权限：client:submission:list / client:submission:review（与菜单种子一致）。
 *
 * 投稿**不进刷题池**：刷题题必须过 AI 生成与配图审核，精选是展示位，两者解耦。
 */
import { ElMessage } from '@/utils/element';
import { getSubmissionListApi, reviewSubmissionApi } from '@/api/submission';
import { useTable } from '@/composables/useTable';
import { useTablePage } from '@/composables/useTablePage';
import { formatDateTime } from '@/utils/format';
import type { ClientSubmissionItem, ClientSubmissionStatus } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { ref } from 'vue';

defineOptions({ name: 'ClientSubmissions' });

const { tableHeight } = useTablePage();

/** 状态文案与标签色 */
const STATUS_LABEL: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
};
const STATUS_TAG: Record<string, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

const PLATFORM_LABEL: Record<string, string> = {
  web: 'Web',
  android: 'App',
};

const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getSubmissionListApi({
      page: p.page,
      pageSize: p.pageSize,
      status: p.status,
      keyword: p.keyword?.trim() || undefined,
    }),
  {
    status: undefined as ClientSubmissionStatus | undefined,
    keyword: '',
  },
);

/* ------------------------------ 审核 ------------------------------ */

const dialogVisible = ref(false);
const saving = ref(false);
const current = ref<ClientSubmissionItem | null>(null);
const form = ref<{ action: 'approve' | 'reject'; note: string }>({ action: 'approve', note: '' });

/** 打开审核弹窗（默认「通过」，驳回时要求填写原因）。 */
function reviewOpen(row: ClientSubmissionItem, action: 'approve' | 'reject'): void {
  current.value = row;
  form.value = { action, note: row.reviewNote ?? '' };
  dialogVisible.value = true;
}

async function submitReview(): Promise<void> {
  if (!current.value) {
    return;
  }
  if (form.value.action === 'reject' && !form.value.note.trim()) {
    ElMessage.warning('驳回时请填写原因（会下发给投稿人）');
    return;
  }
  saving.value = true;
  try {
    await reviewSubmissionApi(current.value.id, {
      action: form.value.action,
      note: form.value.note.trim() || undefined,
    });
    ElMessage.success(form.value.action === 'approve' ? '已通过' : '已驳回');
    dialogVisible.value = false;
    await getList();
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void getList();
});
</script>

<template>
  <div class="client-submissions-page table-page">
    <!-- 查询 -->
    <SearchForm class="table-page__filter" @search="search" @reset="reset">
      <el-form-item label="关键词">
        <el-input v-model="query.keyword" placeholder="句子 / 译文" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 120px">
          <el-option label="待审核" value="pending" />
          <el-option label="已通过" value="approved" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
      </el-form-item>
    </SearchForm>

    <el-card shadow="never" class="mt-4 table-page__card">
      <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3 table-page__toolbar">
        <span class="text-[15px] font-semibold text-ink">用户投稿（共 {{ total }} 条）</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button :loading="loading" @click="getList">刷新</el-button>
        </div>
      </div>

      <div class="table-page__table">
        <el-table v-loading="loading" :data="list" border row-key="id" :height="tableHeight">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column label="投稿内容" min-width="320">
            <template #default="{ row }">
              <p class="text-sm font-medium break-all">{{ row.sentenceEn }}</p>
              <p class="mt-0.5 text-sm text-gray-500 break-all">{{ row.translationZh }}</p>
              <p v-if="row.note" class="mt-1 text-xs text-gray-400 break-all">附言：{{ row.note }}</p>
              <p
                v-if="row.reviewNote"
                class="mt-1 text-xs"
                :class="row.status === 'rejected' ? 'text-danger' : 'text-success'"
              >
                审核备注：{{ row.reviewNote }}
              </p>
            </template>
          </el-table-column>
          <el-table-column label="投稿人" width="140">
            <template #default="{ row }">
              <span class="text-sm">{{ row.nickname }}</span>
              <span class="ml-1 text-xs text-gray-400">#{{ row.userId }}</span>
            </template>
          </el-table-column>
          <el-table-column label="来源" width="90">
            <template #default="{ row }">{{ PLATFORM_LABEL[row.platform] ?? row.platform }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="STATUS_TAG[row.status] ?? 'info'" size="small">
                {{ STATUS_LABEL[row.status] ?? row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="提交时间" width="170">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <template v-if="row.status === 'pending'">
                <el-button
                  v-permission="'client:submission:review'"
                  link
                  type="success"
                  @click="reviewOpen(row as ClientSubmissionItem, 'approve')"
                >
                  通过
                </el-button>
                <el-button
                  v-permission="'client:submission:review'"
                  link
                  type="danger"
                  @click="reviewOpen(row as ClientSubmissionItem, 'reject')"
                >
                  驳回
                </el-button>
              </template>
              <span v-else class="text-xs text-gray-400">已处理</span>
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

    <!-- 审核弹窗 -->
    <BasicDialog v-model="dialogVisible" :title="form.action === 'approve' ? '通过投稿' : '驳回投稿'" width="520px">
      <div v-if="current" class="space-y-3">
        <div class="rounded-lg bg-gray-50 p-3">
          <p class="text-sm font-medium">{{ current.sentenceEn }}</p>
          <p class="mt-1 text-sm text-gray-500">{{ current.translationZh }}</p>
        </div>
        <el-form label-width="80px">
          <el-form-item :label="form.action === 'approve' ? '备注' : '驳回原因'" :required="form.action === 'reject'">
            <el-input
              v-model="form.note"
              type="textarea"
              :rows="3"
              maxlength="300"
              show-word-limit
              :placeholder="form.action === 'approve' ? '选填（不会下发给用户）' : '必填，会下发给投稿人'"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button :type="form.action === 'approve' ? 'primary' : 'danger'" :loading="saving" @click="submitReview">
          {{ form.action === 'approve' ? '确认通过' : '确认驳回' }}
        </el-button>
      </template>
    </BasicDialog>
  </div>
</template>
