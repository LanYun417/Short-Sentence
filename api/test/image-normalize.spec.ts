/**
 * 生成图尺寸归一化单测。
 *
 * 回归点：模型接口的 `ratio` 偶发被忽略，只按宽缩放会把错比图原样入库。
 * `normalizeGeneratedImage` 必须保证「出库宽 ≤ maxWidth 且宽高比恒等于目标比」，
 * 无论源图是 1:1、16:9 还是超宽。
 */
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { normalizeGeneratedImage, parseRatio } from '../src/common/ai/image-normalize.js';

/** 造一张纯色 PNG 作为「模型返回」的生图。 */
async function solidPng(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#7aa2f7' } })
    .png()
    .toBuffer();
}

async function sizeOf(buffer: Buffer): Promise<string> {
  const meta = await sharp(buffer).metadata();
  return `${meta.width}x${meta.height}`;
}

describe('parseRatio', () => {
  it('正常解析 "16:9" / "4:3"', () => {
    expect(parseRatio('16:9')).toEqual([16, 9]);
    expect(parseRatio('4:3')).toEqual([4, 3]);
    expect(parseRatio(' 1:1 ')).toEqual([1, 1]);
  });

  it('非法输入回落 16:9', () => {
    expect(parseRatio(undefined)).toEqual([16, 9]);
    expect(parseRatio('')).toEqual([16, 9]);
    expect(parseRatio('abc')).toEqual([16, 9]);
    expect(parseRatio('0:0')).toEqual([16, 9]);
  });
});

describe('normalizeGeneratedImage', () => {
  it('源图 1:1、目标 4:3：裁切成 4:3 且宽压到 maxWidth', async () => {
    const out = await normalizeGeneratedImage(await solidPng(2048, 2048), {
      maxWidth: 1280,
      ratio: '4:3',
      quality: 82,
    });
    expect(await sizeOf(out)).toBe('1280x960');
    expect((await sharp(out).metadata()).format).toBe('webp');
  });

  it('源图 16:9、目标 4:3：横裁成 4:3（不是只缩宽留 16:9）', async () => {
    const out = await normalizeGeneratedImage(await solidPng(2624, 1472), {
      maxWidth: 1280,
      ratio: '4:3',
      quality: 82,
    });
    expect(await sizeOf(out)).toBe('1280x960');
  });

  it('源图超宽（21:9）、目标 16:9：裁切成 16:9', async () => {
    const out = await normalizeGeneratedImage(await solidPng(2560, 1097), {
      maxWidth: 1280,
      ratio: '16:9',
      quality: 80,
    });
    expect(await sizeOf(out)).toBe('1280x720');
  });

  it('源图比 maxWidth 窄：不放大，但仍按目标比裁切', async () => {
    const out = await normalizeGeneratedImage(await solidPng(600, 600), {
      maxWidth: 1280,
      ratio: '16:9',
      quality: 80,
    });
    expect(await sizeOf(out)).toBe('600x338');
  });

  it('缺失尺寸元数据时抛错而不是静默放行', async () => {
    await expect(
      normalizeGeneratedImage(Buffer.from('not-an-image'), { maxWidth: 1280, ratio: '4:3', quality: 82 }),
    ).rejects.toThrow();
  });

  it('生图自带近白留白：入库前裁掉白边，输出满幅且保持目标比例', async () => {
    // 复刻线上 letterbox 封面：1280x960 画布，中间一条蓝色内容带，上下是米白留白
    const band = await sharp({ create: { width: 1280, height: 630, channels: 3, background: '#7aa2f7' } })
      .png()
      .toBuffer();
    const letterbox = await sharp({ create: { width: 1280, height: 960, channels: 3, background: '#fffbed' } })
      .composite([{ input: band, top: 165, left: 0 }])
      .png()
      .toBuffer();

    const out = await normalizeGeneratedImage(letterbox, { maxWidth: 1280, ratio: '4:3', quality: 82 });
    expect(await sizeOf(out)).toBe('1280x960');

    // 首行/末行都应是蓝色内容（b > r），而不是米白白边（r > b）
    const { data, info } = await sharp(out).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const y of [0, info.height - 1]) {
      const i = y * info.width * info.channels;
      expect(data[i + 2]).toBeGreaterThan(data[i]);
    }
  });

  it('纯色图（左上角非白）不触发裁白边，行为保持不变', async () => {
    const out = await normalizeGeneratedImage(await solidPng(2048, 2048), {
      maxWidth: 1280,
      ratio: '4:3',
      quality: 82,
    });
    expect(await sizeOf(out)).toBe('1280x960');
  });
});
