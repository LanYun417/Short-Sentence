<script setup lang="ts">
/**
 * 情景闯关管理页（「短句」运营后台，路由 /sentence/stage）。
 * 四个 Tab（层级 = 场景 → 剧本 → 关卡）：
 * 1. 关卡总览——按剧本分组，看每关的参与/通关/无翻译/待领奖统计；
 * 2. 对话会话——分页抽查用户的场景对话（筛选关卡/状态/用户/无翻译），
 *    点开抽屉看完整消息流（查 AI 质量、处理客诉），可强制结束异常会话；
 * 3. 剧本管理——剧本的增删改查、AI 封面生成/重生成；
 * 4. 关卡管理——关卡的增删改查、上移下移、AI 生成草稿。
 *
 * 权限：stage:view 查看，stage:handle 增删改（v-permission，与种子菜单一致）。
 */
import BasicDialog from '@/components/BasicDialog/index.vue';
import { ElMessage, ElMessageBox } from '@/utils/element';
import {
  aiGenerateStageStoryApi,
  closeStageSessionApi,
  createStageScriptApi,
  createStageStoryApi,
  deleteStageScriptApi,
  deleteStageStoryApi,
  generateMissingStageCoversApi,
  regenerateAllStageCoversApi,
  generateStageScriptCoverApi,
  getStageOverviewApi,
  getStageScriptsApi,
  getStageSessionDetailApi,
  getStageSessionListApi,
  getStageStoriesApi,
  reorderStageStoriesApi,
  setStageScriptStatusApi,
  setStageStoryStatusApi,
  updateStageScriptApi,
  updateStageStoryApi,
} from '@/api/stage';
import { getCategoryOptionsApi, type SentenceCategoryOption } from '@/api/sentence';
import { useTable } from '@/composables/useTable';
import { formatDateTime } from '@/utils/format';
import type {
  StageAdminChapter,
  StageAdminItem,
  StageLineItem,
  StageRoleItem,
  StageScriptAdminItem,
  StageScriptPayload,
  StageSessionDetail,
  StageSessionItem,
  StageStoryAdminItem,
  StageStoryPayload,
} from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'SentenceStage' });

// 注意：本页**不**用 table-page 布局——总览 Tab 是多张分组表堆叠、会很长，table-page 会把
// 内容区 overflow:hidden 只允许单表格内部滚动，套 el-tabs 后高度链断裂导致整页滚不动。
// 这里整页正常滚动（content-scrollbar 默认 overflow:auto）。

const activeTab = ref<'overview' | 'sessions' | 'scripts' | 'stories'>('overview');

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
  // 剧本名可能带「{场景} · 」前缀（种子数据），与关卡名并排会重复；顺手剥掉
  chapters.value.flatMap((c) =>
    c.stages.map((s) => ({
      id: s.id,
      title: `${c.name.replace(/^.+ · (?=默认剧本$)/, '')} · ${s.title}`,
    })),
  ),
);

function clearRate(stage: StageAdminItem): string {
  if (stage.participantCount === 0) return '—';
  return `${Math.round((stage.clearedCount / stage.participantCount) * 100)}%`;
}

/* ------------------------------ Tab2：对话会话抽查 ------------------------------ */
const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getStageSessionListApi({
      page: p.page,
      pageSize: p.pageSize,
      storyId: p.storyId || undefined,
      status: p.status || undefined,
      userId: p.userId || undefined,
      noTranslation: p.noTranslation ? '1' : undefined,
      keyword: p.keyword?.trim() || undefined,
    }),
  {
    storyId: undefined as number | undefined,
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

/* ------------------------------ Tab3：剧本管理（stage_script CRUD + AI 封面） ------------------------------ */
const scripts = ref<StageScriptAdminItem[]>([]);
const scriptsLoading = ref(false);
const categoryOptions = ref<SentenceCategoryOption[]>([]);
/** 正在生成中的封面标记：单个剧本用 id，补全缺失用 'missing'，批量重生用 'all' */
const generatingKeys = ref<string[]>([]);

async function loadScripts(): Promise<void> {
  scriptsLoading.value = true;
  try {
    const [list, cats] = await Promise.all([getStageScriptsApi(), getCategoryOptionsApi()]);
    scripts.value = list;
    categoryOptions.value = cats;
  } finally {
    scriptsLoading.value = false;
  }
}

function isGenerating(key: string): boolean {
  return generatingKeys.value.includes(key);
}

/** 生成/重新生成剧本封面。 */
async function generateCover(scriptId?: number, regenerate = false): Promise<void> {
  if (scriptId && regenerate) {
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
  const mark = scriptId !== undefined ? String(scriptId) : 'missing';
  generatingKeys.value = [...generatingKeys.value, mark];
  try {
    if (scriptId !== undefined) {
      await generateStageScriptCoverApi(scriptId, regenerate);
      ElMessage.success('封面已生成');
    } else {
      const result = await generateMissingStageCoversApi();
      ElMessage.success(`缺失封面已补全：新增 ${result.generated.length} 张，跳过 ${result.skipped.length} 张`);
    }
    await Promise.all([loadScripts(), loadOverview()]);
  } finally {
    generatingKeys.value = generatingKeys.value.filter((k) => k !== mark);
  }
}

/** 批量重新生成全部启用剧本的封面（覆盖已有图，会消耗较多生图配额，需二次确认）。 */
async function regenerateAllCovers(): Promise<void> {
  const total = scripts.value.filter((item) => item.status === 1).length;
  try {
    await ElMessageBox.confirm(
      `将为全部 ${total} 个启用剧本重新生成封面，**会覆盖现有封面图**且消耗较多 AI 生图配额。确定批量重生吗？`,
      '批量重新生图',
      { type: 'warning', confirmButtonText: '批量重生', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  generatingKeys.value = [...generatingKeys.value, 'all'];
  try {
    const result = await regenerateAllStageCoversApi();
    ElMessage.success(`批量重生完成：成功 ${result.generated.length} 张，失败 ${result.failed.length} 张`);
    await Promise.all([loadScripts(), loadOverview()]);
  } finally {
    generatingKeys.value = generatingKeys.value.filter((k) => k !== 'all');
  }
}

function onTabChange(name: string | number): void {
  if (name === 'scripts' && scripts.value.length === 0) void loadScripts();
  if (name === 'stories') void loadStories();
}

/* ------------------------------ Tab4：关卡管理（stage_story CRUD） ------------------------------ */

const stories = ref<StageStoryAdminItem[]>([]);
const storiesLoading = ref(false);

async function loadStories(): Promise<void> {
  storiesLoading.value = true;
  try {
    stories.value = await getStageStoriesApi();
  } finally {
    storiesLoading.value = false;
  }
}

/**
 * 剥掉剧本名里的「{场景} · 」前缀（种子/迁移生成的默认剧本名带前缀，历史数据），
 * 否则与场景名并排展示会变成「日常生活 · 日常生活 · 默认剧本」。
 */
function stripScenePrefix(categoryName: string, name: string): string {
  const prefix = `${categoryName} · `;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

/** 剧本下拉树：场景为父节点（禁选，只作分组），剧本为子节点（value = 剧本 id）。 */
const scriptTree = computed(() => {
  const groups = new Map<number, { name: string; scripts: StageScriptAdminItem[] }>();
  for (const script of scripts.value) {
    const hit = groups.get(script.categoryId) ?? { name: script.categoryName, scripts: [] };
    hit.scripts.push(script);
    groups.set(script.categoryId, hit);
  }
  return [...groups.entries()].map(([categoryId, group]) => ({
    value: `scene-${categoryId}`,
    label: group.name,
    disabled: true,
    children: group.scripts.map((script) => ({
      value: script.id,
      label: stripScenePrefix(script.categoryName, script.name),
    })),
  }));
});

const treeSelectProps = { label: 'label', children: 'children', disabled: 'disabled' } as const;

/* ------------------------------ 剧本表单弹窗 ------------------------------ */

interface ScriptForm {
  categoryId: number;
  name: string;
  blurb: string;
  sort: number;
  status: 0 | 1;
}

const scriptDialogVisible = ref(false);
const scriptSaving = ref(false);
const editingScriptId = ref<number | null>(null);

const emptyScriptForm = (): ScriptForm => ({
  categoryId: categoryOptions.value[0]?.id ?? 0,
  name: '',
  blurb: '',
  sort: 0,
  status: 1,
});

const scriptForm = ref<ScriptForm>(emptyScriptForm());

function openScriptDialog(row?: StageScriptAdminItem): void {
  editingScriptId.value = row?.id ?? null;
  scriptForm.value = row
    ? {
        categoryId: row.categoryId,
        name: row.name,
        blurb: row.blurb,
        sort: row.sort,
        status: row.status as 0 | 1,
      }
    : emptyScriptForm();
  scriptDialogVisible.value = true;
}

async function saveScript(): Promise<void> {
  const form = scriptForm.value;
  if (!form.categoryId) {
    ElMessage.warning('请选择场景分类');
    return;
  }
  if (!form.name.trim()) {
    ElMessage.warning('剧本名必填');
    return;
  }
  const payload: StageScriptPayload = {
    categoryId: form.categoryId,
    name: form.name.trim(),
    blurb: form.blurb.trim(),
    sort: form.sort,
    status: form.status,
  };
  scriptSaving.value = true;
  try {
    let createdId: number | null = null;
    if (editingScriptId.value === null) {
      const result = await createStageScriptApi(payload);
      createdId = result.id;
      ElMessage.success('剧本已创建');
    } else {
      await updateStageScriptApi(editingScriptId.value, payload);
      ElMessage.success('剧本已更新');
    }
    scriptDialogVisible.value = false;
    await loadScripts();
    // 从关卡弹窗里顺手新建的剧本：自动选中，省得再手动挑一次
    if (createdId !== null && storyDialogVisible.value && storyForm.value.scriptId === 0) {
      storyForm.value.scriptId = createdId;
    }
  } finally {
    scriptSaving.value = false;
  }
}

/** 启停剧本。 */
async function toggleScriptStatus(row: StageScriptAdminItem): Promise<void> {
  const next = row.status === 1 ? 0 : 1;
  if (next === 0 && row.stageCount > 0) {
    try {
      await ElMessageBox.confirm(
        `停用后「${row.name}」下的 ${row.stageCount} 个关卡在客户端都不可见（历史进度与会话保留）。确定停用吗？`,
        '停用剧本',
        { type: 'warning', confirmButtonText: '停用', cancelButtonText: '取消' },
      );
    } catch {
      return;
    }
  }
  await setStageScriptStatusApi(row.id, next as 0 | 1);
  ElMessage.success(next === 1 ? '剧本已启用' : '剧本已停用');
  await loadScripts();
}

/** 删除剧本（连同其下关卡）。 */
async function removeScript(row: StageScriptAdminItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除剧本「${row.name}」吗？\n会连同删除其 ${row.stageCount} 个关卡；历史进度与会话按关卡保留，不受影响。`,
      '删除剧本',
      { type: 'error', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  const result = await deleteStageScriptApi(row.id);
  ElMessage.success(`剧本已删除（${result.deletedStories} 个关卡一并删除）`);
  await Promise.all([loadScripts(), loadStories(), loadOverview()]);
}

/* ------------------------------ 关卡表单弹窗 ------------------------------ */

interface StoryForm {
  scriptId: number;
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
  scriptId: (scriptTree.value[0]?.children[0]?.value as number | undefined) ?? 0,
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
  if (scripts.value.length === 0) await loadScripts();
  editingStoryId.value = row?.id ?? null;
  storyForm.value = row
    ? {
        scriptId: row.scriptId,
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
  if (!form.scriptId || !form.title.trim()) {
    ElMessage.warning('剧本、标题必填');
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
    scriptId: form.scriptId,
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
      await updateStageStoryApi(editingStoryId.value, payload);
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
        `停用后该关卡在客户端地图与对话页都不可见（历史进度/会话保留）。确定停用「${row.title}」吗？`,
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
      `确定删除关卡「${row.title}」吗？\n删除后进度与会话按关卡记录，历史数据保留，但该关卡不可再进入。`,
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

/** 剧本内上移/下移：交换 sort 后整组按新顺序提交。 */
async function moveStory(row: StageStoryAdminItem, direction: -1 | 1): Promise<void> {
  const siblings = stories.value.filter((item) => item.scriptId === row.scriptId);
  const index = siblings.findIndex((item) => item.id === row.id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= siblings.length) return;
  const ids = siblings.map((item) => item.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  await reorderStageStoriesApi(row.scriptId, ids);
  await Promise.all([loadStories(), loadOverview()]);
}

/* ------------------------------ AI 生成关卡草稿 ------------------------------ */

const aiDialogVisible = ref(false);
const aiGenerating = ref(false);
const aiForm = ref<{ scriptId: number }>({ scriptId: 0 });

async function openAiDialog(): Promise<void> {
  if (scripts.value.length === 0) await loadScripts();
  aiForm.value = { scriptId: (scriptTree.value[0]?.children[0]?.value as number | undefined) ?? 0 };
  aiDialogVisible.value = true;
}

/** 调 AI 生成草稿 → 填进编辑弹窗（新增态），运营审核/微调后点保存才入库。 */
async function handleAiGenerate(): Promise<void> {
  if (!aiForm.value.scriptId) {
    ElMessage.warning('请选择剧本');
    return;
  }
  aiGenerating.value = true;
  try {
    const draft = await aiGenerateStageStoryApi(aiForm.value.scriptId);
    aiDialogVisible.value = false;
    // 草稿直接铺进新增弹窗，走统一的保存链路入库
    editingStoryId.value = null;
    storyForm.value = {
      scriptId: draft.scriptId,
      title: draft.title,
      intro: draft.intro,
      outro: draft.outro,
      userRole: draft.userRole,
      setting: draft.setting,
      goal: draft.goal,
      minTurns: draft.minTurns,
      maxTurns: draft.maxTurns,
      target: draft.target ?? 5,
      rewardXp: draft.rewardXp,
      roles: draft.roles.map((role) => ({ ...role })),
      opening: draft.opening.map((line) => ({ ...line })),
      starterHints: draft.starterHints.map((hint) => ({ ...hint })),
    };
    storyDialogVisible.value = true;
    ElMessage.success(`AI 已生成草稿「${draft.title}」，审核后点保存入库`);
  } finally {
    aiGenerating.value = false;
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
            <el-table :data="chapter.stages" border>
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
            <el-select v-model="query.storyId" placeholder="全部" clearable filterable style="width: 240px">
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
                  <el-tag :type="SESSION_STATUS_META[row.status]?.type ?? 'info'">
                    {{ SESSION_STATUS_META[row.status]?.label ?? row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="轮数" width="70" align="center" prop="turnCount" />
              <el-table-column label="通关" width="70" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.cleared" type="success">是</el-tag>
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

      <!-- ===================== Tab3：剧本管理（CRUD + AI 封面） ===================== -->
      <el-tab-pane label="剧本管理" name="scripts">
        <el-card v-loading="scriptsLoading" shadow="never" class="mt-4">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-[15px] font-semibold text-ink">剧本列表（共 {{ scripts.length }} 个，挂在场景下）</span>
            <div class="flex gap-2">
              <el-button :loading="scriptsLoading" @click="loadScripts">刷新</el-button>
              <el-button
                v-permission="'stage:handle'"
                :loading="isGenerating('missing')"
                @click="generateCover(undefined, false)"
              >
                补全缺失封面
              </el-button>
              <el-button
                v-permission="'stage:handle'"
                type="warning"
                :loading="isGenerating('all')"
                @click="regenerateAllCovers"
              >
                批量重新生图
              </el-button>
              <el-button v-permission="'stage:handle'" type="primary" @click="openScriptDialog()">新增剧本</el-button>
            </div>
          </div>

          <el-table :data="scripts" border row-key="id">
            <el-table-column label="场景" width="110" prop="categoryName" show-overflow-tooltip />
            <el-table-column label="剧本" min-width="220">
              <template #default="{ row }">
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-100 dark:bg-gray-800"
                  >
                    <el-image
                      v-if="row.coverUrl"
                      :src="row.coverUrl"
                      :preview-src-list="[row.coverUrl]"
                      preview-teleported
                      fit="cover"
                      class="h-full w-full cursor-zoom-in"
                    />
                    <span v-else class="text-[10px] text-gray-400">无封面</span>
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-medium text-ink">{{ row.name }}</div>
                    <div class="truncate text-xs text-gray-400">{{ row.blurb || '—' }}</div>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="关卡(启用/全部)" width="130" align="center">
              <template #default="{ row }">{{ row.enabledStageCount }} / {{ row.stageCount }}</template>
            </el-table-column>
            <el-table-column label="会话数" width="80" align="center" prop="sessionCount" />
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'info'">
                  {{ row.status === 1 ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="270" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-permission="'stage:handle'"
                  link
                  type="primary"
                  :loading="isGenerating(String(row.id))"
                  @click="generateCover(row.id as number, Boolean(row.coverUrl))"
                >
                  {{ row.coverUrl ? '重生成封面' : '生成封面' }}
                </el-button>
                <el-button
                  v-permission="'stage:handle'"
                  link
                  type="primary"
                  @click="openScriptDialog(row as StageScriptAdminItem)"
                >
                  编辑
                </el-button>
                <el-button
                  v-permission="'stage:handle'"
                  link
                  :type="row.status === 1 ? 'warning' : 'success'"
                  @click="toggleScriptStatus(row as StageScriptAdminItem)"
                >
                  {{ row.status === 1 ? '停用' : '启用' }}
                </el-button>
                <el-button
                  v-permission="'stage:handle'"
                  link
                  type="danger"
                  @click="removeScript(row as StageScriptAdminItem)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- ===================== Tab4：关卡管理（增删改查 + 排序 + 启停） ===================== -->
      <el-tab-pane label="关卡管理" name="stories">
        <el-card v-loading="storiesLoading" shadow="never" class="mt-4">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-[15px] font-semibold text-ink">关卡列表（共 {{ stories.length }} 关，停用的灰显）</span>
            <div class="flex gap-2">
              <el-button :loading="storiesLoading" @click="loadStories">刷新</el-button>
              <el-button v-permission="'stage:handle'" @click="openAiDialog">AI 生成关卡</el-button>
              <el-button v-permission="'stage:handle'" type="primary" @click="openStoryDialog()">新增关卡</el-button>
            </div>
          </div>

          <el-table :data="stories" border row-key="id">
            <el-table-column label="所属" min-width="200">
              <template #default="{ row }">
                <div class="text-sm font-medium text-ink">{{ row.title }}</div>
                <div class="text-xs text-gray-400">
                  {{ row.categoryName }} · {{ stripScenePrefix(row.categoryName, row.scriptName) }}
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
                <el-tag :type="row.status === 1 ? 'success' : 'info'">
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
    <BasicDialog
      v-model="storyDialogVisible"
      :title="editingStoryId === null ? '新增关卡' : '编辑关卡'"
      width="720px"
      :close-on-click-modal="false"
    >
      <el-form label-width="90px">
        <el-form-item label="所属剧本" required>
          <div class="flex flex-wrap items-center gap-2">
            <div class="min-w-0 flex-1">
              <el-tree-select
                v-model="storyForm.scriptId"
                :data="scriptTree"
                :props="treeSelectProps"
                node-key="value"
                filterable
                placeholder="场景 → 剧本（场景不可选，点开选剧本）"
                style="width: 100%"
              >
                <template #empty>
                  <div class="px-3 py-2 text-xs leading-relaxed text-gray-400">
                    还没有剧本。点右侧「＋ 新建剧本」，或去
                    <router-link to="/sentence/category" class="text-primary">「场景分类」</router-link>
                    先建场景。
                  </div>
                </template>
              </el-tree-select>
            </div>
            <el-button class="shrink-0" link type="primary" @click="openScriptDialog()">＋ 新建剧本</el-button>
          </div>
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
    </BasicDialog>

    <!-- 剧本编辑弹窗（新增/编辑共用） -->
    <BasicDialog
      v-model="scriptDialogVisible"
      :title="editingScriptId === null ? '新增剧本' : '编辑剧本'"
      width="520px"
      :close-on-click-modal="false"
    >
      <el-form label-width="90px">
        <el-form-item label="所属场景" required>
          <el-select v-model="scriptForm.categoryId" placeholder="场景分类" filterable style="width: 300px">
            <el-option
              v-for="opt in categoryOptions"
              :key="opt.id"
              :label="`${opt.name}${opt.nameEn ? `（${opt.nameEn}）` : ''}`"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="剧本名" required>
          <el-input v-model="scriptForm.name" maxlength="100" placeholder="如：程序员的一天" style="width: 300px" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input
            v-model="scriptForm.blurb"
            type="textarea"
            :rows="2"
            maxlength="500"
            placeholder="一句话介绍这条身份线"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="scriptForm.sort" :min="0" :max="9999" controls-position="right" />
          <span class="ml-2 text-xs text-gray-400">越小越靠前</span>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch
            v-model="scriptForm.status"
            :active-value="1"
            :inactive-value="0"
            active-text="启用"
            inactive-text="停用"
          />
        </el-form-item>
        <p class="text-xs leading-relaxed text-gray-400">
          剧本挂在场景分类下（没有合适场景可去
          <router-link to="/sentence/category" class="text-primary">「场景分类」</router-link>
          新建）；封面创建后可到本 Tab 用 AI 生成。
        </p>
      </el-form>
      <template #footer>
        <el-button @click="scriptDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="scriptSaving" @click="saveScript">保存</el-button>
      </template>
    </BasicDialog>

    <!-- AI 生成关卡：选剧本 → 生成草稿 → 自动铺进上面的编辑弹窗审核 -->
    <BasicDialog v-model="aiDialogVisible" title="AI 生成关卡" width="520px" :close-on-click-modal="false">
      <el-form label-width="90px">
        <el-form-item label="所属剧本" required>
          <div class="flex flex-wrap items-center gap-2">
            <div class="min-w-0 flex-1">
              <el-tree-select
                v-model="aiForm.scriptId"
                :data="scriptTree"
                :props="treeSelectProps"
                node-key="value"
                filterable
                placeholder="场景 → 剧本（场景不可选，点开选剧本）"
                style="width: 100%"
              >
                <template #empty>
                  <div class="px-3 py-2 text-xs leading-relaxed text-gray-400">
                    还没有剧本。点右侧「＋ 新建剧本」，或去
                    <router-link to="/sentence/category" class="text-primary">「场景分类」</router-link>
                    先建场景。
                  </div>
                </template>
              </el-tree-select>
            </div>
            <el-button class="shrink-0" link type="primary" @click="openScriptDialog()">＋ 新建剧本</el-button>
          </div>
        </el-form-item>
        <p class="text-xs leading-relaxed text-gray-400">
          AI 会根据剧本所属场景和剧本定位生成一整套关卡剧情（标题/引入/目标/角色/开场白/候选短句），
          生成后自动铺进编辑弹窗，**审核修改后点保存才会入库**。
        </p>
      </el-form>
      <template #footer>
        <el-button @click="aiDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="aiGenerating" :disabled="!aiForm.scriptId" @click="handleAiGenerate">
          生成草稿
        </el-button>
      </template>
    </BasicDialog>
  </div>
</template>
