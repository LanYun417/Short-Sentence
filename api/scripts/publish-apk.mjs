/* global FormData, Blob */
/**
 * 发布 Android 安装包：上传 APK → 登记一条上架版本记录 → 校验游客侧可见。
 *
 * 用法（在 api/ 目录或任意目录均可）：
 *   node scripts/publish-apk.mjs \
 *     --apk ../android/build/app/outputs/flutter-apk/app-release.apk \
 *     --version 1.0.0 --version-code 1 \
 *     --changelog "首个正式版：新增周榜/月榜与首次上榜成就" \
 *     --username admin --password '<超管口令>'
 *
 * 也可直接用管理端已签发的访问令牌跳过登录：--token <JWT>。
 * 登录开启图形验证码时，脚本从 Redis 读取刚生成的验证码答案（与 CaptchaService 同键），
 * 仅用于本机/内网自动化发布；生产环境建议直接 --token，不暴露口令。
 *
 * 零新增依赖：只用 Node 内置 fetch/FormData 与 api 已有的 redis 客户端。
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from 'redis';

const DEFAULTS = {
  api: 'http://127.0.0.1:3000/api',
  redis: 'redis://127.0.0.1:6379/0',
  username: 'admin',
  platform: 'android',
};

function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`无法识别的参数：${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`参数 --${key} 缺少取值`);
    // --version-code → opts.versionCode，其余保持原样
    const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = value;
    i += 1;
  }
  return out;
}

async function request(url, init = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${url} 返回非 JSON（HTTP ${res.status}）：${text.slice(0, 300)}`);
  }
  if (!res.ok) throw new Error(`${url} 失败（HTTP ${res.status}）：${JSON.stringify(body)}`);
  return body.data ?? body;
}

function jsonInit(body, token) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  };
}

/** 用账号密码换访问令牌；验证码答案从 Redis 取（CaptchaService 写入的键）。 */
async function loginWithPassword(opts) {
  const captcha = await request(`${opts.api}/auth/captcha`);
  let captchaId;
  let captchaCode;
  if (captcha.enabled) {
    const client = createClient({ url: opts.redis });
    client.on('error', () => undefined);
    await client.connect();
    try {
      captchaCode = await client.get(`auth:captcha:${captcha.captchaId}`);
    } finally {
      await client.quit().catch(() => undefined);
    }
    if (!captchaCode) throw new Error('未从 Redis 读到验证码答案，请改用 --token 发布');
    captchaId = captcha.captchaId;
  }
  const result = await request(
    `${opts.api}/auth/login`,
    jsonInit({ username: opts.username, password: opts.password, captchaId, captchaCode }),
  );
  if (!result.accessToken) throw new Error(`登录响应缺少 accessToken：${JSON.stringify(result)}`);
  return result.accessToken;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  for (const key of ['apk', 'version', 'versionCode']) {
    if (!opts[key]) throw new Error(`缺少必填参数 --${key}`);
  }
  const apkPath = path.resolve(opts.apk);
  const buffer = await readFile(apkPath);
  if (!opts.token && !opts.password) throw new Error('未提供 --token 时必须有 --password');
  const token = opts.token ?? (await loginWithPassword(opts));

  // 1. 上传安装包（multipart 字段名 file）
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/vnd.android.package-archive' }), path.basename(apkPath));
  const uploaded = await request(`${opts.api}/app-versions/upload`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  if (!uploaded.fileId) throw new Error(`上传响应缺少 fileId：${JSON.stringify(uploaded)}`);
  console.log(`[1/3] 安装包已上传：fileId=${uploaded.fileId} size=${uploaded.size}`);

  // 2. 登记上架版本
  const created = await request(
    `${opts.api}/app-versions`,
    jsonInit(
      {
        platform: opts.platform ?? DEFAULTS.platform,
        version: opts.version,
        versionCode: Number(opts.versionCode),
        fileId: uploaded.fileId,
        fileSize: uploaded.size,
        changelog: opts.changelog ?? '',
        forceUpdate: 0,
        status: 1,
      },
      token,
    ),
  );
  console.log(`[2/3] 版本记录已创建：id=${created.id} version=${opts.version}(${opts.versionCode}) status=上架`);

  // 3. 游客侧可见性校验
  const latest = await request(`${opts.api}/client/app/latest?platform=${opts.platform ?? DEFAULTS.platform}`);
  console.log(
    `[3/3] 游客侧最新版本：${latest?.version ?? '(空)'} / downloadUrl=${latest?.downloadUrl ?? '(见下载接口)'}`,
  );
}

main().catch((error) => {
  console.error(`发布失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
