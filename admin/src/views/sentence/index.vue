<script setup lang="ts">
/**
 * 题库管理页（「短句」运营后台）。
 * 模块职责：题目分页筛选 / 增改下架、手动触发每日生成、生成批次进度监控。
 * 权限：按钮级 v-permission（sentence:list/query/add/edit/remove/gen），与种子菜单一致。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import {
  createSentenceApi,
  deleteSentenceApi,
  getCategoryOptionsApi,
  getGenTaskListApi,
  getSentenceListApi,
  triggerGenApi,
  updateSentenceApi,
  type SentenceCategoryOption,
} from '@/api/sentence';
import { useTable } from '@/composables/useTable';
import { formatDateTime } from '@/utils/format';
import { withUploadToken } from '@/utils/uploadToken';
import type { GenTaskItem, SentenceItem, SentenceSavePayload, SentenceStatus } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { ref } from 'vue';

defineOptions({ name: 'SentenceList' });

/** 状态 → 标签样式与文案 */
const STATUS_TAG: Record<SentenceStatus, { type: 'primary' | 'success' | 'info'; label: string }> = {
  pending_image: { type: 'info', label: '待生成' },
  ready: { type: 'success', label: '就绪' },
  offline: { type: 'primary', label: '已下架' },
};

/** 难度文案 */
const DIFFICULTY_LABEL: Record<number, string> = { 1: '基础', 2: '进阶', 3: '挑战' };

/** 生成批次状态标签 */
const GEN_STATUS_TAG: Record<string, { type: 'primary' | 'success' | 'warning' | 'danger'; label: string }> = {
  pending: { type: 'info' as unknown as 'primary', label: '待处理' },
  running: { type: 'primary', label: '进行中' },
  success: { type: 'success', label: '成功' },
  failed: { type: 'danger', label: '失败' },
};

const categories = ref<SentenceCategoryOption[]>([]);

const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getSentenceListApi({
      page: p.page,
      pageSize: p.pageSize,
      keyword: p.keyword?.trim() || undefined,
      status: p.status,
      difficulty: p.difficulty,
    }),
  { keyword: '', status: undefined as SentenceStatus | undefined, difficulty: undefined as number | undefined },
);

/* ------------------------------ 表单弹窗 ------------------------------ */

const dialogVisible = ref(false);
const dialogSaving = ref(false);
const editingId = ref<number | null>(null);
const form = ref<SentenceSavePayload>({
  categoryId: 0,
  sentenceEn: '',
  translationZh: '',
  ipa: '',
  scenePrompt: '',
  difficulty: 2,
  status: 'ready',
});

/** 打开新增。 */
function handleCreate(): void {
  editingId.value = null;
  form.value = {
    categoryId: categories.value[0]?.id ?? 0,
    sentenceEn: '',
    translationZh: '',
    ipa: '',
    scenePrompt: '',
    difficulty: 2,
    status: 'ready',
  };
  dialogVisible.value = true;
}

/** 打开编辑（回填；状态缺省按就绪处理）。 */
function handleEdit(row: SentenceItem): void {
  editingId.value = row.id;
  form.value = {
    categoryId: row.categoryId,
    sentenceEn: row.sentenceEn,
    translationZh: row.translationZh,
    ipa: row.ipa ?? '',
    scenePrompt: row.scenePrompt,
    difficulty: row.difficulty,
    status: row.status === 'offline' ? 'offline' : 'ready',
  };
  dialogVisible.value = true;
}

/** 保存（新增/编辑共用）。 */
async function handleSave(): Promise<void> {
  if (!form.value.sentenceEn.trim() || !form.value.translationZh.trim()) {
    ElMessage.warning('英文句子与中文释义必填');
    return;
  }
  if (!form.value.categoryId) {
    ElMessage.warning('请选择分类');
    return;
  }
  dialogSaving.value = true;
  try {
    const payload: SentenceSavePayload = {
      categoryId: form.value.categoryId,
      sentenceEn: form.value.sentenceEn.trim(),
      translationZh: form.value.translationZh.trim(),
      ipa: form.value.ipa?.trim() || undefined,
      scenePrompt: form.value.scenePrompt?.trim() || undefined,
      difficulty: form.value.difficulty,
      status: form.value.status,
    };
    if (editingId.value === null) {
      await createSentenceApi(payload);
      ElMessage.success('新增成功');
    } else {
      await updateSentenceApi(editingId.value, payload);
      ElMessage.success('保存成功');
    }
    dialogVisible.value = false;
    await getList();
  } finally {
    dialogSaving.value = false;
  }
}

/** 下架（软删除）。 */
async function handleOffline(row: SentenceItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定下架「${row.sentenceEn}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  await deleteSentenceApi(row.id);
  ElMessage.success('已下架');
  await getList();
}

/* ------------------------------ 生成批次 ------------------------------ */

const genDialogVisible = ref(false);
const genLoading = ref(false);
const genList = ref<GenTaskItem[]>([]);
const genTotal = ref(0);
const genPage = ref(1);
const genPageSize = ref(10);

/** 手动触发批量生成。 */
async function handleTriggerGen(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `将按每日目标量异步生成题目与配图（每日本批次仅可执行一次），进度可在「生成批次」查看。确认触发？`,
      '触发生成',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  const result = await triggerGenApi();
  ElMessage.success(`生成任务已启动（批次 #${result.taskId}）`);
  await loadGenTasks();
}

/** 加载批次列表。 */
async function loadGenTasks(): Promise<void> {
  genLoading.value = true;
  try {
    const data = await getGenTaskListApi({ page: genPage.value, pageSize: genPageSize.value });
    genList.value = data.list;
    genTotal.value = data.total;
  } finally {
    genLoading.value = false;
  }
}

/** 打开批次监控。 */
async function handleOpenGenTasks(): Promise<void> {
  genDialogVisible.value = true;
  await loadGenTasks();
}

onMounted(async () => {
  categories.value = await getCategoryOptionsApi().catch(() => []);
  await getList();
});
</script>

<template>
  <div class="sentence-page">
    <!-- 查询表单：关键词 / 状态 / 难度 -->
    <SearchForm @search="search" @reset="reset">
      <el-form-item label="关键词">
        <el-input v-model="query.keyword" placeholder="英文句子 / 中文释义" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 140px">
          <el-option label="待生成" value="pending_image" />
          <el-option label="就绪" value="ready" />
          <el-option label="已下架" value="offline" />
        </el-select>
      </el-form-item>
      <el-form-item label="难度">
        <el-select v-model="query.difficulty" placeholder="全部" clearable style="width: 140px">
          <el-option label="基础" :value="1" />
          <el-option label="进阶" :value="2" />
          <el-option label="挑战" :value="3" />
        </el-select>
      </el-form-item>
    </SearchForm>

    <el-card shadow="never" class="mt-4">
      <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3">
        <span class="text-[15px] font-semibold text-ink">题库列表（共 {{ total }}）</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button v-permission="'sentence:add'" type="primary" @click="handleCreate">新增题目</el-button>
          <el-button v-permission="'sentence:gen'" type="warning" plain @click="handleTriggerGen">生成题库</el-button>
          <el-button @click="handleOpenGenTasks">生成批次</el-button>
          <el-button :loading="loading" @click="getList">刷新</el-button>
        </div>
      </div>

      <!-- 题目表 -->
      <el-table v-loading="loading" :data="list" border row-key="id">
        <el-table-column label="配图" width="110">
          <template #default="{ row }">
            <el-image
              v-if="row.imageUrl"
              :src="withUploadToken(`${row.imageUrl}?scale=200`)"
              :preview-src-list="[withUploadToken(row.imageUrl)]"
              fit="cover"
              style="width: 88px; height: 50px; border-radius: 6px"
            />
            <span v-else class="text-gray-400">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="sentenceEn" label="英文句子" min-width="220" show-overflow-tooltip />
        <el-table-column prop="translationZh" label="中文释义" min-width="160" show-overflow-tooltip />
        <el-table-column prop="ipa" label="音标" min-width="120" show-overflow-tooltip />
        <el-table-column label="分类" width="100">
          <template #default="{ row }">{{ row.categoryName ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="难度" width="80">
          <template #default="{ row }">{{ DIFFICULTY_LABEL[row.difficulty] ?? row.difficulty }}</template>
        </el-table-column>
        <el-table-column label="来源" width="80">
          <template #default="{ row }">
            <el-tag :type="row.source === 'ai' ? 'success' : 'info'" size="small">
              {{ row.source === 'ai' ? 'AI' : '手工' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="STATUS_TAG[row.status as SentenceStatus]?.type ?? 'info'" size="small">
              {{ STATUS_TAG[row.status as SentenceStatus]?.label ?? row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'sentence:edit'" link type="primary" @click="handleEdit(row as SentenceItem)"
              >编辑</el-button
            >
            <el-button v-permission="'sentence:remove'" link type="danger" @click="handleOffline(row as SentenceItem)"
              >下架</el-button
            >
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

    <!-- 新增/编辑弹窗（自定义 footer：保存中禁用确定按钮） -->
    <BasicDialog
      v-model="dialogVisible"
      :title="editingId === null ? '新增题目' : '编辑题目'"
      width="560px"
      :show-footer="false"
    >
      <el-form label-width="80px">
        <el-form-item label="分类" required>
          <el-select v-model="form.categoryId" placeholder="选择分类" style="width: 100%">
            <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="英文句子" required>
          <el-input v-model="form.sentenceEn" maxlength="300" show-word-limit />
        </el-form-item>
        <el-form-item label="中文释义" required>
          <el-input v-model="form.translationZh" maxlength="300" show-word-limit />
        </el-form-item>
        <el-form-item label="音标">
          <el-input v-model="form.ipa" maxlength="200" placeholder="如 /kəˈfeɪ/" />
        </el-form-item>
        <el-form-item label="生图提示词">
          <el-input
            v-model="form.scenePrompt"
            type="textarea"
            :rows="2"
            maxlength="500"
            placeholder="两人对话场景构图；留空按句子自动生成"
          />
        </el-form-item>
        <el-form-item label="难度">
          <el-radio-group v-model="form.difficulty">
            <el-radio :value="1">基础</el-radio>
            <el-radio :value="2">进阶</el-radio>
            <el-radio :value="3">挑战</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="editingId !== null" label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="ready">就绪</el-radio>
            <el-radio value="offline">下架</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogSaving" @click="handleSave">保存</el-button>
      </template>
    </BasicDialog>

    <!-- 生成批次监控 -->
    <BasicDialog v-model="genDialogVisible" title="生成批次" width="760px" :show-footer="false">
      <el-table v-loading="genLoading" :data="genList" border max-height="420">
        <el-table-column prop="id" label="批次" width="70" />
        <el-table-column prop="bizDate" label="业务日期" width="120" />
        <el-table-column label="进度" width="200">
          <template #default="{ row }">
            题目 {{ row.textDone }}/{{ row.targetCount }} · 图片 {{ row.imageDone }}
            <el-tag v-if="row.failCount > 0" type="danger" size="small" class="ml-1">失败 {{ row.failCount }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="GEN_STATUS_TAG[row.status]?.type ?? 'info'" size="small">
              {{ GEN_STATUS_TAG[row.status]?.label ?? row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="触发" width="80">
          <template #default="{ row }">{{ row.triggerType === 'cron' ? '定时' : '手动' }}</template>
        </el-table-column>
        <el-table-column prop="errorMessage" label="错误摘要" min-width="140" show-overflow-tooltip />
        <el-table-column label="完成时间" width="170">
          <template #default="{ row }">{{ row.finishedAt ? formatDateTime(row.finishedAt) : '—' }}</template>
        </el-table-column>
      </el-table>
      <Pagination
        v-model:current-page="genPage"
        v-model:page-size="genPageSize"
        :total="genTotal"
        layout="total, prev, pager, next"
        @size-change="
          (s: number) => {
            genPageSize = s;
            loadGenTasks();
          }
        "
        @current-change="
          (p: number) => {
            genPage = p;
            loadGenTasks();
          }
        "
      />
    </BasicDialog>
  </div>
</template>
