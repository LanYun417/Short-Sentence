<script setup lang="ts">
/**
 * 每日句签管理页（「短句」运营后台）。
 * 模块职责：按日期查看每日句签 / 编辑文案 / 按日期重新生成（AI 文案 + 配图）/ 删除。
 *
 * 为什么需要这个页面：句签是用户完成每日目标后领取的核心留存物，此前后台完全不可见——
 * 生成失败（用户领不到）或文案不佳时，运营没有任何干预手段。
 *
 * 权限：按钮级 v-permission（sentence:card:list/edit/gen/remove），与种子菜单一致。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import {
  deleteSentenceCardApi,
  generateSentenceCardApi,
  getSentenceCardDetailApi,
  getSentenceCardListApi,
  updateSentenceCardApi,
} from '@/api/sentence-card';
import { useTable } from '@/composables/useTable';
import { useTablePage } from '@/composables/useTablePage';
import { formatDateTime } from '@/utils/format';
import type { SentenceCardDetail, SentenceCardItem, SentenceCardPayload } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { computed, ref } from 'vue';

defineOptions({ name: 'SentenceCardList' });

const { tableHeight } = useTablePage();

/** 状态 → 标签样式与文案 */
const STATUS_TAG: Record<string, { type: 'success' | 'info' | 'danger'; label: string }> = {
  ready: { type: 'success', label: '就绪' },
  pending: { type: 'info', label: '待生成' },
  failed: { type: 'danger', label: '失败' },
};

/** 状态标签（未知状态原样展示，不吞信息）。 */
function statusTag(status: string): { type: 'success' | 'info' | 'danger'; label: string } {
  return STATUS_TAG[status] ?? { type: 'info', label: status };
}

/** 本地日期 YYYY-MM-DD（不能用 toISOString：UTC 会差一天）。 */
function todayStr(): string {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const { loading, list, total, query, search, reset, changePage, changePageSize } = useTable(
  (p) =>
    getSentenceCardListApi({
      page: p.page,
      pageSize: p.pageSize,
      keyword: p.keyword?.trim() || undefined,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
    }),
  {
    keyword: '',
    status: undefined as string | undefined,
    startDate: undefined as string | undefined,
    endDate: undefined as string | undefined,
  },
);

/** 日期区间（绑定 el-date-picker 的数组形态，落回 query 的两个字段）。 */
const dateRange = computed<string[] | null>({
  get: () => (query.startDate && query.endDate ? [query.startDate, query.endDate] : null),
  set: (value: string[] | null) => {
    query.startDate = value?.[0];
    query.endDate = value?.[1];
  },
});

/* ------------------------------ 详情抽屉 ------------------------------ */

const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<SentenceCardDetail | null>(null);

/** 打开详情。 */
async function handleDetail(row: SentenceCardItem): Promise<void> {
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  try {
    detail.value = await getSentenceCardDetailApi(row.id);
  } finally {
    detailLoading.value = false;
  }
}

/* ------------------------------ 编辑文案 ------------------------------ */

const editVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const form = ref<SentenceCardPayload>({ title: '', titleZh: '', sentenceEn: '', translationZh: '', blessing: '' });

/** 打开编辑。 */
function handleEdit(row: SentenceCardItem): void {
  editingId.value = row.id;
  form.value = {
    title: row.title,
    titleZh: row.titleZh,
    sentenceEn: row.sentenceEn,
    translationZh: row.translationZh,
    blessing: row.blessing,
  };
  editVisible.value = true;
}

/** 保存文案。 */
async function handleSave(): Promise<void> {
  if (editingId.value === null) {
    return;
  }
  if (!form.value.sentenceEn?.trim() || !form.value.translationZh?.trim()) {
    ElMessage.warning('英文短句与中文释义都不能为空');
    return;
  }
  saving.value = true;
  try {
    await updateSentenceCardApi(editingId.value, {
      title: form.value.title?.trim() || undefined,
      titleZh: form.value.titleZh?.trim() || undefined,
      sentenceEn: form.value.sentenceEn.trim(),
      translationZh: form.value.translationZh.trim(),
      blessing: form.value.blessing?.trim() || undefined,
    });
    ElMessage.success('保存成功');
    editVisible.value = false;
    await search();
  } finally {
    saving.value = false;
  }
}

/* ------------------------------ 重新生成 ------------------------------ */

const genVisible = ref(false);
const generating = ref(false);
const genDate = ref(todayStr());

/** 打开重新生成（可从行内带入该行日期）。 */
function handleGenerate(row?: SentenceCardItem): void {
  genDate.value = row?.bizDate ?? todayStr();
  genVisible.value = true;
}

/** 执行生成（同步等待 AI 文案 + 生图，10~40s）。 */
async function handleGenerateConfirm(): Promise<void> {
  if (!genDate.value) {
    ElMessage.warning('请选择日期');
    return;
  }
  generating.value = true;
  try {
    const result = await generateSentenceCardApi(genDate.value, true);
    ElMessage.success(result.generated ? `${result.bizDate} 生成成功` : `${result.bizDate} 已是就绪状态，未重新生成`);
    genVisible.value = false;
    await search();
  } finally {
    generating.value = false;
  }
}

/* ------------------------------ 删除 ------------------------------ */

/** 删除（连带领取记录）。 */
async function handleDelete(row: SentenceCardItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除 ${row.bizDate} 的句签吗？该日已领取的用户记录也会一并删除，且无法恢复。`,
      '提示',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  await deleteSentenceCardApi(row.id);
  ElMessage.success('已删除');
  await search();
}
</script>

<template>
  <div class="sentence-card-page table-page">
    <el-card shadow="never" class="table-page__card">
      <SearchForm class="table-page__filter" @search="search" @reset="reset">
        <el-form-item label="日期">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 240px"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="就绪" value="ready" />
            <el-option label="待生成" value="pending" />
            <el-option label="失败" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input
            v-model="query.keyword"
            placeholder="主题 / 文案"
            clearable
            style="width: 180px"
            @keyup.enter="search"
          />
        </el-form-item>
      </SearchForm>

      <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3 table-page__toolbar">
        <span class="text-[15px] font-semibold text-ink">每日句签（共 {{ total }} 天）</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button v-permission="'sentence:card:gen'" type="primary" @click="handleGenerate()"> 重新生成 </el-button>
          <el-button :loading="loading" @click="search">刷新</el-button>
        </div>
      </div>

      <div class="table-page__table">
        <el-table v-loading="loading" :data="list" border row-key="id" :height="tableHeight">
          <el-table-column prop="bizDate" label="日期" width="110" />
          <el-table-column label="配图" width="100">
            <template #default="{ row }">
              <el-image
                v-if="row.imageUrl"
                :src="row.imageUrl"
                :preview-src-list="[row.imageUrl]"
                preview-teleported
                fit="cover"
                class="w-[80px] h-[45px] rounded"
              />
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="主题" min-width="140">
            <template #default="{ row }">
              <div class="font-medium">{{ row.titleZh || '—' }}</div>
              <div class="text-xs text-muted">{{ row.title || '—' }}</div>
            </template>
          </el-table-column>
          <el-table-column label="文案" min-width="240">
            <template #default="{ row }">
              <div class="truncate">{{ row.sentenceEn || '—' }}</div>
              <div class="truncate text-xs text-muted">{{ row.translationZh || '—' }}</div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="statusTag(row.status).type" size="small">{{ statusTag(row.status).label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="claimCount" label="领取" width="80" />
          <el-table-column label="更新时间" width="160">
            <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
          </el-table-column>
          <!-- 操作列 250px：四个 link 按钮并排不换行（210px 时「删除」会被挤到第二行） -->
          <el-table-column label="操作" width="250" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="handleDetail(row as SentenceCardItem)">详情</el-button>
              <el-button
                v-permission="'sentence:card:edit'"
                link
                type="primary"
                @click="handleEdit(row as SentenceCardItem)"
              >
                编辑
              </el-button>
              <el-button
                v-permission="'sentence:card:gen'"
                link
                type="primary"
                @click="handleGenerate(row as SentenceCardItem)"
              >
                重生成
              </el-button>
              <el-button
                v-permission="'sentence:card:remove'"
                link
                type="danger"
                @click="handleDelete(row as SentenceCardItem)"
              >
                删除
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

    <!-- 详情 -->
    <el-drawer v-model="detailVisible" title="句签详情" size="480px">
      <!-- 滚动交给 el-scrollbar，避免抽屉里出现原生滚动条 -->
      <el-scrollbar class="h-full">
        <div v-loading="detailLoading" class="space-y-4">
          <template v-if="detail">
            <el-image
              v-if="detail.imageUrl"
              :src="detail.imageUrl"
              :preview-src-list="[detail.imageUrl]"
              preview-teleported
              fit="cover"
              class="w-full rounded-lg"
            />
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="业务日期">{{ detail.bizDate }}</el-descriptions-item>
              <el-descriptions-item label="主题">{{ detail.titleZh }}（{{ detail.title }}）</el-descriptions-item>
              <el-descriptions-item label="英文短句">{{ detail.sentenceEn }}</el-descriptions-item>
              <el-descriptions-item label="中文释义">{{ detail.translationZh }}</el-descriptions-item>
              <el-descriptions-item label="寄语">{{ detail.blessing || '—' }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="statusTag(detail.status).type" size="small">{{ statusTag(detail.status).label }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="领取人数">{{ detail.claimCount }}</el-descriptions-item>
            </el-descriptions>

            <div>
              <p class="mb-1 text-sm font-medium">生图提示词</p>
              <p
                class="rounded border border-solid border-[var(--el-border-color-lighter)] p-2 text-xs leading-relaxed text-muted"
              >
                {{ detail.scenePrompt || '—' }}
              </p>
            </div>

            <div>
              <p class="mb-1 text-sm font-medium">最近领取</p>
              <el-table v-if="detail.claims.length" :data="detail.claims" size="small" border>
                <el-table-column label="用户" min-width="140">
                  <template #default="{ row }">{{ row.nickname || row.email || `#${row.userId}` }}</template>
                </el-table-column>
                <el-table-column label="领取时间" min-width="150">
                  <template #default="{ row }">{{ formatDateTime(row.obtainedAt) }}</template>
                </el-table-column>
              </el-table>
              <p v-else class="text-xs text-muted">还没有用户领取</p>
            </div>
          </template>
        </div>
      </el-scrollbar>
    </el-drawer>

    <!-- 编辑文案 -->
    <BasicDialog
      v-model="editVisible"
      title="编辑句签文案"
      width="520px"
      :confirm-loading="saving"
      @confirm="handleSave"
    >
      <el-form label-width="90px">
        <el-form-item label="英文主题">
          <el-input v-model="form.title" maxlength="80" show-word-limit placeholder="如 Morning Ritual" />
        </el-form-item>
        <el-form-item label="中文主题">
          <el-input v-model="form.titleZh" maxlength="80" show-word-limit />
        </el-form-item>
        <el-form-item label="英文短句" required>
          <el-input v-model="form.sentenceEn" type="textarea" :rows="2" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="中文释义" required>
          <el-input v-model="form.translationZh" type="textarea" :rows="2" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="寄语">
          <el-input
            v-model="form.blessing"
            type="textarea"
            :rows="2"
            maxlength="120"
            show-word-limit
            placeholder="展示在卡背上的一句寄语，留空则客户端用兜底文案"
          />
        </el-form-item>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="文案改动立即对已领取的用户生效；换图请用「重新生成」"
        />
      </el-form>
    </BasicDialog>

    <!-- 重新生成 -->
    <BasicDialog
      v-model="genVisible"
      title="重新生成句签"
      width="440px"
      :confirm-loading="generating"
      confirm-text="开始生成"
      @confirm="handleGenerateConfirm"
    >
      <el-form label-width="80px">
        <el-form-item label="日期" required>
          <el-date-picker v-model="genDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-alert
          type="warning"
          :closable="false"
          show-icon
          title="会覆盖该日期已有的文案与配图"
          description="生成走 AI 写文案 + AI 生图，通常 10~40 秒，期间请勿关闭页面。"
        />
      </el-form>
    </BasicDialog>
  </div>
</template>
