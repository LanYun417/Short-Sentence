/**
 * 微信支付 v3 加密基座。
 *
 * 这是资金链路的安全底座，钉死四类行为：
 * ① 请求签名串必须是官方五段格式（METHOD/URL/TIMESTAMP/NONCE/BODY 各一行）；
 * ② 用私钥签出的名，只有对应公钥能验过；改一个字节就失败（fail-closed）；
 * ③ AES-256-GCM 解密：密文尾部 16 字节拆 tag，密钥/AAD 不对必须抛错；
 * ④ 私钥归一化：后台常见的 `\n` 转义串必须能还原成 PEM。
 */
import { createCipheriv, generateKeyPairSync, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildAuthorizationHeader,
  buildCallbackSignatureString,
  buildRequestSignatureString,
  decryptAesGcm,
  normalizePrivateKey,
  signWithPrivateKey,
  verifyWithCertificate,
} from '../src/common/pay/wechatpay-crypto.js';

/** 生成一对测试密钥（2048 位 RSA；publicKey 模拟平台证书公钥）。 */
function makeKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privateKey, publicKey };
}

/** 按微信规则加密（密文尾部追加 GCM tag），模拟平台下发/回调加密。 */
function encryptLikeWechat(plain: string, key: string, aad: string, nonce?: Buffer): string {
  const iv = nonce ?? randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 微信约定：ciphertext = base64(data + tag)
  return `${iv.toString('base64')}|${Buffer.concat([data, tag]).toString('base64')}`;
}

describe('微信支付签名串', () => {
  it('请求签名串是五段各占一行、末尾带换行', () => {
    expect(buildRequestSignatureString('post', '/v3/pay/transactions/native', '1700000000', 'abc', '{"a":1}')).toBe(
      'POST\n/v3/pay/transactions/native\n1700000000\nabc\n{"a":1}\n',
    );
  });

  it('回调验签串是 TIMESTAMP/NONCE/BODY 三段', () => {
    expect(buildCallbackSignatureString('1700000000', 'abc', '{"x":2}')).toBe('1700000000\nabc\n{"x":2}\n');
  });

  it('Authorization 头包含五个约定字段', () => {
    const header = buildAuthorizationHeader({
      mchId: '1900000001',
      serialNo: 'SERIAL',
      nonce: 'nonce',
      timestamp: '1700000000',
      signature: 'SIG',
    });
    expect(header).toContain('WECHATPAY2-SHA256-RSA2048 ');
    expect(header).toContain('mchid="1900000001"');
    expect(header).toContain('serial_no="SERIAL"');
    expect(header).toContain('signature="SIG"');
  });
});

describe('RSA-SHA256 签名与验签', () => {
  const { privateKey, publicKey } = makeKeyPair();

  it('私钥签名可被对应公钥验过', () => {
    const message = buildCallbackSignatureString('1700000000', 'nonce', '{"id":"x"}');
    const signature = signWithPrivateKey(privateKey, message);
    expect(verifyWithCertificate(publicKey, signature, message)).toBe(true);
  });

  it('报文被篡改一个字符即验签失败', () => {
    const signature = signWithPrivateKey(privateKey, buildCallbackSignatureString('1700000000', 'nonce', '{"id":"x"}'));
    const tampered = buildCallbackSignatureString('1700000000', 'nonce', '{"id":"y"}');
    expect(verifyWithCertificate(publicKey, signature, tampered)).toBe(false);
  });

  it('非法证书/签名一律判失败而不是抛异常', () => {
    expect(verifyWithCertificate('not-a-cert', 'not-a-signature', 'msg')).toBe(false);
  });
});

describe('AES-256-GCM 解密', () => {
  const key = '0123456789abcdef0123456789abcdef';

  it('能解开按微信约定追加 tag 的密文', () => {
    const encrypted = encryptLikeWechat('{"out_trade_no":"SS1"}', key, 'transaction');
    const [nonce, ciphertext] = encrypted.split('|');
    const plain = decryptAesGcm(
      { algorithm: 'AEAD_AES_256_GCM', ciphertext, nonce, associatedData: 'transaction' },
      key,
    );
    expect(plain).toBe('{"out_trade_no":"SS1"}');
  });

  it('AAD 不匹配时解密抛错（防串单）', () => {
    const encrypted = encryptLikeWechat('{"a":1}', key, 'transaction');
    const [nonce, ciphertext] = encrypted.split('|');
    expect(() =>
      decryptAesGcm({ algorithm: 'AEAD_AES_256_GCM', ciphertext, nonce, associatedData: 'certificate' }, key),
    ).toThrow();
  });

  it('密钥长度不是 32 字节时给出明确错误', () => {
    expect(() =>
      decryptAesGcm({ algorithm: 'AEAD_AES_256_GCM', ciphertext: 'AAAA', nonce: 'AAAA', associatedData: '' }, 'short'),
    ).toThrow(/32/);
  });

  it('不支持的算法直接拒绝', () => {
    expect(() =>
      decryptAesGcm({ algorithm: 'AES_128_CBC', ciphertext: 'AAAA', nonce: 'AAAA', associatedData: '' }, key),
    ).toThrow(/不支持/);
  });
});

describe('私钥归一化', () => {
  it('把后台粘贴的 \\n 转义串还原成 PEM', () => {
    const raw = '-----BEGIN PRIVATE KEY-----\\nMIIB\\n-----END PRIVATE KEY-----';
    expect(normalizePrivateKey(raw)).toBe('-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----');
  });

  it('正常 PEM 原样返回', () => {
    const raw = '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----';
    expect(normalizePrivateKey(raw)).toBe(raw);
  });
});
