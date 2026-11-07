<script setup lang="ts">
/**
 * 客户端产品反馈处理页（「短句」运营后台）。
 * 模块职责：分页筛选用户反馈 / 处理（标记已处理或驳回 + 给用户的回复 + 内部备注）。
 * 权限：v-permission（client:feedback:list / client:feedback:handle），与种子菜单一致。
 *
 * 与「题库管理 → 题目举报」的区别：举报面向某一道题（处理动作是核查那道题），
 * 本页面向产品本身，处理动作是「回不回复用户」。
 */
import { ElMessage } from '@/utils/element';
import { getFeedbackListApi, handleFeedbackApi } from '@/api/feedback';
import { useTable } from '@/composables/useTable';
import { useTablePage } from '@/composables/useTablePage';
import { formatDateTime } from '@/utils/format';
import type { ClientFeedbackItem, ClientFeedbackStatus, HandleFeedbackPayload } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { ref } from 'vue';

defineOptions({ name: 'ClientFeedback' });

const { tableHeight } = useTablePage();

/** 反馈类型文案 */
const TYPE_LABEL: Record<string, string> = {
  feature: '功能建议',
  bug: '使用异常',
  content: '内容问题',
  ux: '体验建议',
  other: '其他',
};

/** 反馈类型标签色（按「需要多快响应」排：异常 > 内容 > 建议） */
const TYPE_TAG: Record<string, 'danger' | 'warning' | 'success' | 'info' | 'primary'> = {
  bug: 'danger',
  content: 'warning',
  feature: 'success',
  ux: 'info',
  other: 'primary',
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

/** 来源端文案 */
const PLATFORM_LABEL: Record<string, string> = {
  web: 'Web',
  android: 'App',
};

const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getFeedbackListApi({
      page: p.page,
      pageSize: p.pageSize,
      status: p.status,
      type: p.type,
      platform: p.platform,
      keyword: p.keyword?.trim() || undefined,
    }),
  {
    // 初始用 undefined 表示「全部」；显式标注类型，避免宽化成 string 后与查询入参不兼容
    status: undefined as ClientFeedbackStatus | undefined,
    type: undefined as string | undefined,
    platform: undefined as string | undefined,
    keyword: '',
  },
);

/* ------------------------------ 处理 ------------------------------ */

const dialogVisible = ref(false);
const saving = ref(false);
const current = ref<ClientFeedbackItem | null>(null);
const form = ref<HandleFeedbackPayload>({ status: 'resolved', reply: '', handleNote: '' });

/** 打开处理弹窗（回填已有回复/备注，便于改判）。 */
function handleOpen(row: ClientFeedbackItem): void {
  current.value = row;
  form.value = {
    status: row.status === 'dismissed' ? 'dismissed' : 'resolved',
    reply: row.reply ?? '',
    handleNote: row.handleNote ?? '',
  };
  dialogVisible.value = true;
}

/** 提交处理。 */
async function handleSave(): Promise<void> {
  if (!current.value) {
    return;
  }
  saving.value = true;
  try {
    await handleFeedbackApi(current.value.id, {
      status: form.value.status,
      reply: form.value.reply?.trim() || undefined,
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
  <div class="client-feedback-page table-page">
    <!-- 查询 -->
    <SearchForm class="table-page__filter" @search="search" @reset="reset">
      <el-form-item label="关键词">
        <el-input v-model="query.keyword" placeholder="反馈内容 / 联系方式" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 120px">
          <el-option label="待处理" value="pending" />
          <el-option label="已处理" value="resolved" />
          <el-option label="已驳回" value="dismissed" />
        </el-select>
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="query.type" placeholder="全部" clearable style="width: 130px">
          <el-option label="功能建议" value="feature" />
          <el-option label="使用异常" value="bug" />
          <el-option label="内容问题" value="content" />
          <el-option label="体验建议" value="ux" />
          <el-option label="其他" value="other" />
        </el-select>
      </el-form-item>
      <el-form-item label="来源端">
        <el-select v-model="query.platform" placeholder="全部" clearable style="width: 110px">
          <el-option label="Web" value="web" />
          <el-option label="App" value="android" />
        </el-select>
      </el-form-item>
    </SearchForm>

    <el-card shadow="never" class="mt-4 table-page__card">
      <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3 table-page__toolbar">
        <span class="text-[15px] font-semibold text-ink">用户反馈（共 {{ total }} 条）</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button :loading="loading" @click="getList">刷新</el-button>
        </div>
      </div>

      <!-- 表格 -->
      <div class="table-page__table">
        <el-table v-loading="loading" :data="list" border row-key="id" :height="tableHeight">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column label="反馈内容" min-width="300">
            <template #default="{ row }">
              <p class="text-sm break-all line-clamp-2">{{ row.content }}</p>
              <div v-if="row.images?.length" class="mt-1.5 flex flex-wrap gap-1.5">
                <el-image
                  v-for="url in row.images"
                  :key="url"
                  :src="url"
                  :preview-src-list="row.images"
                  :initial-index="row.images.indexOf(url)"
                  fit="cover"
                  preview-teleported
                  class="h-12 w-12 shrink-0 cursor-zoom-in rounded border border-gray-200"
                />
              </div>
              <p v-if="row.reply" class="mt-1 text-xs text-success">已回复：{{ row.reply }}</p>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="110">
            <template #default="{ row }">
              <el-tag size="small" :type="TYPE_TAG[row.type] ?? 'primary'">
                {{ TYPE_LABEL[row.type] ?? row.type }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="提交人" width="130">
            <template #default="{ row }">{{ row.reporter?.nickname ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="来源" width="120">
            <template #default="{ row }">
              <span class="text-sm">{{ PLATFORM_LABEL[row.platform] ?? row.platform }}</span>
              <span v-if="row.appVersion" class="ml-1 text-xs text-gray-400">v{{ row.appVersion }}</span>
            </template>
          </el-table-column>
          <el-table-column label="联系方式" width="150">
            <template #default="{ row }">
              <span class="text-sm text-gray-600">{{ row.contact || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="STATUS_TAG[row.status] ?? 'info'" size="small">
                {{ STATUS_LABEL[row.status] ?? row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="提交时间" width="170">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="110" fixed="right">
            <template #default="{ row }">
              <el-button
                v-permission="'client:feedback:handle'"
                link
                type="primary"
                @click="handleOpen(row as ClientFeedbackItem)"
              >
                {{ row.status === 'pending' ? '处理' : '改判' }}
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

    <!-- 处理弹窗 -->
    <BasicDialog v-model="dialogVisible" title="处理反馈" width="560px" :show-footer="false">
      <div v-if="current" class="space-y-3">
        <div class="rounded bg-gray-50 p-3 text-sm">
          <p class="whitespace-pre-wrap break-all">{{ current.content }}</p>
          <div v-if="current.images?.length" class="mt-2 flex flex-wrap gap-2">
            <el-image
              v-for="url in current.images"
              :key="url"
              :src="url"
              :preview-src-list="current.images"
              :initial-index="current.images.indexOf(url)"
              fit="cover"
              preview-teleported
              class="h-16 w-16 cursor-zoom-in rounded border border-gray-200"
            />
          </div>
          <p class="mt-2 text-xs text-gray-400">
            {{ TYPE_LABEL[current.type] ?? current.type }} · {{ PLATFORM_LABEL[current.platform] ?? current.platform
            }}<template v-if="current.appVersion"> v{{ current.appVersion }}</template> ·
            {{ current.reporter?.nickname ?? '未知用户' }} ·
            {{ formatDateTime(current.createdAt) }}
            <span v-if="current.contact"> · 联系方式：{{ current.contact }}</span>
          </p>
        </div>
        <el-form label-width="90px">
          <el-form-item label="处理结果" required>
            <el-radio-group v-model="form.status">
              <el-radio value="resolved">已处理</el-radio>
              <el-radio value="dismissed">驳回</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="回复用户">
            <el-input
              v-model="form.reply"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              placeholder="选填。会显示在用户端「我的反馈」里，让用户看到意见被回应"
            />
          </el-form-item>
          <el-form-item label="内部备注">
            <el-input
              v-model="form.handleNote"
              type="textarea"
              :rows="2"
              maxlength="500"
              show-word-limit
              placeholder="选填。仅后台可见，用户看不到"
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
