/// 答案规范化（与后端 `QuestionsService.normalizeAnswer`、Web 端
/// `utils/answer-normalize.ts` 同口径）。
///
/// **只用于输入期的预校验提示**（例如按钮置灰、字符计数），
/// 真正的判分永远由服务端做。三端任一侧单独放宽口径，
/// 都会造成「前端显示对、后端判错」的割裂体验。
library;

/// 规范化：小写、去首尾非字母数字、压缩连续空白。
String normalizeAnswer(String value) {
  return value
      .toLowerCase()
      .trim()
      .replaceAll(RegExp(r'^[^a-z0-9]+'), '')
      .replaceAll(RegExp(r'[^a-z0-9]+$'), '')
      .replaceAll(RegExp(r'\s+'), ' ');
}

/// 用户输入是否为「空答案」（ trim 后什么都没有）。
bool isBlankAnswer(String value) => normalizeAnswer(value).isEmpty;
