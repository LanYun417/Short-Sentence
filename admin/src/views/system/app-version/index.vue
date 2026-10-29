<script setup lang="ts">
/**
 * App 版本管理页。
 * 模块职责：上传 .apk、维护版本信息与更新说明、上下架、删除；下载量只读展示。
 *
 * 为什么要单独的版本表：客户端要按 versionCode 判断「比我当前装的更新」，
 * 回滚时也要能找回历史包——只存一个「最新包」这两件事都做不到。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import type { UploadRequestOptions } from 'element-plus';
import {
  createAppVersionApi,
  deleteAppVersionApi,
  getAppVersionListApi,
  setAppVersionStatusApi,
  updateAppVersionApi,
  uploadApkApi,
} from '@/api/app-version';
import { useTable } from '@/composables/useTable';
import { formatDateTime, formatFileSize } from '@/utils/format';
import type { AppVersionItem, AppVersionPayload } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import BasicDialog from '@/components/BasicDialog/index.vue';

defineOptions({ name: 'SystemAppVersion' });

const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getAppVersionListApi({
      page: p.page,
      pageSize: p.pageSize,
      platform: p.platform || undefined,
      status: p.status,
      keyword: p.keyword?.trim() || undefined,
    }),
  {
    platform: '',
    // undo 显式标注：否则被宽化成 string，与查询入参不兼容
    status: undefined as number | undefined,
    keyword: '',
  },
);

/* ------------------------------ 新增 / 编辑 ------------------------------ */

const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const uploading = ref(false);
/** 表单里回显「已上传的包名」（只是展示，不落库） */
const uploadedName = ref('');

const form = ref<AppVersionPayload>({
  version: '',
  versionCode: 1,
  fileId: 0,
  fileSize: 0,
  changelog: '',
  forceUpdate: 0,
  status: 1,
});

/**
 * el-upload 自定义上传：选中即传，拿到 fileId 存进表单。
 * 不在这里提交版本——用户可能还想改更新说明，两步分开更清楚。
 */
async function handleUploadApk(options: UploadRequestOptions): Promise<void> {
  uploading.value = true;
  try {
    const result = await uploadApkApi(options.file);
    form.value.fileId = result.fileId;
    form.value.fileSize = result.size;
    uploadedName.value = options.file.name;
    ElMessage.success('安装包上传成功');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '安装包上传失败');
  } finally {
    uploading.value = false;
  }
}

function handleCreate(): void {
  editingId.value = null;
  uploadedName.value = '';
  form.value = { version: '', versionCode: 1, fileId: 0, fileSize: 0, changelog: '', forceUpdate: 0, status: 1 };
  dialogVisible.value = true;
}

function handleEdit(row: AppVersionItem): void {
  editingId.value = row.id;
  uploadedName.value = row.fileName ?? '';
  form.value = {
    version: row.version,
    versionCode: row.versionCode,
    fileId: row.fileId,
    fileSize: row.fileSize,
    changelog: row.changelog,
    forceUpdate: row.forceUpdate ? 1 : 0,
    status: row.status,
  };
  dialogVisible.value = true;
}

async function handleSave(): Promise<void> {
  if (!form.value.version.trim()) {
    ElMessage.warning('请填写版本号');
    return;
  }
  if (!form.value.fileId) {
    ElMessage.warning('请先上传安装包');
    return;
  }
  saving.value = true;
  try {
    const payload: AppVersionPayload = {
      ...form.value,
      version: form.value.version.trim(),
      changelog: form.value.changelog?.trim(),
    };
    if (editingId.value === null) {
      await createAppVersionApi(payload);
      ElMessage.success('版本已创建');
    } else {
      await updateAppVersionApi(editingId.value, payload);
      ElMessage.success('已保存');
    }
    dialogVisible.value = false;
    await getList();
  } finally {
    saving.value = false;
  }
}

/** 上下架 */
async function handleToggleStatus(row: AppVersionItem): Promise<void> {
  const next = row.status === 1 ? 0 : 1;
  await setAppVersionStatusApi(row.id, next);
  ElMessage.success(next === 1 ? '已上架' : '已下架');
  await getList();
}

/** 删除（只删版本记录，安装包留给「文件管理」统一清理） */
async function handleDelete(row: AppVersionItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除版本 v${row.version} 吗？安装包文件不会被删除（由「文件管理」统一清理）。`,
      '提示',
      { type: 'warning', confirmButtonText: '确认删除', confirmButtonClass: 'el-button--danger' },
    );
  } catch {
    return;
  }
  await deleteAppVersionApi(row.id);
  ElMessage.success('已删除');
  await getList();
}

/** 强制更新标记的可读文案 */
function forceText(value: boolean): string {
  return value ? '是' : '否';
}

onMounted(() => {
  void getList();
});
</script>

<template>
  <div class="app-version-page">
    <SearchForm @search="search" @reset="reset">
      <el-form-item label="关键词">
        <el-input v-model="query.keyword" placeholder="版本号 / 更新说明" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 110px">
          <el-option label="上架" :value="1" />
          <el-option label="下架" :value="0" />
        </el-select>
      </el-form-item>
    </SearchForm>

    <el-card shadow="never" class="mt-4">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-y-2">
        <span class="text-[15px] font-semibold text-ink">App 版本（共 {{ total }} 个）</span>
        <div class="flex items-center gap-2">
          <el-button v-permission="'system:app-version:add'" type="primary" @click="handleCreate">
            上传新版本
          </el-button>
          <el-button :loading="loading" @click="getList">刷新</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border row-key="id">
        <el-table-column label="版本" width="140">
          <template #default="{ row }">
            <span class="font-medium">v{{ row.version }}</span>
            <span class="ml-1 text-xs text-gray-400">({{ row.versionCode }})</span>
          </template>
        </el-table-column>
        <el-table-column label="平台" width="90">
          <template #default="{ row }">{{ row.platform === 'android' ? 'Android' : 'iOS' }}</template>
        </el-table-column>
        <el-table-column label="安装包" min-width="200">
          <template #default="{ row }">
            <span class="text-sm">{{ row.fileName || '—' }}</span>
            <span class="ml-1 text-xs text-gray-400">{{ formatFileSize(row.fileSize) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="更新说明" min-width="240">
          <template #default="{ row }">
            <p class="text-sm break-all line-clamp-2">{{ row.changelog || '—' }}</p>
          </template>
        </el-table-column>
        <el-table-column label="强制更新" width="90">
          <template #default="{ row }">{{ forceText(row.forceUpdate) }}</template>
        </el-table-column>
        <el-table-column label="下载量" width="90">
          <template #default="{ row }">{{ row.downloadCount }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '上架' : '下架' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发布时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.publishedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              v-permission="'system:app-version:edit'"
              link
              type="primary"
              @click="handleEdit(row as AppVersionItem)"
            >
              编辑
            </el-button>
            <el-button
              v-permission="'system:app-version:edit'"
              link
              type="primary"
              @click="handleToggleStatus(row as AppVersionItem)"
            >
              {{ row.status === 1 ? '下架' : '上架' }}
            </el-button>
            <el-button
              v-permission="'system:app-version:remove'"
              link
              type="danger"
              @click="handleDelete(row as AppVersionItem)"
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

    <!-- 上传 / 编辑 -->
    <BasicDialog
      v-model="dialogVisible"
      :title="editingId === null ? '上传新版本' : '编辑版本'"
      width="620px"
      :show-footer="false"
    >
      <el-form label-width="96px">
        <el-form-item label="版本号" required>
          <el-input v-model="form.version" maxlength="50" placeholder="如 1.2.0" />
        </el-form-item>
        <el-form-item label="版本序号" required>
          <el-input-number v-model="form.versionCode" :min="1" :step="1" />
          <span class="ml-2 text-xs text-gray-400">必须比上一版大（Android versionCode）</span>
        </el-form-item>
        <el-form-item label="安装包" required>
          <div class="flex flex-col gap-1">
            <el-upload :show-file-list="false" accept=".apk" :http-request="handleUploadApk">
              <el-button :loading="uploading">{{ form.fileId ? '重新上传 .apk' : '选择 .apk 上传' }}</el-button>
            </el-upload>
            <span v-if="form.fileId" class="text-xs text-success">
              已上传：{{ uploadedName }}（{{ formatFileSize(form.fileSize) }}）
            </span>
            <span v-else class="text-xs text-gray-400">仅支持 .apk，单个不超过 200MB</span>
          </div>
        </el-form-item>
        <el-form-item label="更新说明">
          <el-input
            v-model="form.changelog"
            type="textarea"
            :rows="4"
            maxlength="1000"
            show-word-limit
            placeholder="本次更新了什么（一行一条更好读），会展示在下载页与新版本提示里"
          />
        </el-form-item>
        <el-form-item label="强制更新">
          <el-switch v-model="form.forceUpdate" :active-value="1" :inactive-value="0" />
          <span class="ml-2 text-xs text-gray-400">开启后客户端可要求必须升级才能继续使用</span>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">上架</el-radio>
            <el-radio :value="0">下架</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">确定</el-button>
      </template>
    </BasicDialog>
  </div>
</template>
