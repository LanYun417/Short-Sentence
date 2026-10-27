<script setup lang="ts">
/**
 * 场景分类管理页（「短句」运营后台）。
 * 模块职责：分类列表（含题目数）/ 新增 / 编辑 / 删除（有题目引用时后端拒绝）。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import { createCategoryApi, deleteCategoryApi, getCategoryListApi, updateCategoryApi } from '@/api/sentence';
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
</script>

<template>
  <div class="sentence-category-page">
    <el-card shadow="never">
      <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3">
        <span class="text-[15px] font-semibold text-ink">场景分类（共 {{ list.length }} 个）</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button v-permission="'sentence:category'" type="primary" @click="handleCreate">新增分类</el-button>
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
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sentenceCount" label="题目数" width="90" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
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
