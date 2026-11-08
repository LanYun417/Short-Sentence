/**
 * 本地配图修复脚本：扫描「状态 ready、但磁盘上的配图文件已丢失」的题目，
 * 复用 SentenceGenService.regenerateImages 重新生图，直到全部补回或达到轮次上限。
 *
 * 适用场景：本机 uploads/webp 被 git clean / 重新克隆 / 卷重置清掉，但 sys_file 记录还在，
 * 于是题目 status=ready、imageFileId 指向一个不存在的文件，前端拿到 404 → 破损图。
 *
 * 机制（与 finish-festival-banks.ts 同源）：
 * - 复用进程内唯一的生图信号量（AI_IMAGE_CONCURRENCY=2）+ Agnes 限流退避，不会打爆配额；
 * - regenerateImages 是「受理即返回」：置 pending_image、后台生图、成功回写 ready、失败回滚原状态；
 * - 本轮没补完就等到下一个整点窗口再扫一轮（Agnes 按小时有用量上限）。
 *
 * 用法（api/ 目录，必须 tsc 编译后 node 跑，禁用 tsx —— 否则拿不到装饰器元数据）：
 *   npx tsc -p tsconfig.scripts.json
 *   node --env-file=.env dist/scripts/repair-missing-images.js
 *
 * 可选环境变量：
 *   REPAIR_MAX_ATTEMPTS   最大轮次（默认 15）
 *   REPAIR_BATCH          每批受理题数（默认 200，控制单次 pending 规模）
 *   REPAIR_TOLERANCE      收敛容忍的残留缺失数（默认 30，多半是真·审不过的图）
 */
import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { OkExpressAdapter } from '../src/common/http/ok-express.adapter.js';
import { SentenceGenService } from '../src/modules/sentence/sentence-gen.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 等到「下一个整点 + 2 分钟」，给按小时重置的用量配额留出余量。 */
function msUntilNextHourBuffer(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 2, 0, 0);
  return Math.max(60_000, next.getTime() - now.getTime());
}

/** 扫描所有 ready 且未退场、imageFileId>0，但磁盘文件不存在的题 id。 */
async function findMissingOnDisk(prisma: PrismaService): Promise<number[]> {
  const rows = await prisma.$queryRaw<Array<{ id: bigint; file_path: string | null }>>`
    SELECT s.id, f.file_path
    FROM sentence s
    LEFT JOIN sys_file f ON f.id = s.image_file_id
    WHERE s.status = 'ready'
      AND s.retired_at IS NULL
      AND s.image_file_id > 0`;
  const missing: number[] = [];
  for (const r of rows) {
    if (!r.file_path) {
      missing.push(Number(r.id));
      continue;
    }
    if (!existsSync(join(process.cwd(), r.file_path))) {
      missing.push(Number(r.id));
    }
  }
  return missing;
}

async function main(): Promise<void> {
  const MAX_ATTEMPTS = Number(process.env.REPAIR_MAX_ATTEMPTS) || 15;
  const BATCH = Number(process.env.REPAIR_BATCH) || 200;
  const TOLERANCE = Number(process.env.REPAIR_TOLERANCE) || 30;

  const app = await NestFactory.create(AppModule, new OkExpressAdapter());
  await app.init();
  const gen = app.get(SentenceGenService);
  const prisma = app.get(PrismaService);

  console.log(`[repair-img] 启动：最大轮次=${MAX_ATTEMPTS} 每批=${BATCH} 容忍残留=${TOLERANCE}`);

  let lastMissing = -1;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const missing = await findMissingOnDisk(prisma);
    console.log(`[repair-img] 第 ${attempt}/${MAX_ATTEMPTS} 轮：磁盘缺失的 ready 题 ${missing.length} 张`);

    if (missing.length <= TOLERANCE) {
      console.log(`[repair-img] 缺失 ${missing.length} ≤ 容忍 ${TOLERANCE}，视为收敛，结束`);
      break;
    }

    // 分批受理，每批轮询 pending_image 清空（信号量并发 2 在 regenerateImages 内部已保证）
    for (let i = 0; i < missing.length; i += BATCH) {
      const chunk = missing.slice(i, i + BATCH);
      try {
        const res = await gen.regenerateImages(chunk);
        console.log(`[repair-img] 受理 ${res.accepted.length}，跳过 ${res.skipped.length}`);
      } catch (e) {
        console.log(`[repair-img] !!! 受理异常（本轮跳过此批）：${(e as Error).message}`);
        await sleep(30_000);
        continue;
      }

      const deadline = Date.now() + 150 * 60 * 1000;
      while (Date.now() < deadline) {
        const pending = await prisma.sentence.count({
          where: { id: { in: chunk.map((n) => BigInt(n)) }, status: 'pending_image' },
        });
        if (pending === 0) break;
        await sleep(5000);
      }
    }

    // 连续两轮数量不降且仍超容忍 → 余下的多半是审核不通过 / 配额持续受限，停止避免空转
    if (lastMissing !== -1 && missing.length >= lastMissing) {
      console.log(`[repair-img] 缺失数未下降（${lastMissing} → ${missing.length}），余下疑似审核残留或配额卡死，停止`);
      break;
    }
    lastMissing = missing.length;

    const wait = msUntilNextHourBuffer();
    console.log(`[repair-img] 等待 ${Math.round(wait / 60000)} 分钟进入下一整点窗口…`);
    await sleep(wait);
  }

  const finalMissing = await findMissingOnDisk(prisma);
  console.log(`[repair-img] 结束：仍缺失 ${finalMissing.length} 张（≤${TOLERANCE} 视为可接受）`);
  await app.close();
}

main().catch((e) => {
  console.error('[repair-img] 脚本异常退出：', e);
  process.exit(1);
});
