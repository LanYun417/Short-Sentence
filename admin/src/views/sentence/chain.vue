<script setup lang="ts">
/**
 * 接龙审核页（「短句」运营后台）。
 * 模块职责：分页查看用户匿名接龙内容，按举报数优先排查，可隐藏/恢复/删除。
 *
 * 权限：v-permission（sentence:chain / sentence:chain:handle），与种子菜单一致。
 * 内容安全的自动闸门在客户端接口（举报满 3 次自动隐藏），这里做人工复核。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import {
  deleteChainEntryApi,
  getChainEntryListApi,
  getChainTopicsAllApi,
  getChainTopicsApi,
  setChainEntryStatusApi,
  setChainTopicStatusApi,
} from '@/api/chain';
import { useTable } from '@/composables/useTable';
import { useTablePage } from '@/composables/useTablePage';
import { formatDateTime } from '@/utils/format';
import type { ChainEntryAdminItem, ChainEntryStatus, ChainTopicAdminItem, ChainTopicOption } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'SentenceChain' });

const { tableHeight } = useTablePage();

const activeTab = ref<'entries' | 'topics'>('entries');

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
  void loadAllTopics();
});

/* ------------------------------ 主题管理（含往期批次） ------------------------------ */
const allTopics = ref<ChainTopicAdminItem[]>([]);
const topicsLoading = ref(false);

async function loadAllTopics(): Promise<void> {
  topicsLoading.value = true;
  try {
    allTopics.value = await getChainTopicsAllApi();
  } finally {
    topicsLoading.value = false;
  }
}

/** 启用 / 停用主题（停用后客户端不再展示，仅本页可见）。 */
async function toggleTopicStatus(row: ChainTopicAdminItem): Promise<void> {
  const next = row.status === 1 ? 0 : 1;
  const actionText = next === 1 ? '启用' : '停用';
  try {
    await ElMessageBox.confirm(
      `确定${actionText}主题「${row.title}」吗？\n${next === 0 ? '停用后用户端列表与详情都不再展示，仅后台可见。' : '启用后会回到用户端可见列表。'}`,
      `${actionText}主题`,
      {
        type: 'warning',
        confirmButtonText: actionText,
        cancelButtonText: '取消',
      },
    );
  } catch {
    return;
  }
  await setChainTopicStatusApi(row.id, next as 0 | 1);
  ElMessage.success(next === 1 ? '已启用' : '已停用');
  await Promise.all([
    loadAllTopics(),
    getChainTopicsApi()
      .then((t) => (topics.value = t))
      .catch(() => {}),
  ]);
}
</script>

<template>
  <div class="sentence-chain-page table-page">
    <el-tabs v-model="activeTab" class="mt-1 chain-tabs">
      <!-- ===================== Tab1：接龙条目审核 ===================== -->
      <el-tab-pane label="接龙审核" name="entries">
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
      </el-tab-pane>

      <!-- ===================== Tab2：主题管理（含往期批次，仅后台可见） ===================== -->
      <el-tab-pane label="主题管理" name="topics">
        <el-card shadow="never" class="mt-4 table-page__card">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-[15px] font-semibold text-ink">
              全部主题（共 {{ allTopics.length }} 条；往期 AI 批次停用后仍在此可见，用户端不展示）
            </span>
            <el-button :loading="topicsLoading" @click="loadAllTopics">刷新</el-button>
          </div>

          <div class="table-page__table">
            <el-table v-loading="topicsLoading" :data="allTopics" border row-key="id" :height="tableHeight">
              <el-table-column prop="id" label="ID" width="70" />
              <el-table-column label="主题" min-width="200">
                <template #default="{ row }">
                  <p class="text-sm font-medium">{{ row.title }}</p>
                  <p class="text-xs italic text-gray-400">{{ row.starterEn }}</p>
                </template>
              </el-table-column>
              <el-table-column label="来源" width="90" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.source === 'ai' ? 'primary' : 'info'" size="small">
                    {{ row.source === 'ai' ? 'AI周更' : '手工种子' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="weekStart" label="所属周" width="110" align="center">
                <template #default="{ row }">{{ row.weekStart ?? '—' }}</template>
              </el-table-column>
              <el-table-column prop="entryCount" label="条目数" width="80" align="center" />
              <el-table-column label="状态" width="90" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
                    {{ row.status === 1 ? '启用' : '已停用' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="创建时间" width="165">
                <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="100" fixed="right">
                <template #default="{ row }">
                  <el-button
                    v-permission="'sentence:chain:handle'"
                    link
                    :type="row.status === 1 ? 'warning' : 'success'"
                    @click="toggleTopicStatus(row as ChainTopicAdminItem)"
                  >
                    {{ row.status === 1 ? '停用' : '启用' }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style>
/* el-tabs 默认不撑满父级，会打断 .table-page 的 flex 高度链：
   .table-page__table > .el-table 是 position:absolute; inset:0，
   父级高度为 0 时整张表格空白（连表头都不渲染）。
   这里把高度链穿透 el-tabs 到 tab 面板，让两个 Tab 的表格都正常渲染。
   不用 scoped/:deep —— .chain-tabs 只在本页存在，类前缀已足够限定作用域。 */
.chain-tabs {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.chain-tabs .el-tabs__content {
  flex: 1 1 auto;
  min-height: 0;
}

.chain-tabs .el-tab-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
</style>
