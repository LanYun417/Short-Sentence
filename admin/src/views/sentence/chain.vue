<script setup lang="ts">
/**
 * 接龙审核页（「短句」运营后台）。
 * 模块职责：分页查看用户匿名接龙内容，按举报数优先排查，可隐藏/恢复/删除。
 *
 * 权限：v-permission（sentence:chain / sentence:chain:handle），与种子菜单一致。
 * 内容安全的自动闸门在客户端接口（举报满 3 次自动隐藏），这里做人工复核。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import { deleteChainEntryApi, getChainEntryListApi, getChainTopicsApi, setChainEntryStatusApi } from '@/api/chain';
import { useTable } from '@/composables/useTable';
import { useTablePage } from '@/composables/useTablePage';
import { formatDateTime } from '@/utils/format';
import type { ChainEntryAdminItem, ChainEntryStatus, ChainTopicOption } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'SentenceChain' });

const { tableHeight } = useTablePage();

const topics = ref<ChainTopicOption[]>([]);

const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getChainEntryListApi({
      page: p.page,
      pageSize: p.pageSize,
      status: p.status || undefined,
      topicId: p.topicId || undefined,
      keyword: p.keyword?.trim() || undefined,
    }),
  // 默认只看待审核：AI 拿不准的会落到 pending，运营打开页面即进队列；清空状态可看全部
  { keyword: '', status: 'pending', topicId: undefined as number | undefined },
);

/** 状态标签文案与配色。 */
const STATUS_META: Record<ChainEntryStatus, { label: string; type: 'success' | 'info' | 'warning' | 'danger' }> = {
  pending: { label: '待审核', type: 'warning' },
  visible: { label: '已通过', type: 'success' },
  rejected: { label: 'AI 拒绝', type: 'danger' },
  hidden: { label: '已隐藏', type: 'info' },
};

/** 通过 / 拒绝 / 隐藏（同一入口，按目标状态给不同提示）。 */
async function setStatus(row: ChainEntryAdminItem, next: 'visible' | 'rejected' | 'hidden'): Promise<void> {
  try {
    await setChainEntryStatusApi(row.id, next);
    ElMessage.success(next === 'visible' ? '已通过' : next === 'rejected' ? '已拒绝' : '已隐藏');
    await getList();
  } catch {
    // 错误提示由请求层统一弹出
  }
}

/** 删除（二次确认）。 */
async function remove(row: ChainEntryAdminItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除这条接龙吗？\n\n${row.contentEn}`, '删除接龙', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  await deleteChainEntryApi(row.id);
  ElMessage.success('已删除');
  await getList();
}

onMounted(async () => {
  void getList();
  try {
    topics.value = await getChainTopicsApi();
  } catch {
    // 主题下拉拉不到不影响列表使用
  }
});
</script>

<template>
  <div class="sentence-chain-page table-page">
    <SearchForm class="table-page__filter" @search="search" @reset="reset">
      <el-form-item label="关键词">
        <el-input v-model="query.keyword" placeholder="英文内容" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="主题">
        <el-select v-model="query.topicId" placeholder="全部" clearable style="width: 200px">
          <el-option v-for="item in topics" :key="item.id" :label="item.title" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 130px">
          <el-option label="待审核" value="pending" />
          <el-option label="已通过" value="visible" />
          <el-option label="AI 拒绝" value="rejected" />
          <el-option label="已隐藏" value="hidden" />
        </el-select>
      </el-form-item>
    </SearchForm>

    <el-card shadow="never" class="mt-4 table-page__card">
      <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3 table-page__toolbar">
        <span class="text-[15px] font-semibold text-ink">接龙审核（共 {{ total }} 条）</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button :loading="loading" @click="getList">刷新</el-button>
        </div>
      </div>

      <div class="table-page__table">
        <el-table v-loading="loading" :data="list" border row-key="id" :height="tableHeight">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column label="内容" min-width="300">
            <template #default="{ row }">
              <p class="text-sm font-medium leading-relaxed">{{ row.contentEn }}</p>
              <p v-if="row.contentZh" class="text-xs text-gray-400">{{ row.contentZh }}</p>
            </template>
          </el-table-column>
          <el-table-column prop="topicTitle" label="主题" min-width="180" show-overflow-tooltip />
          <el-table-column label="赞 / 举报" width="110" align="center">
            <template #default="{ row }">
              <span class="text-sm">{{ row.likeCount }}</span>
              <span class="mx-1 text-gray-300">/</span>
              <span class="text-sm" :class="row.reportCount >= 3 ? 'text-red-500 font-semibold' : ''">
                {{ row.reportCount }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="STATUS_META[row.status as ChainEntryStatus]?.type ?? 'info'" size="small">
                {{ STATUS_META[row.status as ChainEntryStatus]?.label ?? row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="AI 备注" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="text-xs text-gray-500">{{ row.moderationNote || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="作者 ID" width="90" prop="userId" />
          <el-table-column label="提交时间" width="170">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.status !== 'visible'"
                v-permission="'sentence:chain:handle'"
                link
                type="success"
                @click="setStatus(row as ChainEntryAdminItem, 'visible')"
              >
                通过
              </el-button>
              <el-button
                v-if="row.status === 'pending'"
                v-permission="'sentence:chain:handle'"
                link
                type="warning"
                @click="setStatus(row as ChainEntryAdminItem, 'rejected')"
              >
                拒绝
              </el-button>
              <el-button
                v-if="row.status === 'visible'"
                v-permission="'sentence:chain:handle'"
                link
                type="primary"
                @click="setStatus(row as ChainEntryAdminItem, 'hidden')"
              >
                隐藏
              </el-button>
              <el-button
                v-permission="'sentence:chain:handle'"
                link
                type="danger"
                @click="remove(row as ChainEntryAdminItem)"
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
  </div>
</template>
