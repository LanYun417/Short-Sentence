<script setup lang="ts">
/**
 * 支付订单页。
 * 模块职责：收入概览 + 订单分页查询 + 手动同步（补单）+ 全额退款。
 *
 * 口径说明：
 * - 金额一律以「分」交互、以「元」展示（后端只认分，避免浮点误差）；
 * - 「同步」用于回调丢失时向微信查单补单（幂等，已入账不会重复发权益）；
 * - 「退款」是全额退款：微信受理即返回，订单转已退款并撤销该笔权益。
 */
import { ElMessage } from '@/utils/element';
import { getPayOrderStatsApi, getPayOrdersApi, refundPayOrderApi, syncPayOrderApi } from '@/api/pay';
import { useTable } from '@/composables/useTable';
import { useTablePage } from '@/composables/useTablePage';
import { formatDateTime } from '@/utils/format';
import type { PayOrderItem, PayOrderStats } from '@/types/api';
import BasicDialog from '@/components/BasicDialog/index.vue';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'PayOrder' });

const { tableHeight } = useTablePage();

const dateRange = ref<string[]>([]);
const stats = ref<PayOrderStats | null>(null);
const statsLoading = ref(false);
const syncing = ref<string>('');
const refunding = ref(false);

/** 充值概览（每次刷新列表一起刷新） */
async function loadStats(): Promise<void> {
  statsLoading.value = true;
  try {
    stats.value = await getPayOrderStatsApi();
  } finally {
    statsLoading.value = false;
  }
}

const { loading, list, total, query, getList, search, reset, changePage, changePageSize } = useTable(
  (p) =>
    getPayOrdersApi({
      page: p.page,
      pageSize: p.pageSize,
      status: p.status || undefined,
      channel: p.channel || undefined,
      userId: p.userId ? Number(p.userId) : undefined,
      keyword: p.keyword || undefined,
      dateFrom: dateRange.value[0] || undefined,
      dateTo: dateRange.value[1] || undefined,
    }),
  { status: '', channel: '', userId: undefined as number | undefined, keyword: '' },
  { immediate: false },
);

/** 首屏：概览 + 列表一起拉 */
onMounted(() => {
  void loadStats();
  void getList();
});

/** 刷新：概览与列表同刷 */
function refresh(): void {
  void loadStats();
  void getList();
}

/** 重置筛选（日期范围不在 useTable 托管内，需手动清） */
function handleReset(): void {
  dateRange.value = [];
  reset();
}

/** 状态 → 文案/颜色（与后端 pay_order.status 一一对应） */
const STATUS_MAP: Record<string, { label: string; type: 'success' | 'warning' | 'info' | 'danger' }> = {
  pending: { label: '待支付', type: 'warning' },
  paid: { label: '已支付', type: 'success' },
  refunding: { label: '退款中', type: 'warning' },
  refunded: { label: '已退款', type: 'info' },
  closed: { label: '已关闭', type: 'info' },
};

/** 渠道 → 文案 */
const CHANNEL_MAP: Record<string, string> = {
  web: '网页扫码',
  android: '安卓扫码',
  miniapp: '微信小程序',
};

/** 分 → 元（带两位小数） */
function formatAmount(cent?: number | null): string {
  return `¥${((cent ?? 0) / 100).toFixed(2)}`;
}

/** 手动同步（补单） */
async function handleSync(row: PayOrderItem): Promise<void> {
  syncing.value = row.orderNo;
  try {
    const updated = await syncPayOrderApi(row.orderNo);
    ElMessage.success(
      updated.status === 'paid'
        ? '已同步：该订单已支付到账'
        : `已同步：当前状态 ${STATUS_MAP[updated.status]?.label ?? updated.status}`,
    );
    refresh();
  } finally {
    syncing.value = '';
  }
}

/** 退款对话框 */
const refundVisible = ref(false);
const refundTarget = ref<PayOrderItem | null>(null);
const refundReason = ref('');

function openRefund(row: PayOrderItem): void {
  refundTarget.value = row;
  refundReason.value = '';
  refundVisible.value = true;
}

/** 确认退款（二次确认；金额与后果写清楚） */
async function submitRefund(): Promise<void> {
  if (!refundTarget.value) {
    return;
  }
  const target = refundTarget.value;
  // 弹窗内已写明金额与后果，这里直接提交（不再叠一层确认框）
  refunding.value = true;
  try {
    await refundPayOrderApi(target.orderNo, refundReason.value.trim() || undefined);
    ElMessage.success('退款已受理');
    refundVisible.value = false;
    refresh();
  } finally {
    refunding.value = false;
  }
}
</script>

<template>
  <div class="pay-order-page table-page">
    <!-- 收入概览：业务最关心的 6 个数字 -->
    <div v-loading="statsLoading" class="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <el-card shadow="never" body-style="padding: 12px 16px">
        <div class="text-xs text-ink-muted">净收入（累计）</div>
        <div class="mt-1 text-xl font-semibold text-ink">{{ formatAmount(stats?.netAmount) }}</div>
      </el-card>
      <el-card shadow="never" body-style="padding: 12px 16px">
        <div class="text-xs text-ink-muted">今日净收入</div>
        <div class="mt-1 text-xl font-semibold text-ink">{{ formatAmount(stats?.todayNetAmount) }}</div>
      </el-card>
      <el-card shadow="never" body-style="padding: 12px 16px">
        <div class="text-xs text-ink-muted">累计支付</div>
        <div class="mt-1 text-xl font-semibold text-ink">{{ stats?.paidCount ?? 0 }} 笔</div>
      </el-card>
      <el-card shadow="never" body-style="padding: 12px 16px">
        <div class="text-xs text-ink-muted">累计退款</div>
        <div class="mt-1 text-xl font-semibold text-ink">{{ formatAmount(stats?.refundAmount) }}</div>
      </el-card>
      <el-card shadow="never" body-style="padding: 12px 16px">
        <div class="text-xs text-ink-muted">有效会员</div>
        <div class="mt-1 text-xl font-semibold text-primary">{{ stats?.activeVipCount ?? 0 }} 人</div>
      </el-card>
      <el-card shadow="never" body-style="padding: 12px 16px">
        <div class="text-xs text-ink-muted">待支付订单</div>
        <div class="mt-1 text-xl font-semibold text-ink">{{ stats?.pendingCount ?? 0 }} 笔</div>
      </el-card>
    </div>

    <SearchForm class="table-page__filter" @search="search" @reset="handleReset">
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 130px">
          <el-option v-for="(item, key) in STATUS_MAP" :key="key" :label="item.label" :value="key" />
        </el-select>
      </el-form-item>
      <el-form-item label="渠道">
        <el-select v-model="query.channel" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="(label, key) in CHANNEL_MAP" :key="key" :label="label" :value="key" />
        </el-select>
      </el-form-item>
      <el-form-item label="订单号">
        <el-input v-model="query.keyword" placeholder="订单号 / 微信交易号" clearable @keyup.enter="search" />
      </el-form-item>
      <template #advanced>
        <el-form-item label="用户 ID">
          <el-input v-model.number="query.userId" placeholder="客户端用户 ID" clearable />
        </el-form-item>
        <el-form-item label="下单时间">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
          />
        </el-form-item>
      </template>
    </SearchForm>

    <el-card shadow="never" class="table-page__card">
      <div class="table-page__toolbar mb-3 flex flex-wrap items-center justify-between gap-y-2">
        <span class="text-[15px] font-semibold text-ink">支付订单</span>
        <div class="flex items-center gap-2">
          <el-button @click="refresh">
            <template #icon><i class="bi bi-arrow-clockwise" /></template>刷新
          </el-button>
        </div>
      </div>

      <div class="table-page__table">
        <el-table v-loading="loading" border :data="list" :height="tableHeight">
          <el-table-column prop="orderNo" label="订单号" min-width="200" show-overflow-tooltip />
          <el-table-column prop="userId" label="用户 ID" width="100" align="center" />
          <el-table-column prop="title" label="套餐" min-width="110" />
          <el-table-column label="金额" width="110" align="right">
            <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
          </el-table-column>
          <el-table-column label="渠道" width="110" align="center">
            <template #default="{ row }">{{ CHANNEL_MAP[row.channel] ?? row.channel }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="STATUS_MAP[row.status]?.type ?? 'info'" size="small">
                {{ STATUS_MAP[row.status]?.label ?? row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="支付时间" width="170">
            <template #default="{ row }">{{ row.paidAt ? formatDateTime(row.paidAt) : '-' }}</template>
          </el-table-column>
          <el-table-column label="下单时间" width="170">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right" align="center">
            <template #default="{ row }">
              <el-button
                v-permission="'pay:order:edit'"
                type="primary"
                link
                :loading="syncing === row.orderNo"
                :disabled="row.status !== 'pending'"
                @click="handleSync(row as PayOrderItem)"
              >
                同步
              </el-button>
              <el-button
                v-permission="'pay:order:refund'"
                type="danger"
                link
                :disabled="row.status !== 'paid'"
                @click="openRefund(row as PayOrderItem)"
              >
                退款
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

    <!-- 退款原因（选填，会同步到微信退款单） -->
    <BasicDialog
      v-model="refundVisible"
      title="订单退款"
      width="460px"
      confirm-text="确认退款"
      :confirm-loading="refunding"
      :confirm-disabled="!refundTarget"
      @confirm="submitRefund"
    >
      <div v-if="refundTarget" class="space-y-3">
        <div class="rounded bg-fill-light p-3 text-sm text-ink">
          <div>订单号：{{ refundTarget.orderNo }}</div>
          <div>
            退款金额：<span class="font-semibold text-danger">{{ formatAmount(refundTarget.amount) }}</span>
          </div>
        </div>
        <el-input
          v-model="refundReason"
          type="textarea"
          :rows="3"
          maxlength="200"
          show-word-limit
          placeholder="退款原因（选填，可写「误购」「重复购买」等）"
        />
        <div class="text-xs text-ink-muted">退款为全额退款；成功后该笔会员权益立即撤销，到账时间以微信支付为准。</div>
      </div>
    </BasicDialog>
  </div>
</template>
