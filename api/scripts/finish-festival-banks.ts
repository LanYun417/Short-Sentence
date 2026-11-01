/**
 * 节日题库收尾脚本：把「题目没满」的缺口补齐（运维用）。
 *
 * 设计：直接拉起 Nest 上下文，复用 SentenceGenService 的同步等待接口，分三阶段：
 *   Phase A  文本补齐：对「非退役题目数 < 目标」的节日调 generateFestivalByName，
 *           退役旧题并重铺到目标数量（含配图，已用修复后的图像审核）。已达标（>=目标）的
 *           节日（如元旦/情人节/妇女节等）跳过，保留其已有文本，避免无谓重跑。
 *   Phase B  配图补齐：全局扫所有「缺图」题目（pending_image / image_rejected / ready 无图），
 *           走 regenerateImages 重新生图（修复后的审核更宽容，家庭/朋友/儿童不再误杀），
 *           轮询直到 pending_image 清空；若仍有残留（限频 429 等暂时性故障）多跑几轮收敛。
 *   Phase C  封面：generateFestivalCovers 一次性生成全部节日专属封面。
 *
 * 用法（api/ 目录，须用 tsc 编译后 node 跑，禁止 tsx——tsx 不产出装饰器元数据）：
 *   npx tsc -p tsconfig.scripts.json
 *   node --env-file=.env dist/scripts/finish-festival-banks.js
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { OkExpressAdapter } from '../src/common/http/ok-express.adapter.js';
import { SentenceGenService } from '../src/modules/sentence/sentence-gen.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { allFestivalsOf } from '../src/common/calendar/festivals.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const safe = (v: unknown) => JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() : val));

async function main(): Promise<void> {
  const target = Number(process.env.SENTENCE_FESTIVAL_TARGET) || 100;
  const app = await NestFactory.create(AppModule, new OkExpressAdapter());
  await app.init();
  const gen = app.get(SentenceGenService);
  const prisma = app.get(PrismaService);
  const year = new Date().getFullYear();

  // 清掉历史节日批次，避免 prepareFestivalTask 因「当天已有 success 批次」而冲突
  const deleted = await prisma.sentenceGenTask.deleteMany({ where: { festivalName: { not: null } } });
  console.log(`[finish-banks] 已清理历史节日批次 ${deleted.count} 条`);

  // ---- Phase A：文本补齐（低于目标的节日重铺）----
  const festivals = allFestivalsOf(year);
  console.log(`[finish-banks] Phase A：检查 ${festivals.length} 个节日的文本数量（目标 ${target}）`);
  for (const f of festivals) {
    const cat = await prisma.sentenceCategory.findFirst({ where: { name: f.name } });
    const count = cat ? await prisma.sentence.count({ where: { categoryId: cat.id, retiredAt: null } }) : 0;
    if (count >= target) {
      console.log(`[finish-banks]   ${f.name} 已 ${count} 题，跳过文本补齐`);
      continue;
    }
    console.log(`[finish-banks] >>> ${f.name} 仅 ${count} 题，重铺至 ${target}…`);
    const res = await gen.generateFestivalByName(f.name);
    console.log(`[finish-banks] <<< ${f.name} 完成（taskId=${res.taskId}）`);
  }

  // ---- Phase B：配图补齐（全局轮询）----
  console.log('\n[finish-banks] Phase B：补齐所有缺图题目');
  const MAX_PASSES = 6;
  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    // 先把卡在 pending_image 的（上次中断遗留）放行成 ready，让 regenerateImages 能接收
    await prisma.sentence.updateMany({
      where: { retiredAt: null, status: 'pending_image' },
      data: { status: 'ready' },
    });
    const missingRows = await prisma.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM sentence
      WHERE retired_at IS NULL AND status <> 'offline'
        AND (image_file_id IS NULL OR image_file_id = 0
             OR status IN ('image_rejected','pending_image'))`;
    const missing = missingRows.map((r) => ({ id: r.id }));
    if (missing.length === 0) {
      console.log(`[finish-banks]   Pass ${pass}：无缺图题目，配图补齐完成`);
      break;
    }
    console.log(`[finish-banks]   Pass ${pass}：缺图 ${missing.length} 题，重新生图…`);
    const ids = missing.map((m) => Number(m.id));
    const { accepted, skipped } = await gen.regenerateImages(ids);
    console.log(`[finish-banks]   受理 ${accepted.length}，跳过 ${skipped.length}`);

    // 轮询直到这批的 pending_image 清空
    const deadline = Date.now() + 3 * 60 * 60 * 1000; // 单轮最多 3 小时
    while (Date.now() < deadline) {
      const pending = await prisma.sentence.count({
        where: { id: { in: missing.map((m) => m.id) }, status: 'pending_image' },
      });
      if (pending === 0) break;
      await sleep(5000);
    }
    const remainingRows = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*) AS c FROM sentence
      WHERE retired_at IS NULL AND status <> 'offline'
        AND (image_file_id IS NULL OR image_file_id = 0
             OR status IN ('image_rejected','pending_image'))`;
    const remaining = Number(remainingRows[0]?.c ?? 0);
    console.log(`[finish-banks]   Pass ${pass} 结束，仍缺图 ${remaining} 题`);
    if (remaining === 0) break;
    await sleep(2000);
  }

  // ---- Phase C：封面 ----
  console.log('\n[finish-banks] Phase C：生成全部节日封面');
  const covers = await gen.generateFestivalCovers();
  console.log('[finish-banks] 封面结果：', safe(covers));

  await app.close();
  console.log('\n[finish-banks] 全部完成。');
}

main().catch((error) => {
  console.error('[finish-banks] 失败：', error);
  process.exit(1);
});
