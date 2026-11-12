<script setup lang="ts">
/**
 * AI 设置页：模型列表（表格 + 新增/编辑弹窗，与参数管理等列表页同一结构）。
 *
 * 设计：**一套配置、多个模型、不分厂商**。每行一个模型，字段含用途（生文/生图）、
 * API 格式、自定义请求地址 + 完整 URL 开关、模型 ID / 展示名称 / API Key、高级参数
 * （模型系列、上下文窗口、工具轮数、图片输入、思考模式、采样参数）。
 * 同用途取第一个启用的模型。
 *
 * 关键交互：API Key **只回掩码、留空表示沿用已存密钥**——后端从不把真密钥交给浏览器，
 * 前端也不允许把掩码值回填提交。
 *
 * 生图模型固定走 images 接口，API 格式仅对生文模型有意义（生图固定 openai_chat）。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import { getAiSettingsApi, saveAiSettingsApi, testAiApi } from '@/api/ai';
import { useTablePage } from '@/composables/useTablePage';
import BasicDialog from '@/components/BasicDialog/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import type { AdvancedAiConfig, AiModel, SaveAiModel } from '@/types/api';

defineOptions({ name: 'SystemAi' });

type ApiFormat = 'openai_chat' | 'openai_responses' | 'anthropic';
type Purpose = 'text' | 'image';

const API_FORMAT_OPTIONS: Array<{ value: ApiFormat; label: string }> = [
  { value: 'openai_chat', label: 'OpenAI Chat Completions' },
  { value: 'openai_responses', label: 'OpenAI Responses API' },
  { value: 'anthropic', label: 'Anthropic Messages' },
];

const PURPOSE_OPTIONS: Array<{ value: Purpose; label: string }> = [
  { value: 'text', label: '生文（对话/生题/造句/词根/句签/解析）' },
  { value: 'image', label: '生图（场景配图）' },
];

/** 模型系列可选值（仅 OpenAI 系列模型有意义；默认即「不指定」）。 */
const MODEL_SERIES_OPTIONS = [
  { value: '', label: '默认' },
  { value: 'gpt5', label: 'GPT-5 系列' },
  { value: 'gpt6', label: 'GPT-6 系列' },
  { value: 'gemini3', label: 'Gemini-3 系列' },
  { value: 'deepseek4', label: 'Deepseek-4 系列' },
];

const CONTEXT_IN_PRESETS = [
  { label: '128k', value: 128 * 1024 },
  { label: '256k', value: 256 * 1024 },
  { label: '512k', value: 512 * 1024 },
  { label: '1M', value: 1024 * 1024 },
];
const CONTEXT_OUT_PRESETS = [
  { label: '4k', value: 4 * 1024 },
  { label: '16k', value: 16 * 1024 },
  { label: '32k', value: 32 * 1024 },
  { label: '128k', value: 128 * 1024 },
];

const { tableHeight } = useTablePage();

const loading = ref(false);
const saving = ref(false);
/** 正在测试的模型 id（空 = 无） */
const testingId = ref('');
/** 全量模型（未过滤） */
const allModels = ref<AiModel[]>([]);
/** 筛选条件（列表很小，前端过滤即可） */
const query = ref<{ keyword: string; purpose: '' | Purpose }>({ keyword: '', purpose: '' });

/** 列表展示用（按筛选条件过滤）。 */
const list = computed(() =>
  allModels.value.filter((m) => {
    if (query.value.purpose && m.purpose !== query.value.purpose) return false;
    const kw = query.value.keyword.trim().toLowerCase();
    if (!kw) return true;
    return `${m.modelLabel} ${m.modelId} ${m.baseUrl}`.toLowerCase().includes(kw);
  }),
);

/* ------------------------------ 弹窗表单 ------------------------------ */

const dialogVisible = ref(false);
const isEdit = ref(false);
/** 弹窗里「高级配置」是否展开。 */
const advOpen = ref(false);
/** 思考模式：新增值输入框。 */
const thinkingNew = ref('');

const defaultAdvanced = (): AdvancedAiConfig => ({
  modelSeries: '',
  maxInputTokens: 0,
  maxOutputTokens: 0,
  toolRounds: 0,
  imageInput: true,
  thinkingParam: '',
  thinkingOptions: [],
  thinkingValue: '',
  temperature: -1,
  topP: -1,
  topK: -1,
});

/** 弹窗表单（apiKey 是输入框，空 = 沿用已存）。 */
interface ModelForm {
  id: string;
  purpose: Purpose;
  enabled: boolean;
  format: ApiFormat;
  fullUrl: boolean;
  baseUrl: string;
  modelId: string;
  modelLabel: string;
  apiKey: string;
  advanced: AdvancedAiConfig;
}

function newId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function emptyForm(purpose: Purpose = 'text'): ModelForm {
  return {
    id: newId(),
    purpose,
    enabled: true,
    format: 'openai_chat',
    fullUrl: false,
    baseUrl: '',
    modelId: '',
    modelLabel: '',
    apiKey: '',
    advanced: defaultAdvanced(),
  };
}

const form = ref<ModelForm>(emptyForm());
/** 已存密钥的掩码（编辑时提示用）。 */
const editingKeyMasked = ref('');

async function load(): Promise<void> {
  loading.value = true;
  try {
    const data = await getAiSettingsApi();
    allModels.value = data.models;
  } finally {
    loading.value = false;
  }
}

/** 弹窗表单 → 保存入参（apiKey 空则不带，后端按 id 沿用旧密钥）。 */
function toSaveModel(m: ModelForm): SaveAiModel {
  const out: SaveAiModel = {
    id: m.id,
    purpose: m.purpose,
    enabled: m.enabled,
    format: m.format,
    fullUrl: m.fullUrl,
    baseUrl: m.baseUrl.trim(),
    modelId: m.modelId.trim(),
    modelLabel: m.modelLabel.trim(),
    advanced: { ...m.advanced },
  };
  if (m.apiKey.trim()) out.apiKey = m.apiKey.trim();
  return out;
}

/** 已存模型行 → 保存入参（用于启停/删除等整表提交，apiKey 不带 = 沿用）。 */
function rowToSaveModel(m: AiModel, enabled = m.enabled): SaveAiModel {
  return {
    id: m.id,
    purpose: m.purpose,
    enabled,
    format: m.format,
    fullUrl: m.fullUrl,
    baseUrl: m.baseUrl,
    modelId: m.modelId,
    modelLabel: m.modelLabel,
    advanced: { ...m.advanced },
  };
}

/** 整表提交（后端以 models 数组为唯一事实源）。 */
async function persist(models: SaveAiModel[]): Promise<void> {
  saving.value = true;
  try {
    await saveAiSettingsApi({ models });
    await load();
  } finally {
    saving.value = false;
  }
}

/* ------------------------------ 行操作 ------------------------------ */

function openCreate(): void {
  form.value = emptyForm();
  isEdit.value = false;
  editingKeyMasked.value = '';
  advOpen.value = false;
  thinkingNew.value = '';
  dialogVisible.value = true;
}

function openEdit(row: AiModel): void {
  form.value = {
    id: row.id,
    purpose: row.purpose,
    enabled: row.enabled,
    format: row.format,
    fullUrl: row.fullUrl,
    baseUrl: row.baseUrl,
    modelId: row.modelId,
    modelLabel: row.modelLabel,
    apiKey: '',
    advanced: { ...defaultAdvanced(), ...(row.advanced ?? {}) },
  };
  isEdit.value = true;
  editingKeyMasked.value = row.apiKeyConfigured ? row.apiKeyMasked : '';
  advOpen.value = false;
  thinkingNew.value = '';
  dialogVisible.value = true;
}

/** 弹窗保存：新增追加、编辑按 id 替换。 */
async function submitForm(): Promise<void> {
  const m = form.value;
  if (!m.baseUrl.trim()) {
    ElMessage.warning('请填写请求地址');
    return;
  }
  if (!m.modelId.trim()) {
    ElMessage.warning('请填写模型 ID');
    return;
  }
  if (m.enabled && !m.apiKey.trim() && !editingKeyMasked.value) {
    ElMessage.warning('启用中的模型必须填写 API Key');
    return;
  }
  const next = allModels.value.map((row) => rowToSaveModel(row));
  const saved = toSaveModel(m);
  const idx = next.findIndex((row) => row.id === saved.id);
  if (idx >= 0) {
    next[idx] = saved;
  } else {
    next.push(saved);
  }
  await persist(next);
  dialogVisible.value = false;
  ElMessage.success(isEdit.value ? '已保存' : '已新增模型');
}

/** 行内启停：立即保存。 */
async function toggleEnabled(row: AiModel, enabled: boolean): Promise<void> {
  try {
    await persist(allModels.value.map((m) => rowToSaveModel(m, m.id === row.id ? enabled : m.enabled)));
    ElMessage.success(enabled ? '已启用' : '已停用');
  } catch {
    await load(); // 失败回滚显示
  }
}

/** 测试某个模型连通性（用当前已存配置）。 */
async function runTest(row: AiModel): Promise<void> {
  testingId.value = row.id;
  try {
    const data = await testAiApi(undefined, row.id);
    ElMessage.success(`连通正常 · ${data.model} · ${data.latencyMs}ms`);
  } finally {
    testingId.value = '';
  }
}

async function removeModel(row: AiModel): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除模型「${row.modelLabel || row.modelId}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  await persist(allModels.value.filter((m) => m.id !== row.id).map((m) => rowToSaveModel(m)));
  ElMessage.success('已删除');
}

/* ------------------------------ 高级配置交互 ------------------------------ */

function addThinkingOption(): void {
  const v = thinkingNew.value.trim();
  if (!v) return;
  if (!form.value.advanced.thinkingOptions.includes(v)) form.value.advanced.thinkingOptions.push(v);
  thinkingNew.value = '';
}

function removeThinkingOption(v: string): void {
  form.value.advanced.thinkingOptions = form.value.advanced.thinkingOptions.filter((x) => x !== v);
  if (form.value.advanced.thinkingValue === v) form.value.advanced.thinkingValue = '';
}

function purposeLabel(p: Purpose): string {
  return p === 'image' ? '生图' : '生文';
}

function formatLabel(m: AiModel): string {
  if (m.purpose === 'image') return 'images 接口（固定）';
  return API_FORMAT_OPTIONS.find((o) => o.value === m.format)?.label ?? m.format;
}

function resetQuery(): void {
  query.value = { keyword: '', purpose: '' };
}

/** 查询：列表本身是前端过滤，这里顺手从服务端刷新一次。 */
function refresh(): void {
  void load();
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="ai-settings-page table-page">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="mb-3"
      title="一套配置、多个模型、不分厂商"
      description="每行一个模型：用途（生文/生图）+ API 格式 + 地址 + 模型 ID + Key + 高级参数。同用途取第一个启用的模型；生图固定走 images 接口，不受 API 格式影响。"
    />

    <SearchForm class="table-page__filter" @search="refresh" @reset="resetQuery">
      <el-form-item label="关键字">
        <el-input v-model="query.keyword" placeholder="模型名称 / 模型 ID / 地址" clearable />
      </el-form-item>
      <el-form-item label="用途">
        <el-select v-model="query.purpose" placeholder="全部" clearable class="w-40">
          <el-option value="text" label="生文" />
          <el-option value="image" label="生图" />
        </el-select>
      </el-form-item>
    </SearchForm>

    <el-card shadow="never" class="table-page__card">
      <div class="table-page__toolbar mb-3 flex flex-wrap items-center justify-between gap-2">
        <span class="text-[15px] font-semibold text-ink">模型列表</span>
        <el-button v-permission="'system:ai:edit'" type="primary" @click="openCreate">
          <template #icon><i class="bi bi-plus" /></template>
          新增模型
        </el-button>
      </div>

      <div class="table-page__table">
        <el-table v-loading="loading || saving" border :data="list" :height="tableHeight">
          <el-table-column label="用途" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.purpose === 'image' ? 'warning' : 'success'" size="small">
                {{ purposeLabel(row.purpose) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="模型名称" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="font-medium text-ink">{{ row.modelLabel || row.modelId || '-' }}</span>
              <span v-if="row.modelLabel" class="ml-2 font-mono text-[11px] text-gray-400">{{ row.modelId }}</span>
            </template>
          </el-table-column>
          <el-table-column label="API 格式" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ formatLabel(row as AiModel) }}</template>
          </el-table-column>
          <el-table-column label="请求地址" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="font-mono text-xs">{{ row.baseUrl }}</span>
              <el-tag v-if="row.fullUrl" size="small" type="info" class="ml-2">完整 URL</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="API Key" width="130" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.apiKeyConfigured" type="success" size="small">{{ row.apiKeyMasked }}</el-tag>
              <el-tag v-else type="danger" size="small">未配置</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-switch
                :model-value="row.enabled"
                :disabled="saving"
                @change="(v: boolean | string | number) => toggleEnabled(row as AiModel, Boolean(v))"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <div class="table-action">
                <el-button v-permission="'system:ai:edit'" type="primary" link @click="openEdit(row as AiModel)"
                  >编辑</el-button
                >
                <el-button
                  v-permission="'system:ai:edit'"
                  type="primary"
                  link
                  :loading="testingId === row.id"
                  @click="runTest(row as AiModel)"
                >
                  测试
                </el-button>
                <el-button v-permission="'system:ai:edit'" type="danger" link @click="removeModel(row as AiModel)"
                  >删除</el-button
                >
              </div>
            </template>
          </el-table-column>
          <template #empty>
            <div class="py-6 text-xs text-gray-400">
              还没有配置模型。点击右上角「新增模型」，至少添加一个「生文」用途的模型后 AI 功能才会启用。
            </div>
          </template>
        </el-table>
      </div>
    </el-card>

    <!-- 新增 / 编辑模型（项目统一弹窗：正文自带 el-scrollbar 限高、禁止点遮罩关闭、小屏自适应宽度） -->
    <BasicDialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑模型' : '新增模型'"
      width="760px"
      :show-footer="false"
      destroy-on-close
      append-to-body
    >
      <el-form label-width="120px" class="pr-2">
        <el-form-item label="用途" required>
          <el-select v-model="form.purpose" class="w-full">
            <el-option v-for="o in PURPOSE_OPTIONS" :key="o.value" :value="o.value" :label="o.label" />
          </el-select>
        </el-form-item>

        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
          <span class="ml-2 text-xs text-gray-400">同用途取第一个启用的模型</span>
        </el-form-item>

        <el-form-item label="API 格式" required>
          <el-select v-model="form.format" class="w-full" :disabled="form.purpose === 'image'">
            <el-option v-for="o in API_FORMAT_OPTIONS" :key="o.value" :value="o.value" :label="o.label" />
          </el-select>
          <span v-if="form.purpose === 'image'" class="ml-2 text-xs text-gray-400"
            >生图固定走 images 接口，格式不适用</span
          >
        </el-form-item>

        <el-form-item label="请求地址" required>
          <div class="flex w-full items-center gap-2">
            <el-input
              v-model="form.baseUrl"
              :placeholder="form.fullUrl ? 'https://api.example.com/v1/chat/completions' : 'https://api.example.com/v1'"
            />
            <el-switch v-model="form.fullUrl" />
            <span class="shrink-0 text-xs text-gray-400">完整 URL</span>
          </div>
          <span class="mt-1 block text-xs text-gray-400">
            {{
              form.fullUrl
                ? '开启后地址原样使用（需含完整路径）'
                : '关闭时按格式自动补全路径（/chat/completions、/responses、/messages、/images/generations）'
            }}
          </span>
        </el-form-item>

        <el-form-item label="模型 ID" required>
          <el-input v-model="form.modelId" placeholder="如 gpt-4o-mini / deepseek-v4.1-flash" />
        </el-form-item>

        <el-form-item label="模型展示名称">
          <el-input v-model="form.modelLabel" maxlength="64" placeholder="留空则显示模型 ID" />
        </el-form-item>

        <el-form-item label="API Key">
          <el-input
            v-model="form.apiKey"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="
              editingKeyMasked ? `已配置 ${editingKeyMasked}（留空不修改）` : 'API Key（只存服务端，接口不回显明文）'
            "
          />
        </el-form-item>

        <el-form-item label="高级配置">
          <div class="w-full">
            <el-button size="small" link type="primary" @click="advOpen = !advOpen">
              {{ advOpen ? '收起高级配置' : '展开高级配置' }}
            </el-button>

            <el-form v-show="advOpen" label-width="110px" class="advanced-form mt-2">
              <el-form-item label="模型系列">
                <el-select v-model="form.advanced.modelSeries" class="w-full">
                  <el-option v-for="o in MODEL_SERIES_OPTIONS" :key="o.value" :value="o.value" :label="o.label" />
                </el-select>
                <span class="ml-2 text-xs text-gray-400">仅 OpenAI 系列模型有意义</span>
              </el-form-item>

              <el-form-item label="上下文 输入">
                <div class="flex w-full flex-wrap items-center gap-4">
                  <el-input-number
                    v-model="form.advanced.maxInputTokens"
                    :min="0"
                    :max="100000000"
                    controls-position="right"
                    class="w-44"
                  />
                  <div class="flex flex-wrap items-center gap-2">
                    <el-button
                      v-for="p in CONTEXT_IN_PRESETS"
                      :key="p.label"
                      size="small"
                      @click="form.advanced.maxInputTokens = p.value"
                      >{{ p.label }}</el-button
                    >
                  </div>
                  <span class="text-xs text-gray-400">0 = 上游默认</span>
                </div>
              </el-form-item>

              <el-form-item label="上下文 输出">
                <div class="flex w-full flex-wrap items-center gap-4">
                  <el-input-number
                    v-model="form.advanced.maxOutputTokens"
                    :min="0"
                    :max="1000000"
                    controls-position="right"
                    class="w-44"
                  />
                  <div class="flex flex-wrap items-center gap-2">
                    <el-button
                      v-for="p in CONTEXT_OUT_PRESETS"
                      :key="p.label"
                      size="small"
                      @click="form.advanced.maxOutputTokens = p.value"
                      >{{ p.label }}</el-button
                    >
                  </div>
                  <span class="text-xs text-gray-400">0 = 全局默认</span>
                </div>
              </el-form-item>

              <el-form-item label="工具调用轮数">
                <div class="flex w-full flex-wrap items-center gap-4">
                  <el-input-number
                    v-model="form.advanced.toolRounds"
                    :min="0"
                    :max="10000"
                    controls-position="right"
                    class="w-44"
                    placeholder="500"
                  />
                  <span class="text-xs text-gray-400">0 = 上游默认</span>
                </div>
              </el-form-item>

              <el-form-item label="支持图片输入">
                <el-radio-group v-model="form.advanced.imageInput">
                  <el-radio :value="true">支持</el-radio>
                  <el-radio :value="false">不支持</el-radio>
                </el-radio-group>
              </el-form-item>

              <el-form-item label="思考模式">
                <div class="w-full">
                  <div class="flex items-center gap-3">
                    <span class="w-16 shrink-0 text-xs text-gray-400">参数名</span>
                    <el-input v-model="form.advanced.thinkingParam" class="w-56" placeholder="如 reasoning_effort" />
                    <el-select v-model="form.advanced.thinkingValue" class="w-40" placeholder="默认">
                      <el-option value="" label="默认 / 关闭" />
                      <el-option v-for="v in form.advanced.thinkingOptions" :key="v" :value="v" :label="v" />
                    </el-select>
                  </div>
                  <div class="mt-3 flex flex-wrap items-center gap-2">
                    <span class="mr-1 text-xs text-gray-400">可选值（回车添加）：</span>
                    <el-tag
                      v-for="v in form.advanced.thinkingOptions"
                      :key="v"
                      closable
                      size="small"
                      @close="removeThinkingOption(v)"
                    >
                      {{ v }}
                    </el-tag>
                    <el-input
                      v-model="thinkingNew"
                      size="small"
                      class="w-28"
                      placeholder="如 low / high"
                      @keyup.enter="addThinkingOption"
                    />
                  </div>
                </div>
              </el-form-item>

              <el-form-item label="采样参数">
                <div class="flex w-full flex-wrap items-center gap-6">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400">Temperature</span>
                    <el-input-number
                      v-model="form.advanced.temperature"
                      :min="-1"
                      :max="2"
                      :step="0.1"
                      controls-position="right"
                      class="w-32"
                    />
                    <span class="text-xs text-gray-400">0~2，-1=默认</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400">Top P</span>
                    <el-input-number
                      v-model="form.advanced.topP"
                      :min="-1"
                      :max="1"
                      :step="0.05"
                      controls-position="right"
                      class="w-32"
                    />
                    <span class="text-xs text-gray-400">0~1，-1=默认</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400">Top K</span>
                    <el-input-number
                      v-model="form.advanced.topK"
                      :min="-1"
                      :max="100"
                      controls-position="right"
                      class="w-32"
                    />
                    <span class="text-xs text-gray-400">1~100，-1=默认</span>
                  </div>
                </div>
              </el-form-item>
            </el-form>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button v-permission="'system:ai:edit'" type="primary" :loading="saving" @click="submitForm">
          {{ isEdit ? '保存' : '新增' }}
        </el-button>
      </template>
    </BasicDialog>
  </div>
</template>

<style scoped>
/* 高级配置各行之间留出呼吸感。
   不用 Tailwind 工具类：项目的工具类被包在 @layer utilities 里，
   而 Element Plus 样式无层级（优先级更高），打在 el-form-item 上的
   margin 工具类会被 EP 的 `margin-bottom: 18px` 压掉；
   这里用 scoped 普通类选择器提高特异性，稳稳覆盖。 */
.advanced-form .el-form-item {
  margin-bottom: 26px;
}
</style>
