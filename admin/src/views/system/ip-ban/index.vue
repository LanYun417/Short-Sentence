<script setup lang="ts">
/**
 * IP 黑名单管理页。
 * 模块职责：查看封禁记录、人工封禁 / 解封、查看概览统计。
 *
 * 注意：本页依赖后端菜单（sys_menu）中的「IP黑名单」条目（permission = ip:ban:list）。
 * 路由由菜单树动态生成，需先在菜单中配置该页（含 ip:ban:add / ip:ban:remove 两个按钮权限），
 * 页面才会在侧边栏出现并可访问。本文件仅提供组件实现。
 */

import { reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from '@/utils/element';
import { addIpBanApi, getIpBanListApi, getIpBanStatsApi, removeIpBanApi } from '@/api/ip-ban';
import type { IpBanRecord, IpBanStats } from '@/api/ip-ban';
import { useTable } from '@/composables/useTable';
import { useTablePage } from '@/composables/useTablePage';
import { formatDateTime } from '@/utils/format';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'SystemIpBan' });

const { tableHeight } = useTablePage();

const TYPE_LABEL: Record<string, string> = { auto: '自动', manual: '人工' };
const SCOPE_LABEL: Record<string, string> = {
  register: '注册超限',
  login: '登录爆破',
  captcha: '验证码绕过',
  manual: '人工',
};

const stats = reactive<IpBanStats>({ total: 0, active: 0, autoActive: 0 });

async function refreshStats(): Promise<void> {
  try {
    Object.assign(stats, await getIpBanStatsApi());
  } catch {
    /* 统计失败不阻断列表 */
  }
}

const { loading, list, total, query, getList, changePage, changePageSize } = useTable(
  (p) =>
    getIpBanListApi({
      page: p.page,
      pageSize: p.pageSize,
      keyword: p.keyword.trim() || undefined,
      activeOnly: p.activeOnly,
    }),
  { keyword: '', activeOnly: false },
);

/** 拉取列表后同步刷新统计 */
async function loadList(): Promise<void> {
  await getList();
  await refreshStats();
}
// 用带统计刷新的版本覆盖默认行为
const searchWrapped = (): void => {
  query.page = 1;
  void loadList();
};
const resetWrapped = (): void => {
  query.keyword = '';
  query.activeOnly = false;
  query.page = 1;
  void loadList();
};

/** 解封 */
async function handleUnban(row: IpBanRecord): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定解封 IP「${row.ip}」吗？解封后该 IP 将恢复访问。`, '解封 IP', {
      type: 'warning',
      confirmButtonText: '解封',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  await removeIpBanApi(row.ip);
  ElMessage.success('已解封');
  await loadList();
}

/* ----------------------------- 人工封禁弹窗 ----------------------------- */
const dialogVisible = ref(false);
const submitting = ref(false);
const form = reactive({ ip: '', reason: '', hours: 24 });

function openDialog(): void {
  form.ip = '';
  form.reason = '';
  form.hours = 24;
  dialogVisible.value = true;
}

async function submitDialog(): Promise<void> {
  if (!form.ip.trim()) {
    ElMessage.warning('请输入要封禁的 IP');
    return;
  }
  submitting.value = true;
  try {
    await addIpBanApi({ ip: form.ip.trim(), reason: form.reason.trim() || undefined, hours: form.hours });
    ElMessage.success('已封禁');
    dialogVisible.value = false;
    await loadList();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="ip-ban-page table-page">
    <el-row :gutter="12" class="mb-4 table-page__extra">
      <el-col :span="8">
        <el-card shadow="never">
          <div class="stat-label">封禁总数</div>
          <div class="stat-value">{{ stats.total }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <div class="stat-label">生效中</div>
          <div class="stat-value text-danger">{{ stats.active }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <div class="stat-label">其中自动封禁</div>
          <div class="stat-value text-warning">{{ stats.autoActive }}</div>
        </el-card>
      </el-col>
    </el-row>

    <SearchForm class="table-page__filter" @search="searchWrapped" @reset="resetWrapped">
      <el-form-item label="IP">
        <el-input
          v-model="query.keyword"
          placeholder="模糊检索 IP"
          clearable
          style="width: 180px"
          @keyup.enter="searchWrapped"
        />
      </el-form-item>
      <el-form-item label="仅生效中">
        <el-switch v-model="query.activeOnly" @change="searchWrapped" />
      </el-form-item>
    </SearchForm>

    <el-card shadow="never" class="mt-4 table-page__card">
      <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3 table-page__toolbar">
        <span class="text-[15px] font-semibold text-ink">封禁记录（{{ total }}）</span>
        <div class="flex gap-2">
          <el-button :loading="loading" @click="loadList">
            <template #icon><i class="bi bi-arrow-clockwise" /></template>
            刷新
          </el-button>
          <el-button v-permission="'ip:ban:add'" type="danger" @click="openDialog">
            <template #icon><i class="bi bi-shield-x" /></template>
            封禁 IP
          </el-button>
        </div>
      </div>

      <div class="table-page__table">
        <el-table v-loading="loading" border :data="list" :height="tableHeight">
          <el-table-column prop="ip" label="IP" min-width="140" />
          <el-table-column label="类型" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.type === 'auto' ? 'warning' : 'info'" size="small">
                {{ TYPE_LABEL[row.type] ?? row.type }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="触发来源" width="110" align="center">
            <template #default="{ row }">{{ SCOPE_LABEL[row.scope] ?? row.scope }}</template>
          </el-table-column>
          <el-table-column prop="reason" label="原因" min-width="200" show-overflow-tooltip />
          <el-table-column prop="operator" label="操作人" width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.operator || '-' }}</template>
          </el-table-column>
          <el-table-column label="到期时间" width="170">
            <template #default="{ row }">{{ row.expiresAt ? formatDateTime(row.expiresAt) : '永久' }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.active ? 'danger' : 'success'" size="small">
                {{ row.active ? '生效中' : '已解封' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="封禁时间" width="170">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right" align="center">
            <template #default="{ row }">
              <el-button
                v-permission="'ip:ban:remove'"
                type="success"
                link
                :disabled="!row.active"
                @click="handleUnban(row as IpBanRecord)"
              >
                解封
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

    <el-dialog v-model="dialogVisible" title="封禁 IP" width="460px" @close="dialogVisible = false">
      <el-form label-width="90px">
        <el-form-item label="IP" required>
          <el-input v-model="form.ip" placeholder="请输入要封禁的 IPv4 / IPv6" clearable />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="form.reason" placeholder="选填，如：批量注册" clearable />
        </el-form-item>
        <el-form-item label="封禁时长">
          <el-input-number v-model="form.hours" :min="0" :max="8760" :step="1" style="width: 180px" />
          <span class="ml-2 text-muted">小时（0 = 永久）</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="submitting" @click="submitDialog">确定封禁</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-value {
  margin-top: 6px;
  font-size: 26px;
  font-weight: 600;
}

.text-danger {
  color: var(--el-color-danger);
}

.text-warning {
  color: var(--el-color-warning);
}

.text-muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
