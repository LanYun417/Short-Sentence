/**
 * 节日题库一次性生成脚本（运维 / 校验用）。
 *
 * 为什么是脚本而非只靠 HTTP 端点：
 * - 端点 gen/festival / gen/festivals 是「即发即忘」，任务在常驻 server 后台跑，
 *   脚本外拿不到「整批跑完」的信号；
 * - 本脚本直接拉起 Nest 应用上下文，调用 SentenceGenService 的同步等待接口，
 *   串行把指定节日题库铺满，再生成全部节日封面，跑完才退出，便于观察与中断续跑。
 *
 * 用法（在 api/ 目录下）：
 *   npx tsx scripts/gen-festival-banks.ts 春节 中秋节   # 只铺这两个节日（验证用）
 *   npx tsx scripts/gen-festival-banks.ts all          # 铺满全年所有节日
 *   npx tsx scripts/gen-festival-banks.ts covers       # 只生成全部节日专属封面
 *   npx tsx scripts/gen-festival-banks.ts all --skip-covers
 *
 * 中断后续跑：每个节日按 (bizDate, categoryId) 幂等建批，已就绪的题不会重复生成，
 * 失败/中断的批次重跑会续生成剩余数量，因此可随时 Ctrl-C 后重跑补齐。
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { OkExpressAdapter } from '../src/common/http/ok-express.adapter.js';
import { SentenceGenService } from '../src/modules/sentence/sentence-gen.service.js';
import { allFestivalsOf } from '../src/common/calendar/festivals.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const skipCovers = args.includes('--skip-covers');
  const positional = args.filter((a) => a !== '--skip-covers');

  // 与常驻 server 完全一致的工厂（自定义适配器），只 init 不 listen，避免重复占用端口，
  // 同时复用 server 那套全局模块解析顺序（createApplicationContext 在全局模块上解析差异会导致
  // FileLoggerService 注入的 PrismaService 为 undefined）。
  const app = await NestFactory.create(AppModule, new OkExpressAdapter());
  await app.init();
  const gen = app.get(SentenceGenService);
  const year = new Date().getFullYear();

  if (positional[0] === 'covers') {
    console.log('[festival-banks] 仅生成全部节日封面…');
    const result = await gen.generateFestivalCovers();
    console.log('[festival-banks] 封面完成：', JSON.stringify(result));
    await app.close();
    return;
  }

  const names =
    positional.length === 0 || positional[0] === 'all' ? allFestivalsOf(year).map((f) => f.name) : positional;

  console.log(`[festival-banks] 目标节日（${names.length} 个）：${names.join('、')}`);

  for (const name of names) {
    console.log(`\n[festival-banks] >>> 开始生成「${name}」题库`);
    const res = await gen.generateFestivalByName(name);
    console.log(`[festival-banks] <<< 完成「${name}」（taskId=${res.taskId}）`);
  }

  if (!skipCovers) {
    console.log('\n[festival-banks] 生成全部节日专属封面…');
    const covers = await gen.generateFestivalCovers();
    console.log('[festival-banks] 封面结果：', JSON.stringify(covers));
  }

  await app.close();
  console.log('\n[festival-banks] 全部完成。');
}

main().catch((error) => {
  console.error('[festival-banks] 生成失败：', error);
  process.exit(1);
});
