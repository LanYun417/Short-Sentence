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
 *
 * 另有一类缺陷：模型会把内容画在画布中间、四周补一圈浅色留白（letterbox），
 * `ratio` 与 `size` 档位冲突时尤其明显。白边是**像素内容**，不是缩放补出来的，
 * 单靠 `fit: cover` 按尺寸裁去不掉它；前端再怎么 cover 也只是把白边一起放大。
 * 所以入库前先找出真实内容边界裁掉留白，再按目标比例居中裁切。
 *
 * 为什么不用 `sharp.trim()`：它按「四角同色 + 容差」裁，遇到白边与内容之间的
 * 渐变过渡会停在过渡行，残留几行浅色（实测输出首末行仍是 255,250,213 / 255,249,232）。
 * 改为按「整行/整列与留白底色的差异像素占比」扫描内容边界，边界干净可控。
 */
import sharp from 'sharp';

/**
 * 留白底色判定。模型补的边不总是纯白，常见米白 / 奶油 / 浅杏（如 255,247,227、
 * 254,240,211），所以按「亮 + 低饱和」判，而不是卡死各通道 ≥ 230。
 * 彩色内容（如 253,238,161 的明黄、162,121,66 的棕）不会命中。
 */
const LETTERBOX_MIN_CHANNEL = 200;
const LETTERBOX_MAX_SPREAD = 50;
/** 单像素与留白底色的曼哈顿差异阈值：容忍压缩噪声与轻微渐变。 */
const BLANK_PIXEL_DIFF = 36;
/** 一行/列中「非底色像素」占比达到此值，即认为进入了内容区。 */
const BLANK_ROW_CONTENT_RATIO = 0.02;
/** 裁掉面积超过此比例视为误判（纯色图会全裁），回退原图。 */
const MAX_AREA_CUT = 0.6;
/** 裁掉面积不足此比例视为满幅图，无需处理。 */
const MIN_AREA_CUT = 0.03;

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

/** 左上角 1px 的 RGB（无 alpha 时按 3 通道取）。 */
async function topLeftPixel(buffer: Buffer): Promise<[number, number, number]> {
  const px = await sharp(buffer).extract({ left: 0, top: 0, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  return [px[0] ?? 0, px[1] ?? 0, px[2] ?? 0];
}

/** 该颜色是否属于「留白底色」：够亮且接近中性色。 */
function isLetterboxColor(r: number, g: number, b: number): boolean {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= LETTERBOX_MIN_CHANNEL && max - min <= LETTERBOX_MAX_SPREAD;
}

/** 真实内容的裁剪矩形；无留白 / 判定不安全时返回 null。 */
async function findContentBounds(
  buffer: Buffer,
): Promise<{ left: number; top: number; width: number; height: number } | null> {
  const bg = await topLeftPixel(buffer);
  if (!isLetterboxColor(bg[0], bg[1], bg[2])) return null;

  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const channels = info.channels;
  const isContent = (x: number, y: number): boolean => {
    const i = (y * w + x) * channels;
    return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > BLANK_PIXEL_DIFF;
  };

  let top = -1;
  let bottom = -1;
  let left = -1;
  let right = -1;
  for (let y = 0; y < h && top < 0; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (isContent(x, y)) n++;
    if (n / w >= BLANK_ROW_CONTENT_RATIO) top = y;
  }
  for (let y = h - 1; y >= 0 && bottom < 0; y--) {
    let n = 0;
    for (let x = 0; x < w; x++) if (isContent(x, y)) n++;
    if (n / w >= BLANK_ROW_CONTENT_RATIO) bottom = y;
  }
  for (let x = 0; x < w && left < 0; x++) {
    let n = 0;
    for (let y = 0; y < h; y++) if (isContent(x, y)) n++;
    if (n / h >= BLANK_ROW_CONTENT_RATIO) left = x;
  }
  for (let x = w - 1; x >= 0 && right < 0; x--) {
    let n = 0;
    for (let y = 0; y < h; y++) if (isContent(x, y)) n++;
    if (n / h >= BLANK_ROW_CONTENT_RATIO) right = x;
  }
  if (top < 0 || bottom < 0 || left < 0 || right < 0) return null;

  const width = right - left + 1;
  const height = bottom - top + 1;
  const areaCut = 1 - (width * height) / (w * h);
  if (width < 8 || height < 8 || areaCut > MAX_AREA_CUT || areaCut < MIN_AREA_CUT) return null;
  return { left, top, width, height };
}

/**
 * 把生图 buffer 归一化为「宽 ≤ maxWidth、宽高比 = ratio」的 webp。
 *
 * 先裁掉浅色留白，再按 `fit: cover` 居中裁切；输出尺寸恒为
 * `outW × round(outW * h / w)`，其中 outW = min(裁后宽, maxWidth)。
 * 全程一条 sharp 流水线只编码一次，避免中间转码损失画质。
 */
export async function normalizeGeneratedImage(buffer: Buffer, options: NormalizeImageOptions): Promise<Buffer> {
  const [ratioW, ratioH] = parseRatio(options.ratio);
  const meta = await sharp(buffer).metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  if (!srcW || !srcH) {
    throw new Error('生图元数据缺失（无 width/height），无法归一化尺寸');
  }

  const bounds = await findContentBounds(buffer);
  const sourceW = bounds?.width ?? srcW;
  const outW = Math.max(1, Math.min(sourceW, Math.round(options.maxWidth)));
  const outH = Math.max(1, Math.round((outW * ratioH) / ratioW));

  let pipeline = sharp(buffer);
  if (bounds) pipeline = pipeline.extract(bounds);
  return pipeline.resize(outW, outH, { fit: 'cover' }).webp({ quality: options.quality }).toBuffer();
}
