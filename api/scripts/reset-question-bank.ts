/**
 * 题库重置 + 重新生成（破坏性运维脚本）。
 *
 * ⚠️ 破坏性：删除全部题目、答题记录、收藏、生成批次历史，以及题目配图
 *    （数据库记录 + 磁盘文件 + 缩略图缓存）。用户的刷题历史会一并清空——
 *    这是「重新做题库」的必然代价，执行前请确认。
 *
 * 用法：
 *   npm run reset:question-bank            # 预演：只打印将删除什么，不动数据
 *   npm run reset:question-bank -- --yes   # 执行
 *   RESET_TARGET=100 ...                   # 重新生成的目标题数（默认 100）
 *
 * 为什么手动实例化而不是引导 Nest 应用上下文：
 * AppModule 里多个模块的 onModuleInit 依赖 HTTP 服务器（FileLoggerService 的 Prisma
 * 事件订阅、TaskService 的调度初始化），`createApplicationContext` 起不来。
 * 这里按依赖链手动 new 出所需服务——用到的都是同一套实现，行为完全一致。
 */
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FileService } from '../src/common/file/file.service.js';
import { ImageScaleService } from '../src/common/file/file-guards.js';
import { AiCallLogService } from '../src/common/ai/ai-call-log.service.js';
import { AgnesSentenceProvider } from '../src/common/ai/agnes-sentence.provider.js';
import { AgnesImageProvider } from '../src/common/ai/agnes-image.provider.js';
import { SentenceGenService } from '../src/modules/sentence/sentence-gen.service.js';
import { FilesService } from '../src/modules/files/files.service.js';

/** 重新生成的目标题数。 */
const TARGET = Math.max(1, Number(process.env.RESET_TARGET ?? 100));
/** 是否真删（不带 --yes 只预演）。 */
const CONFIRMED = process.argv.includes('--yes');

/** 轮询间隔（毫秒）。 */
const POLL_INTERVAL = 5000;

async function main(): Promise<void> {
  console.log(`目标题数：${TARGET}｜模式：${CONFIRMED ? '执行（真删）' : '预演（不改数据）'}`);

  const prisma = new PrismaService();
  await prisma.$connect();

  // 手动装配：删文件用 FilesService（磁盘 + 缩略图缓存），生题用 SentenceGenService
  const files = new FilesService(prisma, new ImageScaleService());
  const aiCallLog = new AiCallLogService(prisma);
  const gen = new SentenceGenService(
    prisma,
    new AgnesSentenceProvider(aiCallLog),
    new AgnesImageProvider(aiCallLog),
    new FileService(prisma),
  );

  try {
    // 1. 先收集配图文件 id——删题之后就关联不到了
    const referenced = await prisma.sentence.findMany({
      where: { imageFileId: { gt: 0n } },
      select: { imageFileId: true },
    });
    const referencedIds = [...new Set(referenced.map((row) => Number(row.imageFileId)))];

    // 孤儿配图：命名形如 `<题目id>.webp` 且已无题目引用（生图失败/中断的残留）。
    // 注意：Prisma 7 的 MySQL connector 不支持 regex 过滤，先用 endsWith 缩小范围再在内存里精确匹配。
    const webpRows = await prisma.file.findMany({
      where: { fileName: { endsWith: '.webp' } },
      select: { id: true, fileName: true },
    });
    const orphanIds = webpRows
      .filter((row) => /^[0-9]+\.webp$/.test(row.fileName))
      .map((row) => Number(row.id))
      .filter((id) => !referencedIds.includes(id));

    const [sentenceCount, recordCount, favoriteCount, genTaskCount] = await Promise.all([
      prisma.sentence.count(),
      prisma.sentenceRecord.count(),
      prisma.sentenceFavorite.count(),
      prisma.sentenceGenTask.count(),
    ]);
    console.log(
      `将删除：题目 ${sentenceCount} / 答题记录 ${recordCount} / 收藏 ${favoriteCount} / 生成批次 ${genTaskCount}\n` +
        `将删除配图文件：被题目引用 ${referencedIds.length} + 孤儿 ${orphanIds.length}`,
    );

    if (!CONFIRMED) {
      console.log('预演结束（未改动任何数据）。确认无误后加 --yes 执行。');
      return;
    }

    // 2. 按外键依赖顺序清库：record / favorite 依赖 sentence，必须先删
    const records = await prisma.sentenceRecord.deleteMany({});
    const favorites = await prisma.sentenceFavorite.deleteMany({});
    const genTasks = await prisma.sentenceGenTask.deleteMany({});
    const sentences = await prisma.sentence.deleteMany({});
    console.log(
      `已删：题目 ${sentences.count} / 答题记录 ${records.count} / 收藏 ${favorites.count} / 生成批次 ${genTasks.count}`,
    );

    // 3. 删配图（数据库记录 + 磁盘文件 + 缩略图缓存，逻辑复用 FilesService）
    const allFileIds = [...referencedIds, ...orphanIds];
    let removed = 0;
    for (const id of allFileIds) {
      try {
        await files.deleteFile(id);
        removed += 1;
      } catch (error) {
        console.warn(`  文件 ${id} 删除失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    console.log(`已删配图文件：${removed}/${allFileIds.length}`);

    // 4. 触发重新生成
    const { taskId } = await gen.triggerManual(TARGET);
    console.log(`已触发生成任务 #${taskId}，开始轮询进度（文本与图片分别计数）…`);

    // 5. 轮询批次进度，直到 success / failed
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      const task = await prisma.sentenceGenTask.findUnique({ where: { id: BigInt(taskId) } });
      if (!task) {
        console.warn('批次记录消失，停止轮询');
        break;
      }
      const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      console.log(
        `  [${now}] ${task.status}｜文本 ${task.textDone}/${task.targetCount}｜图片 ${task.imageDone}｜失败 ${task.failCount}`,
      );
      if (task.status === 'success' || task.status === 'failed') {
        console.log(task.status === 'success' ? '✓ 生成完成' : `✗ 生成失败：${task.errorMessage ?? '未知原因'}`);
        break;
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('重置失败：', error);
  process.exit(1);
});
