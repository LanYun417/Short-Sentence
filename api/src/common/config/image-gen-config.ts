/**
 * 配图生成参数（尺寸档位 / 宽高比 / 入库缩放）。
 *
 * 为什么单独一个文件：`scripts/seed-sentences-manual.ts`（人工题库初始化）也要用这几个值，
 * 而 `config.ts` 是服务端配置中心，模块加载时就会校验 JWT 等必填项，缺一项直接抛错拒绝启动。
 * 让 CLI 脚本 import `config.ts` 就会被服务端的必填项拦住——与 `db-config.ts` 同一类问题，
 * `test/db-config.spec.ts` 对其有硬性约束。
 *
 * 约定：默认值只在这里写一份，`config.ts` 的 `sentence` 段引用本模块，
 * 不要在两处各写一套（见 03-环境与配置 的规则）。
 */
import { toNumber } from './env-parse.js';

export const imageGenConfig = {
  /** 配图尺寸档位与宽高比（16:9 卡片图，2K 档输出 2624x1472） */
  imageSize: process.env.SENTENCE_IMAGE_SIZE ?? '2K',
  imageRatio: process.env.SENTENCE_IMAGE_RATIO ?? '16:9',
  /** 入库前缩放上限（宽 px）与 webp 质量 */
  imageMaxWidth: toNumber(process.env.SENTENCE_IMAGE_MAX_WIDTH, 1280),
  imageQuality: Math.min(100, Math.max(1, toNumber(process.env.SENTENCE_IMAGE_QUALITY, 80))),
} as const;
