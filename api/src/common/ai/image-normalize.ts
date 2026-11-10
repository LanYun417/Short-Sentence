/**
 * AI 生成图入库前的尺寸归一化。
 *
 * 为什么需要：生图接口的 `ratio` 参数是「尽量满足」，与 `size` 档位同时传时
 * 偶发被忽略，模型会吐回 1:1 / 超宽等错比图。此前入库只做
 * `.resize({ width })`（只缩宽、保持原比例），错比图会原样落盘——
 * 同一类卡片里混着多种比例的文件（前端 object-cover 能兜住显示，
 * 但文件尺寸本身不一致，备份/迁移/审核时一眼就能看出来）。
 *
 * 这里统一在入库前「按宽缩放 + 居中裁切」到目标宽高比，保证出库尺寸恒定。
 */
import sharp from 'sharp';

/** 解析 "16:9" / "4:3" 为 [w, h]；非法输入回落 16:9。 */
export function parseRatio(ratio: string | undefined): [number, number] {
  const match = /^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/.exec((ratio ?? '').trim());
  const w = match ? Number(match[1]) : 16;
  const h = match ? Number(match[2]) : 9;
  return [w > 0 ? w : 16, h > 0 ? h : 9];
}

export interface NormalizeImageOptions {
  /** 出库宽度上限（px）；源图更窄时不放大 */
  maxWidth: number;
  /** 目标宽高比（如 "16:9"、"4:3"） */
  ratio: string;
  /** webp 质量 */
  quality: number;
}

/**
 * 把生图 buffer 归一化为「宽 ≤ maxWidth、宽高比 = ratio」的 webp。
 *
 * 输出尺寸恒为 `outW × round(outW * h / w)`（fit: cover 居中裁切），
 * 其中 outW = min(源宽, maxWidth)。源图比 maxWidth 窄时不放大，但仍按目标比裁切。
 */
export async function normalizeGeneratedImage(buffer: Buffer, options: NormalizeImageOptions): Promise<Buffer> {
  const [ratioW, ratioH] = parseRatio(options.ratio);
  const meta = await sharp(buffer).metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  if (!srcW || !srcH) {
    throw new Error('生图元数据缺失（无 width/height），无法归一化尺寸');
  }
  const outW = Math.max(1, Math.min(srcW, Math.round(options.maxWidth)));
  const outH = Math.max(1, Math.round((outW * ratioH) / ratioW));
  return sharp(buffer).resize(outW, outH, { fit: 'cover' }).webp({ quality: options.quality }).toBuffer();
}
