<script setup lang="ts">
/**
 * AI 设置页（模型列表）。
 *
 * 设计：**一套配置、多个模型、不分厂商**。每张卡片 = 一个模型，
 * 字段含用途（生文 / 生图）、API 格式、自定义请求地址 + 完整 URL 开关、
 * 模型 ID / 展示名称 / API Key、高级参数（模型系列、上下文窗口、工具轮数、
 * 图片输入、思考模式、采样参数）。同用途取第一个启用的模型。
 *
 * 关键交互：API Key **只回掩码、留空表示沿用已存密钥**——后端从不把真密钥交给浏览器，
 * 前端也不允许把掩码值回填提交。
 *
 * 生图模型固定走 images 接口，API 格式仅对生文模型有意义（生图固定 openai_chat）。
 */
import { ElMessage } from '@/utils/element';
import { getAiSettingsApi, saveAiSettingsApi, testAiApi } from '@/api/ai';
import type { AdvancedAiConfig, AiSettings, SaveAiModel, SaveAiSettingsPayload } from '@/types/api';

defineOptions({ name: 'SystemAi' });

type ApiFormat = 'openai_chat' | 'openai_responses' | 'anthropic';
type Purpose = 'text' | 'image';

const API_FORMAT_OPTIONS: Array<{ value: ApiFormat; label: string }> = [
  { value: 'openai_chat', label: 'OpenAI Chat Completions 格式' },
  { value: 'openai_responses', label: 'OpenAI Responses API 格式' },
  { value: 'anthropic', label: 'Anthropic Messages 格式' },
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

const loading = ref(false);
const saving = ref(false);
/** 正在测试的模型 id（空 = 无） */
const testingId = ref('');
const settings = ref<AiSettings | null>(null);

/** 可编辑的模型表单（apiKey 是输入框，空 = 沿用已存）。 */
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

const models = ref<ModelForm[]>([]);
/** 每个模型密钥的已配置形态（读接口只回掩码），用于 placeholder 提示。 */
const keyMeta = ref<Record<string, { configured: boolean; masked: string }>>({});
/** 每个模型「高级配置」是否展开。 */
const advOpen = ref<Record<string, boolean>>({});
/** 每个模型思考模式的新增值输入框。 */
const thinkingNew = ref<Record<string, string>>({});

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

/** 生成一个短 id（同列表内唯一即可，落库为 VarChar(32)）。 */
function newId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function blankModel(purpose: Purpose = 'text'): ModelForm {
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

async function load(): Promise<void> {
  loading.value = true;
  try {
    const data = await getAiSettingsApi();
    settings.value = data;
    models.value = data.models.map((m) => ({
      id: m.id,
      purpose: m.purpose,
      enabled: m.enabled,
      format: m.format,
      fullUrl: m.fullUrl,
      baseUrl: m.baseUrl,
      modelId: m.modelId,
      modelLabel: m.modelLabel,
      apiKey: '', // 只回掩码，输入框留空表示沿用
      advanced: { ...defaultAdvanced(), ...(m.advanced ?? {}) },
    }));
    keyMeta.value = Object.fromEntries(
      data.models.map((m) => [m.id, { configured: m.apiKeyConfigured, masked: m.apiKeyMasked }]),
    );
  } finally {
    loading.value = false;
  }
}

/** 表单 → 保存入参（apiKey 空则不带，后端按 id 沿用旧密钥）。 */
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

async function save(): Promise<void> {
  saving.value = true;
  try {
    const payload: SaveAiSettingsPayload = { models: models.value.map(toSaveModel) };
    await saveAiSettingsApi(payload);
    ElMessage.success('已保存，配置立即生效');
    await load();
  } finally {
    saving.value = false;
  }
}

/** 新增一个模型卡片。 */
function addModel(purpose: Purpose = 'text'): void {
  const m = blankModel(purpose);
  models.value.push(m);
  advOpen.value[m.id] = false;
}

/** 删除一个模型卡片。 */
function removeModel(id: string): void {
  models.value = models.value.filter((m) => m.id !== id);
}

/** 测试某个模型的连通（把当前表单作为草稿发过去，未保存也能测）。 */
async function runTest(m: ModelForm): Promise<void> {
  testingId.value = m.id;
  try {
    const data = await testAiApi(toSaveModel(m), m.id);
    ElMessage.success(`连通正常 · ${data.model} · ${data.latencyMs}ms`);
  } finally {
    testingId.value = '';
  }
}

/** 思考模式：回车添加一个可选值。 */
function addThinkingOption(m: ModelForm): void {
  const v = (thinkingNew.value[m.id] ?? '').trim();
  if (!v) return;
  if (!m.advanced.thinkingOptions.includes(v)) m.advanced.thinkingOptions.push(v);
  thinkingNew.value[m.id] = '';
}

function removeThinkingOption(m: ModelForm, v: string): void {
  m.advanced.thinkingOptions = m.advanced.thinkingOptions.filter((x) => x !== v);
  if (m.advanced.thinkingValue === v) m.advanced.thinkingValue = '';
}

function purposeLabel(p: Purpose): string {
  return p === 'image' ? '生图' : '生文';
}

function modelName(m: ModelForm): string {
  return m.modelLabel || m.modelId || '未命名模型';
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div v-loading="loading" class="ai-settings-page">
    <el-card shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-[15px] font-semibold text-ink">AI 模型配置</span>
          <div class="flex items-center gap-2">
            <el-tag v-if="settings && settings.models.length" type="success" size="small">
              已配置 {{ settings.models.length }} 个模型
            </el-tag>
            <el-tag v-else type="info" size="small">未配置</el-tag>
          </div>
        </div>
      </template>

      <el-alert
        v-if="!loading && models.length === 0"
        type="warning"
        :closable="false"
        show-icon
        class="mb-4"
        title="尚未配置任何模型"
        description="生题、AI 拓展、词根拆解、句签、题目解析与场景配图都会停用。添加至少一个「生文」用途的模型并保存后立即生效。"
      />

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="mb-4"
        title="一套配置、多个模型、不分厂商"
        description="每张卡片是一个模型：用途（生文/生图）+ API 格式 + 地址 + 模型 ID + Key + 高级参数。同用途取第一个启用的模型；生图固定走 images 接口，不受 API 格式影响。"
      />

      <!-- 模型列表 -->
      <el-card v-for="m in models" :key="m.id" shadow="never" class="model-card" :body-style="{ padding: '16px 20px' }">
        <template #header>
          <div class="flex flex-wrap items-center gap-2">
            <el-tag :type="m.purpose === 'image' ? 'warning' : 'success'" size="small" effect="light">
              {{ purposeLabel(m.purpose) }}
            </el-tag>
            <span class="text-sm font-semibold text-ink">{{ modelName(m) }}</span>
            <span class="font-mono text-[11px] text-gray-400">#{{ m.id }}</span>
            <div class="flex-1"></div>
            <el-switch v-model="m.enabled" :active-text="m.enabled ? '已启用' : '已停用'" inline-text />
            <el-button size="small" :loading="testingId === m.id" @click="runTest(m)">测试连接</el-button>
            <el-button size="small" type="danger" plain @click="removeModel(m.id)">删除</el-button>
          </div>
        </template>

        <el-form label-width="120px">
          <el-form-item label="用途" required>
            <el-select v-model="m.purpose" class="w-full">
              <el-option v-for="o in PURPOSE_OPTIONS" :key="o.value" :value="o.value" :label="o.label" />
            </el-select>
          </el-form-item>

          <el-form-item label="API 格式" required>
            <el-select v-model="m.format" class="w-full" :disabled="m.purpose === 'image'">
              <el-option v-for="o in API_FORMAT_OPTIONS" :key="o.value" :value="o.value" :label="o.label" />
            </el-select>
            <span v-if="m.purpose === 'image'" class="ml-2 text-xs text-gray-400"
              >生图固定走 images 接口，格式不适用</span
            >
          </el-form-item>

          <el-form-item label="请求地址" required>
            <div class="flex w-full items-center gap-2">
              <el-input
                v-model="m.baseUrl"
                :placeholder="m.fullUrl ? 'https://api.example.com/v1/chat/completions' : 'https://api.example.com/v1'"
              />
              <el-switch v-model="m.fullUrl" />
              <span class="shrink-0 text-xs text-gray-400">完整 URL</span>
            </div>
            <span class="mt-1 block text-xs text-gray-400">
              {{
                m.fullUrl
                  ? '开启后地址原样使用（需含完整路径）'
                  : '关闭时按所选格式自动补全路径（/chat/completions、/responses、/messages、/images/generations）'
              }}
            </span>
          </el-form-item>

          <el-form-item label="模型 ID" required>
            <el-input v-model="m.modelId" placeholder="如 gpt-4o-mini / deepseek-v4.1-flash" />
          </el-form-item>

          <el-form-item label="模型展示名称">
            <el-input v-model="m.modelLabel" maxlength="64" placeholder="留空则显示模型 ID" />
          </el-form-item>

          <el-form-item label="API Key">
            <el-input
              v-model="m.apiKey"
              type="password"
              show-password
              autocomplete="new-password"
              :placeholder="
                keyMeta[m.id]?.configured
                  ? `已配置 ${keyMeta[m.id].masked}（留空不修改）`
                  : 'API Key（只存服务端，接口不回显明文）'
              "
            />
          </el-form-item>

          <el-form-item label="高级配置">
            <div class="w-full">
              <el-button size="small" link type="primary" @click="advOpen[m.id] = !advOpen[m.id]">
                {{ advOpen[m.id] ? '收起高级配置' : '展开高级配置' }}
              </el-button>
              <el-form v-show="advOpen[m.id]" label-width="110px" class="advanced-form mt-2">
                <el-form-item label="模型系列">
                  <el-select v-model="m.advanced.modelSeries" class="w-full">
                    <el-option v-for="o in MODEL_SERIES_OPTIONS" :key="o.value" :value="o.value" :label="o.label" />
                  </el-select>
                  <span class="ml-2 text-xs text-gray-400">仅 OpenAI 系列模型有意义</span>
                </el-form-item>

                <el-form-item label="上下文 输入">
                  <div class="flex w-full flex-wrap items-center gap-4">
                    <el-input-number
                      v-model="m.advanced.maxInputTokens"
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
                        @click="m.advanced.maxInputTokens = p.value"
                        >{{ p.label }}</el-button
                      >
                    </div>
                    <span class="text-xs text-gray-400">0 = 上游默认</span>
                  </div>
                </el-form-item>

                <el-form-item label="上下文 输出">
                  <div class="flex w-full flex-wrap items-center gap-4">
                    <el-input-number
                      v-model="m.advanced.maxOutputTokens"
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
                        @click="m.advanced.maxOutputTokens = p.value"
                        >{{ p.label }}</el-button
                      >
                    </div>
                    <span class="text-xs text-gray-400">0 = 全局默认</span>
                  </div>
                </el-form-item>

                <el-form-item label="工具调用轮数">
                  <div class="flex w-full flex-wrap items-center gap-4">
                    <el-input-number
                      v-model="m.advanced.toolRounds"
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
                  <el-radio-group v-model="m.advanced.imageInput">
                    <el-radio :value="true">支持</el-radio>
                    <el-radio :value="false">不支持</el-radio>
                  </el-radio-group>
                </el-form-item>

                <el-form-item label="思考模式">
                  <div class="w-full">
                    <div class="flex items-center gap-3">
                      <span class="w-16 shrink-0 text-xs text-gray-400">参数名</span>
                      <el-input v-model="m.advanced.thinkingParam" class="w-56" placeholder="如 reasoning_effort" />
                      <el-select v-model="m.advanced.thinkingValue" class="w-40" placeholder="默认">
                        <el-option value="" label="默认 / 关闭" />
                        <el-option v-for="v in m.advanced.thinkingOptions" :key="v" :value="v" :label="v" />
                      </el-select>
                    </div>
                    <div class="mt-3 flex flex-wrap items-center gap-2">
                      <span class="mr-1 text-xs text-gray-400">可选值（回车添加）：</span>
                      <el-tag
                        v-for="v in m.advanced.thinkingOptions"
                        :key="v"
                        closable
                        size="small"
                        @close="removeThinkingOption(m, v)"
                      >
                        {{ v }}
                      </el-tag>
                      <el-input
                        v-model="thinkingNew[m.id]"
                        size="small"
                        class="w-28"
                        placeholder="如 low / high"
                        @keyup.enter="addThinkingOption(m)"
                      />
                    </div>
                  </div>
                </el-form-item>

                <el-form-item label="采样参数">
                  <div class="flex w-full flex-wrap items-center gap-6">
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-400">Temperature</span>
                      <el-input-number
                        v-model="m.advanced.temperature"
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
                        v-model="m.advanced.topP"
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
                        v-model="m.advanced.topK"
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
      </el-card>

      <!-- 操作区 -->
      <div class="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <el-button @click="addModel('text')">+ 添加生文模型</el-button>
        <el-button @click="addModel('image')">+ 添加生图模型</el-button>
        <div class="flex-1"></div>
        <el-button v-permission="'system:ai:edit'" type="primary" :loading="saving" @click="save">保存全部</el-button>
        <span class="text-xs text-gray-400">存于「参数管理」，保存即生效；密钥留空表示沿用原值</span>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
/* 模型卡片之间留出呼吸感（EP 表单项自带间距，这里只排卡片间距）。 */
.model-card {
  margin-bottom: 16px;
}

/* 高级配置各行之间留出呼吸感。
   不用 Tailwind 工具类：项目的工具类被包在 @layer utilities 里，
   而 Element Plus 样式无层级（优先级更高），打在 el-form-item 上的
   margin 工具类会被 EP 的 `margin-bottom: 18px` 压掉；
   这里用 scoped 普通类选择器提高特异性，稳稳覆盖。 */
.advanced-form .el-form-item {
  margin-bottom: 26px;
}
</style>
