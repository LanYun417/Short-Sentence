/**
 * 答案规范化（与后端 QuestionsService.normalizeAnswer 同口径）。
 * 后端是最终判定权威；这里仅用于输入期的预校验提示，不替代后端。
 */

/**
 * 规范化：小写、去首尾非字母数字、压缩连续空白。
 * @param value 用户输入
 * @returns 规范化后的字符串
 */
export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .replace(/\s+/g, ' ');
}
