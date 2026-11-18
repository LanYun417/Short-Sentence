<script setup lang="ts">
/**
 * 支付设置页。
 * 模块职责：维护微信支付 v3 的六项凭证（AppID / 商户号 / 证书序列号 / 商户私钥 / APIv3 密钥 / 回调地址）。
 *
 * 安全口径（与「AI 设置」「邮件设置」一致）：
 * - 读接口只回掩码与「是否已配置」，绝不回显明文；
 * - 私钥 / APIv3 密钥**留空表示不修改**（后端按「未传即沿用现值」处理），只有填写才覆盖；
 * - 保存即生效（运行时快照刷新），无需重启服务。
 */
import { ElMessage } from '@/utils/element';
import { getPaySettingsApi, savePaySettingsApi, testPayConnectionApi } from '@/api/pay';
import type { PaySettingsInfo, SavePaySettingsPayload } from '@/types/api';

defineOptions({ name: 'PaySettings' });

const loading = ref(false);
const saving = ref(false);
const testing = ref(false);
const info = ref<PaySettingsInfo | null>(null);
/** 测试连接结果（null = 未测） */
const testResult = ref<{ ok: boolean; message: string } | null>(null);

/** 表单（密钥为空表示不修改） */
const form = reactive({
  appId: '',
  mchId: '',
  serialNo: '',
  privateKey: '',
  apiv3Key: '',
  notifyUrl: '',
});

/** 加载配置（回填非敏感项；敏感项只显示掩码占位） */
async function load(): Promise<void> {
  loading.value = true;
  try {
    const data = await getPaySettingsApi();
    info.value = data;
    form.appId = data.appId;
    form.mchId = data.mchId;
    form.serialNo = data.serialNo;
    form.notifyUrl = data.notifyUrl;
    form.privateKey = '';
    form.apiv3Key = '';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});

/** 私钥占位提示 */
const privateKeyPlaceholder = computed(() =>
  info.value?.privateKeyConfigured
    ? `已配置（${info.value.privateKeyMasked}），留空不修改；填写则覆盖`
    : '粘贴 apiclient_key.pem 内容，或填写服务器上的文件路径',
);

/** APIv3 密钥占位提示 */
const apiv3KeyPlaceholder = computed(() =>
  info.value?.apiv3KeyConfigured
    ? `已配置（${info.value.apiv3KeyMasked}），留空不修改；填写则覆盖`
    : '商户平台设置的 32 位 APIv3 密钥',
);

/** 回调地址（后端已配则展示；未配时给默认建议） */
const notifyUrlHint = computed(() => {
  if (form.notifyUrl) {
    return form.notifyUrl;
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://<你的域名>';
  return `${origin.replace(/:\d+$/, '')}/api/pay/notify/wechat`;
});

/** 保存（只提交有变化的字段；密钥留空不覆盖） */
async function handleSave(): Promise<void> {
  const payload: SavePaySettingsPayload = {
    appId: form.appId.trim(),
    mchId: form.mchId.trim(),
    serialNo: form.serialNo.trim(),
    notifyUrl: form.notifyUrl.trim(),
  };
  if (form.privateKey.trim()) {
    payload.privateKey = form.privateKey.trim();
  }
  if (form.apiv3Key.trim()) {
    payload.apiv3Key = form.apiv3Key.trim();
  }
  saving.value = true;
  try {
    info.value = await savePaySettingsApi(payload);
    form.privateKey = '';
    form.apiv3Key = '';
    ElMessage.success(info.value.enabled ? '已保存，支付功能已可用' : '已保存；仍有缺项，补全后自动启用');
  } finally {
    saving.value = false;
  }
}

/** 测试连接：验证商户私钥签名 + APIv3 密钥解密（不产生资金动作） */
async function handleTest(): Promise<void> {
  testing.value = true;
  testResult.value = null;
  try {
    testResult.value = await testPayConnectionApi();
  } finally {
    testing.value = false;
  }
}

/** 把建议的回调地址填进输入框 */
function useSuggestedNotifyUrl(): void {
  form.notifyUrl = notifyUrlHint.value;
}
</script>

<template>
  <div v-loading="loading" class="pay-settings-page">
    <el-card shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="text-[15px] font-semibold text-ink">微信支付配置</span>
            <el-tag :type="info?.enabled ? 'success' : 'info'" size="small">
              {{ info?.enabled ? '已启用' : '未启用' }}
            </el-tag>
          </div>
          <div class="flex items-center gap-2">
            <el-button :loading="testing" :disabled="!info?.enabled" @click="handleTest">测试连接</el-button>
            <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
          </div>
        </div>
      </template>

      <el-alert
        v-if="info && !info.enabled"
        type="warning"
        :closable="false"
        show-icon
        class="mb-4"
        title="支付功能尚未启用"
        :description="`还缺：${info.missing.join('、')}。补齐并保存后，客户端会立即出现购买入口。`"
      />
      <el-alert
        v-if="testResult"
        :type="testResult.ok ? 'success' : 'error'"
        :closable="false"
        show-icon
        class="mb-4"
        :title="testResult.ok ? '连接正常' : '连接失败'"
        :description="testResult.message"
      />

      <el-form label-width="140px" class="max-w-3xl">
        <el-form-item label="AppID">
          <el-input
            v-model="form.appId"
            placeholder="小程序支付填小程序 AppID；扫码支付填已绑定该商户的 AppID"
            clearable
          />
        </el-form-item>
        <el-form-item label="商户号">
          <el-input v-model="form.mchId" placeholder="微信支付商户号（mchid）" clearable />
        </el-form-item>
        <el-form-item label="证书序列号">
          <el-input v-model="form.serialNo" placeholder="商户 API 证书序列号（商户平台「API 证书」页可查）" clearable />
        </el-form-item>
        <el-form-item label="商户私钥">
          <el-input
            v-model="form.privateKey"
            type="textarea"
            :rows="6"
            :placeholder="privateKeyPlaceholder"
            spellcheck="false"
          />
          <div class="mt-1 text-xs text-ink-muted">
            对应 apiclient_key.pem。支持三种写法：文件路径 / 完整 PEM / 带 \n
            转义的字符串；私钥只存数据库，读接口只回掩码。
          </div>
        </el-form-item>
        <el-form-item label="APIv3 密钥">
          <el-input
            v-model="form.apiv3Key"
            type="password"
            show-password
            maxlength="32"
            :placeholder="apiv3KeyPlaceholder"
          />
          <div class="mt-1 text-xs text-ink-muted">商户平台「账户中心 → API 安全」设置的 32 位密钥，用于回调解密。</div>
        </el-form-item>
        <el-form-item label="回调地址">
          <el-input v-model="form.notifyUrl" placeholder="https://<域名>/api/pay/notify/wechat" clearable />
          <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span>必须公网可达（https），微信支付结果通知发到这里。</span>
            <el-button link type="primary" @click="useSuggestedNotifyUrl">填入建议地址</el-button>
          </div>
        </el-form-item>
      </el-form>

      <el-divider />

      <div class="space-y-2 text-xs leading-6 text-ink-muted">
        <div class="text-sm font-medium text-ink">接入步骤</div>
        <div>1. 微信支付商户平台开通「Native 支付」与（小程序支付所需）「JSAPI 支付」；</div>
        <div>2. 下载商户 API 证书，得到 apiclient_key.pem 与证书序列号；</div>
        <div>3. 在「账户中心 → API 安全」设置 APIv3 密钥（32 位），并配置回调地址；</div>
        <div>
          4. 官方文档：
          <a
            class="text-primary hover:underline"
            href="https://pay.weixin.qq.com/doc/v3/merchant/4015423216"
            target="_blank"
            rel="noreferrer"
            >微信支付 API v3 接入指南</a
          >
        </div>
        <div>保存即生效；密钥项留空不会覆盖已有配置。商户私钥建议长期保管，不要通过聊天工具明文传输。</div>
      </div>
    </el-card>
  </div>
</template>
