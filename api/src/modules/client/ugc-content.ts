/**
 * UGC 内容校验（纯函数，便于单测）——接龙、投稿等用户生成内容共用。
 *
 * 这是本项目 UGC 的**入库前闸门**：接龙是 UGC，用户投稿（审核通过后会公开展示）
 * 也是 UGC，两者共用同一套规则，避免「一个入口校验、另一个裸奔」。
 *
 * 闸门只挡「明显不该出现的东西」——链接、联系方式、纯符号灌水、英文字段里混中文；
 * 语义好坏交给社区举报与后台审核，规则引擎判不了。
 */

/** 校验结果。 */
export interface ContentCheck {
  ok: boolean;
  message?: string;
  /** 规范化后的英文（折叠多余空格、去首尾） */
  contentEn: string;
  /** 规范化后的中文（空串归一成空串，由调用方决定是否转 null） */
  contentZh: string;
}

/** 可覆盖的长度限制（接龙默认 6~200 / 120；投稿等场景可以放宽到 300）。 */
export interface EntryLimits {
  minEn?: number;
  maxEn?: number;
  maxZh?: number;
}

/** 纯文本（附言等）校验结果。 */
export interface TextCheck {
  ok: boolean;
  message?: string;
  value: string;
}

/** 英文字段允许的字符：可打印 ASCII（字母 / 数字 / 常用标点）。 */
const ASCII_PRINTABLE = /^[\x20-\x7E]+$/;
/** 明显是链接 / 联系方式：一律拒绝（UGC 最常见的滥用形态）。 */
const LINK_OR_CONTACT = /(https?:\/\/|www\.|\.com\b|@[a-z0-9_-]+|\b\d{6,}\b)/i;
/** 同一字符连续 8 次以上：刷屏灌水。 */
const REPEAT_SPAM = /(.)\1{7,}/;

/** 默认长度限制（接龙口径）。 */
const DEFAULT_MIN_EN = 6;
const DEFAULT_MAX_EN = 200;
const DEFAULT_MAX_ZH = 120;

/** 是否含至少两个英文单词（单词 = 连续字母）。 */
function wordCount(text: string): number {
  return text.split(/\s+/).filter((item) => /^[A-Za-z][A-Za-z'-]*$/.test(item)).length;
}

/**
 * 校验一条「英文 + 中文」UGC 内容（接龙续写、用户投稿正文）。
 * @param rawEn 英文（必填）
 * @param rawZh 中文（可选）
 * @param limits 长度限制，默认接龙口径（6~200 / 120）
 */
export function validateEntry(rawEn: string, rawZh?: string | null, limits: EntryLimits = {}): ContentCheck {
  const minEn = limits.minEn ?? DEFAULT_MIN_EN;
  const maxEn = limits.maxEn ?? DEFAULT_MAX_EN;
  const maxZh = limits.maxZh ?? DEFAULT_MAX_ZH;
  const contentEn = (rawEn ?? '').replace(/\s+/g, ' ').trim();
  const contentZh = (rawZh ?? '').replace(/\s+/g, ' ').trim();

  if (contentEn.length < minEn) {
    return { ok: false, message: '再写长一点点吧，至少两个英文单词', contentEn, contentZh };
  }
  if (contentEn.length > maxEn) {
    return { ok: false, message: `英文内容最多 ${maxEn} 个字符`, contentEn, contentZh };
  }
  if (!ASCII_PRINTABLE.test(contentEn)) {
    return { ok: false, message: '这里只写英文，中文请写进「中文」一栏', contentEn, contentZh };
  }
  if (wordCount(contentEn) < 2) {
    return { ok: false, message: '至少写两个英文单词', contentEn, contentZh };
  }
  if (LINK_OR_CONTACT.test(contentEn) || REPEAT_SPAM.test(contentEn)) {
    return { ok: false, message: '请不要留链接或联系方式', contentEn, contentZh };
  }
  if (contentZh.length > maxZh) {
    return { ok: false, message: `中文内容最多 ${maxZh} 个字符`, contentEn, contentZh };
  }
  if (contentZh && LINK_OR_CONTACT.test(contentZh)) {
    return { ok: false, message: '请不要留链接或联系方式', contentEn, contentZh };
  }

  return { ok: true, contentEn, contentZh };
}

/**
 * 校验一段自由文本（附言、备注等允许中英文混合的字段）：长度 + 链接/联系方式。
 */
export function checkFreeText(raw: string | null | undefined, maxLen: number, label = '内容'): TextCheck {
  const value = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (value.length > maxLen) {
    return { ok: false, message: `${label}最多 ${maxLen} 个字符`, value };
  }
  if (value && (LINK_OR_CONTACT.test(value) || REPEAT_SPAM.test(value))) {
    return { ok: false, message: '请不要留链接或联系方式', value };
  }
  return { ok: true, value };
}

/** 匿名化名的名词库（不暴露任何用户信息）。 */
const ALIAS_NOUNS = ['旅人', '过客', '夜行者', '写信人', '赶路人', '旁观者', '同路人', '旧友', '候车人', '收信人'];

/**
 * 按 userId + salt 派生稳定的匿名化名。
 *
 * **为什么要稳定**：同一主题下同一个人应该始终是同一个名字，否则读者会以为
 * 每条都是不同人写的，接龙的「对话感」就没了。用纯函数而不是随机数，
 * 刷新页面名字也不会变。
 */
export function aliasOf(userId: number, salt: number): string {
  const hash = (Math.imul(userId, 2654435761) + Math.imul(salt, 40503)) >>> 0;
  const noun = ALIAS_NOUNS[hash % ALIAS_NOUNS.length] ?? ALIAS_NOUNS[0];
  return `${noun}·${(hash % 9000) + 1000}`;
}
