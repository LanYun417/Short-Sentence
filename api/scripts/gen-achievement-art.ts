/**
 * 成就 AI 卡通大图：给 8 枚高光成就各生成一张软 3D 黏土卡通徽章图。
 *
 * 为什么单独一个脚本：图片是内容资产不是代码，出错重试不影响服务；
 * 种子（prisma/seed.service.ts）已把 artUrl 预填为 `/static/achievements/<code>.png`，
 * 图落盘到 uploads/achievements/ 后三端详情弹窗自动生效，无需改代码、无需入库。
 *
 * 幂等：目标文件已存在就跳过（`--force` 全量重出）。
 *
 * 生图走项目内 AgnesAI（sys_config 里启用的「生图」模型，DB 优先、空值回落 AI_AGNES_*），
 * 与句子配图 / 闯关封面同一条管线；串行 + 限速，避免打爆免费额度。
 *
 * 透明背景：上游接口没有 background 参数，只能提示词里要「clean transparent background」；
 * 出图后若四角颜色一致（纯色底），再从边界洪水填充抠掉，避免徽章压在彩色卡片上带白底。
 *
 * 用法（api/ 目录）：
 *   npm run gen:achievement-art              # 只补缺失的图
 *   npm run gen:achievement-art -- --force   # 全部重新生成
 */
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AiCallLogService } from '../src/common/ai/ai-call-log.service.js';
import { AiBudgetService } from '../src/common/ai/ai-budget.service.js';
import { AiSettingsService } from '../src/common/ai/ai-settings.service.js';
import { ImageGenApiProvider } from '../src/common/ai/image-gen.provider.js';

/** 统一风格前缀（样张 Soft_3D_clay_achievement_badge 已由用户确认方向）。 */
const STYLE_PREFIX =
  'A cute premium achievement badge icon, soft rounded 3D clay / vinyl toy aesthetic, ' +
  'cheerful storybook cartoon illustration, smooth friendly shapes, warm subtle studio lighting, ' +
  'centered, rich but harmonious colors, ';

/** 统一收尾（透明底 + 无文字，喂给移动端徽章位）。 */
const STYLE_SUFFIX =
  ' no text, no letters, no words, isolated on a clean transparent background, ' +
  'suitable as a mobile app achievement art.';

/** 单枚成就大图定义。 */
interface AchievementArt {
  /** 成就 code（同时是文件名与 artUrl 路径段） */
  code: string;
  /** 成就名（日志用） */
  name: string;
  /** 主体意象 + 主色调（提示词主体句） */
  subject: string;
}

/** 8 枚高光成就（与 prisma/seed.service.ts 里 artUrl 预填的 8 个 code 对齐）。 */
const ARTS: AchievementArt[] = [
  {
    code: 'first_step',
    name: '初次落笔',
    subject:
      'The subject is a single friendly footprint pressing into a small glowing open page, sky-blue accent color.',
  },
  {
    code: 'streak_7',
    name: '七日不辍',
    subject: 'The subject is a cozy layered flame with a warm smile-like curve, amber to orange gradient.',
  },
  {
    code: 'streak_30',
    name: '月满',
    subject: 'The subject is a small golden trophy under a gentle full moon, golden palette.',
  },
  {
    code: 'correct_500',
    name: '炉火纯青',
    subject: 'The subject is a shining medal with a refined flame emblem, red and gold palette.',
  },
  {
    code: 'favorite_50',
    name: '藏句成癖',
    subject:
      'The subject is a cluster of sparkling gemstones beside a tiny treasured jewel box, amethyst purple palette.',
  },
  {
    code: 'explorer_all',
    name: '环游',
    subject: 'The subject is a cute mini globe with a tiny winding path around it, teal and green palette.',
  },
  {
    code: 'rank_first',
    name: '榜首加冕',
    subject: 'The subject is a plush crown resting on a winner podium, royal purple and gold palette.',
  },
  {
    code: 'stage_all',
    name: '全境通关',
    subject: 'The subject is a fantasy map scroll with a small checkered flag, emerald green palette.',
  },
];

/** 生图尺寸：方形徽章，2K 档（与句子配图共用档位，上游按 ratio 给方图）。 */
const IMAGE_SIZE = '2K';
const IMAGE_RATIO = '1:1';
/** 入库前缩放到 1024 方图（详情弹窗大图位，再大是浪费）。 */
const IMAGE_MAX_WIDTH = 1024;

/** 两次生图最小间隔（毫秒）：Agnes 免费额度对突发敏感。 */
const MIN_INTERVAL_MS = 12_000;
/** 单张图最多尝试次数（429 指数退避）。 */
const MAX_ATTEMPTS = 4;

/** 输出目录：api/uploads/achievements/（上传根目录，/static/achievements/ 即指向这里）。 */
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'uploads', 'achievements');

/**
 * 去掉纯色背景（保留连通前景）。
 *
 * 上游没有 background 参数，只能提示词里要透明底；真出图时若四角颜色一致即视为纯色底，
 * 从所有边界像素洪水填充，把接触边界的同色连通区 alpha 置 0。
 * 四角不一致（渐变 / 满铺）或已被抠过（四角皆透明）时原样返回。
 */
async function stripFlatBackground(input: Buffer): Promise<{ buffer: Buffer; stripped: boolean }> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) {
    return { buffer: input, stripped: false };
  }
  const at = (x: number, y: number): [number, number, number] => {
    const i = (y * width + x) * 4;
    return [data[i] as number, data[i + 1] as number, data[i + 2] as number];
  };
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  // 已被抠过：四角全透明，无需处理
  const alphaAt = (x: number, y: number): number => data[(y * width + x) * 4 + 3] as number;
  if (
    alphaAt(0, 0) === 0 &&
    alphaAt(width - 1, 0) === 0 &&
    alphaAt(0, height - 1) === 0 &&
    alphaAt(width - 1, height - 1) === 0
  ) {
    return { buffer: input, stripped: false };
  }
  const avg = [0, 1, 2].map((c) => corners.reduce((sum, p) => sum + (p[c] as number), 0) / corners.length);
  const uniform = corners.every((p) => p.every((channel, i) => Math.abs(channel - (avg[i] as number)) <= 12));
  if (!uniform) {
    return { buffer: input, stripped: false };
  }

  /** 颜色与底色差（含抗锯齿过渡带容忍）。 */
  const tolerance = 48;
  const nearBg = (x: number, y: number): boolean => {
    const [r, g, b] = at(x, y);
    return (
      Math.abs(r - (avg[0] as number)) <= tolerance &&
      Math.abs(g - (avg[1] as number)) <= tolerance &&
      Math.abs(b - (avg[2] as number)) <= tolerance
    );
  };
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number): void => {
    const idx = y * width + x;
    if (!visited[idx] && nearBg(x, y)) {
      visited[idx] = 1;
      stack.push(idx);
    }
  };
  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length > 0) {
    const idx = stack.pop() as number;
    const x = idx % width;
    const y = (idx - x) / width;
    data[idx * 4 + 3] = 0;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }

  const out = await sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
  return { buffer: out, stripped: true };
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    // AI 配置优先读 sys_config（与后台「AI 设置」同源），空值回落环境变量
    const aiSettings = new AiSettingsService(prisma);
    await aiSettings.reload();
    const imageGen = new ImageGenApiProvider(new AiCallLogService(prisma), new AiBudgetService(prisma), aiSettings);
    if (!imageGen.enabled) {
      throw new Error('生图能力未配置（AI 设置里添加并启用一个「生图」用途的模型）');
    }

    await mkdir(OUT_DIR, { recursive: true });
    console.log(`[achievement-art] 输出目录：${OUT_DIR}${force ? '（--force 全量重出）' : ''}`);

    let done = 0;
    let skipped = 0;
    let failed = 0;
    let lastStart = 0;

    // 串行：一次只发一张，间隔兜底，绝不给额度添堵
    for (const art of ARTS) {
      const target = join(OUT_DIR, `${art.code}.png`);
      if (existsSync(target) && !force) {
        skipped += 1;
        console.log(`[achievement-art] 跳过 ${art.name}（${art.code}.png 已存在）`);
        continue;
      }

      const prompt = `${STYLE_PREFIX}${art.subject}${STYLE_SUFFIX}`;
      let generated = false;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !generated; attempt += 1) {
        // 限速：保证两次请求之间至少间隔 MIN_INTERVAL_MS
        const wait = Math.max(0, lastStart + MIN_INTERVAL_MS - Date.now());
        if (wait > 0) {
          await new Promise((resolve) => setTimeout(resolve, wait));
        }
        lastStart = Date.now();
        try {
          const image = await imageGen.generate(prompt, { size: IMAGE_SIZE, ratio: IMAGE_RATIO });
          const { buffer, stripped } = await stripFlatBackground(image.buffer);
          const png = await sharp(buffer)
            .resize({ width: IMAGE_MAX_WIDTH, height: IMAGE_MAX_WIDTH, fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer();
          await writeFile(target, png);
          generated = true;
          done += 1;
          console.log(
            `[achievement-art] ✅ ${art.name}（${art.code}.png，${Math.round(png.length / 1024)}KB` +
              `${stripped ? '，已抠纯色底' : ''}）`,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const rateLimited = message.includes('429') || message.includes('rate_limit');
          if (attempt < MAX_ATTEMPTS) {
            const backoff = (rateLimited ? 30_000 : 5_000) * attempt;
            console.warn(
              `[achievement-art] ${art.name} 第 ${attempt} 次失败（${rateLimited ? '限流' : '其他'}），` +
                `${Math.round(backoff / 1000)}s 后重试：${message.slice(0, 140)}`,
            );
            await new Promise((resolve) => setTimeout(resolve, backoff));
            continue;
          }
          failed += 1;
          console.warn(`[achievement-art] ❌ ${art.name} 放弃：${message.slice(0, 160)}`);
        }
      }
    }

    console.log(`[achievement-art] 结束：成功 ${done}，跳过 ${skipped}，失败 ${failed}（共 ${ARTS.length} 枚）`);
    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[achievement-art] 脚本异常退出：', error);
  process.exit(1);
});
