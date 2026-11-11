<script setup lang="ts">
/**
 * 场景分类管理页（「短句」运营后台）。
 * 模块职责：分类列表（含题目数）/ 新增 / 编辑 / 删除（有题目引用时后端拒绝）。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import {
  createCategoryApi,
  deleteCategoryApi,
  generateCategoryCoverApi,
  generateMissingCategoryCoversApi,
  getCategoryListApi,
  getCoverGenLogsApi,
  regenerateAllCategoryCoversApi,
  updateCategoryApi,
} from '@/api/sentence';
import type { CoverGenLogItem } from '@/api/sentence';
import type { SentenceCategoryItem, SentenceCategoryPayload } from '@/types/api';
import { formatDateTime } from '@/utils/format';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { ref } from 'vue';

defineOptions({ name: 'SentenceCategory' });

const loading = ref(false);
const list = ref<SentenceCategoryItem[]>([]);

/** 加载列表。 */
async function load(): Promise<void> {
  loading.value = true;
  try {
    list.value = await getCategoryListApi();
  } finally {
    loading.value = false;
  }
}

/* ------------------------------ 表单 ------------------------------ */

const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const form = ref<SentenceCategoryPayload>({ name: '', nameEn: '', icon: '', sort: 0, status: 1 });

/** 打开新增。 */
function handleCreate(): void {
  editingId.value = null;
  form.value = { name: '', nameEn: '', icon: '', sort: list.value.length + 1, status: 1 };
  dialogVisible.value = true;
}

/** 打开编辑。 */
function handleEdit(row: SentenceCategoryItem): void {
  editingId.value = row.id;
  form.value = {
    name: row.name,
    nameEn: row.nameEn ?? '',
    icon: row.icon ?? '',
    sort: row.sort,
    status: row.status,
  };
  dialogVisible.value = true;
}

/** 保存。 */
async function handleSave(): Promise<void> {
  const name = form.value.name.trim();
  if (!name) {
    ElMessage.warning('分类名称必填');
    return;
  }
  saving.value = true;
  try {
    const payload: SentenceCategoryPayload = {
      name,
      nameEn: form.value.nameEn?.trim() || undefined,
      icon: form.value.icon?.trim() || undefined,
      sort: form.value.sort ?? 0,
      status: form.value.status ?? 1,
    };
    if (editingId.value === null) {
      await createCategoryApi(payload);
      ElMessage.success('新增成功');
    } else {
      await updateCategoryApi(editingId.value, payload);
      ElMessage.success('保存成功');
    }
    dialogVisible.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

/** 删除。 */
async function handleDelete(row: SentenceCategoryItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除分类「${row.name}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  await deleteCategoryApi(row.id);
  ElMessage.success('已删除');
  await load();
}

onMounted(() => {
  void load();
});

/* ------------------------------ 场景封面（AI 生图） ------------------------------ */

/** 正在生成封面的分类 id 集合；'all' = 一键补全 */
const coveringIds = ref<string[]>([]);

function isCovering(key: string): boolean {
  return coveringIds.value.includes(key);
}

/**
 * 生成/重新生成场景封面。已有封面时 regenerate 走「重新生成」（二次确认）。
 * 封面同时用于闯关地图的场景卡与节日题库卡（同一字段，互不冲突）。
 */
async function generateCover(row: SentenceCategoryItem, regenerate = false): Promise<void> {
  if (regenerate) {
    try {
      await ElMessageBox.confirm('重新生成会覆盖当前封面图（旧图文件仍在 file 表，可回溯），确定吗？', '重新生成封面', {
        type: 'warning',
        confirmButtonText: '重新生成',
        cancelButtonText: '取消',
      });
    } catch {
      return;
    }
  }
  const mark = String(row.id);
  coveringIds.value = [...coveringIds.value, mark];
  try {
    await generateCategoryCoverApi(row.id, regenerate);
    ElMessage.success('封面已生成');
    await load();
  } finally {
    coveringIds.value = coveringIds.value.filter((item) => item !== mark);
  }
}

/** 一键补齐全部缺失场景封面。 */
async function generateAllCovers(): Promise<void> {
  coveringIds.value = [...coveringIds.value, 'all'];
  try {
    const result = await generateMissingCategoryCoversApi();
    const failed = result.failed.length;
    ElMessage.success(
      failed > 0 ? `已补全 ${result.generated.length} 张，${failed} 张失败（可重试）` : '缺失场景封面已补全',
    );
    await load();
  } finally {
    coveringIds.value = coveringIds.value.filter((item) => item !== 'all');
  }
}

/** 批量重新生成全部启用分类的封面（覆盖已有图，消耗较多生图配额，需二次确认）。 */
async function regenerateAllCovers(): Promise<void> {
  const total = list.value.filter((item) => item.status === 1).length;
  try {
    await ElMessageBox.confirm(
      `将为全部 ${total} 个启用分类重新生成封面，会覆盖现有封面图且消耗较多 AI 生图配额。确定批量重生吗？`,
      '批量重新生图',
      { type: 'warning', confirmButtonText: '批量重生', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  // 与「补全缺失封面」共用 'all' 标记：两个批量任务互斥，避免同时抢生图配额
  coveringIds.value = [...coveringIds.value, 'all'];
  try {
    const result = await regenerateAllCategoryCoversApi();
    ElMessage.success(
      `批量重生完成：成功 ${result.generated.length} 张，失败 ${result.failed.length} 张` +
        (result.failed.length > 0 ? '，失败原因见「生图日志」' : ''),
    );
    await load();
  } finally {
    coveringIds.value = coveringIds.value.filter((item) => item !== 'all');
  }
}

/* ------------------------------ 封面生成日志 ------------------------------ */

const logVisible = ref(false);
const logLoading = ref(false);
const logs = ref<CoverGenLogItem[]>([]);
const logTotal = ref(0);
const logPage = ref(1);
const logPageSize = ref(20);
const logStatus = ref('');
const logBizId = ref('');

const LOG_STATUS_LABEL: Record<string, string> = {
  success: '成功',
  rejected: '审核不通过',
  failed: '失败',
};

function logStatusTag(status: string): 'success' | 'warning' | 'danger' {
  return status === 'success' ? 'success' : status === 'rejected' ? 'warning' : 'danger';
}

/** 拉取封面生成日志（审核原因、重试轨迹都落在 errorMessage 里）。 */
async function loadCoverLogs(): Promise<void> {
  logLoading.value = true;
  try {
    const bizId = Number(logBizId.value);
    const result = await getCoverGenLogsApi({
      page: logPage.value,
      pageSize: logPageSize.value,
      status: logStatus.value || undefined,
      bizId: Number.isFinite(bizId) && bizId > 0 ? bizId : undefined,
    });
    logs.value = result.list;
    logTotal.value = result.total;
  } finally {
    logLoading.value = false;
  }
}

function openCoverLogs(): void {
  logVisible.value = true;
  void loadCoverLogs();
}

function searchCoverLogs(): void {
  logPage.value = 1;
  void loadCoverLogs();
}
</script>

<template>
  <div class="sentence-category-page">
    <el-card shadow="never">
      <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3">
        <span class="text-[15px] font-semibold text-ink">场景分类（共 {{ list.length }} 个）</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button v-permission="'sentence:category'" type="primary" @click="handleCreate">新增分类</el-button>
          <el-button v-permission="'sentence:category'" :loading="isCovering('all')" @click="generateAllCovers">
            补全缺失封面
          </el-button>
          <el-button v-permission="'sentence:category'" :loading="isCovering('all')" @click="regenerateAllCovers">
            批量重新生图
          </el-button>
          <el-button @click="openCoverLogs">生图日志</el-button>
          <el-button :loading="loading" @click="load">刷新</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border row-key="id">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="分类名称" min-width="140" />
        <el-table-column prop="nameEn" label="英文名" min-width="120">
          <template #default="{ row }">{{ row.nameEn ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="icon" label="图标" min-width="120">
          <template #default="{ row }">{{ row.icon ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="封面" width="120">
          <template #default="{ row }">
            <div
              class="flex h-12 w-16 items-center justify-center overflow-hidden rounded bg-gray-100 dark:bg-gray-800"
            >
              <el-image
                v-if="row.coverUrl"
                :src="row.coverUrl"
                :preview-src-list="[row.coverUrl]"
                preview-teleported
                fit="cover"
                class="h-full w-full cursor-zoom-in"
              />
              <span v-else class="text-[10px] text-gray-400">未生成</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sentenceCount" label="题目数" width="90" />
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button
              v-permission="'sentence:category'"
              link
              type="primary"
              :loading="isCovering(String(row.id))"
              @click="generateCover(row as SentenceCategoryItem, Boolean(row.coverUrl))"
            >
              {{ row.coverUrl ? '重生成封面' : '生成封面' }}
            </el-button>
            <el-button
              v-permission="'sentence:category'"
              link
              type="primary"
              @click="handleEdit(row as SentenceCategoryItem)"
            >
              编辑
            </el-button>
            <el-button
              v-permission="'sentence:category'"
              link
              type="danger"
              @click="handleDelete(row as SentenceCategoryItem)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <BasicDialog
      v-model="dialogVisible"
      :title="editingId === null ? '新增分类' : '编辑分类'"
      width="480px"
      :show-footer="false"
    >
      <el-form label-width="80px">
        <el-form-item label="分类名称" required>
          <el-input v-model="form.name" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="英文名">
          <el-input v-model="form.nameEn" maxlength="50" placeholder="客户端卡片副标题，可留空" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="form.icon" maxlength="100" placeholder="lucide 图标名，如 shopping-bag / heart" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="999" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </BasicDialog>

    <!-- 封面生成日志：审核不通过原因、自动重试轨迹都在详情列，不用再翻控制台 -->
    <el-drawer v-model="logVisible" title="封面生成日志" size="780px" destroy-on-close>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <el-select v-model="logStatus" placeholder="全部状态" clearable style="width: 140px" @change="searchCoverLogs">
          <el-option label="成功" value="success" />
          <el-option label="审核不通过" value="rejected" />
          <el-option label="失败" value="failed" />
        </el-select>
        <el-input
          v-model="logBizId"
          placeholder="分类 ID"
          clearable
          style="width: 120px"
          @keyup.enter="searchCoverLogs"
        />
        <el-button type="primary" @click="searchCoverLogs">查询</el-button>
        <el-button :loading="logLoading" @click="loadCoverLogs">刷新</el-button>
        <span class="ml-auto text-xs text-gray-400">共 {{ logTotal }} 条</span>
      </div>
      <el-table v-loading="logLoading" :data="logs" border row-key="id" max-height="560">
        <el-table-column label="时间" width="165">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="分类 ID" width="90">
          <template #default="{ row }">{{ row.bizId || '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="logStatusTag(row.status)" size="small">
              {{ LOG_STATUS_LABEL[row.status] ?? row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="90">
          <template #default="{ row }">{{ row.latencyMs }} ms</template>
        </el-table-column>
        <el-table-column label="详情（对象 / 审核原因 / 重试轨迹）" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">{{ row.errorMessage ?? '—' }}</template>
        </el-table-column>
      </el-table>
      <div class="mt-3 flex justify-end">
        <el-pagination
          v-model:current-page="logPage"
          v-model:page-size="logPageSize"
          :total="logTotal"
          layout="total, prev, pager, next"
          background
          @current-change="loadCoverLogs"
        />
      </div>
    </el-drawer>
  </div>
</template>
