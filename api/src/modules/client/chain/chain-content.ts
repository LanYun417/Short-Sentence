/**
 * 接龙内容校验与匿名化名（纯函数，便于单测）。
 *
 * 这是本功能唯一的内容安全闸门：接龙是 UGC，**必须在入库前把能挡的挡掉**，
 * 而不是等举报。闸门只管「明显不该出现的东西」——链接、联系方式、纯符号灌水、
 * 非英文内容；语义好坏交给社区举报与后台处理，规则引擎判不了。
 */

/** 校验结果。 */
export interface ContentCheck {
  ok: boolean;
  message?: string;
  /** 规范化后的英文（折叠多余空格、去首尾） */
  contentEn: string;
  /** 规范化后的中文（空串归一成 null 由调用方处理） */
  contentZh: string;
}

/** 英文字段允许的字符：可打印 ASCII（字母 / 数字 / 常用标点）。 */
const ASCII_PRINTABLE = /^[\x20-\x7E]+$/;
/** 明显是链接 / 联系方式：一律拒绝（UGC 最常见的滥用形态）。 */
const LINK_OR_CONTACT = /(https?:\/\/|www\.|\.com\b|@[a-z0-9_-]+|\b\d{6,}\b)/i;
/** 同一字符连续 8 次以上：刷屏灌水。 */
const REPEAT_SPAM = /(.)\1{7,}/;

/** 英文续写长度上下限。 */
const MIN_EN = 6;
const MAX_EN = 200;
/** 中文翻译长度上限。 */
const MAX_ZH = 120;

/** 是否含至少两个英文单词（单词 = 连续字母）。 */
function wordCount(text: string): number {
  return text.split(/\s+/).filter((item) => /^[A-Za-z][A-Za-z'-]*$/.test(item)).length;
}

/**
 * 校验一条接龙。
 * @param rawEn 英文续写（必填）
 * @param rawZh 中文翻译（可选）
 */
export function validateEntry(rawEn: string, rawZh?: string | null): ContentCheck {
  const contentEn = (rawEn ?? '').replace(/\s+/g, ' ').trim();
  const contentZh = (rawZh ?? '').replace(/\s+/g, ' ').trim();

  if (contentEn.length < MIN_EN) {
    return { ok: false, message: '再写长一点点吧，至少两个英文单词', contentEn, contentZh };
  }
  if (contentEn.length > MAX_EN) {
    return { ok: false, message: `英文续写最多 ${MAX_EN} 个字符`, contentEn, contentZh };
  }
  if (!ASCII_PRINTABLE.test(contentEn)) {
    return { ok: false, message: '这里只接英文，中文请写进「中文翻译」', contentEn, contentZh };
  }
  if (wordCount(contentEn) < 2) {
    return { ok: false, message: '至少写两个英文单词，才接得上上一句', contentEn, contentZh };
  }
  if (LINK_OR_CONTACT.test(contentEn) || REPEAT_SPAM.test(contentEn)) {
    return { ok: false, message: '请不要留链接或联系方式', contentEn, contentZh };
  }
  if (contentZh.length > MAX_ZH) {
    return { ok: false, message: `中文翻译最多 ${MAX_ZH} 个字符`, contentEn, contentZh };
  }
  if (contentZh && LINK_OR_CONTACT.test(contentZh)) {
    return { ok: false, message: '请不要留链接或联系方式', contentEn, contentZh };
  }

  return { ok: true, contentEn, contentZh };
}

/** 匿名化名的名词库（不暴露任何用户信息）。 */
const ALIAS_NOUNS = ['旅人', '过客', '夜行者', '写信人', '赶路人', '旁观者', '同路人', '旧友', '候车人', '收信人'];

/**
 * 按 userId + topicId 派生稳定的匿名化名。
 *
 * **为什么要稳定**：同一主题下同一个人应该始终是同一个名字，否则读者会以为
 * 每条都是不同人写的，接龙的「对话感」就没了。用纯函数而不是随机数，
 * 刷新页面名字也不会变。
 */
export function aliasOf(userId: number, topicId: number): string {
  const hash = (Math.imul(userId, 2654435761) + Math.imul(topicId, 40503)) >>> 0;
  const noun = ALIAS_NOUNS[hash % ALIAS_NOUNS.length] ?? ALIAS_NOUNS[0];
  return `${noun}·${(hash % 9000) + 1000}`;
}
