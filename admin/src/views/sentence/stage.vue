<script setup lang="ts">
/**
 * 情景闯关管理页（「短句」运营后台，路由 /sentence/stage）。
 * 两个 Tab：
 * 1. 关卡总览——每章一张表，看每关的参与/通关/无翻译/待领奖统计；
 * 2. 对话会话——分页抽查用户的场景对话（筛选关卡/状态/用户/无翻译），
 *    点开抽屉看完整消息流（查 AI 质量、处理客诉），可强制结束异常会话。
 *
 * 权限：stage:view 查看，stage:handle 强制结束（v-permission，与种子菜单一致）。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import {
  closeStageSessionApi,
  createStageStoryApi,
  deleteStageStoryApi,
  generateStageCoverApi,
  getStageCoversApi,
  getStageOverviewApi,
  getStageSessionDetailApi,
  getStageSessionListApi,
  getStageStoriesApi,
  reorderStageStoriesApi,
  setStageStoryStatusApi,
  updateStageStoryApi,
} from '@/api/stage';
import { getCategoryOptionsApi, type SentenceCategoryOption } from '@/api/sentence';
import { useTable } from '@/composables/useTable';
import { formatDateTime } from '@/utils/format';
import type {
  StageAdminChapter,
  StageAdminItem,
  StageChapterCoverItem,
  StageLineItem,
  StageRoleItem,
  StageSessionDetail,
  StageSessionItem,
  StageStoryAdminItem,
  StageStoryPayload,
} from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'SentenceStage' });

// 注意：本页**不**用 table-page 布局——总览 Tab 是多张章节表堆叠、会很长，table-page 会把
// 内容区 overflow:hidden 只允许单表格内部滚动，套 el-tabs 后高度链断裂导致整页滚不动。
// 这里整页正常滚动（content-scrollbar 默认 overflow:auto）。

const activeTab = ref<'overview' | 'sessions' | 'covers' | 'stories'>('overview');

/* ------------------------------ Tab1 关卡总览 ------------------------------ */
const chapters = ref<StageAdminChapter[]>([]);
const overviewLoading = ref(false);

async function loadOverview(): Promise<void> {
  overviewLoading.value = true;
  try {
    chapters.value = await getStageOverviewApi();
  } finally {
    overviewLoading.value = false;
  }
}

/** 总览里的关卡下拉（给会话筛选用）。 */
const stageOptions = computed(() =>
  chapters.value.flatMap((c) => c.stages.map((s) => ({ id: s.id, title: `${c.name} · ${s.title}` }))),
);

function clearRate(stage: StageAdminItem): string {
  if (stage.participantCount === 0) return '—';
  return `${Math.round((stage.clearedCount / stage.participantCount) * 100)}%`;
}

/* ------------------------------ Tab3：章节封面管理（AI 生图） ------------------------------ */
const covers = ref<StageChapterCoverItem[]>([]);
const coversLoading = ref(false);
/** 正在生成中的标记：单章用 chapterKey，全部补全用 'all' */
const generatingKeys = ref<string[]>([]);

async function loadCovers(): Promise<void> {
  coversLoading.value = true;
  try {
    covers.value = await getStageCoversApi();
  } finally {
    coversLoading.value = false;
  }
}

function isGenerating(key: string): boolean {
  return generatingKeys.value.includes(key);
}

/**
 * 生成封面。chapterKey 缺省 = 补全全部缺失封面；已有封面时 regenerate 走「重新生成」（二次确认）。
 */
async function generateCover(chapterKey?: string, regenerate = false): Promise<void> {
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
  const mark = chapterKey ?? 'all';
  generatingKeys.value = [...generatingKeys.value, mark];
  try {
    await generateStageCoverApi({ chapterKey, regenerate });
    ElMessage.success(chapterKey ? '封面已生成' : '缺失封面已补全');
    await Promise.all([loadCovers(), loadOverview()]);
  } finally {
    generatingKeys.value = generatingKeys.value.filter((k) => k !== mark);
  }
}

function onTabChange(name: string | number): void {
  if (name === 'covers' && covers.value.length === 0) void loadCovers();
  if (name === 'stories') void loadStories();
}

/* ------------------------------ Tab4：关卡管理（stage_story CRUD） ------------------------------ */

const stories = ref<StageStoryAdminItem[]>([]);
const storiesLoading = ref(false);
const categoryOptions = ref<SentenceCategoryOption[]>([]);

async function loadStories(): Promise<void> {
  storiesLoading.value = true;
  try {
    const [list, cats] = await Promise.all([getStageStoriesApi(), getCategoryOptionsApi()]);
    stories.value = list;
    categoryOptions.value = cats;
  } finally {
    storiesLoading.value = false;
  }
}

/** 章节选项：复用封面列表里的 chapterKey/chapterName（封面 Tab 懒加载，这里兜底加载一次）。 */
const chapterOptions = computed(() =>
  covers.value.length > 0
    ? covers.value.map((item) => ({ key: item.chapterKey, name: item.chapterName }))
    : stories.value.length > 0
      ? [...new Map(stories.value.map((item) => [item.chapterKey, item.chapterName])).entries()].map(([key, name]) => ({
          key,
          name,
        }))
      : [],
);

/** 新增时可选的分类 = 尚未绑定关卡的分类。 */
const freeCategoryOptions = computed(() => {
  const used = new Set(stories.value.map((item) => item.category));
  return categoryOptions.value.filter((item) => !used.has(item.name));
});

/* ------------------------------ 关卡表单弹窗 ------------------------------ */

interface StoryForm {
  chapterKey: string;
  category: string;
  title: string;
  intro: string;
  outro: string;
  userRole: string;
  setting: string;
  goal: string;
  minTurns: number;
  maxTurns: number;
  target: number;
  rewardXp: number;
  roles: StageRoleItem[];
  opening: StageLineItem[];
  starterHints: Array<{ en: string; zh: string }>;
}

const storyDialogVisible = ref(false);
const storySaving = ref(false);
const editingStoryId = ref<number | null>(null);

const emptyForm = (): StoryForm => ({
  chapterKey: chapterOptions.value[0]?.key ?? '',
  category: '',
  title: '',
  intro: '',
  outro: '',
  userRole: '',
  setting: '',
  goal: '',
  minTurns: 6,
  maxTurns: 12,
  target: 5,
  rewardXp: 30,
  roles: [{ nameEn: '', name: '', persona: '', emoji: '🧑' }],
  opening: [],
  starterHints: [{ en: '', zh: '' }],
});

const storyForm = ref<StoryForm>(emptyForm());

async function openStoryDialog(row?: StageStoryAdminItem): Promise<void> {
  if (covers.value.length === 0) await loadCovers();
  if (categoryOptions.value.length === 0) {
    try {
      categoryOptions.value = await getCategoryOptionsApi();
    } catch {
      // 下拉为空时仍可手填分类名之外的字段，保存由后端兜底校验
    }
  }
  editingStoryId.value = row?.id ?? null;
  storyForm.value = row
    ? {
        chapterKey: row.chapterKey,
        category: row.category,
        title: row.title,
        intro: row.intro,
        outro: row.outro,
        userRole: row.userRole,
        setting: row.setting,
        goal: row.goal,
        minTurns: row.minTurns,
        maxTurns: row.maxTurns,
        target: row.target,
        rewardXp: row.rewardXp,
        roles: row.roles.map((role) => ({ ...role })),
        opening: row.opening.map((line) => ({ ...line })),
        starterHints: row.starterHints.map((hint) => ({ ...hint })),
      }
    : emptyForm();
  storyDialogVisible.value = true;
}

function addRole(): void {
  storyForm.value.roles.push({ nameEn: '', name: '', persona: '', emoji: '🧑' });
}
function removeRole(index: number): void {
  storyForm.value.roles.splice(index, 1);
}
function addOpeningLine(): void {
  storyForm.value.opening.push({ speaker: storyForm.value.roles[0]?.nameEn ?? '', contentEn: '', contentZh: '' });
}
function removeOpeningLine(index: number): void {
  storyForm.value.opening.splice(index, 1);
}
function addHint(): void {
  storyForm.value.starterHints.push({ en: '', zh: '' });
}
function removeHint(index: number): void {
  storyForm.value.starterHints.splice(index, 1);
}

async function saveStory(): Promise<void> {
  const form = storyForm.value;
  if (!form.chapterKey || !form.category.trim() || !form.title.trim()) {
    ElMessage.warning('章节、分类、标题必填');
    return;
  }
  if (form.minTurns < 1 || form.maxTurns < form.minTurns) {
    ElMessage.warning('轮数需要 minTurns >= 1 且 maxTurns >= minTurns');
    return;
  }
  if (
    form.roles.length < 1 ||
    form.roles.some((role) => !role.nameEn.trim() || !role.name.trim() || !role.persona.trim())
  ) {
    ElMessage.warning('出场角色 1~3 人，英文名/中文名/人设都必填');
    return;
  }
  const payload: StageStoryPayload = {
    chapterKey: form.chapterKey,
    category: form.category.trim(),
    title: form.title.trim(),
    intro: form.intro.trim(),
    outro: form.outro.trim(),
    userRole: form.userRole.trim(),
    setting: form.setting.trim(),
    goal: form.goal.trim(),
    minTurns: form.minTurns,
    maxTurns: form.maxTurns,
    target: form.target,
    rewardXp: form.rewardXp,
    roles: form.roles.map((role) => ({ ...role, nameEn: role.nameEn.trim(), name: role.name.trim() })),
    opening: form.opening
      .filter((line) => line.contentEn.trim())
      .map((line) => ({ speaker: line.speaker, contentEn: line.contentEn.trim(), contentZh: line.contentZh.trim() })),
    starterHints: form.starterHints
      .filter((hint) => hint.en.trim())
      .map((hint) => ({ en: hint.en.trim(), zh: hint.zh.trim() })),
  };
  storySaving.value = true;
  try {
    if (editingStoryId.value === null) {
      await createStageStoryApi(payload);
      ElMessage.success('关卡已创建');
    } else {
      // 编辑时不传 category（后端禁止修改绑定分类）
      const { category: _category, ...rest } = payload;
      await updateStageStoryApi(editingStoryId.value, rest);
      ElMessage.success('关卡已更新');
    }
    storyDialogVisible.value = false;
    await Promise.all([loadStories(), loadOverview()]);
  } finally {
    storySaving.value = false;
  }
}

/** 启停关卡。 */
async function toggleStoryStatus(row: StageStoryAdminItem): Promise<void> {
  const next = row.status === 1 ? 0 : 1;
  if (next === 0) {
    try {
      await ElMessageBox.confirm(
        `停用后该关卡在客户端地图与详情页都不可见（历史进度/会话保留）。确定停用「${row.title}」吗？`,
        '停用关卡',
        { type: 'warning', confirmButtonText: '停用', cancelButtonText: '取消' },
      );
    } catch {
      return;
    }
  }
  await setStageStoryStatusApi(row.id, next as 0 | 1);
  ElMessage.success(next === 1 ? '关卡已启用' : '关卡已停用');
  await Promise.all([loadStories(), loadOverview()]);
}

/** 删除关卡（物理删除，提示关联会话数）。 */
async function removeStory(row: StageStoryAdminItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除关卡「${row.title}」吗？\n删除后该分类可重新绑定新关卡；历史进度与会话按分类保留，不受影响。`,
      '删除关卡',
      { type: 'error', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  const result = await deleteStageStoryApi(row.id);
  ElMessage.success(`关卡已删除（关联会话 ${result.sessionCount} 条保留）`);
  await Promise.all([loadStories(), loadOverview()]);
}

/** 章内上移/下移：交换 sort 后整章按新顺序提交。 */
async function moveStory(row: StageStoryAdminItem, direction: -1 | 1): Promise<void> {
  const siblings = stories.value.filter((item) => item.chapterKey === row.chapterKey);
  const index = siblings.findIndex((item) => item.id === row.id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= siblings.length) return;
  const ids = siblings.map((item) => item.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  await reorderStageStoriesApi(row.chapterKey, ids);
  await Promise.all([loadStories(), loadOverview()]);
}

/* ------------------------------ Tab2 对话会话 ------------------------------ */
const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getStageSessionListApi({
      page: p.page,
      pageSize: p.pageSize,
      categoryId: p.categoryId || undefined,
      status: p.status || undefined,
      userId: p.userId || undefined,
      noTranslation: p.noTranslation ? '1' : undefined,
      keyword: p.keyword?.trim() || undefined,
    }),
  {
    categoryId: undefined as number | undefined,
    status: '',
    userId: undefined as number | undefined,
    keyword: '',
    noTranslation: false,
  },
);

const SESSION_STATUS_META: Record<string, { label: string; type: 'success' | 'info' | 'warning' | 'danger' }> = {
  active: { label: '进行中', type: 'warning' },
  completed: { label: '已通关', type: 'success' },
  ended: { label: '未达成结束', type: 'info' },
  abandoned: { label: '已放弃', type: 'info' },
};

/** 会话详情抽屉 */
const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<StageSessionDetail | null>(null);

async function openDetail(row: StageSessionItem): Promise<void> {
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  try {
    detail.value = await getStageSessionDetailApi(row.id);
  } finally {
    detailLoading.value = false;
  }
}

/** 强制结束进行中的会话（二次确认）。 */
async function closeSession(row: StageSessionItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定强制结束用户「${row.nickname}」在「${row.stageTitle}」的这条会话吗？\n只会把会话置为结束，不影响通关与进度。`,
      '强制结束会话',
      { type: 'warning', confirmButtonText: '结束会话', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  await closeStageSessionApi(row.id);
  ElMessage.success('已结束该会话');
  await getList();
  if (detail.value?.id === row.id) {
    detail.value = await getStageSessionDetailApi(row.id);
  }
}

onMounted(() => {
  void loadOverview();
  void getList();
});
</script>

<template>
  <div class="sentence-stage-page">
    <el-tabs v-model="activeTab" class="mt-1" @tab-change="onTabChange">
      <!-- ===================== Tab1：关卡总览 ===================== -->
      <el-tab-pane label="关卡总览" name="overview">
        <el-card v-loading="overviewLoading" shadow="never" class="mt-4">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-[15px] font-semibold text-ink">关卡数据统计</span>
            <el-button :loading="overviewLoading" @click="loadOverview">刷新</el-button>
          </div>

          <div v-for="chapter in chapters" :key="chapter.key" class="mb-6 last:mb-0">
            <div class="mb-2 flex items-baseline gap-2">
              <h3 class="text-sm font-bold text-ink">{{ chapter.name }}</h3>
              <span class="text-xs text-gray-400">{{ chapter.subtitle }}</span>
            </div>
            <el-table :data="chapter.stages" border size="small">
              <el-table-column prop="title" label="关卡" min-width="160" show-overflow-tooltip />
              <el-table-column label="目标" min-width="220" show-overflow-tooltip>
                <template #default="{ row }">
                  <span class="text-xs text-gray-500">{{ row.goal }}</span>
                </template>
              </el-table-column>
              <el-table-column label="参与用户" width="90" align="center" prop="participantCount" />
              <el-table-column label="会话数" width="80" align="center" prop="sessionCount" />
              <el-table-column label="进行中" width="80" align="center" prop="activeSessionCount" />
              <el-table-column label="通关人数" width="90" align="center" prop="clearedCount" />
              <el-table-column label="通关率" width="80" align="center">
                <template #default="{ row }">{{ clearRate(row as StageAdminItem) }}</template>
              </el-table-column>
              <el-table-column label="平均轮数" width="90" align="center">
                <template #default="{ row }">{{ row.avgClearedTurns ?? '—' }}</template>
              </el-table-column>
              <el-table-column label="无翻译通关" width="100" align="center" prop="noTranslationClearedCount" />
              <el-table-column label="待领奖" width="80" align="center" prop="claimableCount" />
              <el-table-column label="奖励XP" width="80" align="center" prop="rewardXp" />
            </el-table>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- ===================== Tab2：对话会话抽查 ===================== -->
      <el-tab-pane label="对话会话" name="sessions">
        <SearchForm class="mt-4" @search="search" @reset="reset">
          <el-form-item label="关卡">
            <el-select v-model="query.categoryId" placeholder="全部" clearable style="width: 220px">
              <el-option v-for="opt in stageOptions" :key="opt.id" :label="opt.title" :value="opt.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="query.status" placeholder="全部" clearable style="width: 130px">
              <el-option label="进行中" value="active" />
              <el-option label="已通关" value="completed" />
              <el-option label="未达成结束" value="ended" />
              <el-option label="已放弃" value="abandoned" />
            </el-select>
          </el-form-item>
          <el-form-item label="用户ID">
            <el-input
              v-model.number="query.userId"
              placeholder="精确用户"
              clearable
              style="width: 110px"
              @keyup.enter="search"
            />
          </el-form-item>
          <el-form-item label="昵称">
            <el-input
              v-model="query.keyword"
              placeholder="用户昵称"
              clearable
              style="width: 140px"
              @keyup.enter="search"
            />
          </el-form-item>
          <el-form-item label="无翻译通关">
            <el-checkbox v-model="query.noTranslation" label="只看无翻译通关" />
          </el-form-item>
        </SearchForm>

        <el-card shadow="never" class="mt-4">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-[15px] font-semibold text-ink">对话会话（共 {{ total }} 条）</span>
            <el-button :loading="loading" @click="getList">刷新</el-button>
          </div>

          <div>
            <el-table v-loading="loading" :data="list" border row-key="id">
              <el-table-column prop="id" label="ID" width="70" />
              <el-table-column label="用户" min-width="140">
                <template #default="{ row }">
                  <span class="text-sm">{{ row.nickname }}</span>
                  <span class="ml-1 text-xs text-gray-400">#{{ row.userId }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="stageTitle" label="关卡" min-width="140" show-overflow-tooltip />
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="SESSION_STATUS_META[row.status]?.type ?? 'info'" size="small">
                    {{ SESSION_STATUS_META[row.status]?.label ?? row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="轮数" width="70" align="center" prop="turnCount" />
              <el-table-column label="通关" width="70" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.cleared" type="success" size="small">是</el-tag>
                  <span v-else class="text-gray-300">—</span>
                </template>
              </el-table-column>
              <el-table-column label="用过翻译" width="90" align="center">
                <template #default="{ row }">
                  <span :class="row.translationUsed ? 'text-amber-500' : 'text-emerald-600'">
                    {{ row.translationUsed ? '是' : '否' }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="消息数" width="80" align="center" prop="messageCount" />
              <el-table-column label="开始时间" width="165">
                <template #default="{ row }">{{ formatDateTime(row.startedAt) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="170" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" @click="openDetail(row as StageSessionItem)">详情</el-button>
                  <el-button
                    v-if="row.status === 'active'"
                    v-permission="'stage:handle'"
                    link
                    type="danger"
                    @click="closeSession(row as StageSessionItem)"
                  >
                    强制结束
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <Pagination
            v-model:current-page="query.page"
            v-model:page-size="query.pageSize"
            class="mt-3"
            :total="total"
            @size-change="changePageSize"
            @current-change="changePage"
          />
        </el-card>
      </el-tab-pane>

      <!-- ===================== Tab3：章节封面管理（AI 生图） ===================== -->
      <el-tab-pane label="封面管理" name="covers">
        <el-card v-loading="coversLoading" shadow="never" class="mt-4">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-[15px] font-semibold text-ink">章节封面（AI 生图，4:3 webp）</span>
            <div class="flex gap-2">
              <el-button :loading="coversLoading" @click="loadCovers">刷新</el-button>
              <el-button
                v-permission="'stage:handle'"
                type="primary"
                :loading="isGenerating('all')"
                @click="generateCover(undefined, false)"
              >
                补全缺失封面
              </el-button>
            </div>
          </div>

          <div
            v-for="item in covers"
            :key="item.chapterKey"
            class="mb-3 flex items-center gap-4 rounded-xl border border-gray-200 p-3 last:mb-0 dark:border-gray-700"
          >
            <!-- 缩略图：有图显示图，无图显示占位 -->
            <div
              class="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
            >
              <img
                v-if="item.coverUrl"
                :src="item.coverUrl"
                :alt="item.chapterName"
                class="h-full w-full object-cover"
                loading="lazy"
              />
              <span v-else class="px-1 text-center text-xs text-gray-400">未生成</span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold text-ink">{{ item.chapterName }}</div>
              <div class="mt-0.5 text-xs text-gray-400">
                {{ item.generatedAt ? `生成于 ${formatDateTime(item.generatedAt)}` : '尚未生成' }}
              </div>
              <div class="mt-1 truncate text-xs text-gray-400" :title="item.prompt">提示词：{{ item.prompt }}</div>
            </div>
            <el-button
              v-permission="'stage:handle'"
              size="small"
              :loading="isGenerating(item.chapterKey)"
              @click="generateCover(item.chapterKey, Boolean(item.coverUrl))"
            >
              {{ item.coverUrl ? '重新生成' : '生成封面' }}
            </el-button>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- ===================== Tab4：关卡管理（增删改查 + 排序 + 启停） ===================== -->
      <el-tab-pane label="关卡管理" name="stories">
        <el-card v-loading="storiesLoading" shadow="never" class="mt-4">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-[15px] font-semibold text-ink">关卡列表（共 {{ stories.length }} 关，停用的灰显）</span>
            <div class="flex gap-2">
              <el-button :loading="storiesLoading" @click="loadStories">刷新</el-button>
              <el-button v-permission="'stage:handle'" type="primary" @click="openStoryDialog()">新增关卡</el-button>
            </div>
          </div>

          <el-table :data="stories" border row-key="id" size="small">
            <el-table-column label="章节" width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.chapterName }}</template>
            </el-table-column>
            <el-table-column label="关卡" min-width="170">
              <template #default="{ row }">
                <div class="text-sm font-medium text-ink">{{ row.title }}</div>
                <div class="text-xs text-gray-400">
                  {{ row.category }}#{{ row.categoryId ?? '已删除' }} · {{ row.roles.length }} 角色
                </div>
              </template>
            </el-table-column>
            <el-table-column label="目标" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="text-xs text-gray-500">{{ row.goal }}</span>
              </template>
            </el-table-column>
            <el-table-column label="轮数" width="90" align="center">
              <template #default="{ row }">{{ row.minTurns }}~{{ row.maxTurns }}</template>
            </el-table-column>
            <el-table-column label="奖励XP" width="80" align="center" prop="rewardXp" />
            <el-table-column label="参与/会话/通关" width="120" align="center">
              <template #default="{ row }"
                >{{ row.participantCount }}/{{ row.sessionCount }}/{{ row.clearedCount }}</template
              >
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
                  {{ row.status === 1 ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="240" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="moveStory(row as StageStoryAdminItem, -1)">上移</el-button>
                <el-button link type="primary" @click="moveStory(row as StageStoryAdminItem, 1)">下移</el-button>
                <el-button
                  v-permission="'stage:handle'"
                  link
                  type="primary"
                  @click="openStoryDialog(row as StageStoryAdminItem)"
                >
                  编辑
                </el-button>
                <el-button
                  v-permission="'stage:handle'"
                  link
                  :type="row.status === 1 ? 'warning' : 'success'"
                  @click="toggleStoryStatus(row as StageStoryAdminItem)"
                >
                  {{ row.status === 1 ? '停用' : '启用' }}
                </el-button>
                <el-button
                  v-permission="'stage:handle'"
                  link
                  type="danger"
                  @click="removeStory(row as StageStoryAdminItem)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 会话详情抽屉：完整消息流 -->
    <el-drawer v-model="detailVisible" title="会话详情" size="560px">
      <el-scrollbar v-loading="detailLoading" class="h-full">
        <div v-if="detail" class="space-y-4 pr-2">
          <div class="rounded-xl bg-gray-50 p-3 text-xs leading-relaxed dark:bg-gray-800">
            <p><b>用户：</b>{{ detail.nickname }}（#{{ detail.userId }}）</p>
            <p><b>关卡：</b>{{ detail.stageTitle }}</p>
            <p><b>目标：</b>{{ detail.goal }}</p>
            <p>
              <b>状态：</b>{{ SESSION_STATUS_META[detail.status]?.label ?? detail.status }} · {{ detail.turnCount }} 轮
              · 通关：{{ detail.cleared ? '是' : '否' }} · 用过翻译：{{ detail.translationUsed ? '是' : '否' }}
            </p>
            <p v-if="detail.summary"><b>复盘：</b>{{ detail.summary }}</p>
          </div>

          <div class="space-y-2.5">
            <div
              v-for="msg in detail.messages"
              :key="msg.id"
              class="rounded-xl border p-2.5"
              :class="
                msg.role === 'user'
                  ? 'border-sky-200 bg-sky-50/60 dark:border-sky-800 dark:bg-sky-950/30'
                  : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
              "
            >
              <p class="mb-1 text-[11px] font-medium text-gray-400">
                {{ msg.role === 'user' ? '用户' : (msg.speaker ?? 'NPC') }} · {{ formatDateTime(msg.createdAt) }}
              </p>
              <p class="text-sm leading-relaxed">{{ msg.contentEn }}</p>
              <p v-if="msg.contentZh" class="mt-0.5 text-xs text-gray-400">{{ msg.contentZh }}</p>
            </div>
          </div>
        </div>
      </el-scrollbar>
    </el-drawer>

    <!-- 关卡编辑弹窗（新增/编辑共用） -->
    <el-dialog
      v-model="storyDialogVisible"
      :title="editingStoryId === null ? '新增关卡' : '编辑关卡'"
      width="720px"
      :close-on-click-modal="false"
    >
      <el-form label-width="90px" size="small">
        <el-form-item label="所属章节" required>
          <el-select v-model="storyForm.chapterKey" placeholder="选择章节" style="width: 220px">
            <el-option v-for="opt in chapterOptions" :key="opt.key" :label="opt.name" :value="opt.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="绑定分类" required>
          <el-select
            v-if="editingStoryId === null"
            v-model="storyForm.category"
            placeholder="选一个尚未绑定关卡的场景分类"
            filterable
            style="width: 320px"
          >
            <el-option
              v-for="opt in freeCategoryOptions"
              :key="opt.id"
              :label="`${opt.name}${opt.nameEn ? `（${opt.nameEn}）` : ''}`"
              :value="opt.name"
            />
          </el-select>
          <span v-else class="text-sm text-gray-500">{{ storyForm.category }}（不可修改）</span>
        </el-form-item>
        <el-form-item label="关卡标题" required>
          <el-input v-model="storyForm.title" maxlength="100" placeholder="如：便利店的清晨" style="width: 320px" />
        </el-form-item>
        <el-form-item label="剧情引入">
          <el-input
            v-model="storyForm.intro"
            type="textarea"
            :rows="2"
            maxlength="1000"
            placeholder="进入关卡时展示的剧情引入"
          />
        </el-form-item>
        <el-form-item label="通关收束">
          <el-input
            v-model="storyForm.outro"
            type="textarea"
            :rows="2"
            maxlength="1000"
            placeholder="通关后展示的剧情收束"
          />
        </el-form-item>
        <el-form-item label="用户角色">
          <el-input
            v-model="storyForm.userRole"
            maxlength="200"
            placeholder="用户在场景中扮演的角色，如：刚搬来的住户"
            style="width: 320px"
          />
        </el-form-item>
        <el-form-item label="场景设定">
          <el-input
            v-model="storyForm.setting"
            type="textarea"
            :rows="2"
            maxlength="1000"
            placeholder="喂给 AI 的场景设定"
          />
        </el-form-item>
        <el-form-item label="对话目标" required>
          <el-input
            v-model="storyForm.goal"
            type="textarea"
            :rows="2"
            maxlength="500"
            placeholder="展示给用户 + AI 通关判定依据"
          />
        </el-form-item>
        <el-form-item label="轮数">
          <span class="text-xs text-gray-500">通关需</span>
          <el-input-number v-model="storyForm.minTurns" :min="1" :max="50" controls-position="right" class="mx-1" />
          <span class="text-xs text-gray-500">轮，上限</span>
          <el-input-number v-model="storyForm.maxTurns" :min="1" :max="100" controls-position="right" class="mx-1" />
          <span class="text-xs text-gray-500">轮 · 奖励</span>
          <el-input-number v-model="storyForm.rewardXp" :min="0" :max="10000" controls-position="right" class="mx-1" />
          <span class="text-xs text-gray-500">XP（旧版通关线</span>
          <el-input-number v-model="storyForm.target" :min="0" :max="1000" controls-position="right" class="mx-1" />
          <span class="text-xs text-gray-500">句）</span>
        </el-form-item>

        <el-form-item label="出场角色">
          <div class="w-full space-y-2">
            <div v-for="(role, index) in storyForm.roles" :key="index" class="flex items-start gap-2">
              <el-input
                v-model="role.nameEn"
                placeholder="英文名（模型 speaker 用）"
                maxlength="40"
                style="width: 130px"
              />
              <el-input v-model="role.name" placeholder="中文名" maxlength="40" style="width: 110px" />
              <el-input v-model="role.emoji" placeholder="emoji" maxlength="10" style="width: 70px" />
              <el-input v-model="role.persona" placeholder="人设（喂给模型）" maxlength="500" class="flex-1" />
              <el-button v-if="storyForm.roles.length > 1" link type="danger" @click="removeRole(index)">删</el-button>
            </div>
            <el-button v-if="storyForm.roles.length < 3" link type="primary" @click="addRole">+ 添加角色</el-button>
          </div>
        </el-form-item>

        <el-form-item label="开场白">
          <div class="w-full space-y-2">
            <div v-for="(line, index) in storyForm.opening" :key="index" class="flex items-start gap-2">
              <el-select v-model="line.speaker" placeholder="说话者" style="width: 120px">
                <el-option
                  v-for="role in storyForm.roles"
                  :key="role.nameEn"
                  :label="role.nameEn"
                  :value="role.nameEn"
                />
              </el-select>
              <el-input v-model="line.contentEn" placeholder="英文台词" maxlength="300" class="flex-1" />
              <el-input v-model="line.contentZh" placeholder="中文翻译" maxlength="200" style="width: 160px" />
              <el-button link type="danger" @click="removeOpeningLine(index)">删</el-button>
            </div>
            <el-button link type="primary" @click="addOpeningLine">+ 添加一句</el-button>
          </div>
        </el-form-item>

        <el-form-item label="候选短句">
          <div class="w-full space-y-2">
            <div v-for="(hint, index) in storyForm.starterHints" :key="index" class="flex items-center gap-2">
              <el-input v-model="hint.en" placeholder="英文短句" maxlength="200" class="flex-1" />
              <el-input v-model="hint.zh" placeholder="中文" maxlength="200" style="width: 200px" />
              <el-button v-if="storyForm.starterHints.length > 1" link type="danger" @click="removeHint(index)"
                >删</el-button
              >
            </div>
            <el-button v-if="storyForm.starterHints.length < 8" link type="primary" @click="addHint"
              >+ 添加一条</el-button
            >
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="storyDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="storySaving" @click="saveStory">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
