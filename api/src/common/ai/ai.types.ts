/**
 * AI 能力共享类型与 Provider 接口。
 * 模块职责：定义生题 / 生图两类能力的抽象，业务模块只依赖接口，
 * 换模型、换厂商（或加 mock 实现）都不需要改动业务代码。
 */

/** 生题草稿（Agnes 输出解析后的单条）。 */
export interface SentenceDraft {
  /** 英文句子（入库唯一键） */
  sentenceEn: string;
  /** 其他可接受的等价英文表达（最多 5 条；输入模式下写出任一即算对，拼词模式不涉及） */
  alternateAnswers?: string[];
  /** 中文释义（用户端题干） */
  translationZh: string;
  /** IPA 音标 */
  ipa: string;
  /** 题目解析（中文：语法点 / 时态语态 / 关键词形与搭配 / 易错点；答题后无论对错都展示） */
  explanation?: string;
  /** 生图提示词（两人对话场景构图） */
  scenePrompt: string;
  /** 难度：1 易 / 2 中 / 3 难 */
  difficulty: number;
  /** 分类名（与 SentenceCategory.name 对应；不存在则由调用方兜底） */
  categoryName: string;
}

/** 审核未通过的条目（含原因，便于日志排查）。 */
export interface RejectedDraft {
  draft: SentenceDraft;
  reason: string;
}

/**
 * 待补解析的题目（存量题回填用）。
 * 只送必要字段：解析要讲的是句子本身的语法结构，多余字段纯属浪费 token。
 */
export interface ExplainItem {
  /** 英文句子 */
  sentenceEn: string;
  /** 中文释义（帮模型判断这句在教什么） */
  translationZh: string;
  /** 难度 1/2/3（决定解析深浅） */
  difficulty: number;
}

/**
 * 生题 Provider 接口。
 *
 * 三段式流水线：generate（生题）→ polish（优化）→ review（审核），
 * 三者各自独立调用、可单独重试；审核不通过的题目直接丢弃，不进生图。
 */
export interface SentenceGenProvider {
  /**
   * 一阶段：生成一批句子草稿。
   * @param theme 当日主题（如「日常生活」）
   * @param count 目标条数
   * @param focusDifficulty 强制本批全部为该难度（1/2/3），省略则按自然分布
   * @param bizId 关联业务 id（批次 id），落 ai_call_log 便于按批次核对三阶段是否都跑了
   */
  generateBatch(theme: string, count: number, focusDifficulty?: number, bizId?: number): Promise<SentenceDraft[]>;

  /**
   * 二阶段：优化地道性、中文可读性与难度标注。
   * 返回**同数量、同顺序**的草稿（模型漏掉的条目保留原稿，不会因为「优化」丢题）。
   * @param bizId 关联业务 id（批次 id）
   */
  polishBatch(drafts: SentenceDraft[], theme: string, bizId?: number): Promise<SentenceDraft[]>;

  /**
   * 三阶段：审核并剔除不合格题目
   * （语法 / 对译 / 语义自足 / 难度标注 / 内容适当性 / 逻辑自洽 / 可画性）。
   * **fail-closed**：模型未给出结论的条目按不通过处理——漏判即放行等于没审。
   * @param bizId 关联业务 id（批次 id）
   */
  reviewBatch(
    drafts: SentenceDraft[],
    bizId?: number,
  ): Promise<{ approved: SentenceDraft[]; rejected: RejectedDraft[] }>;

  /**
   * 补全题目解析（**存量题回填**用；新题在生题阶段就已带上 explanation）。
   *
   * 返回**与输入等长、同顺序**的解析数组：模型漏掉的条目返回空串，调用方据此跳过
   * （不覆盖已有解析，也不把空值写进库）。
   *
   * @param items 待补条目（句子 + 释义 + 难度）
   * @param bizId 关联业务 id（便于核对调用来源）
   */
  explainBatch(items: ExplainItem[], bizId?: number): Promise<string[]>;

  /**
   * 图像内容审核（把生图纳入审核链路）。
   *
   * 对单张已生成的配图做视觉审核：适龄、无不当内容；情侣/浪漫场景的两人须为一男一女
   * （平台插画惯例；生图提示词已强制，这里再兜底拦截模型偶发跑偏）。
   * **fail-closed**：模型未给出明确通过结论即视为不通过，宁可不下发也不放坏图进库。
   *
   * @param image 已生成、转码后的图片字节（webp/png 均可，按 data URL 送视觉模型）
   * @param context 预期场景（提示词 + 可选句子），帮助审核模型判断画面是否合理
   * @param bizId 关联业务 id（批次 id），落 ai_call_log 便于按批次核对
   */
  reviewImage(image: Buffer, context: ImageReviewContext, bizId?: number): Promise<ImageReviewResult>;
}

/** 每日句签主题（AI 输出解析后的单条）。 */
export interface SentenceCardTheme {
  /** 主题标题（英文，如 Morning Ritual） */
  title: string;
  /** 主题标题（中文） */
  titleZh: string;
  /** 卡面短句（英文） */
  sentenceEn: string;
  /** 短句中文释义 */
  translationZh: string;
  /** 生图提示词（唯美场景插画，非对话） */
  scenePrompt: string;
  /** 寄语（这张卡独有的一句，随文案一起生成；展示在卡背） */
  blessing: string;
}

/** 生图结果（原始字节，转 webp 与入库由调用方负责）。 */
export interface GeneratedImage {
  buffer: Buffer;
  /** 上游返回的 MIME（通常是 image/png） */
  mimeType: string;
}

/** 图像审核上下文（帮助审核模型理解这张图的预期场景）。 */
export interface ImageReviewContext {
  /** 生图提示词（预期场景描述） */
  scenePrompt: string;
  /** 对应英文句子（可选，辅助判断场景是否合理） */
  sentenceEn?: string;
}

/** 图像审核结论。 */
export interface ImageReviewResult {
  /** 是否通过（false = 不发布，进入隔离态） */
  pass: boolean;
  /** 不通过原因（通过时为空串） */
  reason: string;
}

/** 生图 Provider 接口。 */
export interface ImageGenProvider {
  /**
   * 按提示词生成一张图。
   * @param prompt 场景提示词
   * @param options 尺寸档位与宽高比
   */
  generate(prompt: string, options: { size: string; ratio: string }): Promise<GeneratedImage>;
}

/** OpenAI 兼容用量统计（Agnes 返回）。 */
export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
}

/**
 * AI  Provider 调用失败。
 * `retryable` 决定是否值得重试：429 与 5xx / 网络错误为 true，其余 4xx（如 401 密钥错）为 false。
 */
export class AiProviderError extends Error {
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(message: string, options: { retryable: boolean; status?: number | null }) {
    super(message);
    this.name = 'AiProviderError';
    this.retryable = options.retryable;
    this.status = options.status ?? null;
  }
}
