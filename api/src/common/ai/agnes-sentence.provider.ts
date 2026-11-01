/**
 * Agnes 生题 Provider（agnes-2.5-flash，OpenAI 兼容 chat/completions）。
 * 模块职责：按主题批量生成句子草稿（英文句子/中文释义/音标/对话场景提示词/难度/分类），
 * 以及每日句签的主题文案。
 *
 * 契约（官方文档）：POST {baseUrl}/chat/completions，Bearer 认证；
 * 请求 { model: 'agnes-2.5-flash', messages, temperature, response_format: json_object }；
 * 响应 choices[0].message.content（OpenAI 兼容）。
 * Base URL 与密钥与生图（AgnesImageProvider）共用，仅模型不同。
 * 限流未知，调用方（生成流水线）必须用信号量控制并发，本 Provider 只管单次调用。
 */
import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config/config.js';
import type { DayContext } from '../calendar/day-context.js';
import { AiCallLogService } from './ai-call-log.service.js';
import { AiBudgetService } from './ai-budget.service.js';
import { AiSettingsService } from './ai-settings.service.js';
import {
  AiProviderError,
  type ExplainItem,
  type ImageReviewContext,
  type ImageReviewResult,
  type RejectedDraft,
  type SentenceCardTheme,
  type SentenceDraft,
  type SentenceGenProvider,
} from './ai.types.js';

/** 单条草稿的最小可用判定。 */
function isUsableDraft(item: unknown): item is SentenceDraft {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const draft = item as Record<string, unknown>;
  return typeof draft.sentenceEn === 'string' && draft.sentenceEn.trim().length > 0;
}

/** 从任意值安全取出字符串（非字符串按空串处理），trim 后截断到 max。 */
function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * 从模型输出解析图像审核结论。fail-closed：只要不是明确的 `pass:true`，一律视为不通过。
 * 模型用了 json_object 模式，正常应返回 `{"pass":bool,"reason":str}`；解析不出就按不通过处理。
 */
function parseReviewVerdict(content: string): { pass: boolean; reason: string } {
  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]) as Record<string, unknown>;
      const pass = obj.pass === true;
      const reason = typeof obj.reason === 'string' ? (obj.reason as string).slice(0, 120) : '';
      return { pass, reason: pass ? '' : reason || '图像审核未通过' };
    } catch {
      // 落到下面「无法解析」分支
    }
  }
  return { pass: false, reason: '图像审核未返回明确结论（按不通过处理）' };
}

/**
 * 归一化备用答案数组，并剔除与主句重复的条目（避免模型把主句混进备用答案里）。
 * @param primary 主句（用于去重）
 * @param value 模型输出的备用答案
 * @param max 最多保留条数
 */
function parseAlternatesWith(primary: string, value: unknown, max = 5): string[] {
  const primaryKey = primary
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .replace(/\s+/g, ' ');
  return parseAlternates(value, max + 1)
    .filter((item) => {
      const key = item
        .toLowerCase()
        .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
        .replace(/\s+/g, ' ');
      return key !== primaryKey;
    })
    .slice(0, max);
}

/** 优化阶段备用答案取值：模型给了新的就用新的，漏了就回退生题阶段版本。 */
function withFallback(draft: SentenceDraft, rawAlternates: unknown, fallbackAlternates?: string[]): string[] {
  const parsed = parseAlternatesWith(draft.sentenceEn, rawAlternates);
  return parsed.length > 0 ? parsed : parseAlternatesWith(draft.sentenceEn, fallbackAlternates);
}

/**
 * 把模型产出的备用答案归一为干净数组（最多 max 条、去重、去空）。
 * 去重用与 normalizeAnswer 同口径的 key，避免同一句的不同标点写法重复。
 */
function parseAlternates(value: unknown, max = 5): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }
    const t = item.trim();
    if (!t) {
      continue;
    }
    const key = t
      .toLowerCase()
      .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
      .replace(/\s+/g, ' ');
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(t.slice(0, 300));
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

/**
 * 难度分级标准：生题（generate）与优化（polish）共用同一套。
 *
 * **难度由词汇与语法决定，不由句子长短决定**——6 词的习语是 3 档，6 词的日常请求是 1 档。
 * 两处各写一套必然漂移，所以集中在这里。提示词统一用英文：上游模型对英文指令的遵循度更高。
 *
 * ⚠️ 这里**刻意不写成品例句**：早期版本给了 "Could you open the window?" 之类的完整句子，
 * 结果模型把它们（及近似变体）直接当素材复述进题库（2026-10-24 实测：题库里出现
 * "I'm running late, so I'll grab a coffee on the way."，正是当时的反例原文）。
 * 现在只描述**结构特征**，并在末尾明确禁止照抄示例。
 */
const DIFFICULTY_RULES = [
  'DIFFICULTY IS DECIDED BY VOCABULARY AND GRAMMAR, NOT BY SENTENCE LENGTH',
  '(length is a consequence, not a criterion).',
  '',
  'Level 1 (basic):',
  '- Vocabulary: only the most frequent everyday words (CEFR A1-A2: time, want, help, busy, sure, cold).',
  '- Grammar: present simple, past simple, and simple modals (can, must). One simple sentence.',
  '- Forbidden: subordinate clauses, perfect tenses, passive voice, idioms, figurative phrasal verbs.',
  '- Typical shape: one subject + one verb + one object or adverbial, with no connector.',
  '- These sentences will naturally be short (usually 5-8 words), but do NOT label a level-2 sentence as',
  '  level 1 just because it is short.',
  '- Anything containing a "so / because / if" clause, a progressive or perfect tense, a passive, or a',
  '  figurative phrasal verb is AT LEAST level 2, no matter how short.',
  '',
  'Level 2 (intermediate): any ONE of - a common word beyond the most frequent range, one clause or connector,',
  'one of progressive / perfect / passive, a common phrasal verb.',
  '',
  'Level 3 (advanced): abstract nouns, idioms or figurative phrasal verbs, subjunctive mood, multiple clauses,',
  'complex tense combinations.',
  '',
  'When unsure, choose 2 rather than 1. Never disguise a hard sentence as easy by shortening it.',
  'These rules describe STRUCTURE only. Never output an example from these instructions, or a close',
  'variant of one, as a real item.',
].join('\n');

/** 二阶段（优化）的 system 提示词。 */
const POLISH_SYSTEM_PROMPT = [
  'You are a senior English editor for a language-learning app.',
  'Below is a batch of draft items (a JSON array; every item has an index).',
  'Rewrite every item and return EXACTLY the same number in the same order, with matching indexes.',
  'Do not add, drop or merge items.',
  '',
  'Improve:',
  '1. sentenceEn: remove Chinglish, awkward collocations and unnatural word order; make it sound like',
  '   something a native speaker would actually say in that situation. Keep the original meaning and scenario.',
  '   Do not add slang, rare expressions or internet speak.',
  '2. translationZh: remove translationese; follow Chinese word order and collocations;',
  '   the Chinese alone must be understandable.',
  '3. difficulty: re-judge with the rules below (the original label may be wrong; do not copy it).',
  '4. ipa: British IPA consistent with the rewritten English.',
  '5. scenePrompt: keep it a flat cartoon of TWO PEOPLE talking in the matching scene; fix it if it no longer matches.',
  '6. categoryName: keep the original Chinese category name unless clearly wrong.',
  '7. alternateAnswers: rewrite the list so every entry still expresses the SAME meaning as the REWRITTEN',
  '   sentenceEn. Each must be natural, grammatically correct, different from sentenceEn and from each other.',
  '   Keep 3-5 entries; if the rewritten sentence made an entry invalid, replace or drop it. Never include sentenceEn.',
  '8. explanation: rewrite it so it matches the REWRITTEN sentenceEn. If your rewrite changed the tense, voice,',
  '   verb pattern or word form, the note MUST follow — an explanation that describes the old sentence is worse',
  '   than none. Keep it Chinese, plain text, at most 2 short sentences, specific to this sentence.',
  '   If the original note was generic boilerplate, replace it with something concrete.',
  '',
  DIFFICULTY_RULES,
  '',
  'Output JSON only:',
  '{"items":[{"index":0,"sentenceEn":"","translationZh":"","ipa":"","explanation":"","scenePrompt":"","difficulty":1,"categoryName":"","alternateAnswers":["",""]}]}',
].join('\n');

/**
 * 补全题目解析的 system 提示词（存量题回填专用）。
 *
 * 与生题阶段的 3d 规则同一口径，但**不看场景、不看备选答案**，
 * 只要求「针对这一句，讲清楚值得学的那一两个点」。
 */
const EXPLAIN_SYSTEM_PROMPT = [
  'You write short learning notes for an English-learning app.',
  'The learner has just answered an item — right or wrong — and now sees a note explaining the grammar.',
  'Below is a batch of items (a JSON array; every item has an index, the English sentence, its Chinese meaning,',
  'and its difficulty level 1/2/3).',
  '',
  'Write the note for EVERY item and return EXACTLY the same number in the same order, with matching indexes.',
  'Do not add, drop or merge items.',
  '',
  'Rules:',
  '1. Chinese, plain text, at most 2 short sentences (30-120 characters). No markdown, no bullet symbols.',
  '2. Explain WHY the sentence is built this way — the point worth learning — not what it means.',
  '   The Chinese meaning is already shown to the learner, so repeating it wastes the note.',
  '3. Cover the one or two things that actually matter for THAT sentence: the tense or voice used,',
  '   the key verb pattern / collocation, the word-form change (e.g. an irregular past tense),',
  '   or the pitfall where a literal Chinese-to-English translation would go wrong.',
  '4. Match the depth to the difficulty: level 1 → the plain pattern behind a basic sentence;',
  '   level 3 → clauses, idioms, subjunctive mood. Never lecture beyond what this sentence shows.',
  '5. Be specific to this sentence. Never write generic advice such as "注意时态", never repeat the sentence,',
  '   and never translate it word by word.',
  '',
  'Output JSON only: {"items":[{"index":0,"explanation":""}]}',
].join('\n');

/** 三阶段（审核）的 system 提示词。 */
const REVIEW_SYSTEM_PROMPT = [
  'You are the final quality gate before these items enter a sentence bank for a language-learning app.',
  'Review every item (index = input position).',
  '',
  'FAIL an item if ANY of the following is true:',
  '1. The English has grammar errors, unnatural collocations, or obvious Chinglish.',
  '2. The Chinese is translationese — especially keeping English word order (the object placed before the verb) —',
  '   unclear, or does not match the English.',
  '3. The Chinese alone is not understandable (not self-contained), or key information is missing so the',
  '   meaning is ambiguous. A compressed phrase without a predicate counts as broken.',
  '4. The difficulty label clearly contradicts the content (a clause / perfect tense / idiom in level 1,',
  '   or a trivial sentence in level 3).',
  '5. Content unsuitable for a language-learning app: sensitive, vulgar, misleading, factually wrong,',
  '   or advertising a specific brand.',
  '6. Too empty to stand alone as a question (e.g. a bare one-word acknowledgement).',
  '7. THE SITUATION IS NOT LOGICALLY COHERENT. The cause / contrast / result relation must actually hold:',
  '   if the sentence uses "so", "because" or "but", the two halves have to be genuinely connected.',
  '   Reject contradictions in the scene as well — for example someone described as being in a hurry who is',
  '   then calmly doing something leisurely. Everyday details must agree with each other.',
  '8. THE SENTENCE CANNOT BE ILLUSTRATED. The app shows one flat cartoon of two people talking, so the item',
  '   must depict a concrete, observable everyday scene. Reject purely abstract statements, inner states with',
  '   no visible action, and anything that only works as written text.',
  '9. THE EXPLANATION TEACHES SOMETHING FALSE. If an explanation is present, it must describe the grammar the',
  '   sentence ACTUALLY uses (tense, voice, pattern, word form). A note that contradicts the sentence misleads',
  '   the learner — fail it. A missing explanation is not a reason to fail (the app can show the sentence alone).',
  '',
  'You MUST output exactly one verdict per item. An item with no verdict will be treated as FAILED.',
  'Be strict: better to drop an item than to let a bad one through.',
  'Output JSON only: {"items":[{"index":0,"pass":true,"reason":""}]}',
  '(reason only when pass=false, max 15 words, English or Chinese)',
].join('\n');

/**
 * 图像内容审核提示词（视觉模型看单张已生成配图）。
 * 与文本审核同一套「fail-closed」心智：宁可不下发，也不放坏图进库。
 */
const IMAGE_REVIEW_SYSTEM_PROMPT = [
  'You are the image content moderator for a language-learning app for all ages.',
  'You will be shown ONE illustration (flat cartoon, two people talking) just generated for a sentence card.',
  'The intended scene is described by the provided "scenePrompt".',
  '',
  'FAIL the image (pass=false) if ANY of the following is true:',
  '1. Content not safe for all ages: nudity, sexual content, romantic/intimate touching beyond a light hug or',
  '   hand-hold, violence, gore, blood, weapons, drugs, hate symbols, or anything disturbing.',
  '2. A CLEARLY ROMANTIC couple — people who are kissing, embracing romantically, or holding hands in an',
  '   unambiguously romantic context — is the SAME gender (two men or two women). The platform convention is',
  '   that romantic couples are a man and a woman, so flag ONLY this specific case.',
  '   IMPORTANT: two people of the same gender who are NOT a romantic couple must PASS. Do NOT invent a',
  '   "couple" from them. This includes: family (mother and daughter, father and son, siblings, grandparents),',
  '   friends, classmates, coworkers, two children playing, a group, or people simply standing/talking/walking',
  "   together. A mother holding her daughter's hand, two kids, or two colleagues are NOT couples — PASS them.",
  '3. The image is grossly off from the described scene (empty background with no people when people are',
  '   required, text/letters as the main subject, or a scene contradicting the sentence).',
  '4. Low quality / broken render that would look obviously wrong to a user.',
  '',
  'PASS when the image is appropriate and depicts the intended everyday scene; this is true even if the two',
  'people shown are the same gender, as long as they are not a romantic couple (see rule 2).',
  'Be strict about SAFETY (rule 1) and genuine romantic same-gender couples (rule 2); do not over-flag',
  'ordinary same-gender pairs that are clearly family, friends, or strangers.',
  'Output JSON only: {"pass":true,"reason":""} or {"pass":false,"reason":"short reason, max 20 words"}',
].join('\n');

@Injectable()
export class AgnesSentenceProvider implements SentenceGenProvider {
  private readonly logger = new Logger(AgnesSentenceProvider.name);

  constructor(
    private readonly aiCallLog: AiCallLogService,
    private readonly budget: AiBudgetService,
    private readonly aiSettings: AiSettingsService,
  ) {}

  /** 密钥未配置时禁用生题能力（由调用方转为明确的业务错误）。 */
  get enabled(): boolean {
    return this.aiSettings.current.apiKey.trim().length > 0;
  }

  /**
   * 批量生成句子草稿。
   *
   * 提示词策略：system 规定输出 JSON 形状与字段约束；user 给出主题与数量。
   * 要求模型返回 `{"items": [...]}`（json_object 模式必须是对象，不能是裸数组）。
   */
  async generateBatch(
    theme: string,
    count: number,
    focusDifficulty?: number,
    bizId?: number,
    targetCategory?: string,
  ): Promise<SentenceDraft[]> {
    if (!this.enabled) {
      throw new AiProviderError('生题能力未配置（AI_AGNES_API_KEY 缺失）', { retryable: false });
    }

    // 定向补某一场景：把该场景名同时作为主题，并强制所有条目的 categoryName 必须等于它。
    // 否则模型只是「主题里包含该场景」，仍会把大部分题出到它熟悉的旧场景（实测新分类长期 0 题）。
    const themeLine = targetCategory
      ? `7. Generate ${count} items this batch. Theme: ${targetCategory}. ` +
        `EVERY item's categoryName MUST be exactly "${targetCategory}" — this is a targeted refill of ` +
        `that specific scene, so do NOT assign any other category name to any item.`
      : `7. Generate ${count} items this batch. Theme: ${theme}.`;

    const systemPrompt = [
      'You are an English curriculum expert building a sentence bank for an English-learning app.',
      'Hard requirements:',
      '1. Output JSON only, shaped as {"items": [...]}. No explanations.',
      '2. Each item has: sentenceEn (natural spoken English), translationZh (Chinese meaning), ipa (British IPA),',
      '   scenePrompt (English image prompt), difficulty (1/2/3, judged by rule 4 below),',
      '   categoryName (Chinese category name, matching the theme or narrower),',
      '   alternateAnswers (array of 3-5 OTHER natural English sentences that mean the SAME as sentenceEn),',
      '   explanation (short Chinese learning note — see rule 3d).',
      '3. translationZh is the field most likely to go wrong. Three hard rules:',
      '   a. Natural Chinese: follow Chinese word order and collocations. Never map English word order literally.',
      '      The classic tell is leaving the object in front of the verb, or stacking adverbs before the verb.',
      '   b. Self-contained: the Chinese alone must make sense without seeing the English. Never drop the time,',
      '      place or condition clause the sentence depends on; a compressed phrase without a predicate reads broken.',
      '   c. Complete: keep who / does what / where so there is no ambiguity. 8-25 Chinese characters.',
      '8b. alternateAnswers rules:',
      '   - Each entry is a DIFFERENT natural way to express the SAME meaning as sentenceEn',
      '     (different wording, word order, or vocabulary). All must be grammatically correct and natural.',
      '   - None may equal sentenceEn or each other (after ignoring case and punctuation).',
      '   - Provide 3 to 5 entries. Only use fewer if the sentence is a fixed courtesy formula with one obvious',
      '     alternative; never invent awkward ones.',
      '   - Do NOT include sentenceEn itself in this array.',
      '3d. explanation rules (this is the note the learner sees after answering, right or wrong):',
      '   - Output EXACTLY three lines, fixed format, Chinese labels, no markdown, no numbering, no extra text:',
      '     语法：<一句话点明时态/句式>',
      '     词形：<关键词的形式与用法，如「wait → have been waiting」>',
      '     易错：<最容易写错的一点>',
      '   - Each line at most 30 Chinese characters; total at most 90. Use plain words a beginner understands.',
      '   - Be specific to THIS sentence. Never write generic advice such as "注意时态" or a grammar lecture.',
      '',
      DIFFICULTY_RULES,
      '',
      '4. Distribution: about 40% level 1, 40% level 2, 20% level 3.',
      focusDifficulty
        ? `   THIS BATCH MUST BE ALL LEVEL ${focusDifficulty}. Every item has to satisfy that level's vocabulary` +
          ' and grammar rules above. Do not fake an easy level by merely shortening a hard sentence.'
        : '   All three levels must appear; do not pile everything into level 2.',
      '5. sentenceEn must be natural spoken English with complete meaning. Do not drop words in the name of',
      '   "casual", and avoid rare words and slang.',
      '6. scenePrompt: a flat cartoon illustration of TWO PEOPLE talking in that specific scene',
      '   (who they are, what they are doing, the environment, the lighting). 16:9 composition, no text in the image.',
      themeLine,
    ].join('\n');

    // 解析放进 chat 的 validate 钩子：解析不出条目必须在「记 success」之前抛，
    // 否则 withRetry 的每次重试都会留下一条 success，日志里的生题成功率是虚的。
    let drafts: SentenceDraft[] = [];
    await this.chat(
      'sentence_gen',
      systemPrompt,
      `Theme: ${theme}. Count: ${count}. Output JSON with shape {"items":[{"index":0,"sentenceEn":"","translationZh":"","ipa":"","explanation":"","scenePrompt":"","difficulty":1,"categoryName":"","alternateAnswers":["",""]}]}.`,
      0.8,
      {
        bizId,
        validate: (content) => {
          drafts = this.parseDrafts(content);
          if (drafts.length === 0) {
            throw new AiProviderError('生题接口未返回可用草稿', { retryable: true });
          }
        },
      },
    );
    return drafts;
  }

  /**
   * 二阶段（优化）：换编辑视角再过一遍，修正地道性、中文可读性与难度标注。
   *
   * 返回**同数量、同顺序**：模型漏掉的条目保留原稿，字段被写空的也回填原值——
   * 「优化」不该让题目变少或丢字段，否则调用方还要额外做对齐与兜底。
   */
  async polishBatch(drafts: SentenceDraft[], theme: string, bizId?: number): Promise<SentenceDraft[]> {
    if (!this.enabled) {
      throw new AiProviderError('生题能力未配置（AI_AGNES_API_KEY 缺失）', { retryable: false });
    }
    if (drafts.length === 0) {
      return [];
    }

    const payload = drafts.map((draft, index) => ({ index, ...draft }));
    const content = await this.chat(
      'sentence_polish',
      POLISH_SYSTEM_PROMPT,
      `Theme: ${theme}\nDraft items:\n${JSON.stringify(payload)}`,
      0.3,
      { bizId },
    );

    const polished = new Map<number, SentenceDraft>();
    // 备用答案兜底：模型漏掉 alternateAnswers 时回退生题阶段版本（运行期不可变草稿，索引固定）
    const draft = (index: number): SentenceDraft => drafts[index];
    for (const item of this.extractItems(content)) {
      if (!isUsableDraft(item)) {
        continue;
      }
      const raw = item as unknown as Record<string, unknown>;
      const index = Number(raw.index);
      if (!Number.isInteger(index) || index < 0 || index >= drafts.length) {
        continue;
      }
      polished.set(index, {
        sentenceEn: str(raw.sentenceEn, 300),
        translationZh: str(raw.translationZh, 300),
        ipa: str(raw.ipa, 200),
        explanation: str(raw.explanation, 500),
        scenePrompt: str(raw.scenePrompt, 500),
        difficulty: this.clampDifficulty(raw.difficulty),
        categoryName: str(raw.categoryName, 50) || drafts[index].categoryName,
        // 优化改写常会调整句子表达，备用答案以改写后的为准；模型漏掉时回退生题阶段的版本
        alternateAnswers: withFallback(draft(index), raw.alternateAnswers, drafts[index].alternateAnswers),
      });
    }

    return drafts.map((draft, index) => {
      const next = polished.get(index);
      if (!next) {
        return draft;
      }
      return {
        ...next,
        translationZh: next.translationZh || draft.translationZh,
        ipa: next.ipa || draft.ipa,
        // 解释漏了就留生题阶段的版本（「优化」不该让字段变空）
        explanation: next.explanation || draft.explanation,
        scenePrompt: next.scenePrompt || draft.scenePrompt,
        // 优化改写句子后，主句对应的备用答案也要跟着换（漏了就留生题阶段版本）
        alternateAnswers: withFallback(next, next.alternateAnswers, draft.alternateAnswers),
      };
    });
  }

  /**
   * 三阶段（审核）：语法 / 对译 / 语义自足 / 难度标注 / 内容适当性 / 逻辑自洽 / 可画性七道关。
   * **fail-closed**：模型没给结论的条目按**不通过**处理——漏判即放行等于这道题没审过。
   * （2026-10-24 之前是 fail-open，实测大量题目在"审核通过"的名义下带着翻译腔进了库。）
   */
  async reviewBatch(
    drafts: SentenceDraft[],
    bizId?: number,
  ): Promise<{ approved: SentenceDraft[]; rejected: RejectedDraft[] }> {
    if (!this.enabled) {
      throw new AiProviderError('生题能力未配置（AI_AGNES_API_KEY 缺失）', { retryable: false });
    }
    if (drafts.length === 0) {
      return { approved: [], rejected: [] };
    }

    const payload = drafts.map((draft, index) => ({ index, ...draft }));
    const content = await this.chat('sentence_review', REVIEW_SYSTEM_PROMPT, JSON.stringify(payload), 0.1, { bizId });

    const verdicts = new Map<number, { pass: boolean; reason: string }>();
    for (const item of this.extractItems(content)) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }
      const raw = item as Record<string, unknown>;
      const index = Number(raw.index);
      if (!Number.isInteger(index) || index < 0 || index >= drafts.length) {
        continue;
      }
      verdicts.set(index, { pass: raw.pass === true, reason: str(raw.reason, 80) });
    }

    const approved: SentenceDraft[] = [];
    const rejected: RejectedDraft[] = [];
    drafts.forEach((draft, index) => {
      const verdict = verdicts.get(index);
      // fail-closed：模型没给结论就**不放行**
      if (!verdict || !verdict.pass) {
        rejected.push({ draft, reason: verdict?.reason || '审核未给出结论' });
        return;
      }
      approved.push(draft);
    });
    return { approved, rejected };
  }

  /**
   * 图像内容审核：把刚生成的配图送视觉模型，判断是否适龄、有无不当内容、
   * 情侣场景是否为一男一女。fail-closed——明确 `pass:true` 才放行，其余一律不通过。
   *
   * 视觉调用走与文本审核同一套 `chat`（多模态），共享预算闸门与调用日志；
   * 调用失败（接口/超时）由调用方 `withRetry` 兜底，最终仍失败则按不通过处理。
   */
  async reviewImage(image: Buffer, context: ImageReviewContext, bizId?: number): Promise<ImageReviewResult> {
    if (!this.enabled) {
      throw new AiProviderError('生题能力未配置（AI_AGNES_API_KEY 缺失）', { retryable: false });
    }
    const userPayload = JSON.stringify({
      scenePrompt: context.scenePrompt,
      sentenceEn: context.sentenceEn ?? '',
    });
    const content = await this.chat(
      'image_review',
      IMAGE_REVIEW_SYSTEM_PROMPT,
      userPayload,
      0.1,
      { bizId },
      image.toString('base64'),
    );
    return parseReviewVerdict(content);
  }

  /**
   * 补全题目解析（存量题回填）。
   *
   * 为什么单独一次调用而不是复用 polish：这一批题目已经入库（无需改句、无需重审场景），
   * 只为它们补一个字段；走 polish 会把整题重写一遍，既浪费 token 又有引入新错的风险。
   */
  async explainBatch(items: ExplainItem[], bizId?: number): Promise<string[]> {
    if (!this.enabled) {
      throw new AiProviderError('生题能力未配置（AI_AGNES_API_KEY 缺失）', { retryable: false });
    }
    if (items.length === 0) {
      return [];
    }
    const payload = items.map((item, index) => ({ index, ...item }));
    const content = await this.chat('sentence_explain', EXPLAIN_SYSTEM_PROMPT, JSON.stringify(payload), 0.4, { bizId });

    // 与输入等长、同顺序：模型漏掉的条目留空串，调用方跳过（绝不写空值覆盖）
    const out = new Array<string>(items.length).fill('');
    for (const item of this.extractItems(content)) {
      const raw = item as unknown as Record<string, unknown>;
      const index = Number(raw.index);
      if (!Number.isInteger(index) || index < 0 || index >= items.length) {
        continue;
      }
      out[index] = str(raw.explanation, 500);
    }
    return out;
  }

  /**
   * 统一的上游调用：请求 + 错误归一 + AI 调用日志（三阶段共用，避免各写一套日志口径）。
   * @param callType ai_call_log.type（sentence_gen / sentence_polish / sentence_review）
   * @param options bizId：关联批次 id（便于按批次核对三阶段是否都跑了）；
   *                validate：**内容可用性校验**，在「记 success」之前执行，抛错即记 failed
   * @returns 模型输出文本（content 为空时回退 reasoning_content）
   */
  private async chat(
    callType: string,
    systemPrompt: string,
    userContent: string,
    temperature: number,
    options: { bizId?: number; validate?: (content: string) => void } = {},
    imageBase64?: string,
  ): Promise<string> {
    // 预算闸门放在 try 之前：超额时直接抛不可重试错误，**不写 ai_call_log**
    // （被拦下的调用不算「消费」，也不该污染失败率统计）。放在这里即覆盖所有文本调用
    // （生题/优化/审核/句签/词根/造句）。
    await this.budget.assertWithinBudget();
    const startedAt = Date.now();
    try {
      // 视觉审核走多模态：user 消息变成 [文本 + 图片] 数组；纯文本调用不传 imageBase64。
      const userMessage: {
        role: 'user';
        content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
      } = imageBase64
        ? {
            role: 'user',
            content: [
              { type: 'text', text: userContent },
              { type: 'image_url', image_url: { url: `data:image/webp;base64,${imageBase64}` } },
            ],
          }
        : { role: 'user', content: userContent };
      const response = await fetch(`${this.aiSettings.current.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.aiSettings.current.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.aiSettings.current.textModel,
          messages: [{ role: 'system', content: systemPrompt }, userMessage],
          temperature,
          max_tokens: config.ai.maxOutputTokens,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(config.ai.requestTimeoutMs),
      });

      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        throw new AiProviderError(`${callType} 接口返回 ${response.status}: ${detail}`, {
          retryable: response.status === 429 || response.status >= 500,
          status: response.status,
        });
      }

      const body = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string | null; reasoning_content?: string | null };
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const message = body.choices?.[0]?.message;
      // content 为空时回退 reasoning_content：推理模型可能把输出放在 reasoning_content 里
      const content = message?.content?.trim() || message?.reasoning_content?.trim() || '';
      if (!content) {
        throw new AiProviderError(`${callType} 返回为空`, { retryable: true });
      }

      // 关键：内容可用性校验放在「记 success」之前。
      // HTTP 200 不等于内容可用——生题最常见的失败是「返回了内容但解析不出条目」，
      // 过去先记 success 再抛错，导致 ai_call_log 的生题成功率虚高
      // （2026-10-24 实测：19 次 success 只换来 8 次优化，日志与真实产出对不上）。
      options.validate?.(content);

      await this.aiCallLog.record({
        type: callType,
        provider: 'agnes',
        model: this.aiSettings.current.textModel,
        bizId: options.bizId ?? 0,
        promptTokens: body.usage?.prompt_tokens ?? 0,
        completionTokens: body.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - startedAt,
        status: 'success',
      });
      return content;
    } catch (error) {
      await this.aiCallLog.record({
        type: callType,
        provider: 'agnes',
        model: this.aiSettings.current.textModel,
        bizId: options.bizId ?? 0,
        latencyMs: Date.now() - startedAt,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof AiProviderError) {
        throw error;
      }
      throw new AiProviderError(`${callType} 调用失败: ${error instanceof Error ? error.message : String(error)}`, {
        retryable: true,
      });
    }
  }

  /**
   * 生成每日句签主题（一张精美闪卡的文案 + 生图提示词）。
   * 输出形状 {"title","titleZh","sentenceEn","translationZh","scenePrompt"}。
   *
   * @param day 业务日期 YYYY-MM-DD
   * @param recent 最近几张卡的主题（用于去重，避免连续同质化）
   * @param context 当天的节日/节气语境（命中时按该风格生成，否则随机维度）
   */
  async generateSentenceCardTheme(
    day: string,
    recent: SentenceCardTheme[] = [],
    context?: DayContext,
  ): Promise<SentenceCardTheme> {
    if (!this.enabled) {
      throw new AiProviderError('生题能力未配置（AI_AGNES_API_KEY 缺失）', { retryable: false });
    }

    // 最近几天的主题摘要，喂给模型做去重。
    // 只写「每天要不同」是不够的：模型看不到历史，只能凭运气避开，
    // 实测会连续多天收敛到同一个安全区（曾连续 4 天都是 quiet/stillness/静谧）。
    const recentBlock =
      recent.length === 0
        ? '(no previous cards)'
        : recent.map((item, i) => `${i + 1}. ${item.title} / ${item.titleZh}: ${item.sentenceEn}`).join('\n');

    /**
     * 节日/节气段落。
     *
     * 命中节日或节气时，主题**必须**贴这个日子（这是用户要的「时间感」：
     * 到中秋就该是中秋，而不是随机一张好看的卡）。
     * 普通日则给随机维度，由模型自由发挥。
     */
    const themeBlock =
      context && context.kind !== 'ordinary'
        ? [
            `TODAY IS SPECIAL — ${context.kind === 'festival' ? 'FESTIVAL' : 'SOLAR TERM'}: ${context.name} (${context.nameEn}).`,
            `The card MUST be built around this day. Visual and emotional direction: ${context.styleHint}`,
            'Use concrete, culturally respectful imagery of this day. Do NOT explain the festival in the text;',
            'let the image and the sentence carry it. The Chinese title should name the day naturally',
            `(e.g. include「${context.name}」or a poetic variant of it), not a generic mood word.`,
            'Still keep it fresh: avoid postcard clichés and greeting-card slogans.',
          ].join('\n')
        : '';

    const systemPrompt = [
      'You are the card designer for "Short Sentence", an app where users collect one beautiful flash card per day.',
      'Hard requirements:',
      '1. Output JSON only, shaped as {"title":"","titleZh":"","sentenceEn":"","translationZh":"","scenePrompt":"","blessing":""}.',
      '   No explanations.',
      '2. title: English theme name, 2-4 words (e.g. "Morning Ritual"). titleZh: the Chinese theme name.',
      '3. sentenceEn: one short English sentence (at most 12 words) that lands a concrete image or a small specific moment.',
      '   Prefer a tangible scene over an abstract mood. Avoid vague beauty/peace/quiet statements.',
      '4. translationZh: natural Chinese following Chinese word order. Never translate literally.',
      '   Example: "Small hands gather what the patient earth has grown." -> 「小小的手，捧起大地耐心孕育的果实」,',
      '   never 「小小的手，收获耐心大地生长出的果实」. Keep the Chinese short too; it must read smoothly aloud.',
      '5. titleZh and translationZh must not stack the same words; they should read like Chinese, not a translation.',
      '6. scenePrompt: English image prompt for a storybook-style scene illustration (NOT two people talking):',
      '   describe the subject, environment, light and palette; flat / storybook style, 16:9, no text in the image.',
      '7. blessing: a short Chinese dedication (at most 24 characters) written for whoever collects this card today.',
      '   Warm and specific to the theme; never a translation of sentenceEn; no exclamation marks;',
      '   read like something a friend would write on the back of a postcard.',
      `8. Date: ${day}.`,
      themeBlock,
      '',
      'DIVERSITY RULES (still apply on ordinary days; on special days they only constrain HOW, not WHAT):',
      'A. These themes were already used on the previous days:',
      recentBlock,
      'B. Your new theme MUST NOT reuse any of them, and MUST NOT be a synonym or near-variant.',
      '   Same mood under a different name counts as a repeat.',
      '',
      'C. BEAUTY BAR — this is a collectible card, not a diary entry.',
      '   The scene must be something a person would happily set as a phone wallpaper or keep as a postcard.',
      '   Every card needs: a clear subject, beautiful light, and a palette that feels deliberate.',
      '   FORBIDDEN settings (they are mundane, not beautiful): appliances and home chores',
      '   (washing machine, laundromat, toaster, microwave, dishes, vacuuming), offices,',
      '   industrial or mechanical scenes, hospitals, traffic jams, queues, paperwork.',
      '   "Concrete" means a tangible image, NOT a household chore.',
      '',
      'D. On an ORDINARY day, choose a different EMOTIONAL REGISTER from the recent cards.',
      '   These registers are all beautiful but feel different — cycle through them:',
      '   - serene: mist over still water, snow after it stops, an empty mountain path',
      '   - warm: firelight, dusk in a kitchen, wool and steam, bread cooling on a sill',
      '   - vast: a sea horizon, high grassland, a sky full of stars, a long empty road',
      '   - bright: hard noon sun on a white wall, cut lemons, laundry snapping in wind',
      '   - anticipating: a platform before arrival, light under a door, an unopened letter',
      '   - intimate: two hands around one cup, a shared umbrella, a note left on a table',
      '   - playful: a cat claiming a sunlit chair, wind lifting papers, a kite tugging',
      '   - nostalgic: an old radio, a grandmother\u2019s courtyard, a photo tucked in a book',
      '   - crisp: frost on a window, cold blue hour, clear water over stones',
      '   - ardent: a summer run, a sunset burning, dancing barefoot',
      '',
      'E. Look at the recent cards above and note what they used. Your card must differ on AT LEAST TWO of:',
      '   time of day (dawn / morning / noon / afternoon / dusk / night),',
      '   setting (indoor vs outdoor, and the specific kind of place),',
      '   emotional register (from list D),',
      '   palette (warm gold / cool blue / green / monochrome / vivid).',
      '   If recent cards were all night-time indoor scenes, do NOT deliver another night-time indoor scene.',
      '',
      'F. Avoid common holidays on ordinary days (they are handled separately). Concrete beats poetic.',
      '   But beautiful beats merely concrete: if an idea is specific yet ugly, drop it.',
      '',
      'G. Do NOT anchor on the current season or month. October does not mean autumn leaves,',
      '   harvest, pumpkins or golden fields. A card may be set in any season, any weather, any hour —',
      '   the date is only the day it is delivered, not a constraint on the scene.',
      '   FORBIDDEN words and their variants: harvest, golden autumn, ripe grain, abundance,',
      '   bountiful, fruitful. They are greeting-card clichés and must never appear.',
      '',
      'H. Palette lock: look at the recent cards\u2019 palettes. If the last two share a palette family',
      '   (e.g. both warm amber/gold), this card MUST use a different family: cool blue, green,',
      '   monochrome, high-contrast night, or soft pastel. Do not let gold recur.',
    ].join('\n');

    // 复读兜底：prompt 要求「不得重复」是软约束，实测模型会直接复读上一次输出
    // （曾连续两次给出完全相同的标题与句子）。这里生成后与历史硬比对，
    // 撞了就再生成一次，最多 3 次；仍撞则接受（避免无限重试拖垮定时任务）。
    const userContent =
      context && context.kind !== 'ordinary'
        ? `Generate the daily card for ${day}. It is ${context.nameEn} (${context.name}) — build the card around it.`
        : `Generate the daily card theme for ${day}. It must differ from the previous days in BOTH subject and mood.`;

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      // 撞重后追加一句更强的提醒，而不是原样再问一遍
      const retryHint =
        attempt === 1
          ? ''
          : `\n\nIMPORTANT: your previous answer duplicated an existing card. Produce a clearly different subject, setting and palette.`;
      const content = await this.chat('sentence_card_gen', systemPrompt, `${userContent}${retryHint}`, 1.0);
      const theme = this.parseSentenceCardTheme(content);
      if (!theme) {
        throw new AiProviderError('句签主题输出不可用', { retryable: true });
      }
      if (!this.isDuplicateTheme(theme, recent)) {
        return theme;
      }
      this.logger.warn(`[SentenceCard] 第 ${attempt}/${maxAttempts} 次生成与历史重复（${theme.titleZh}），重试`);
    }

    // 三次都撞：宁可抛错让定时任务记失败、运营手动重跑，
    // 也不要把一张重复的卡发给用户。
    throw new AiProviderError('句签主题连续重复，已放弃本次生成', { retryable: true });
  }

  /**
   * 判断新主题是否与最近某张卡重复。
   *
   * **为什么需要代码兜底**：prompt 里已经写了「不得重复」，但实测模型仍会
   * 直接复读上一次的输出（曾连续两次给出完全相同的 "Library Dust / 旧书尘埃"
   * 与同一句英文）。指令是软约束，采样会失效；这一层是硬拦截。
   *
   * 判重口径（归一化后）：
   * - title 相同，或
   * - sentenceEn 相同，或
   * - titleZh 相同
   * 不做模糊相似度：过严会误杀正常变体，而完全相同的复读才是真问题。
   */
  private isDuplicateTheme(theme: SentenceCardTheme, recent: SentenceCardTheme[]): boolean {
    const norm = (value: string): string =>
      value
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}]+/gu, '');
    const title = norm(theme.title);
    const zh = norm(theme.titleZh);
    const sentence = norm(theme.sentenceEn);
    return recent.some((item) => {
      const otherTitle = norm(item.title);
      const otherZh = norm(item.titleZh);
      const otherSentence = norm(item.sentenceEn);
      return (
        (title.length > 0 && title === otherTitle) ||
        (zh.length > 0 && zh === otherZh) ||
        (sentence.length > 0 && sentence === otherSentence)
      );
    });
  }

  /** 解析句签主题输出（容忍 ```json 围栏与思考文字夹带）。 */
  private parseSentenceCardTheme(content: string): SentenceCardTheme | null {
    let text = content.trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/;
    const matched = fence.exec(text);
    if (matched) {
      text = matched[1].trim();
    }
    if (!text.startsWith('{')) {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        text = text.slice(start, end + 1);
      }
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.logger.warn('[SentenceCard] 句签主题输出不是合法 JSON，已丢弃');
      return null;
    }
    const raw = parsed as Record<string, unknown>;
    const theme: SentenceCardTheme = {
      title: str(raw.title, 80),
      titleZh: str(raw.titleZh, 80),
      sentenceEn: str(raw.sentenceEn, 200),
      translationZh: str(raw.translationZh, 200),
      scenePrompt: str(raw.scenePrompt, 500),
      blessing: str(raw.blessing, 120),
    };
    // 标题与短句为卡面必需，缺任一视为不可用；寄语允许为空（老卡片没有，前端有兜底文案）
    if (!theme.title || !theme.sentenceEn || !theme.scenePrompt) {
      return null;
    }
    return theme;
  }

  /** 从模型输出中取出 items 数组（容忍 ```json 围栏与思考文字夹带）。 */
  private extractItems(content: string): unknown[] {
    let text = content.trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/;
    const matched = fence.exec(text);
    if (matched) {
      text = matched[1].trim();
    }
    // 兜底：输出可能夹带思考/解释文字（推理模型尤其常见），截取首个 { 到末个 } 之间的片段再解析
    if (!text.startsWith('{') && !text.startsWith('[')) {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        text = text.slice(start, end + 1);
      }
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      this.logger.warn(`[Sentence] 模型输出不是合法 JSON，已丢弃：${(err as Error).message}`);
      return [];
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
    const container = parsed as { items?: unknown };
    return Array.isArray(container?.items) ? container.items : [];
  }

  /** 解析模型输出为草稿数组（字段缺失按空处理）。 */
  private parseDrafts(content: string): SentenceDraft[] {
    const drafts: SentenceDraft[] = [];
    for (const item of this.extractItems(content)) {
      if (!isUsableDraft(item)) {
        continue;
      }
      // isUsableDraft 已把 item 收窄为 SentenceDraft；这里再按记录访问需要二次断言
      const draft = item as unknown as Record<string, unknown>;
      const sentenceEn = str(draft.sentenceEn, 300);
      drafts.push({
        sentenceEn,
        alternateAnswers: parseAlternatesWith(sentenceEn, draft.alternateAnswers),
        translationZh: str(draft.translationZh, 300),
        ipa: str(draft.ipa, 200),
        explanation: str(draft.explanation, 500),
        scenePrompt: str(draft.scenePrompt, 500),
        difficulty: this.clampDifficulty(draft.difficulty),
        categoryName: str(draft.categoryName, 50),
      });
    }
    return drafts;
  }

  /** 难度归一到 1~3（非法值按 2 处理）。 */
  private clampDifficulty(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 2;
    }
    return Math.min(3, Math.max(1, Math.floor(parsed)));
  }
}
