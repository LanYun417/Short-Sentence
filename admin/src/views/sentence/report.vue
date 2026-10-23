<script setup lang="ts">
/**
 * 题目举报处理页（「短句」运营后台）。
 * 模块职责：分页筛选举报 / 处理（标记已处理或驳回 + 备注）。
 * 权限：v-permission（sentence:report / sentence:report:handle），与种子菜单一致。
 */
import { ElMessage } from '@/utils/element';
import { getReportListApi, handleReportApi } from '@/api/report';
import { useTable } from '@/composables/useTable';
import { formatDateTime } from '@/utils/format';
import type { HandleReportPayload, SentenceReportItem } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { ref } from 'vue';

defineOptions({ name: 'SentenceReport' });

/** 举报类型文案 */
const REASON_LABEL: Record<string, string> = {
  wrong: '题目/翻译有误',
  inappropriate: '内容不适当',
  image: '图片不雅/有问题',
  other: '其他',
};

/** 处理状态文案 */
const STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  resolved: '已处理',
  dismissed: '已驳回',
};

/** 处理状态标签色 */
const STATUS_TAG: Record<string, 'warning' | 'success' | 'info'> = {
  pending: 'warning',
  resolved: 'success',
  dismissed: 'info',
};

const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getReportListApi({
      page: p.page,
      pageSize: p.pageSize,
      status: p.status || undefined,
      reason: p.reason || undefined,
      keyword: p.keyword?.trim() || undefined,
    }),
  { keyword: '', status: '', reason: '' },
);

/* ------------------------------ 处理 ------------------------------ */

const dialogVisible = ref(false);
const saving = ref(false);
const current = ref<SentenceReportItem | null>(null);
const form = ref<HandleReportPayload>({ status: 'resolved', handleNote: '' });

/** 打开处理弹窗。 */
function handleOpen(row: SentenceReportItem): void {
  current.value = row;
  form.value = { status: row.status === 'dismissed' ? 'dismissed' : 'resolved', handleNote: row.handleNote ?? '' };
  dialogVisible.value = true;
}

/** 提交处理。 */
async function handleSave(): Promise<void> {
  if (!current.value) {
    return;
  }
  saving.value = true;
  try {
    await handleReportApi(current.value.id, {
      status: form.value.status,
      handleNote: form.value.handleNote?.trim() || undefined,
    });
    ElMessage.success('已处理');
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
  <div class="p-4">
    <!-- 查询 -->
    <SearchForm @search="search" @reset="reset">
      <el-form-item label="关键词">
        <el-input v-model="query.keyword" placeholder="英文 / 翻译 / 补充说明" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 120px">
          <el-option label="待处理" value="pending" />
          <el-option label="已处理" value="resolved" />
          <el-option label="已驳回" value="dismissed" />
        </el-select>
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="query.reason" placeholder="全部" clearable style="width: 150px">
          <el-option label="题目/翻译有误" value="wrong" />
          <el-option label="内容不适当" value="inappropriate" />
          <el-option label="图片不雅/有问题" value="image" />
          <el-option label="其他" value="other" />
        </el-select>
      </el-form-item>
    </SearchForm>

    <!-- 工具栏 -->
    <div class="mb-3 flex items-center gap-2">
      <el-button :loading="loading" @click="getList">刷新</el-button>
      <span class="text-sm text-gray-400">共 {{ total }} 条举报</span>
    </div>

    <!-- 表格 -->
    <el-table v-loading="loading" :data="list" border row-key="id">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="题目" min-width="260">
        <template #default="{ row }">
          <template v-if="row.sentence">
            <p class="text-sm font-medium">{{ row.sentence.sentenceEn }}</p>
            <p class="text-xs text-gray-400">{{ row.sentence.translationZh }}</p>
          </template>
          <span v-else class="text-gray-400">题目已删除</span>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="140">
        <template #default="{ row }">
          <el-tag size="small" type="warning">{{ REASON_LABEL[row.reason] ?? row.reason }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="补充说明" min-width="200">
        <template #default="{ row }">
          <span class="text-sm text-gray-600">{{ row.description || '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="举报人" width="130">
        <template #default="{ row }">{{ row.reporter?.nickname ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="STATUS_TAG[row.status] ?? 'info'" size="small">
            {{ STATUS_LABEL[row.status] ?? row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="举报时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button
            v-permission="'sentence:report:handle'"
            link
            type="primary"
            @click="handleOpen(row as SentenceReportItem)"
          >
            {{ row.status === 'pending' ? '处理' : '改判' }}
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

    <!-- 处理弹窗 -->
    <BasicDialog v-model="dialogVisible" title="处理举报" width="520px" :show-footer="false">
      <div v-if="current" class="space-y-3">
        <div class="rounded bg-gray-50 p-3 text-sm">
          <p class="font-medium">{{ current.sentence?.sentenceEn ?? '（题目已删除）' }}</p>
          <p class="text-gray-500">{{ current.sentence?.translationZh ?? '—' }}</p>
          <p class="mt-2 text-xs text-gray-400">
            类型：{{ REASON_LABEL[current.reason] ?? current.reason }}
            <span v-if="current.description"> · 补充：{{ current.description }}</span>
          </p>
        </div>
        <el-form label-width="80px">
          <el-form-item label="处理结果" required>
            <el-radio-group v-model="form.status">
              <el-radio value="resolved">已处理</el-radio>
              <el-radio value="dismissed">驳回</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="处理备注">
            <el-input
              v-model="form.handleNote"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              placeholder="选填，记录处理说明"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">确定</el-button>
      </template>
    </BasicDialog>
  </div>
</template>
