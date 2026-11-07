<script setup lang="ts">
/**
 * 客户端公告页（「短句」运营后台）。
 * 模块职责：向**用户端（Web / App）**发布全员公告 —— 列表筛选 / 发布 / 编辑 /
 * 撤回与恢复 / 删除，并展示每条公告的已读人数。
 *
 * ⚠️ 与「系统 → 通知中心」不是一回事：那里是后台**站内信**（发给指定的后台用户，
 * 按人一行）；这里是发给**客户端用户**的广播公告（一条内容全员可见，已读按人统计）。
 * 两个入口的受众与语义都不同，别混用。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import {
  createClientNoticeApi,
  deleteClientNoticeApi,
  getClientNoticeListApi,
  setClientNoticeStatusApi,
  updateClientNoticeApi,
} from '@/api/client-notice';
import { useTable } from '@/composables/useTable';
import { useTablePage } from '@/composables/useTablePage';
import { formatDateTime } from '@/utils/format';
import type { ClientNoticeItem, ClientNoticePayload, ClientNoticeStatus } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { ref } from 'vue';

defineOptions({ name: 'ClientNotice' });

const { tableHeight } = useTablePage();

/** 状态 → 标签（未知状态原样展示，不吞信息）。 */
const STATUS_TAG: Record<number, { type: 'success' | 'info' | 'warning'; label: string }> = {
  0: { type: 'info', label: '草稿' },
  1: { type: 'success', label: '已发布' },
  2: { type: 'warning', label: '已撤回' },
};

function statusTag(status: number): { type: 'success' | 'info' | 'warning'; label: string } {
  return STATUS_TAG[status] ?? { type: 'info', label: String(status) };
}

/** 通知类型（与后端枚举一致）。 */
const TYPE_LABEL: Record<number, string> = { 1: '系统', 2: '公告', 3: '活动' };

const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getClientNoticeListApi({
      page: p.page,
      pageSize: p.pageSize,
      status: p.status,
      noticeType: p.noticeType,
      title: p.title?.trim() || undefined,
    }),
  {
    status: undefined as ClientNoticeStatus | undefined,
    noticeType: undefined as number | undefined,
    title: '',
  },
);

/* ------------------------------ 发布 / 编辑 ------------------------------ */

const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const form = ref<ClientNoticePayload>({ title: '', content: '', noticeType: 2, link: '', pinned: 0 });

/** 打开新增（默认「公告」类型）。 */
function handleCreate(): void {
  editingId.value = null;
  form.value = { title: '', content: '', noticeType: 2, link: '', pinned: 0 };
  dialogVisible.value = true;
}

/** 打开编辑（回填；状态不在弹窗里改，用列表的发布/撤回操作）。 */
function handleEdit(row: ClientNoticeItem): void {
  editingId.value = row.id;
  form.value = {
    title: row.title,
    content: row.content,
    noticeType: row.noticeType,
    link: row.link ?? '',
    pinned: row.pinned,
  };
  dialogVisible.value = true;
}

/**
 * 保存。
 * @param publish 新增时是否立即发布（false = 存草稿）；编辑时该参数无效
 */
async function handleSave(publish: boolean): Promise<void> {
  const title = form.value.title.trim();
  const content = form.value.content.trim();
  if (!title) {
    ElMessage.warning('标题必填');
    return;
  }
  if (!content) {
    ElMessage.warning('正文必填');
    return;
  }
  const payload: ClientNoticePayload = {
    title,
    content,
    noticeType: form.value.noticeType,
    link: form.value.link?.trim() || undefined,
    pinned: form.value.pinned ?? 0,
  };
  saving.value = true;
  try {
    if (editingId.value === null) {
      await createClientNoticeApi({ ...payload, publish });
      ElMessage.success(publish ? '已发布，用户端立即可见' : '已存为草稿');
    } else {
      await updateClientNoticeApi(editingId.value, payload);
      ElMessage.success('保存成功');
    }
    dialogVisible.value = false;
    await getList();
  } finally {
    saving.value = false;
  }
}

/* ------------------------------ 撤回 / 发布 / 删除 ------------------------------ */

/** 发布或撤回（撤回后客户端立刻不可见，数据与已读记录保留）。 */
async function handleToggleStatus(row: ClientNoticeItem): Promise<void> {
  const toPublish = row.status !== 1;
  try {
    await ElMessageBox.confirm(
      toPublish
        ? `确定重新发布「${row.title}」吗？用户端会再次可见（已读过的人不再冒红点）。`
        : `确定撤回「${row.title}」吗？撤回后用户端立刻看不到，已读记录保留。`,
      toPublish ? '重新发布' : '撤回公告',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  await setClientNoticeStatusApi(row.id, toPublish ? 1 : 2);
  ElMessage.success(toPublish ? '已发布' : '已撤回');
  await getList();
}

/** 删除（连带删除已读记录，不可恢复）。 */
async function handleDelete(row: ClientNoticeItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除公告「${row.title}」吗？已读记录会一并删除，不可恢复。`, '删除公告', {
      type: 'warning',
      confirmButtonText: '确认删除',
      confirmButtonClass: 'el-button--danger',
    });
  } catch {
    return;
  }
  await deleteClientNoticeApi(row.id);
  ElMessage.success('已删除');
  await getList();
}
</script>

<template>
  <div class="sentence-client-notice-page table-page">
    <SearchForm class="table-page__filter" @search="search" @reset="reset">
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 120px">
          <el-option label="草稿" :value="0" />
          <el-option label="已发布" :value="1" />
          <el-option label="已撤回" :value="2" />
        </el-select>
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="query.noticeType" placeholder="全部" clearable style="width: 120px">
          <el-option label="系统" :value="1" />
          <el-option label="公告" :value="2" />
          <el-option label="活动" :value="3" />
        </el-select>
      </el-form-item>
      <el-form-item label="标题">
        <el-input v-model="query.title" placeholder="按标题搜索" clearable style="width: 200px" @keyup.enter="search" />
      </el-form-item>
    </SearchForm>

    <el-card shadow="never" class="mt-4 table-page__card">
      <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3 table-page__toolbar">
        <span class="text-[15px] font-semibold text-ink">客户端公告（共 {{ total }} 条）</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button v-permission="'client:notice:add'" type="primary" @click="handleCreate">发布公告</el-button>
          <el-button :loading="loading" @click="getList">刷新</el-button>
        </div>
      </div>

      <div class="table-page__table">
        <el-table v-loading="loading" :data="list" border row-key="id" :height="tableHeight">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column label="置顶" width="70" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.pinned === 1" type="warning" size="small">置顶</el-tag>
              <span v-else class="text-faint">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
          <el-table-column label="类型" width="90">
            <template #default="{ row }">{{ TYPE_LABEL[row.noticeType] ?? row.noticeType }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="statusTag(row.status).type" size="small">{{ statusTag(row.status).label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="readCount" label="已读人数" width="100" align="center" />
          <el-table-column label="发布时间" width="170">
            <template #default="{ row }">{{ row.publishedAt ? formatDateTime(row.publishedAt) : '—' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button
                v-permission="'client:notice:edit'"
                link
                type="primary"
                @click="handleEdit(row as ClientNoticeItem)"
              >
                编辑
              </el-button>
              <el-button
                v-permission="'client:notice:edit'"
                link
                :type="row.status === 1 ? 'warning' : 'success'"
                @click="handleToggleStatus(row as ClientNoticeItem)"
              >
                {{ row.status === 1 ? '撤回' : '发布' }}
              </el-button>
              <el-button
                v-permission="'client:notice:remove'"
                link
                type="danger"
                @click="handleDelete(row as ClientNoticeItem)"
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

    <BasicDialog
      v-model="dialogVisible"
      :title="editingId === null ? '发布公告' : '编辑公告'"
      width="620px"
      :show-footer="false"
    >
      <el-form label-width="90px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" maxlength="200" show-word-limit placeholder="如：新场景已上线" />
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="form.noticeType">
            <el-radio :value="2">公告</el-radio>
            <el-radio :value="3">活动</el-radio>
            <el-radio :value="1">系统</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="正文" required>
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="6"
            maxlength="2000"
            show-word-limit
            placeholder="纯文本，按原样展示（不支持 HTML）"
          />
        </el-form-item>
        <el-form-item label="跳转链接">
          <el-input v-model="form.link" maxlength="255" placeholder="客户端路由，如 /review；留空则不跳转" />
        </el-form-item>
        <el-form-item label="置顶">
          <el-switch v-model="form.pinned" :active-value="1" :inactive-value="0" />
          <span class="ml-2 text-xs text-muted">置顶公告在用户端列表最前</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button v-if="editingId === null" :loading="saving" @click="handleSave(false)">存为草稿</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave(true)">
          {{ editingId === null ? '发布' : '保存' }}
        </el-button>
      </template>
    </BasicDialog>
  </div>
</template>
