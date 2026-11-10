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
  updateCategoryApi,
} from '@/api/sentence';
import type { SentenceCategoryItem, SentenceCategoryPayload } from '@/types/api';
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
              <img
                v-if="row.coverUrl"
                :src="row.coverUrl"
                :alt="row.name"
                class="h-full w-full object-cover"
                loading="lazy"
              />
              <span v-else class="text-[10px] text-gray-400">未生成</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
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
  </div>
</template>
