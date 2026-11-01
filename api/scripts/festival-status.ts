import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { OkExpressAdapter } from '../src/common/http/ok-express.adapter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { allFestivalsOf } from '../src/common/calendar/festivals.js';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, new OkExpressAdapter());
  await app.init();
  const prisma = app.get(PrismaService);
  const year = new Date().getFullYear();

  let totalMissing = 0;
  let totalReady = 0;
  for (const f of allFestivalsOf(year)) {
    const cat = await prisma.sentenceCategory.findFirst({ where: { name: f.name } });
    if (!cat) {
      console.log(`${f.name}: (无分类/0 题)`);
      continue;
    }
    const rows = await prisma.$queryRaw<Array<{ status: string; c: bigint }>>`
      SELECT status, COUNT(*) AS c FROM sentence
      WHERE category_id = ${cat.id} AND retired_at IS NULL
      GROUP BY status`;
    const by: Record<string, number> = {};
    let ready = 0;
    for (const r of rows) {
      by[r.status] = Number(r.c);
      if (r.status === 'ready') ready = Number(r.c);
    }
    const imgRows = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*) AS c FROM sentence
      WHERE category_id = ${cat.id} AND retired_at IS NULL
        AND image_file_id IS NOT NULL AND image_file_id <> 0`;
    const withImg = Number(imgRows[0]?.c ?? 0);
    const missing = ready - withImg + (by['image_rejected'] ?? 0) + (by['pending_image'] ?? 0);
    totalMissing += Math.max(0, missing);
    totalReady += ready;
    console.log(
      `${f.name}: ready=${ready} 有图=${withImg} 缺图≈${Math.max(0, missing)} ` +
        `(rejected=${by['image_rejected'] ?? 0} pending=${by['pending_image'] ?? 0})`,
    );
  }
  console.log(`\n汇总：ready 合计=${totalReady}，估算缺图=${totalMissing}`);
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
