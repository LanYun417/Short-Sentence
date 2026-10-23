/**
 * 词根词典服务（客户端）。
 * 模块职责：按单词搜索 / 查词（未命中实时 AI 解析并入库）/ 每日批量入库。
 *
 * 设计要点：
 * - **缓存优先**：命中 word_root 直接返回，避免重复消耗上游配额；
 * - **服务端权威**：解析结果由后端生成并落库，客户端只传单词；
 * - **限速友好**：每日入库逐条串行 + 指数退避（上游对突发很敏感）。
 */
import { Injectable, Logger } from '@nestjs/common';
import { config } from '../../../common/config/config.js';
import { AiCallLogService } from '../../../common/ai/ai-call-log.service.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

/** 词根构件。 */
export interface WordPart {
  /** 类型：prefix 前缀 / root 词根 / suffix 后缀 */
  type: string;
  /** 文本（如 un-） */
  text: string;
  /** 含义 */
  meaning: string;
}

/** 结构化解析结果。 */
export interface WordRootAnalysis {
  phonetic?: string;
  meaning?: string;
  parts?: WordPart[];
  explanation?: string;
  related?: string[];
}

/** 对外返回的词条。 */
export interface WordRootItem {
  word: string;
  phonetic: string | null;
  meaning: string | null;
  parts: WordPart[];
  explanation: string;
  related: string[];
  source: string;
  searchCount: number;
}

/** 每日入库默认条数。 */
const DAILY_INGEST_LIMIT = 100;
/** 两次上游请求之间的最小间隔（毫秒）。 */
const MIN_INTERVAL_MS = 4_000;
/** 单条最多尝试次数。 */
const MAX_ATTEMPTS = 4;

/** 词根解析提示词（要求严格 JSON，便于落库与前端渲染）。 */
const SYSTEM_PROMPT = [
  '你是英语词源学老师。用户给出一个英文单词，请拆解它的词根、前缀、后缀，并给出中文释义。',
  '只输出一个 JSON 对象，不要 markdown 代码块、不要任何解释文字。JSON 结构：',
  '{"phonetic":"/.../","meaning":"中文释义（含词性，如 adj. 不可避免的）","parts":[{"type":"prefix|root|suffix","text":"un-","meaning":"否定"}],"explanation":"一句话说明这个词是怎么构成的","related":["同根词1","同根词2"]}',
  'parts 按单词从左到右顺序排列；若某词没有明显词缀，parts 至少给出词根。',
].join('\n');

@Injectable()
export class WordRootService {
  private readonly logger = new Logger(WordRootService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiCallLog: AiCallLogService,
  ) {}

  /** 搜索：按包含匹配，按热度排序（关键词为空时返回热门词）。 */
  async search(keyword: string): Promise<WordRootItem[]> {
    const q = keyword.trim().toLowerCase();
    const rows = await this.prisma.wordRoot.findMany({
      where: q ? { word: { contains: q } } : {},
      orderBy: [{ searchCount: 'desc' }, { word: 'asc' }],
      take: 20,
    });
    return rows.map((row) => this.toItem(row));
  }

  /** 查词：命中缓存直接返回并累加热度；未命中则实时解析并入库。 */
  async lookup(word: string): Promise<WordRootItem> {
    const normalized = this.normalize(word);
    const cached = await this.prisma.wordRoot.findUnique({ where: { word: normalized } });
    if (cached) {
      await this.prisma.wordRoot.update({
        where: { word: normalized },
        data: { searchCount: { increment: 1 } },
      });
      return this.toItem(cached);
    }
    const analysis = await this.analyze(normalized);
    const row = await this.prisma.wordRoot.create({
      data: {
        word: normalized,
        phonetic: analysis.phonetic?.slice(0, 120) ?? null,
        meaning: analysis.meaning?.slice(0, 300) ?? null,
        analysis: analysis as unknown as object,
        source: 'ai',
        searchCount: 1,
      },
    });
    return this.toItem(row);
  }

  /**
   * 每日入库：从题库句子里抽未解析的单词，逐条解析并入库。
   * 为什么从题库抽词：这些词是用户真实会遇到的，词典与内容天然对齐。
   */
  async ingestDaily(limit = DAILY_INGEST_LIMIT): Promise<{ created: number; failed: number }> {
    const candidates = await this.pickCandidates(limit);
    if (candidates.length === 0) {
      this.logger.log('[WordRoot] 没有待入库的单词');
      return { created: 0, failed: 0 };
    }
    this.logger.log(`[WordRoot] 每日入库开始，候选 ${candidates.length} 个`);

    let created = 0;
    let failed = 0;
    let lastStart = 0;

    for (const word of candidates) {
      // 限速：两次请求之间至少间隔 MIN_INTERVAL_MS
      const wait = Math.max(0, lastStart + MIN_INTERVAL_MS - Date.now());
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      lastStart = Date.now();

      let analysis: WordRootAnalysis | null = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          analysis = await this.analyze(word);
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const rateLimited = message.includes('429');
          if (attempt < MAX_ATTEMPTS) {
            const backoff = (rateLimited ? 30_000 : 5_000) * attempt;
            this.logger.warn(
              `[WordRoot] ${word} 第 ${attempt} 次失败，${backoff / 1000}s 后重试：${message.slice(0, 100)}`,
            );
            await new Promise((resolve) => setTimeout(resolve, backoff));
            continue;
          }
          failed += 1;
          this.logger.warn(`[WordRoot] ${word} 放弃：${message.slice(0, 120)}`);
        }
      }
      if (!analysis) {
        continue;
      }
      try {
        await this.prisma.wordRoot.create({
          data: {
            word,
            phonetic: analysis.phonetic?.slice(0, 120) ?? null,
            meaning: analysis.meaning?.slice(0, 300) ?? null,
            analysis: analysis as unknown as object,
            source: 'daily',
          },
        });
        created += 1;
      } catch {
        // 并发/重复时唯一键冲突：忽略即可
      }
    }

    this.logger.log(`[WordRoot] 每日入库完成：成功 ${created}，失败 ${failed}`);
    return { created, failed };
  }

  /** 从题库句子里抽取候选单词（长度 ≥ 4、纯字母、尚未入库）。 */
  private async pickCandidates(limit: number): Promise<string[]> {
    const rows = await this.prisma.sentence.findMany({
      where: { status: 'ready' },
      select: { sentenceEn: true },
      take: 400,
    });
    const existing = new Set((await this.prisma.wordRoot.findMany({ select: { word: true } })).map((row) => row.word));
    const stopWords = new Set([
      'this',
      'that',
      'these',
      'those',
      'there',
      'their',
      'them',
      'then',
      'than',
      'with',
      'have',
      'been',
      'being',
      'will',
      'would',
      'could',
      'should',
      'about',
      'what',
      'when',
      'where',
      'which',
      'while',
      'your',
      'yours',
      'from',
      'into',
      'just',
      'like',
      'make',
      'made',
      'much',
      'many',
      'more',
      'most',
      'some',
      'such',
      'very',
      'well',
      'were',
      'here',
      'they',
      'does',
      'did',
      'doing',
      'done',
      'because',
      'before',
      'after',
      'again',
      'still',
    ]);
    const picked = new Set<string>();
    for (const row of rows) {
      for (const raw of row.sentenceEn.toLowerCase().split(/[^a-z]+/)) {
        if (raw.length < 4 || stopWords.has(raw) || existing.has(raw) || picked.has(raw)) {
          continue;
        }
        picked.add(raw);
        if (picked.size >= limit) {
          return [...picked];
        }
      }
    }
    return [...picked];
  }

  /** 调上游做一次词根解析（非流式）。 */
  private async analyze(word: string): Promise<WordRootAnalysis> {
    if (config.ai.agnes.apiKey.trim().length === 0) {
      throw new Error('AI 能力未配置（AI_AGNES_API_KEY 缺失）');
    }
    const startedAt = Date.now();
    const response = await fetch(`${config.ai.agnes.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.ai.agnes.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.ai.agnes.textModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `单词：${word}` },
        ],
        temperature: 0.3,
        stream: false,
      }),
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 200);
      throw new Error(`词根解析接口返回 ${response.status}: ${detail}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = payload.choices?.[0]?.message?.content ?? '';
    await this.aiCallLog.record({
      type: 'word_root',
      provider: 'agnes',
      model: config.ai.agnes.textModel,
      bizId: 0,
      promptTokens: payload.usage?.prompt_tokens ?? 0,
      completionTokens: payload.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - startedAt,
      status: 'success',
    });
    return this.parseAnalysis(content);
  }

  /** 解析模型输出（容错：剥离 ```json 围栏、截取首个 JSON 对象）。 */
  private parseAnalysis(content: string): WordRootAnalysis {
    const cleaned = content
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) {
      throw new Error('词根解析返回格式异常');
    }
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as WordRootAnalysis;
    if (!Array.isArray(parsed.parts)) {
      parsed.parts = [];
    }
    if (!Array.isArray(parsed.related)) {
      parsed.related = [];
    }
    return parsed;
  }

  /** 归一化单词（小写、去非字母）。 */
  private normalize(word: string): string {
    const normalized = word.toLowerCase().replace(/[^a-z-]/g, '');
    if (normalized.length < 2 || normalized.length > 64) {
      throw new Error('请输入合法的英文单词');
    }
    return normalized;
  }

  /** 数据库行 → 对外结构。 */
  private toItem(row: {
    word: string;
    phonetic: string | null;
    meaning: string | null;
    analysis: unknown;
    source: string;
    searchCount: number;
  }): WordRootItem {
    const analysis = (row.analysis ?? {}) as WordRootAnalysis;
    return {
      word: row.word,
      phonetic: row.phonetic ?? analysis.phonetic ?? null,
      meaning: row.meaning ?? analysis.meaning ?? null,
      parts: analysis.parts ?? [],
      explanation: analysis.explanation ?? '',
      related: analysis.related ?? [],
      source: row.source,
      searchCount: row.searchCount,
    };
  }
}
