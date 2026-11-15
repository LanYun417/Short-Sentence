/**
 * 运行环境与接口基地址。
 *
 * 小程序只能请求「已备案 HTTPS 域名」，因此生产域名必须写死在这里并在
 * 微信公众平台「开发管理 → 服务器域名」登记为 request 合法域名。
 * 开发期本机调试：微信开发者工具「详情 → 本地设置」勾选「不校验合法域名」。
 */

/** 本机开发默认地址（真机预览请改成电脑局域网 IP，如 http://192.168.1.8:3000/api）。 */
const DEV_BASE_URL = 'http://localhost:3000/api';

/** 生产域名（部署后替换为真实域名，必须 HTTPS 且已备案）。 */
const PROD_BASE_URL = 'https://api.example.com/api';

/** 调试用的地址覆盖键（在 Storage 里 setItem 即可临时切环境，不用改代码）。 */
const OVERRIDE_KEY = 'ss_api_base';

function resolveBaseUrl(): string {
  const override = wx.getStorageSync<string>(OVERRIDE_KEY);
  if (override && typeof override === 'string') {
    return override.replace(/\/+$/, '');
  }
  try {
    const envVersion = wx.getAccountInfoSync().miniProgram.envVersion;
    if (envVersion === 'release' || envVersion === 'trial') {
      return PROD_BASE_URL;
    }
  } catch {
    // 低版本基础库 / 非小程序环境没有该 API：按开发期处理
  }
  return DEV_BASE_URL;
}

/** 接口基地址（不含结尾斜杠，已含 `/api`）。 */
export const API_BASE_URL = resolveBaseUrl();

/**
 * 静态资源基地址。
 * 后端下发的图片是 `/static/xxx.webp` 相对路径，需要补上 origin（去掉 `/api` 段）。
 */
export const ASSET_BASE_URL = API_BASE_URL.replace(/\/api$/, '');
