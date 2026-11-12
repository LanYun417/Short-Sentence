<script setup lang="ts">
/**
 * AI 设置页（Agnes 文本通道 + 英伟达 NIM 生题通道）。
 *
 * 模型接入参数参考常见 AI 客户端的设置形态：
 * - API 格式：OpenAI Chat Completions / OpenAI Responses API / Anthropic Messages 三种；
 * - 自定义请求地址 + 「完整 URL」开关（开 = 地址原样使用，关 = 自动补全格式对应路径）；
 * - 模型 ID / 展示名称 / API Key（只回掩码、留空不改）；
 * - 高级配置：模型系列、上下文窗口（输入/输出预设）、工具调用轮数、图片输入、思考模式、采样参数。
 *
 * 注意：**生图模型固定走 Agnes images 接口，不受 API 格式影响**，保持不变。
 *
 * 保存后后端刷新运行时快照，下一次 AI 调用立即生效，无需重启进程。
 */
import { ElMessage } from '@/utils/element';
import { getAiSettingsApi, saveAiSettingsApi, testAiApi } from '@/api/ai';
import type { AdvancedAiConfig, AiSettings, SaveAiSettingsPayload } from '@/types/api';

defineOptions({ name: 'SystemAi' });

type ApiFormat = 'openai_chat' | 'openai_responses' | 'anthropic';

const API_FORMAT_OPTIONS: Array<{ value: ApiFormat; label: string }> = [
  { value: 'openai_chat', label: 'OpenAI Chat Completions 格式' },
  { value: 'openai_responses', label: 'OpenAI Responses API 格式' },
  { value: 'anthropic', label: 'Anthropic Messages 格式' },
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
const testing = ref(false);
const testingNim = ref(false);
const settings = ref<AiSettings | null>(null);
const testResult = ref('');
const testNimResult = ref('');
/** 高级配置折叠面板激活项。 */
const activeNames = ref<string[]>([]);
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

const form = ref({
  apiKey: '',
  baseUrl: 'https://api.agnes-ai.cn/v1',
  apiFormat: 'openai_chat' as ApiFormat,
  fullUrl: false,
  textModel: 'agnes-2.5-flash',
  modelLabel: '',
  imageModel: 'agnes-image-2.5-flash',
  nimApiKey: '',
  nimBaseUrl: 'https://integrate.api.nvidia.com/v1',
  nimModel: '',
  genChannel: 'agnes' as 'agnes' | 'nim',
  advanced: defaultAdvanced() as AdvancedAiConfig,
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    const data = await getAiSettingsApi();
    settings.value = data;
    form.value = {
      apiKey: '',
      baseUrl: data.baseUrl || 'https://api.agnes-ai.cn/v1',
      apiFormat: data.apiFormat ?? 'openai_chat',
      fullUrl: !!data.fullUrl,
      textModel: data.textModel || 'agnes-2.5-flash',
      modelLabel: data.modelLabel || '',
      imageModel: data.imageModel || 'agnes-image-2.5-flash',
      nimApiKey: '',
      nimBaseUrl: data.nimBaseUrl || 'https://integrate.api.nvidia.com/v1',
      nimModel: data.nimModel || '',
      genChannel: data.genChannel === 'nim' ? 'nim' : 'agnes',
      advanced: { ...defaultAdvanced(), ...(data.advanced ?? {}) },
    };
  } finally {
    loading.value = false;
  }
}

/** 思考模式：回车添加一个可选值。 */
function addThinkingOption(): void {
  const v = thinkingNew.value.trim();
  if (!v) return;
  if (!form.value.advanced.thinkingOptions.includes(v)) {
    form.value.advanced.thinkingOptions.push(v);
  }
  thinkingNew.value = '';
}

function removeThinkingOption(v: string): void {
  form.value.advanced.thinkingOptions = form.value.advanced.thinkingOptions.filter((x) => x !== v);
  if (form.value.advanced.thinkingValue === v) form.value.advanced.thinkingValue = '';
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    const payload: SaveAiSettingsPayload = {
      baseUrl: form.value.baseUrl.trim(),
      apiFormat: form.value.apiFormat,
      fullUrl: form.value.fullUrl,
      textModel: form.value.textModel.trim(),
      modelLabel: form.value.modelLabel.trim(),
      imageModel: form.value.imageModel.trim(),
      nimBaseUrl: form.value.nimBaseUrl.trim(),
      nimModel: form.value.nimModel.trim(),
      genChannel: form.value.genChannel,
      advanced: { ...form.value.advanced },
    };
    if (form.value.apiKey.trim()) payload.apiKey = form.value.apiKey.trim();
    if (form.value.nimApiKey.trim()) payload.nimApiKey = form.value.nimApiKey.trim();
    await saveAiSettingsApi(payload);
    ElMessage.success('已保存，配置立即生效');
    await load();
  } finally {
    saving.value = false;
  }
}

async function runTest(): Promise<void> {
  testing.value = true;
  testResult.value = '';
  try {
    const data = await testAiApi();
    testResult.value = `连通正常 · ${data.model} · ${data.latencyMs}ms`;
    ElMessage.success('连通正常');
  } finally {
    testing.value = false;
  }
}

async function runNimTest(): Promise<void> {
  testingNim.value = true;
  testNimResult.value = '';
  try {
    const data = await testAiApi('nim');
    testNimResult.value = `NIM 连通正常 · ${data.model} · ${data.latencyMs}ms`;
    ElMessage.success('NIM 连通正常');
  } finally {
    testingNim.value = false;
  }
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
          <span class="text-[15px] font-semibold text-ink">Agnes AI 服务（文本通道）</span>
          <el-tag v-if="settings?.enabled" type="success" size="small">已配置</el-tag>
          <el-tag v-else type="info" size="small">未配置</el-tag>
        </div>
      </template>

      <el-alert
        v-if="settings && !settings.enabled"
        type="warning"
        :closable="false"
        show-icon
        class="mb-4"
        title="尚未配置 API Key"
        description="生题、AI 拓展、词根拆解、句签与题目解析都会停用。填入 Key 保存后立即生效。"
      />

      <el-form label-width="140px" class="max-w-3xl">
        <el-form-item label="API 格式" required>
          <el-select v-model="form.apiFormat" class="w-full">
            <el-option v-for="o in API_FORMAT_OPTIONS" :key="o.value" :value="o.value" :label="o.label" />
          </el-select>
          <span class="ml-2 text-xs text-gray-400">文本对话所用协议；生图仍走 Agnes images，不受影响</span>
        </el-form-item>

        <el-form-item label="自定义请求地址" required>
          <div class="flex w-full items-center gap-2">
            <el-input
              v-model="form.baseUrl"
              :placeholder="form.fullUrl ? 'https://api.example.com/v1/chat/completions' : 'https://api.agnes-ai.cn/v1'"
            />
            <el-switch v-model="form.fullUrl" />
            <span class="shrink-0 text-xs text-gray-400">完整 URL</span>
          </div>
          <span class="mt-1 block text-xs text-gray-400">
            {{
              form.fullUrl
                ? '开启后地址原样使用（需含完整路径，如 …/chat/completions）'
                : '关闭时按所选格式自动补全路径（/chat/completions、/responses、/messages）'
            }}
          </span>
        </el-form-item>

        <el-form-item label="模型 ID" required>
          <el-input v-model="form.textModel" placeholder="agnes-2.5-flash" />
          <span class="ml-2 text-xs text-gray-400">生题 / 造句 / 词根 / 句签 / 解析</span>
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
              settings?.apiKeyConfigured
                ? `已配置 ${settings.apiKeyMasked}（留空不修改）`
                : 'API Key（只存服务端，接口不回显明文）'
            "
          />
        </el-form-item>

        <el-form-item label="生图模型">
          <el-input v-model="form.imageModel" placeholder="agnes-image-2.5-flash" />
          <span class="ml-2 text-xs text-gray-400">题目配图；固定走 Agnes，不随 API 格式变化</span>
        </el-form-item>

        <!-- 高级配置 -->
        <el-form-item label="高级配置">
          <el-collapse v-model="activeNames" class="w-full">
            <el-collapse-item name="adv">
              <template #title>
                <span class="text-sm font-medium">展开高级配置</span>
                <span class="ml-2 text-xs text-gray-400"
                  >模型系列 / 上下文窗口 / 工具轮数 / 图片输入 / 思考模式 / 采样参数</span
                >
              </template>

              <el-form label-width="140px" class="advanced-form mt-2">
                <el-form-item label="模型系列">
                  <el-select v-model="form.advanced.modelSeries" class="w-full">
                    <el-option v-for="o in MODEL_SERIES_OPTIONS" :key="o.value" :value="o.value" :label="o.label" />
                  </el-select>
                  <span class="ml-2 text-xs text-gray-400">仅 OpenAI 系列模型有意义，未选择时用默认配置</span>
                </el-form-item>

                <el-form-item label="上下文窗口 输入">
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

                <el-form-item label="上下文窗口 输出">
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
            </el-collapse-item>
          </el-collapse>
        </el-form-item>

        <el-form-item label="生题内容通道">
          <el-radio-group v-model="form.genChannel">
            <el-radio value="agnes">Agnes（默认，走上方生文模型）</el-radio>
            <el-radio value="nim">英伟达 NIM（免费模型，见下方）</el-radio>
          </el-radio-group>
          <span class="ml-2 text-xs text-gray-400"
            >选 NIM 后所有文本
            AI（生题/优化/审核/解析/逐词释义/句签/客户端拓展与词根）都走该通道；仅图像生成与图像审核保持 Agnes</span
          >
        </el-form-item>

        <template v-if="form.genChannel === 'nim'">
          <el-divider content-position="left">英伟达 NIM 通道配置（必填 · 所有文本 AI 走这里）</el-divider>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            class="mb-4"
            title="英伟达 NIM 免费模型通道（OpenAI 兼容）"
            description="选择「英伟达 NIM」后，所有文本 AI 调用都改走这里的地址与模型；仅图像生成和图像审核保持 Agnes。三项一起填，模型在 NVIDIA NIM 目录任选。"
          />

          <el-form-item label="NIM API Key">
            <el-input
              v-model="form.nimApiKey"
              type="password"
              show-password
              autocomplete="new-password"
              :placeholder="
                settings?.nimApiKeyConfigured
                  ? `已配置 ${settings.nimApiKeyMasked}（留空不修改）`
                  : 'NVIDIA NIM API Key（只存服务端，接口不回显明文）'
              "
            />
          </el-form-item>

          <el-form-item label="NIM 上游地址">
            <el-input v-model="form.nimBaseUrl" placeholder="https://integrate.api.nvidia.com/v1" />
          </el-form-item>

          <el-form-item label="NIM 生题模型">
            <el-input v-model="form.nimModel" placeholder="如 deepseek-ai/deepseek-v4.1-flash" />
            <span class="ml-2 text-xs text-gray-400">NIM 目录任选免费模型；选 Agnes 通道时本配置不启用</span>
          </el-form-item>
        </template>

        <el-form-item>
          <el-button v-permission="'system:ai:edit'" type="primary" :loading="saving" @click="save">保存设置</el-button>
          <span class="ml-3 text-xs text-gray-400">存于「参数管理」，空值回落环境变量；保存即生效</span>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 连通性测试 -->
    <el-card shadow="never" class="mt-4">
      <template #header>
        <span class="text-[15px] font-semibold text-ink">连通性测试</span>
      </template>
      <div class="flex flex-wrap items-center gap-2">
        <el-button v-permission="'system:ai:edit'" :loading="testing" @click="runTest">测试 Agnes 连通</el-button>
        <el-button v-permission="'system:ai:edit'" :loading="testingNim" @click="runNimTest">测试 NIM 连通</el-button>
        <span v-if="testResult" class="text-sm text-emerald-600">{{ testResult }}</span>
        <span v-if="testNimResult" class="text-sm text-emerald-600">{{ testNimResult }}</span>
        <span v-else-if="!testResult && !testNimResult" class="text-xs text-gray-400">
          按当前 API 格式与生文模型发一个极短请求，验证 Key、地址与模型是否都对
        </span>
      </div>
    </el-card>
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
