<script setup lang="ts">
/**
 * 题库管理页（「短句」运营后台）。
 * 模块职责：题目分页筛选 / 增改下架、手动触发每日生成、生成批次进度监控。
 * 权限：按钮级 v-permission（sentence:list/query/add/edit/remove/gen），与种子菜单一致。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import {
  cancelGenTaskApi,
  createSentenceApi,
  batchSentenceStatusApi,
  batchRegenerateSentenceImageApi,
  deleteGenTaskApi,
  deleteSentenceApi,
  exportSentencesApi,
  getCategoryOptionsApi,
  getGenTaskListApi,
  getSentenceDetailApi,
  getSentenceListApi,
  pauseGenTaskApi,
  regenerateSentenceImageApi,
  resumeGenTaskApi,
  triggerGenApi,
  triggerAllFestivalsApi,
  triggerFestivalCoversApi,
  backfillExplanationsApi,
  updateSentenceApi,
  type SentenceCategoryOption,
} from '@/api/sentence';
import { useTable } from '@/composables/useTable';
import { useCsvExport } from '@/composables/useCsvExport';
import { formatDateTime } from '@/utils/format';
import type { GenTaskItem, SentenceItem, SentenceSavePayload, SentenceStatus } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { onBeforeUnmount, ref, watch } from 'vue';

defineOptions({ name: 'SentenceList' });

/** 状态 → 标签样式与文案 */
const STATUS_TAG: Record<SentenceStatus, { type: 'primary' | 'success' | 'info'; label: string }> = {
  pending_image: { type: 'info', label: '待生成' },
  ready: { type: 'success', label: '就绪' },
  offline: { type: 'primary', label: '已下架' },
};

/** 难度文案 */
const DIFFICULTY_LABEL: Record<number, string> = { 1: '基础', 2: '进阶', 3: '挑战' };

/** 生成批次状态标签 */
const GEN_STATUS_TAG: Record<string, { type: 'primary' | 'success' | 'warning' | 'danger'; label: string }> = {
  pending: { type: 'info' as unknown as 'primary', label: '待处理' },
  running: { type: 'primary', label: '进行中' },
  success: { type: 'success', label: '成功' },
  failed: { type: 'danger', label: '失败' },
  paused: { type: 'warning', label: '已暂停' },
  cancelled: { type: 'info' as unknown as 'primary', label: '已取消' },
};

/** 生成阶段文案（stage 为空 = 三阶段上线前的老批次，不显示）。 */
const GEN_STAGE_LABEL: Record<string, string> = {
  generating: '生题',
  polishing: '优化',
  reviewing: '审核',
  imaging: '生图',
  done: '收尾',
};

/** 心跳停滞阈值：运行中且超过这么久没有心跳，大概率卡住了。 */
const HEARTBEAT_STALE_MS = 120_000;

/** 心跳是否已停滞。 */
function heartbeatStale(row: GenTaskItem): boolean {
  if (row.status !== 'running' || !row.lastHeartbeatAt) {
    return false;
  }
  return Date.now() - new Date(row.lastHeartbeatAt).getTime() > HEARTBEAT_STALE_MS;
}

/** 心跳相对时间（「23 秒前」）。轮询每 3s 刷新列表，渲染时重算即为准实时。 */
function heartbeatText(row: GenTaskItem): string {
  if (!row.lastHeartbeatAt) {
    return '—';
  }
  const seconds = Math.max(0, Math.round((Date.now() - new Date(row.lastHeartbeatAt).getTime()) / 1000));
  if (seconds < 60) {
    return `${seconds} 秒前`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} 分钟前`;
  }
  return formatDateTime(row.lastHeartbeatAt);
}

const categories = ref<SentenceCategoryOption[]>([]);

const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getSentenceListApi({
      page: p.page,
      pageSize: p.pageSize,
      keyword: p.keyword?.trim() || undefined,
      status: p.status,
      difficulty: p.difficulty,
      categoryId: p.categoryId,
    }),
  {
    keyword: '',
    status: undefined as SentenceStatus | undefined,
    difficulty: undefined as number | undefined,
    categoryId: undefined as number | undefined,
  },
);

/* ------------------------------ 表单弹窗 ------------------------------ */

const dialogVisible = ref(false);
const dialogSaving = ref(false);
const editingId = ref<number | null>(null);
const form = ref<SentenceSavePayload>({
  categoryId: 0,
  sentenceEn: '',
  translationZh: '',
  ipa: '',
  explanation: '',
  scenePrompt: '',
  difficulty: 2,
  status: 'ready',
});

/** 打开新增。 */
function handleCreate(): void {
  editingId.value = null;
  form.value = {
    categoryId: categories.value[0]?.id ?? 0,
    sentenceEn: '',
    translationZh: '',
    ipa: '',
    explanation: '',
    scenePrompt: '',
    difficulty: 2,
    status: 'ready',
  };
  dialogVisible.value = true;
}

/** 打开编辑（回填；状态缺省按就绪处理）。 */
function handleEdit(row: SentenceItem): void {
  editingId.value = row.id;
  form.value = {
    categoryId: row.categoryId,
    sentenceEn: row.sentenceEn,
    translationZh: row.translationZh,
    ipa: row.ipa ?? '',
    explanation: row.explanation ?? '',
    scenePrompt: row.scenePrompt,
    difficulty: row.difficulty,
    status: row.status === 'offline' ? 'offline' : 'ready',
  };
  dialogVisible.value = true;
}

/** 保存（新增/编辑共用）。 */
async function handleSave(): Promise<void> {
  if (!form.value.sentenceEn.trim() || !form.value.translationZh.trim()) {
    ElMessage.warning('英文句子与中文释义必填');
    return;
  }
  if (!form.value.categoryId) {
    ElMessage.warning('请选择分类');
    return;
  }
  dialogSaving.value = true;
  try {
    const payload: SentenceSavePayload = {
      categoryId: form.value.categoryId,
      sentenceEn: form.value.sentenceEn.trim(),
      translationZh: form.value.translationZh.trim(),
      ipa: form.value.ipa?.trim() || undefined,
      explanation: form.value.explanation?.trim() || undefined,
      scenePrompt: form.value.scenePrompt?.trim() || undefined,
      difficulty: form.value.difficulty,
      status: form.value.status,
    };
    if (editingId.value === null) {
      await createSentenceApi(payload);
      ElMessage.success('新增成功');
    } else {
      await updateSentenceApi(editingId.value, payload);
      ElMessage.success('保存成功');
    }
    dialogVisible.value = false;
    await getList();
  } finally {
    dialogSaving.value = false;
  }
}

/** 下架题目（软删除：前端二次确认后调用）。 */
async function handleOffline(row: SentenceItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定下架「${row.sentenceEn}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  await deleteSentenceApi(row.id);
  ElMessage.success('已下架');
  await getList();
}

/* ------------------------------ 单题重新生图 ------------------------------ */

const regenVisible = ref(false);
const regenSubmitting = ref(false);
const regenTarget = ref<SentenceItem | null>(null);
const regenPrompt = ref('');
/** 正在出图的题目 id：按钮转圈 + 禁点，避免连点（后端也会拦，这是第一道）。 */
const regeneratingIds = ref<Set<number>>(new Set());
/** 轮询定时器（按题目 id；离开页面统一清掉，别在后台一直打接口）。 */
const regenTimers = new Map<number, ReturnType<typeof setInterval>>();

/** 打「生图中」标记。 */
function setRegenerating(id: number, on: boolean): void {
  const next = new Set(regeneratingIds.value);
  if (on) {
    next.add(id);
  } else {
    next.delete(id);
  }
  regeneratingIds.value = next;
}

/** 打开弹窗（提示词预填当前值，可直接改后重生成）。 */
function handleOpenRegen(row: SentenceItem): void {
  regenTarget.value = row;
  regenPrompt.value = row.scenePrompt ?? '';
  regenVisible.value = true;
}

/**
 * 轮询单题直到出图。
 *
 * 判定「成功」看 **imageUrl 是否变化**，不看 status：下架题重新生图后
 * 状态会还原成 offline，若按「status === ready」判断会把成功误报成失败。
 */
function pollRegen(id: number, prevUrl: string | null): void {
  if (regenTimers.has(id)) {
    return;
  }
  let tries = 0;
  const stop = (): void => {
    const timer = regenTimers.get(id);
    if (timer) {
      clearInterval(timer);
      regenTimers.delete(id);
    }
    setRegenerating(id, false);
  };
  const timer = setInterval(() => {
    tries += 1;
    void getSentenceDetailApi(id)
      .then((detail) => {
        const row = list.value.find((item) => item.id === id);
        if (row) {
          row.status = detail.status;
          row.imageUrl = detail.imageUrl;
        }
        if (detail.status !== 'pending_image') {
          stop();
          ElMessage.success(detail.imageUrl !== prevUrl ? '配图已更新' : '重新生图未成功，可再试一次');
        } else if (tries >= 12) {
          // 12 × 5s = 60s 仍未出图：停止轮询，避免一直打后端（状态仍可在刷新后看到）
          stop();
          ElMessage.warning('生图仍在进行，稍后刷新列表查看结果');
        }
      })
      .catch(() => {
        // 单次轮询失败不打断，下一轮继续
        if (tries >= 12) {
          stop();
        }
      });
  }, 5000);
  regenTimers.set(id, timer);
}

/** 提交：受理后立刻刷新（状态变「待生成」），再开始轮询。 */
async function submitRegen(): Promise<void> {
  const row = regenTarget.value;
  if (!row) {
    return;
  }
  const prevUrl = row.imageUrl;
  regenSubmitting.value = true;
  try {
    await regenerateSentenceImageApi(row.id, regenPrompt.value.trim() || undefined);
    regenVisible.value = false;
    setRegenerating(row.id, true);
    ElMessage.success('已开始重新生图，约 10~40 秒完成');
    await getList();
    pollRegen(row.id, prevUrl);
  } finally {
    regenSubmitting.value = false;
  }
}

/** 离开页面：清掉所有轮询。 */
onBeforeUnmount(() => {
  for (const timer of regenTimers.values()) {
    clearInterval(timer);
  }
  regenTimers.clear();
});

/* ------------------------------ 批量上下架 ------------------------------ */

/** 表格勾选的题目 id（翻页后仍保留，靠 reserve-selection + row-key）。 */
const selectedIds = ref<number[]>([]);

/** 勾选变化：同步 id 列表。 */
function handleSelectionChange(rows: SentenceItem[]): void {
  selectedIds.value = rows.map((row) => row.id);
}

/** 导出题库 CSV：按当前筛选条件（后端有 5 万行上限，超了请求层会提示具体原因）。 */
const { exporting, exportCsv } = useCsvExport();

function handleExport(): void {
  void exportCsv({
    api: exportSentencesApi,
    params: {
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      difficulty: query.difficulty || undefined,
      categoryId: query.categoryId || undefined,
    },
    name: '题库',
  });
}

/** 批量下架。 */
async function handleBatchOffline(): Promise<void> {
  if (selectedIds.value.length === 0) {
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确定下架选中的 ${selectedIds.value.length} 条题目吗？软删除，图片仍保留。`,
      '批量下架',
      {
        type: 'warning',
      },
    );
  } catch {
    return;
  }
  await batchSentenceStatusApi(selectedIds.value, 'offline');
  ElMessage.success('已批量下架');
  await getList();
}

/** 批量上架（只对已有配图的题生效，后端会过滤）。 */
async function handleBatchOnline(): Promise<void> {
  if (selectedIds.value.length === 0) {
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确定上架选中的 ${selectedIds.value.length} 条题目吗？只有已生成配图的题会被上架。`,
      '批量上架',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  const result = await batchSentenceStatusApi(selectedIds.value, 'ready');
  ElMessage.success(result.affected > 0 ? `已上架 ${result.affected} 条` : '没有符合条件的题目（需已生成配图）');
  await getList();
}

/**
 * 批量重新生图（换配图风格时用；逐条点太慢）。
 *
 * 与单题版共用同一套轮询（pollRegen 按题目 id 各起一个定时器），
 * 受理后先刷新列表（状态变「待生成」），出图的题会在行内自动更新。
 * 单次上限 50：每张图都消耗 Agnes 配额（免费额度 40 RPM / 并发 2），
 * 一次 50 张要约 75 秒以上，超出部分运营分两批点即可。
 */
async function handleBatchRegen(): Promise<void> {
  if (selectedIds.value.length === 0) {
    return;
  }
  try {
    await ElMessageBox.confirm(
      `将对选中的 ${selectedIds.value.length} 条题目重新生成配图（沿用各自的场景提示词），每张约 10~40 秒、消耗 AI 生图配额。已下架的题出图后仍是下架。确认继续？`,
      '批量重新生图',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  const prevUrls = new Map(list.value.map((row) => [row.id, row.imageUrl]));
  const result = await batchRegenerateSentenceImageApi(selectedIds.value);
  if (result.accepted.length === 0) {
    ElMessage.warning('没有可重新生成的题目（不存在、正在生成或已在出图）');
    return;
  }
  for (const id of result.accepted) {
    setRegenerating(id, true);
    pollRegen(id, prevUrls.get(id) ?? null);
  }
  ElMessage.success(
    result.skipped.length > 0
      ? `已受理 ${result.accepted.length} 张，跳过 ${result.skipped.length} 张（正在生成或不存在）`
      : `已受理 ${result.accepted.length} 张，约 10~40 秒后自动更新`,
  );
  await getList();
}

/* ------------------------------ 生成批次 ------------------------------ */

const genDialogVisible = ref(false);
const genLoading = ref(false);
const genList = ref<GenTaskItem[]>([]);
const genTotal = ref(0);
const genPage = ref(1);
const genPageSize = ref(10);

/** 「触发生成」表单：数量 / 可选难度 / 可选定向场景。 */
const genFormVisible = ref(false);
const genSubmitting = ref(false);
/** 解析回填进行中（按钮 loading，避免连点烧配额） */
const backfilling = ref(false);
const genForm = ref<{ count: number; difficulty?: number; categoryName?: string }>({
  count: 30,
  difficulty: undefined,
  categoryName: undefined,
});

/** 打开「触发生成」表单（默认全部分类、30 条）。 */
function handleTriggerGen(): void {
  genForm.value = { count: 30, difficulty: undefined, categoryName: undefined };
  genFormVisible.value = true;
}

/**
 * 提交触发生成。
 * 选了定向场景时本批所有题会强制归属该场景（服务端覆盖模型自报分类），
 * 用于填补 0 题的新场景；留空则按自然分布跨所有启用分类。
 */
async function submitGenForm(): Promise<void> {
  if (genSubmitting.value) {
    return;
  }
  genSubmitting.value = true;
  try {
    const result = await triggerGenApi({
      count: genForm.value.count,
      difficulty: genForm.value.difficulty,
      categoryName: genForm.value.categoryName || undefined,
    });
    ElMessage.success(
      genForm.value.categoryName
        ? `已启动定向补题「${genForm.value.categoryName}」（批次 #${result.taskId}）`
        : `生成任务已启动（批次 #${result.taskId}）`,
    );
    genFormVisible.value = false;
    await loadGenTasks();
  } finally {
    genSubmitting.value = false;
  }
}

/* ------------------------------ 生成全部节日题库 ------------------------------ */

/** 生成全部节日题库中（按钮 loading，避免连点烧配额）。 */
const festivalGenSubmitting = ref(false);

/** 生成节日封面中（按钮 loading）。 */
const festivalCoverSubmitting = ref(false);

/**
 * 为全年所有节日生成专属封面图。
 *
 * 封面是每个节日单独画的一张主视觉（红灯笼 / 龙舟 / 圣诞树…）——比从题库里随手挑一张
 * 更能一眼认出是哪个节日。已有封面的节日默认跳过；force=true 强制重画（换掉不贴合的封面）。
 *
 * 同样走 `ElMessageBox.confirm`：要调生图模型、会烧配额。
 */
async function handleTriggerFestivalCovers(force = false): Promise<void> {
  if (festivalCoverSubmitting.value) {
    return;
  }
  try {
    await ElMessageBox.confirm(
      force
        ? '将重画全年所有节日的封面图（每节一张，共二十来张，会消耗 AI 生图配额）。确认继续？'
        : '将为全年所有节日各生成一张专属封面图（已有封面的会跳过，会消耗 AI 生图配额）。生成在后台串行执行，完成后刷新题库页即可看到。确认继续？',
      force ? '重画节日封面' : '生成节日封面',
      { type: 'warning', confirmButtonText: '开始生成', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  festivalCoverSubmitting.value = true;
  try {
    await triggerFestivalCoversApi(force);
    ElMessage.success('已启动：正在为各节日生成专属封面，稍后刷新题库页查看');
  } finally {
    festivalCoverSubmitting.value = false;
  }
}

/**
 * 一次性生成全部节日题库。
 *
 * 节日题库是常驻内容库：铺满后用户端随时能看到所有节日并专门刷题，
 * 而不是只有节日当天才有题可选。只补题量不足的节日，已就绪的会跳过。
 *
 * 走 `ElMessageBox.confirm`：一次要调几十次模型 + 出图，量很大，
 * 必须让运营点之前就知道「它会烧 AI 配额、会跑很久」。
 */
async function handleTriggerAllFestivals(): Promise<void> {
  if (festivalGenSubmitting.value) {
    return;
  }
  try {
    await ElMessageBox.confirm(
      '将为全年所有节日各生成一批题目（含生图，量较大，会消耗 AI 配额）。已就绪的节日会自动跳过。生成在后台串行执行，进度看「生成批次」列表。确认继续？',
      '生成全部节日题库',
      { type: 'warning', confirmButtonText: '开始生成', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  festivalGenSubmitting.value = true;
  try {
    const result = await triggerAllFestivalsApi();
    const failed = result.failed > 0 ? `，失败 ${result.failed} 个` : '';
    ElMessage.success(
      `已启动：共 ${result.total} 个节日，新建 ${result.created} 批，跳过 ${result.skipped} 个（已就绪）${failed}`,
    );
  } finally {
    festivalGenSubmitting.value = false;
  }
}

/**
 * 补全存量题解析（按批，可反复点到补完）。
 *
 * force=true 时连「旧的长解析」一起重新生成，统一成固定三行格式（语法/词形/易错）。
 * 走 `ElMessageBox.confirm` 而不是直接执行：这是要花 AI 配额的写操作，
 * 运营点一下就该知道「它会调模型、会产生费用」，而不是无感地批量烧钱。
 */
async function handleBackfillExplanations(force = false): Promise<void> {
  try {
    await ElMessageBox.confirm(
      force
        ? '将把「不是新三行格式」的题目解析重新生成（每批 20 条，会产生 AI 调用费用）。继续？'
        : '将为「已就绪但没有解析」的题目调用 AI 生成语法解析（每批 20 条，会产生 AI 调用费用）。继续？',
      force ? '精简旧解析' : '补全题目解析',
      { type: 'warning', confirmButtonText: force ? '开始精简' : '开始补全', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  backfilling.value = true;
  try {
    const result = await backfillExplanationsApi(20, force);
    if (result.scanned === 0) {
      ElMessage.success(force ? '所有题目都已是新格式解析' : '所有题目都已有解析');
    } else {
      ElMessage.success(`本批补了 ${result.updated} 条，还剩 ${result.remaining} 条待补`);
      await getList();
    }
  } finally {
    backfilling.value = false;
  }
}

/** 加载批次列表。silent = 轮询刷新时不显示 loading（避免表格每 3s 闪一次）。 */
async function loadGenTasks(silent = false): Promise<void> {
  if (!silent) {
    genLoading.value = true;
  }
  try {
    const data = await getGenTaskListApi({ page: genPage.value, pageSize: genPageSize.value });
    genList.value = data.list;
    genTotal.value = data.total;
  } finally {
    if (!silent) {
      genLoading.value = false;
    }
  }
}

/** 批次 → 定向场景名（categoryId=0 表示定时/全量批次，按自然分布跨所有分类）。 */
function genTaskCategoryName(row: GenTaskItem): string {
  if (!row.categoryId) {
    return '全部分类';
  }
  return categories.value.find((item) => item.id === row.categoryId)?.name ?? `分类 ${row.categoryId}`;
}

/** 批次弹窗轮询定时器。 */
let genTimer: ReturnType<typeof setInterval> | null = null;

/** 停止轮询（关弹窗 / 卸载时）。 */
function stopGenPolling(): void {
  if (genTimer) {
    clearInterval(genTimer);
    genTimer = null;
  }
}

/** 打开批次监控。 */
/**
 * 打开批次弹窗：加载后每 3s 静默刷新。
 * 一批要跑几分钟、中途几十秒计数器都不动，不轮询就只能看到静止的数字，
 * 分不清「在跑」还是「卡死」——这正是运营反馈的问题。
 */
async function handleOpenGenTasks(): Promise<void> {
  genDialogVisible.value = true;
  await loadGenTasks();
  stopGenPolling();
  genTimer = setInterval(() => {
    void loadGenTasks(true);
  }, 3000);
}

watch(genDialogVisible, (open) => {
  if (!open) {
    stopGenPolling();
  }
});

onBeforeUnmount(stopGenPolling);

/* --------------------------- 批次操作：暂停 / 继续 / 取消 / 删除 --------------------------- */

/** 暂停：后端在下一个批次边界生效，最长等一个批次（约 1~2 分钟）。 */
async function handlePauseGen(row: GenTaskItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '暂停不会丢弃任何已生成内容：当前批次跑完（最长约 1~2 分钟）后停止，之后可随时「继续」。确认暂停？',
      '暂停生成',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  await pauseGenTaskApi(row.id);
  ElMessage.success('已请求暂停，将在当前批次完成后停止');
  await loadGenTasks();
}

/** 继续：从已完成进度接着跑（计数器从批次表读回，不会重复生成）。 */
async function handleResumeGen(row: GenTaskItem): Promise<void> {
  await resumeGenTaskApi(row.id);
  ElMessage.success('已继续生成');
  await loadGenTasks();
}

/** 取消：终态，不能接着跑；已生成的题目与图片仍保留。 */
async function handleCancelGen(row: GenTaskItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '取消后不能接着跑（已生成的题目与图片仍会保留）。若只是想临时停下，请用「暂停」。确认取消？',
      '取消生成',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  await cancelGenTaskApi(row.id);
  ElMessage.success('已请求取消，将在当前批次完成后停止');
  await loadGenTasks();
}

/** 删除：只清理「还没生成配图」的题目，已配图的保留。 */
async function handleRemoveGen(row: GenTaskItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '删除批次不会删除「已配图」的题目（它们仍是可用内容）；只会清理还没生成配图的题目。确认删除？',
      '删除批次',
      { type: 'warning', confirmButtonText: '确认删除', confirmButtonClass: 'el-button--danger' },
    );
  } catch {
    return;
  }
  const result = await deleteGenTaskApi(row.id);
  ElMessage.success(result.removedSentences > 0 ? `已删除，清理未配图题目 ${result.removedSentences} 条` : '已删除');
  await loadGenTasks();
}

onMounted(async () => {
  categories.value = await getCategoryOptionsApi().catch(() => []);
  await getList();
});
</script>

<template>
  <div class="sentence-page">
    <!-- 查询表单：关键词 / 分类 / 状态 / 难度 -->
    <SearchForm @search="search" @reset="reset">
      <el-form-item label="关键词">
        <el-input v-model="query.keyword" placeholder="英文句子 / 中文释义" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="分类">
        <el-select v-model="query.categoryId" placeholder="全部" clearable filterable style="width: 180px">
          <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 140px">
          <el-option label="待生成" value="pending_image" />
          <el-option label="就绪" value="ready" />
          <el-option label="已下架" value="offline" />
        </el-select>
      </el-form-item>
      <el-form-item label="难度">
        <el-select v-model="query.difficulty" placeholder="全部" clearable style="width: 140px">
          <el-option label="基础" :value="1" />
          <el-option label="进阶" :value="2" />
          <el-option label="挑战" :value="3" />
        </el-select>
      </el-form-item>
    </SearchForm>

    <el-card shadow="never" class="mt-4">
      <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3">
        <span class="text-[15px] font-semibold text-ink">题库列表（共 {{ total }}）</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button v-permission="'sentence:add'" type="primary" @click="handleCreate">新增题目</el-button>
          <el-button v-permission="'sentence:edit'" :disabled="selectedIds.length === 0" @click="handleBatchOffline">
            批量下架<span v-if="selectedIds.length > 0">（{{ selectedIds.length }}）</span>
          </el-button>
          <el-button v-permission="'sentence:edit'" :disabled="selectedIds.length === 0" @click="handleBatchOnline">
            批量上架<span v-if="selectedIds.length > 0">（{{ selectedIds.length }}）</span>
          </el-button>
          <el-tooltip
            :disabled="selectedIds.length <= 50"
            content="单次最多 50 条：每张配图都消耗 AI 生图配额，请分批操作"
          >
            <span>
              <el-button
                v-permission="'sentence:gen'"
                plain
                :disabled="selectedIds.length === 0 || selectedIds.length > 50"
                @click="handleBatchRegen"
              >
                批量重新生图<span v-if="selectedIds.length > 0">（{{ selectedIds.length }}）</span>
              </el-button>
            </span>
          </el-tooltip>
          <el-button v-permission="'sentence:gen'" type="warning" plain @click="handleTriggerGen">生成题库</el-button>
          <el-tooltip content="一次性为全年所有节日各生成一批题目，铺满后用户端随时可刷；已就绪的节日会自动跳过">
            <span>
              <el-button
                v-permission="'sentence:gen'"
                :loading="festivalGenSubmitting"
                plain
                @click="handleTriggerAllFestivals"
              >
                生成节日题库
              </el-button>
            </span>
          </el-tooltip>
          <el-tooltip content="为全年每个节日单独生成一张专属封面图（比从题库里挑一张更能体现节日）；已有封面的会跳过">
            <span>
              <el-button
                v-permission="'sentence:gen'"
                :loading="festivalCoverSubmitting"
                plain
                @click="handleTriggerFestivalCovers(false)"
              >
                生成节日封面
              </el-button>
            </span>
          </el-tooltip>
          <el-tooltip content="重画全部节日封面（用于替换不贴合的封面）">
            <span>
              <el-button
                v-permission="'sentence:gen'"
                :loading="festivalCoverSubmitting"
                plain
                @click="handleTriggerFestivalCovers(true)"
              >
                重画节日封面
              </el-button>
            </span>
          </el-tooltip>
          <el-button v-permission="'sentence:gen'" :loading="backfilling" plain @click="handleBackfillExplanations()">
            补全解析
          </el-button>
          <el-button
            v-permission="'sentence:gen'"
            :loading="backfilling"
            plain
            @click="handleBackfillExplanations(true)"
          >
            精简旧解析
          </el-button>
          <el-button :loading="exporting" @click="handleExport">
            <template #icon><i class="bi bi-download" /></template>
            导出
          </el-button>
          <el-button @click="handleOpenGenTasks">生成批次</el-button>
          <el-button :loading="loading" @click="getList">刷新</el-button>
        </div>
      </div>

      <!-- 题目表 -->
      <el-table v-loading="loading" :data="list" border row-key="id" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="45" :reserve-selection="true" />
        <el-table-column label="配图" width="110">
          <template #default="{ row }">
            <el-image
              v-if="row.imageUrl"
              :src="`${row.imageUrl}?scale=200`"
              :preview-src-list="[row.imageUrl]"
              preview-teleported
              fit="cover"
              style="width: 88px; height: 50px; border-radius: 6px"
            />
            <span v-else class="text-gray-400">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="sentenceEn" label="英文句子" min-width="220" show-overflow-tooltip />
        <el-table-column prop="translationZh" label="中文释义" min-width="160" show-overflow-tooltip />
        <el-table-column prop="ipa" label="音标" min-width="120" show-overflow-tooltip />
        <el-table-column label="分类" width="100">
          <template #default="{ row }">{{ row.categoryName ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="难度" width="80">
          <template #default="{ row }">{{ DIFFICULTY_LABEL[row.difficulty] ?? row.difficulty }}</template>
        </el-table-column>
        <el-table-column label="来源" width="80">
          <template #default="{ row }">
            <el-tag :type="row.source === 'ai' ? 'success' : 'info'" size="small">
              {{ row.source === 'ai' ? 'AI' : '手工' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="STATUS_TAG[row.status as SentenceStatus]?.type ?? 'info'" size="small">
              {{ STATUS_TAG[row.status as SentenceStatus]?.label ?? row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'sentence:edit'" link type="primary" @click="handleEdit(row as SentenceItem)"
              >编辑</el-button
            >
            <el-button
              v-permission="'sentence:gen'"
              link
              type="warning"
              :loading="regeneratingIds.has((row as SentenceItem).id)"
              :disabled="regeneratingIds.has((row as SentenceItem).id)"
              @click="handleOpenRegen(row as SentenceItem)"
              >重新生图</el-button
            >
            <el-button v-permission="'sentence:remove'" link type="danger" @click="handleOffline(row as SentenceItem)"
              >下架</el-button
            >
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

    <!-- 新增/编辑弹窗（自定义 footer：保存中禁用确定按钮） -->
    <BasicDialog
      v-model="dialogVisible"
      :title="editingId === null ? '新增题目' : '编辑题目'"
      width="560px"
      :show-footer="false"
    >
      <el-form label-width="80px">
        <el-form-item label="分类" required>
          <el-select v-model="form.categoryId" placeholder="选择分类" style="width: 100%">
            <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="英文句子" required>
          <el-input v-model="form.sentenceEn" maxlength="300" show-word-limit />
        </el-form-item>
        <el-form-item label="中文释义" required>
          <el-input v-model="form.translationZh" maxlength="300" show-word-limit />
        </el-form-item>
        <el-form-item label="音标">
          <el-input v-model="form.ipa" maxlength="200" placeholder="如 /kəˈfeɪ/" />
        </el-form-item>
        <el-form-item label="题目解析">
          <el-input
            v-model="form.explanation"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="答题后展示给用户的语法说明（时态/词形/搭配/易错点），留空则不显示解析块"
          />
        </el-form-item>
        <el-form-item label="生图提示词">
          <el-input
            v-model="form.scenePrompt"
            type="textarea"
            :rows="2"
            maxlength="500"
            placeholder="两人对话场景构图；留空按句子自动生成"
          />
        </el-form-item>
        <el-form-item label="难度">
          <el-radio-group v-model="form.difficulty">
            <el-radio :value="1">基础</el-radio>
            <el-radio :value="2">进阶</el-radio>
            <el-radio :value="3">挑战</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="editingId !== null" label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="ready">就绪</el-radio>
            <el-radio value="offline">下架</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogSaving" @click="handleSave">保存</el-button>
      </template>
    </BasicDialog>

    <!-- 重新生图（可改场景提示词；异步，出图后自动更新本页那一行） -->
    <BasicDialog
      v-model="regenVisible"
      :title="regenTarget ? `重新生图 · #${regenTarget.id}` : '重新生图'"
      width="560px"
      :confirm-loading="regenSubmitting"
      confirm-text="开始生成"
      @confirm="submitRegen"
    >
      <p v-if="regenTarget" class="mb-3 rounded bg-fill-light px-3 py-2 text-sm leading-relaxed text-ink">
        {{ regenTarget.sentenceEn }}
        <span class="mt-1 block text-xs text-muted">{{ regenTarget.translationZh }}</span>
      </p>
      <el-form label-width="90px">
        <el-form-item label="场景提示词">
          <el-input
            v-model="regenPrompt"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="描述画面：谁、在哪、在做什么；留空按句子自动构图"
          />
        </el-form-item>
      </el-form>
      <el-alert type="info" :closable="false" show-icon>
        <template #title> 生成约 10~40 秒，期间该题状态变为「待生成」；失败会自动还原原状态，旧图不受影响。 </template>
      </el-alert>
    </BasicDialog>

    <!-- 触发生成：数量 / 可选难度 / 可选定向场景 -->
    <BasicDialog v-model="genFormVisible" title="触发生成" width="500px">
      <el-form label-width="90px">
        <el-form-item label="目标数量">
          <el-input-number v-model="genForm.count" :min="1" :max="300" :step="10" />
          <span class="ml-2 text-xs text-muted">每题都要出图，越多越久；每日全量由 00:30 定时任务生成</span>
        </el-form-item>
        <el-form-item label="难度">
          <el-select v-model="genForm.difficulty" placeholder="不限（40/40/20 自然分布）" clearable style="width: 100%">
            <el-option label="基础" :value="1" />
            <el-option label="进阶" :value="2" />
            <el-option label="挑战" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="定向场景">
          <el-select v-model="genForm.categoryName" placeholder="全部分类（自然分布）" clearable style="width: 100%">
            <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.name" />
          </el-select>
        </el-form-item>
        <el-alert type="info" :closable="false" show-icon>
          <template #title>
            选具体场景则本批所有题强制归属该场景（用于填补 0 题的新场景，一天可为多个场景分别补题）；
            留空则按自然分布跨所有启用分类。生题 + 配图异步执行，进度看「生成批次」。
          </template>
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="genFormVisible = false">取消</el-button>
        <el-button type="primary" :loading="genSubmitting" @click="submitGenForm">开始生成</el-button>
      </template>
    </BasicDialog>

    <!-- 生成批次监控 -->
    <BasicDialog v-model="genDialogVisible" title="生成批次" width="920px" :show-footer="false">
      <el-table v-loading="genLoading" :data="genList" border max-height="420">
        <el-table-column prop="id" label="批次" width="70" />
        <el-table-column prop="bizDate" label="业务日期" width="120" />
        <el-table-column label="进度" width="200">
          <template #default="{ row }">
            题目 {{ row.textDone }}/{{ row.targetCount }} · 图片 {{ row.imageDone }}
            <el-tag v-if="row.failCount > 0" type="danger" size="small" class="ml-1">失败 {{ row.failCount }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="GEN_STATUS_TAG[row.status]?.type ?? 'info'" size="small">
              {{ GEN_STATUS_TAG[row.status]?.label ?? row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="阶段 / 心跳" width="150">
          <template #default="{ row }">
            <template v-if="row.status === 'running'">
              <el-tag size="small" effect="plain" :type="heartbeatStale(row as GenTaskItem) ? 'danger' : 'primary'">
                {{ GEN_STAGE_LABEL[row.stage] ?? '进行中' }}
              </el-tag>
              <span
                class="ml-1 text-xs"
                :class="heartbeatStale(row as GenTaskItem) ? 'text-danger' : 'text-muted'"
                :title="row.lastHeartbeatAt ? formatDateTime(row.lastHeartbeatAt) : ''"
              >
                {{ heartbeatText(row as GenTaskItem) }}
              </span>
            </template>
            <span v-else class="text-xs text-faint">—</span>
          </template>
        </el-table-column>
        <el-table-column label="触发" width="80">
          <template #default="{ row }">{{ row.triggerType === 'cron' ? '定时' : '手动' }}</template>
        </el-table-column>
        <el-table-column label="定向场景" width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ genTaskCategoryName(row as GenTaskItem) }}</template>
        </el-table-column>
        <el-table-column prop="errorMessage" label="错误摘要" min-width="140" show-overflow-tooltip />
        <el-table-column label="完成时间" width="170">
          <template #default="{ row }">{{ row.finishedAt ? formatDateTime(row.finishedAt) : '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'running' || row.status === 'pending'">
              <el-button link type="warning" @click="handlePauseGen(row as GenTaskItem)">暂停</el-button>
              <el-button link type="danger" @click="handleCancelGen(row as GenTaskItem)">取消</el-button>
            </template>
            <template v-else-if="row.status === 'paused' || row.status === 'failed'">
              <el-button link type="primary" @click="handleResumeGen(row as GenTaskItem)">继续</el-button>
              <el-button link type="danger" @click="handleRemoveGen(row as GenTaskItem)">删除</el-button>
            </template>
            <template v-else>
              <el-button link type="danger" @click="handleRemoveGen(row as GenTaskItem)">删除</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
      <Pagination
        v-model:current-page="genPage"
        v-model:page-size="genPageSize"
        :total="genTotal"
        layout="total, prev, pager, next"
        @size-change="
          (s: number) => {
            genPageSize = s;
            loadGenTasks();
          }
        "
        @current-change="
          (p: number) => {
            genPage = p;
            loadGenTasks();
          }
        "
      />
    </BasicDialog>
  </div>
</template>
