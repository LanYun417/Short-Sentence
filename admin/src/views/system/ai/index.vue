<script setup lang="ts">
/**
 * AI 设置页（Agnes）。
 *
 * 关键交互：API Key **只回掩码、留空表示不改**——后端从不把真密钥交给浏览器，
 * 前端也不允许把掩码值回填提交（否则会把真密钥覆盖成 "****abcd"）。
 *
 * 保存后后端会刷新运行时快照，下一次 AI 调用立即生效，无需重启进程。
 */
import { ElMessage } from '@/utils/element';
import { getAiSettingsApi, saveAiSettingsApi, testAiApi } from '@/api/ai';
import type { AiSettings, SaveAiSettingsPayload } from '@/types/api';

defineOptions({ name: 'SystemAi' });

const loading = ref(false);
const saving = ref(false);
const testing = ref(false);
const settings = ref<AiSettings | null>(null);
/** 最近一次连通性测试结果（成功时展示耗时） */
const testResult = ref('');

const form = ref({
  // 只用于「输入新值」；空 = 不修改
  apiKey: '',
  baseUrl: 'https://api.agnes-ai.cn/v1',
  textModel: 'agnes-2.5-flash',
  imageModel: 'agnes-image-2.5-flash',
});

/** 读取设置（密钥输入框保持空白，placeholder 显示已配置的掩码）。 */
async function load(): Promise<void> {
  loading.value = true;
  try {
    const data = await getAiSettingsApi();
    settings.value = data;
    form.value = {
      apiKey: '',
      baseUrl: data.baseUrl || 'https://api.agnes-ai.cn/v1',
      textModel: data.textModel || 'agnes-2.5-flash',
      imageModel: data.imageModel || 'agnes-image-2.5-flash',
    };
  } finally {
    loading.value = false;
  }
}

/** 保存（只提交本次填了的密钥字段）。 */
async function save(): Promise<void> {
  saving.value = true;
  try {
    const payload: SaveAiSettingsPayload = {
      baseUrl: form.value.baseUrl.trim(),
      textModel: form.value.textModel.trim(),
      imageModel: form.value.imageModel.trim(),
    };
    // 留空 = 不修改：绝不把掩码值提交上去
    if (form.value.apiKey.trim()) {
      payload.apiKey = form.value.apiKey.trim();
    }
    await saveAiSettingsApi(payload);
    ElMessage.success('已保存，配置立即生效');
    await load();
  } finally {
    saving.value = false;
  }
}

/** 测试连通性（用生文模型发一个极短请求）。 */
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

onMounted(() => {
  void load();
});
</script>

<template>
  <div v-loading="loading" class="ai-settings-page">
    <el-card shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-[15px] font-semibold text-ink">Agnes AI 服务</span>
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
        <el-form-item label="API Key">
          <el-input
            v-model="form.apiKey"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="
              settings?.apiKeyConfigured
                ? `已配置 ${settings.apiKeyMasked}（留空不修改）`
                : 'Agnes API Key（只存服务端，接口不回显明文）'
            "
          />
        </el-form-item>

        <el-form-item label="上游地址">
          <el-input v-model="form.baseUrl" placeholder="https://api.agnes-ai.cn/v1" />
        </el-form-item>

        <el-form-item label="生文模型">
          <el-input v-model="form.textModel" placeholder="agnes-2.5-flash" />
          <span class="ml-2 text-xs text-gray-400">生题 / 造句 / 词根 / 句签 / 解析</span>
        </el-form-item>

        <el-form-item label="生图模型">
          <el-input v-model="form.imageModel" placeholder="agnes-image-2.5-flash" />
          <span class="ml-2 text-xs text-gray-400">题目配图（16:9）</span>
        </el-form-item>

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
        <el-button v-permission="'system:ai:edit'" :loading="testing" @click="runTest">测试连通</el-button>
        <span v-if="testResult" class="text-sm text-emerald-600">{{ testResult }}</span>
        <span v-else class="text-xs text-gray-400">
          用「生文模型」发一个极短请求，验证 Key、上游地址与模型是否都对
        </span>
      </div>
    </el-card>
  </div>
</template>
