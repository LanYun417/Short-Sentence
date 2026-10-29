/**
 * 腾讯云 SES 客户端单测（不联网：fetch 用桩替换）。
 *
 * 守住四件事：
 * 1. TC3 签名头结构正确（Credential 作用域日期用 UTC、SignedHeaders、Signature 为 64 位 hex）；
 * 2. 请求体里 TemplateData 是 **JSON 字符串**（腾讯云要求，写成对象会被拒）；
 * 3. 业务错误（HTTP 200 + Response.Error）要抛 SesError，而不是当成功；
 * 4. 正常响应解析出 MessageId。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sesSendEmail, SesError } from '../src/common/mail/tencent-ses.client.js';

const CREDENTIAL = { secretId: 'AKIDtest', secretKey: 'secret-test', region: 'ap-guangzhou' };

/** 捕获 fetch 的调用参数，并按需返回响应。 */
function stubFetch(response: { status?: number; body: unknown }): { calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const status = response.status ?? 200;
      return new Response(JSON.stringify(response.body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return { calls };
}

describe('tencent-ses.client', () => {
  beforeEach(() => {
    // 固定系统时间：签名里的日期与时间戳必须可预期
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T02:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('构造合规的 TC3 签名头与请求体', async () => {
    const { calls } = stubFetch({ body: { Response: { MessageId: 'msg-1', RequestId: 'req-1' } } });

    const result = await sesSendEmail(CREDENTIAL, {
      FromEmailAddress: '短句 <noreply@dphrase.cn>',
      Destination: ['user@example.com'],
      Subject: '短句 - 注册验证码',
      Template: { TemplateID: 66220, TemplateData: JSON.stringify({ action: '注册', code: '123456' }) },
    });

    expect(result.messageId).toBe('msg-1');
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url).toBe('https://ses.tencentcloudapi.com/');
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;
    expect(headers['X-TC-Action']).toBe('SendEmail');
    expect(headers['X-TC-Version']).toBe('2020-10-02');
    expect(headers['X-TC-Region']).toBe('ap-guangzhou');
    // 固定时间 → 时间戳可预期
    expect(headers['X-TC-Timestamp']).toBe(String(Math.floor(Date.parse('2026-10-29T02:30:00Z') / 1000)));

    // 日期必须是 UTC（东八区 02:30 仍是 10-29；若按本地日期算在跨日时段会错位）
    expect(headers.Authorization).toContain('Credential=AKIDtest/2026-10-29/ses/tc3_request');
    expect(headers.Authorization).toContain('SignedHeaders=content-type;host');
    expect(headers.Authorization).toMatch(/Signature=[0-9a-f]{64}$/);

    // TemplateData 必须是字符串，不是对象
    const body = JSON.parse(String(init.body)) as {
      Template: { TemplateID: number; TemplateData: string };
    };
    expect(body.Template.TemplateID).toBe(66220);
    expect(typeof body.Template.TemplateData).toBe('string');
    expect(JSON.parse(body.Template.TemplateData)).toEqual({ action: '注册', code: '123456' });
  });

  it('业务错误（HTTP 200 + Response.Error）抛 SesError 并带错误码', async () => {
    stubFetch({
      body: { Response: { Error: { Code: 'FailedOperation.DomainNotVerified', Message: '域名未验证' } } },
    });

    await expect(
      sesSendEmail(CREDENTIAL, { FromEmailAddress: 'a@b.com', Destination: ['c@d.com'], Subject: 's' }),
    ).rejects.toMatchObject({ name: 'SesError', code: 'FailedOperation.DomainNotVerified' });
  });

  it('非 JSON 响应抛 SesError（不把网关错误当成功）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>bad gateway</html>', { status: 502 })),
    );

    await expect(
      sesSendEmail(CREDENTIAL, { FromEmailAddress: 'a@b.com', Destination: ['c@d.com'], Subject: 's' }),
    ).rejects.toBeInstanceOf(SesError);
  });
});
