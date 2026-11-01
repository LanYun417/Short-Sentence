/**
 * 节日题库收尾脚本：把「题目没满 / 配图缺失」的缺口补齐（运维用）。
 *
 * 背景：Agnes 接口有**按小时的用量上限**（超额返回 429「请在 xx:00 之后重试」），
 * 一次跑不完 21 个节日 × 100 题（含配图与图像审核）。所以做成**自愈循环**：
 * 每轮先补文本、再补配图；一轮没跑完就等到下一个整点后再来一轮，直到全部达标
 * 或达到轮次上限。单个节日失败不终止整轮，下一轮继续。
 *
 * 用法（api/ 目录，须用 tsc 编译后 node 跑，禁用 tsx——tsx 不产出装饰器元数据）：
 *   npx tsc -p tsconfig.scripts.json
 *   node --env-file=.env dist/scripts/finish-festival-banks.js
 *
 * 可选环境变量：
 *   SENTENCE_FESTIVAL_TARGET  每节日目标题数（默认 100）
 *   FINISH_MAX_ATTEMPTS       最大轮次（默认 30）
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

/** 等到「下一个整点 + 2 分钟」，给按小时重置的用量配额留出余量。 */
function msUntilNextHourBuffer(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 2, 0, 0);
  return Math.max(60_000, next.getTime() - now.getTime());
}

async function main(): Promise<void> {
  const target = Number(process.env.SENTENCE_FESTIVAL_TARGET) || 100;
  const MAX_ATTEMPTS = Number(process.env.FINISH_MAX_ATTEMPTS) || 30;
  // 允许残留的「真·审不过的图」数量（如日历文字可见、场景与提示不符）：这类重出多少次都会被
  // fail-closed 审核拦下，属预期不下发，不该因此判定「没做完」而永远不生成封面。
  const MISSING_TOLERANCE = Number(process.env.FINISH_MISSING_TOLERANCE) || 40;
  // 可选：启动前先等待 N 分钟（用于当前正处于「配额受限窗口」时，避免开工就被 429 空转）。
  const startDelayMin = Number(process.env.FINISH_START_DELAY_MIN) || 0;
  const app = await NestFactory.create(AppModule, new OkExpressAdapter());
  await app.init();
  const gen = app.get(SentenceGenService);
  const prisma = app.get(PrismaService);
  const year = new Date().getFullYear();
  const festivals = allFestivalsOf(year);

  const deleted = await prisma.sentenceGenTask.deleteMany({ where: { festivalName: { not: null } } });
  console.log(`[finish-banks] 已清理历史节日批次 ${deleted.count} 条`);

  if (startDelayMin > 0) {
    console.log(`[finish-banks] 先等待 ${startDelayMin} 分钟再开工（避开当前配额受限窗口）…`);
    await sleep(startDelayMin * 60_000);
    console.log(`[finish-banks] 等待结束，开始工作（${new Date().toLocaleTimeString()}）。`);
  }

  const missingCount = async (): Promise<number> => {
    const rows = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*) AS c FROM sentence
      WHERE retired_at IS NULL AND status <> 'offline'
        AND (image_file_id IS NULL OR image_file_id = 0
             OR status IN ('image_rejected','pending_image'))`;
    return Number(rows[0]?.c ?? 0);
  };

  const textCount = async (name: string): Promise<number> => {
    const cat = await prisma.sentenceCategory.findFirst({ where: { name } });
    if (!cat) return 0;
    return prisma.sentence.count({ where: { categoryId: cat.id, retiredAt: null } });
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`\n[finish-banks] ===== 第 ${attempt} 轮（${new Date().toLocaleTimeString()}）=====`);

    // ---- Phase A：文本补齐（逐节日，单节失败不影响其它）----
    for (const f of festivals) {
      const count = await textCount(f.name);
      if (count >= target) continue;
      console.log(`[finish-banks] >>> ${f.name} 仅 ${count} 题，重铺至 ${target}…`);
      try {
        const res = await gen.generateFestivalByName(f.name);
        console.log(`[finish-banks] <<< ${f.name} 完成（taskId=${res.taskId}）`);
      } catch (e) {
        console.log(`[finish-banks] !!! ${f.name} 生题失败（本轮跳过）：${(e as Error).message}`);
      }
    }

    // ---- Phase B：配图补齐 ----
    // 仅首轮把卡在 pending_image 的（被中断留下）放行成 ready；后续轮不要重置，
    // 否则会把仍在队列里重试的任务状态打乱（导致重复入队）。
    if (attempt === 1) {
      await prisma.sentence.updateMany({
        where: { retiredAt: null, status: 'pending_image' },
        data: { status: 'ready' },
      });
    }
    const missingRows = await prisma.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM sentence
      WHERE retired_at IS NULL AND status <> 'offline'
        AND (image_file_id IS NULL OR image_file_id = 0
             OR status IN ('image_rejected','pending_image'))`;
    if (missingRows.length === 0) {
      console.log('[finish-banks] 本轮无缺图题目');
    } else {
      console.log(`[finish-banks] 本轮缺图 ${missingRows.length} 题，重新生图…`);
      const ids = missingRows.map((r) => Number(r.id));
      const { accepted, skipped } = await gen.regenerateImages(ids);
      console.log(`[finish-banks] 受理 ${accepted.length}，跳过 ${skipped.length}`);
      // 轮询直到这批 pending_image 清空（单轮上限 150 分钟，够在一个新鲜配额窗口内补完）
      const deadline = Date.now() + 150 * 60 * 1000;
      while (Date.now() < deadline) {
        const pending = await prisma.sentence.count({
          where: { id: { in: missingRows.map((r) => r.id) }, status: 'pending_image' },
        });
        if (pending === 0) break;
        await sleep(5000);
      }
    }

    // ---- 收敛判定 ----
    let allTextOk = true;
    for (const f of festivals) {
      if ((await textCount(f.name)) < target) {
        allTextOk = false;
        break;
      }
    }
    const missing = await missingCount();
    console.log(`[finish-banks] 第 ${attempt} 轮结束：文本${allTextOk ? '全部达标' : '仍有不足'}，缺图 ${missing} 题`);

    if (allTextOk && missing <= MISSING_TOLERANCE) {
      break;
    }
    const wait = msUntilNextHourBuffer();
    console.log(`[finish-banks] 等待 ${Math.round(wait / 60000)} 分钟后重试（避开按小时配额上限）…`);
    await sleep(wait);
  }

  // 无论是否「完全达标」都生成封面：封面与单题配图独立，且残留缺图多半是真·审不过的图。
  const finalMissing = await missingCount();
  console.log(
    `\n[finish-banks] 补图阶段结束：剩余缺图 ${finalMissing} 题（≤${MISSING_TOLERANCE} 视为可接受的审核残留）。`,
  );
  console.log('[finish-banks] 生成全部节日封面…');
  try {
    const covers = await gen.generateFestivalCovers();
    console.log('[finish-banks] 封面结果：', safe(covers));
  } catch (e) {
    console.log(`[finish-banks] 封面生成失败：${(e as Error).message}`);
  }

  await app.close();
  console.log('\n[finish-banks] 全部完成。');
}

main().catch((error) => {
  console.error('[finish-banks] 失败：', error);
  process.exit(1);
});
