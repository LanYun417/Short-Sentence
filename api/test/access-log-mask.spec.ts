/**
 * 访问日志脱敏单测。
 *
 * 回归点：`?token=` 是静态资源鉴权用的（`<img>` 无法自定义请求头），
 * 而访问日志会把整个 URL 落库/落盘 —— 不脱敏就等于把令牌明文写进日志表，
 * 任何能看日志的人都能直接拿来登录。
 */
import { describe, expect, it } from 'vitest';
import { maskUrl } from '../src/common/log/http-access-log.middleware.js';

describe('maskUrl', () => {
  it('抹掉 token / access_token / refresh_token 的值', () => {
    expect(maskUrl('/static/webp/a.webp?token=abc.def.ghi')).toBe('/static/webp/a.webp?token=******');
    expect(maskUrl('/api/x?access_token=aaa&page=1')).toBe('/api/x?access_token=******&page=1');
    expect(maskUrl('/api/x?refresh_token=aaa#frag')).toBe('/api/x?refresh_token=******#frag');
  });

  it('不是敏感参数就原样保留（不误伤业务查询串）', () => {
    const url = '/api/client/questions/next?difficulty=2&mode=assemble';
    expect(maskUrl(url)).toBe(url);
  });

  it('多个敏感参数一起出现时全部替换', () => {
    expect(maskUrl('/api/x?token=a&refresh_token=b')).toBe('/api/x?token=******&refresh_token=******');
  });
});
