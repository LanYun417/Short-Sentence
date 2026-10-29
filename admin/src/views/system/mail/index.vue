<script setup lang="ts">
/**
 * 邮件设置页（腾讯云 SES）。
 *
 * 关键交互：SecretId / SecretKey **只回掩码、留空表示不改**——
 * 后端从不把真密钥交给浏览器，前端也不允许把掩码值回填提交（否则会把真密钥覆盖成 "****abcd"）。
 */
import { ElMessage } from '@/utils/element';
import { getMailSettingsApi, saveMailSettingsApi, testMailApi } from '@/api/mail';
import type { MailSettings, SaveMailSettingsPayload } from '@/types/api';

defineOptions({ name: 'SystemMail' });

const loading = ref(false);
const saving = ref(false);
const testing = ref(false);
const settings = ref<MailSettings | null>(null);
/** 测试收件箱（默认填发件人自己，方便自查） */
const testTo = ref('');

const form = ref({
  enabled: false,
  // 只用于「输入新值」；空 = 不修改
  secretId: '',
  secretKey: '',
  region: 'ap-guangzhou',
  fromAddress: '',
  fromAlias: '短句',
  templateCaptcha: 66220,
  templateReminder: 66223,
});

/** 地域选项（SES 常用地域，按需增减） */
const REGIONS = [
  { value: 'ap-guangzhou', label: '广州 ap-guangzhou' },
  { value: 'ap-hongkong', label: '中国香港 ap-hongkong' },
  { value: 'ap-beijing', label: '北京 ap-beijing' },
  { value: 'ap-shanghai', label: '上海 ap-shanghai' },
];

/** 读取设置（密钥输入框保持空白，placeholder 显示已配置的掩码）。 */
async function load(): Promise<void> {
  loading.value = true;
  try {
    const data = await getMailSettingsApi();
    settings.value = data;
    form.value = {
      enabled: data.enabled,
      secretId: '',
      secretKey: '',
      region: data.region || 'ap-guangzhou',
      fromAddress: data.fromAddress,
      fromAlias: data.fromAlias || '短句',
      templateCaptcha: data.templateCaptcha || 66220,
      templateReminder: data.templateReminder || 66223,
    };
    if (!testTo.value) {
      testTo.value = data.fromAddress;
    }
  } finally {
    loading.value = false;
  }
}

/** 保存（只提交本次填了的密钥字段）。 */
async function save(): Promise<void> {
  saving.value = true;
  try {
    const payload: SaveMailSettingsPayload = {
      enabled: form.value.enabled,
      region: form.value.region,
      fromAddress: form.value.fromAddress.trim(),
      fromAlias: form.value.fromAlias.trim(),
      templateCaptcha: form.value.templateCaptcha,
      templateReminder: form.value.templateReminder,
    };
    // 留空 = 不修改：绝不把掩码值提交上去
    if (form.value.secretId.trim()) {
      payload.secretId = form.value.secretId.trim();
    }
    if (form.value.secretKey.trim()) {
      payload.secretKey = form.value.secretKey.trim();
    }
    await saveMailSettingsApi(payload);
    ElMessage.success('已保存');
    await load();
  } finally {
    saving.value = false;
  }
}

/** 发送测试邮件（验证凭证/模板/发件域名是否都通）。 */
async function sendTest(): Promise<void> {
  if (!testTo.value.trim()) {
    ElMessage.warning('请填写测试收件邮箱');
    return;
  }
  testing.value = true;
  try {
    await testMailApi(testTo.value.trim());
    ElMessage.success(`测试邮件已发送至 ${testTo.value.trim()}，请查收（含垃圾箱）`);
  } finally {
    testing.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div v-loading="loading" class="mail-settings-page">
    <el-card shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-[15px] font-semibold text-ink">腾讯云 SES 邮件服务</span>
          <div class="flex items-center gap-2">
            <el-tag v-if="settings?.enabled" :type="settings.ready ? 'success' : 'warning'" size="small">
              {{ settings.ready ? '已启用 · 配置完整' : '已启用 · 配置不完整' }}
            </el-tag>
            <el-tag v-else type="info" size="small">未启用</el-tag>
          </div>
        </div>
      </template>

      <el-alert
        v-if="settings && !settings.ready"
        type="warning"
        :closable="false"
        show-icon
        class="mb-4"
        :title="`还缺：${settings.missing.join('、')}`"
        description="补齐后才能发送邮件；验证码与每日提醒都会走这套配置。"
      />

      <el-form label-width="140px" class="max-w-3xl">
        <el-form-item label="启用邮件服务">
          <el-switch v-model="form.enabled" />
          <span class="ml-2 text-xs text-gray-400">关闭后验证码邮件与每日提醒都不会发送</span>
        </el-form-item>

        <el-form-item label="SecretId">
          <el-input
            v-model="form.secretId"
            :placeholder="settings?.secretId ? `已配置 ${settings.secretId}（留空不修改）` : '腾讯云 API 密钥 SecretId'"
            autocomplete="off"
          />
        </el-form-item>

        <el-form-item label="SecretKey">
          <el-input
            v-model="form.secretKey"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="
              settings?.secretKeyConfigured
                ? `已配置 ${settings.secretKeyMasked}（留空不修改）`
                : '腾讯云 API 密钥 SecretKey'
            "
          />
        </el-form-item>

        <el-form-item label="地域">
          <el-select v-model="form.region" style="width: 260px">
            <el-option v-for="item in REGIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>

        <el-form-item label="发件人邮箱">
          <el-input v-model="form.fromAddress" placeholder="需在 SES 控制台验证过的域名下，如 noreply@dphrase.cn" />
        </el-form-item>

        <el-form-item label="发件人显示名">
          <el-input v-model="form.fromAlias" maxlength="50" placeholder="短句" />
        </el-form-item>

        <el-form-item label="验证码模板 ID">
          <el-input-number v-model="form.templateCaptcha" :min="1" :step="1" />
          <span class="ml-2 text-xs text-gray-400">模板变量：action（动作）、code（验证码）</span>
        </el-form-item>

        <el-form-item label="每日提醒模板 ID">
          <el-input-number v-model="form.templateReminder" :min="1" :step="1" />
          <span class="ml-2 text-xs text-gray-400">模板变量：nickname（昵称）</span>
        </el-form-item>

        <el-form-item>
          <el-button v-permission="'system:mail:edit'" type="primary" :loading="saving" @click="save"
            >保存设置</el-button
          >
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 测试发信 -->
    <el-card shadow="never" class="mt-4">
      <template #header>
        <span class="text-[15px] font-semibold text-ink">发送测试邮件</span>
      </template>
      <div class="flex flex-wrap items-center gap-2">
        <el-input v-model="testTo" placeholder="收件邮箱" style="width: 280px" />
        <el-button v-permission="'system:mail:edit'" :loading="testing" @click="sendTest">发送测试</el-button>
        <span class="text-xs text-gray-400"
          >用「验证码模板」发一条固定内容（code=123456），验证凭证、模板与发件域名</span
        >
      </div>
    </el-card>
  </div>
</template>
