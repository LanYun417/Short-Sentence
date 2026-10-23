/**
 * AI 能力共享类型与 Provider 接口。
 * 模块职责：定义生题 / 生图两类能力的抽象，业务模块只依赖接口，
 * 换模型、换厂商（或加 mock 实现）都不需要改动业务代码。
 */

/** 生题草稿（DeepSeek 输出解析后的单条）。 */
export interface SentenceDraft {
  /** 英文句子（入库唯一键） */
  sentenceEn: string;
  /** 中文释义（用户端题干） */
  translationZh: string;
  /** IPA 音标 */
  ipa: string;
  /** 生图提示词（两人对话场景构图） */
  scenePrompt: string;
  /** 难度：1 易 / 2 中 / 3 难 */
  difficulty: number;
  /** 分类名（与 SentenceCategory.name 对应；不存在则由调用方兜底） */
  categoryName: string;
}

/** 生题 Provider 接口。 */
export interface SentenceGenProvider {
  /**
   * 生成一批句子草稿。
   * @param theme 当日主题（如「日常生活」）
   * @param count 目标条数
   */
  generateBatch(theme: string, count: number): Promise<SentenceDraft[]>;
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
}

/** 生图结果（原始字节，转 webp 与入库由调用方负责）。 */
export interface GeneratedImage {
  buffer: Buffer;
  /** 上游返回的 MIME（通常是 image/png） */
  mimeType: string;
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

/** OpenAI 兼容用量统计（DeepSeek / NVIDIA 返回）。 */
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
