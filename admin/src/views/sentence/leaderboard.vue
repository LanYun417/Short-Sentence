<script setup lang="ts">
/**
 * 排行榜管理页（「短句」运营后台）。
 * 模块职责：7 个榜单实时查看（不走客户端 60s 缓存，带用户邮箱）+ 按邮箱/昵称查用户全部名次。
 *
 * 榜单类型与窗口口径由后端 leaderboard.dto 一处定义，前端只做展示。
 *
 * 权限：v-permission（sentence:leaderboard，只读菜单），与种子菜单一致。
 */
import { ElMessage } from '@/utils/element';
import { getLeaderboardBoardApi, getLeaderboardUserRanksApi } from '@/api/leaderboard';
import type { LeaderboardAdminBoard, LeaderboardUserRanks } from '@/types/api';
import { ref } from 'vue';

defineOptions({ name: 'SentenceLeaderboard' });

const TYPE_OPTIONS: Array<{ label: string; value: string; unit: string }> = [
  { label: '今日答题数', value: 'today_answered', unit: '题' },
  { label: '今日答对数', value: 'today_correct', unit: '题' },
  { label: '近 7 天答题数', value: 'week_answered', unit: '题' },
  { label: '近 7 天答对数', value: 'week_correct', unit: '题' },
  { label: '近 30 天答题数', value: 'month_answered', unit: '题' },
  { label: '近 30 天答对数', value: 'month_correct', unit: '题' },
  { label: '累计打卡天数', value: 'checkin_total', unit: '天' },
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));

const boardType = ref('today_answered');
const topN = ref(100);
const board = ref<LeaderboardAdminBoard | null>(null);
const boardLoading = ref(false);

async function loadBoard(): Promise<void> {
  boardLoading.value = true;
  try {
    board.value = await getLeaderboardBoardApi({ type: boardType.value, topN: topN.value });
  } finally {
    boardLoading.value = false;
  }
}

/* ------------------------------ 按用户查名次 ------------------------------ */

const userKeyword = ref('');
const userResult = ref<LeaderboardUserRanks | null>(null);
const userLoading = ref(false);

async function searchUser(): Promise<void> {
  const kw = userKeyword.value.trim();
  if (!kw) {
    ElMessage.warning('请输入邮箱或昵称');
    return;
  }
  userLoading.value = true;
  try {
    userResult.value = await getLeaderboardUserRanksApi({ keyword: kw });
  } finally {
    userLoading.value = false;
  }
}

/** 名次奖牌色：1 金 2 银 3 铜。 */
function rankClass(rank: number): string {
  if (rank === 1) return 'text-amber-500';
  if (rank === 2) return 'text-slate-400';
  if (rank === 3) return 'text-amber-700';
  return 'text-muted';
}

loadBoard();
</script>

<template>
  <div class="sentence-leaderboard-page table-page">
    <!-- 实时榜单 -->
    <el-card shadow="never" class="table-page__card mb-3">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <el-select v-model="boardType" style="width: 170px" @change="loadBoard">
          <el-option v-for="o in TYPE_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-select v-model="topN" style="width: 120px" @change="loadBoard">
          <el-option :label="'Top 100'" :value="100" />
          <el-option :label="'Top 200'" :value="200" />
          <el-option :label="'Top 500'" :value="500" />
        </el-select>
        <el-button :loading="boardLoading" @click="loadBoard">刷新</el-button>
        <span v-if="board" class="text-xs text-muted">
          {{ TYPE_LABEL[board.type] }} · 截止 {{ board.date }} · 共 {{ board.total }} 人上榜（不走客户端缓存，实时聚合）
        </span>
      </div>

      <el-table v-loading="boardLoading" :data="board?.top ?? []" border row-key="userId" max-height="520">
        <el-table-column label="名次" width="80">
          <template #default="{ row }">
            <span class="font-semibold tabular-nums" :class="rankClass(row.rank)">{{ row.rank }}</span>
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="220">
          <template #default="{ row }">
            <div class="text-sm text-ink">{{ row.nickname || `用户 ${row.userId}` }}</div>
            <div class="text-xs text-muted">{{ row.email }}</div>
          </template>
        </el-table-column>
        <el-table-column label="数量" width="120">
          <template #default="{ row }">
            <span class="font-semibold tabular-nums text-ink">{{ row.count }}</span>
            <span class="ml-1 text-xs text-muted">{{ board?.unit }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 按用户查全部名次 -->
    <el-card shadow="never" class="table-page__card">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <el-input
          v-model="userKeyword"
          placeholder="输入邮箱或昵称，查该用户在全部榜上的名次"
          clearable
          style="width: 320px"
          @keyup.enter="searchUser"
        />
        <el-button type="primary" :loading="userLoading" @click="searchUser">查询</el-button>
      </div>

      <div v-if="userResult && !userResult.users.length" class="py-6 text-center text-sm text-muted">
        未找到匹配用户
      </div>
      <div v-for="u in userResult?.users ?? []" :key="u.userId" class="mb-3 rounded-lg border border-line-lighter p-3">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-ink">{{ u.nickname || `用户 ${u.userId}` }}</span>
          <span class="text-xs text-muted">{{ u.email }}</span>
          <el-tag size="small" type="warning">XP {{ u.xp }}</el-tag>
        </div>
        <div class="flex flex-wrap gap-2">
          <el-tag v-for="r in u.ranks" :key="r.type" size="small" :type="r.rank ? 'primary' : 'info'">
            {{ TYPE_LABEL[r.type] }}：{{ r.rank ? `第 ${r.rank} 名（${r.count}）` : '未上榜' }}
          </el-tag>
        </div>
      </div>
    </el-card>
  </div>
</template>
