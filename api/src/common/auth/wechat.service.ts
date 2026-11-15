/**
 * 微信小程序登录服务。
 * 模块职责：用 `wx.login` 拿到的 `code` 调微信 `jscode2session` 换 openid / session_key。
 *
 * 设计取舍：
 * - 密钥缺失时整体禁用（接口返回明确错误），不阻断服务启动——与 AI 密钥同一口径。
 * - 仅做「code → openid」这一跳；openid 如何映射成我们自己的用户，由 ClientAuthUserService 决定
 *   （首次登录自动建号、后续登录按 openid 命中已有账号），本服务不碰用户表。
 * - session_key 仅透出、不落库：小程序侧需要它做「手机号授权」「数据解密」等高级能力，
 *   但本服务不负责保管，调用方按需使用后立即丢弃。
 */
import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config/config.js';
import { AppException } from '../exception/app.exception.js';

/** 微信 code2session 返回的会话信息。 */
export interface WechatSession {
  openid: string;
  sessionKey: string;
  unionid?: string;
}

/** jscode2session 成功响应（errcode 缺省为 0）。 */
interface WechatCode2SessionOk {
  openid: string;
  session_key: string;
  unionid?: string;
}

/** jscode2session 失败响应。 */
interface WechatCode2SessionErr {
  errcode: number;
  errmsg: string;
}

@Injectable()
export class WechatService {
  private readonly logger = new Logger(WechatService.name);

  /**
   * 用小程序登录 code 换取微信会话。
   * @throws AppException 未配置 / 微信返回错误 / 网络异常时给出明确提示
   */
  async code2Session(code: string): Promise<WechatSession> {
    const { appId, appSecret } = config.wechat.miniProgram;
    if (!appId || !appSecret) {
      throw AppException.badRequest('微信登录未配置（缺少 WECHAT_MINIAPP_APPID / WECHAT_MINIAPP_SECRET）');
    }

    const url =
      `https://api.weixin.qq.com/sns/jscode2session` +
      `?appid=${encodeURIComponent(appId)}` +
      `&secret=${encodeURIComponent(appSecret)}` +
      `&js_code=${encodeURIComponent(code)}` +
      `&grant_type=authorization_code`;

    let json: WechatCode2SessionOk | WechatCode2SessionErr;
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      json = (await resp.json()) as WechatCode2SessionOk | WechatCode2SessionErr;
    } catch (error) {
      this.logger.error(`微信 code2session 调用失败: ${error instanceof Error ? error.message : String(error)}`);
      throw AppException.serviceUnavailable('微信登录服务暂时不可用，请稍后再试');
    }

    if ('errcode' in json && json.errcode !== 0) {
      this.logger.warn(`微信 code2session 返回错误: ${json.errcode} ${json.errmsg}`);
      throw AppException.badRequest(`微信登录失败：${json.errmsg ?? '未知错误'}`);
    }

    const ok = json as WechatCode2SessionOk;
    if (!ok.openid || !ok.session_key) {
      throw AppException.badRequest('微信登录失败：返回数据异常');
    }
    return {
      openid: ok.openid,
      sessionKey: ok.session_key,
      unionid: ok.unionid,
    };
  }
}
