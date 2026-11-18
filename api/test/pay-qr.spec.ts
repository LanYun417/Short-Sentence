/**
 * 支付二维码生成：必须是可被 &lt;img&gt; 直接渲染的 PNG data URL，
 * 且不同 code_url 产出不同图（避免把缓存/常量写死导致用户扫到别人的单）。
 */
import { describe, expect, it } from 'vitest';
import { toQrDataUrl } from '../src/common/pay/qr.js';

describe('支付二维码', () => {
  it('生成 PNG data URL', () => {
    const url = toQrDataUrl('weixin://wxpay/bizpayurl?pr=abc123');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    // PNG 文件的 base64 魔数：iVBORw0KGgo
    expect(url.slice('data:image/png;base64,'.length, 'data:image/png;base64,'.length + 11)).toBe('iVBORw0KGgo');
  });

  it('不同内容产出不同二维码', () => {
    const a = toQrDataUrl('weixin://wxpay/bizpayurl?pr=abc');
    const b = toQrDataUrl('weixin://wxpay/bizpayurl?pr=xyz');
    expect(a).not.toBe(b);
  });

  it('体积在合理范围（几 KB，不拖慢下单响应）', () => {
    const url = toQrDataUrl('weixin://wxpay/bizpayurl?pr=abc123');
    expect(url.length).toBeGreaterThan(500);
    expect(url.length).toBeLessThan(20_000);
  });
});
