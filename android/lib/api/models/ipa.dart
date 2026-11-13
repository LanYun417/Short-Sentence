/// 音标学习模型。
///
/// 与后端 `/api/client/ipa/*`（`modules/client/ipa/ipa.service.ts`）逐字段对应。
/// 音标库是双端共用的静态参考数据：48 个国际音标（12 单元音 / 8 双元音 /
/// 11 清辅音 / 17 浊辅音），Web 与 App 从同一份种子渲染，避免两端漂移。
library;

/// 音标类型（分组由后端顺序下发）。
enum IpaPhonemeType {
  /// 单元音（12）
  vowel('vowel', '单元音'),

  /// 双元音（8）
  diphthong('diphthong', '双元音'),

  /// 清辅音（11）
  consonantVoiceless('consonant_voiceless', '清辅音'),

  /// 浊辅音（17）
  consonantVoiced('consonant_voiced', '浊辅音');

  const IpaPhonemeType(this.value, this.title);

  /// 后端字段值。
  final String value;

  /// 分组标题（中文）。
  final String title;

  /// 按后端字段值解析（未知值回落单元音，防止新分组闪退）。
  static IpaPhonemeType fromValue(String value) {
    return IpaPhonemeType.values.firstWhere(
      (t) => t.value == value,
      orElse: () => IpaPhonemeType.vowel,
    );
  }
}

/// 一个音标。
class IpaPhoneme {
  const IpaPhoneme({
    required this.symbol,
    required this.type,
    required this.exampleWords,
    required this.tips,
  });

  /// 音标符号（不含斜线）。
  final String symbol;

  /// 类型（分组）。
  final IpaPhonemeType type;

  /// 示例词（用于本地朗读与提示）。
  final List<String> exampleWords;

  /// 中文发音要点（口型 + 常见错误）。
  final String tips;

  factory IpaPhoneme.fromJson(Map<String, dynamic> json) {
    return IpaPhoneme(
      symbol: json['symbol'] as String? ?? '',
      type: IpaPhonemeType.fromValue(json['type'] as String? ?? ''),
      exampleWords:
          (json['exampleWords'] as List<dynamic>? ?? const <dynamic>[]).whereType<String>().toList(),
      tips: json['tips'] as String? ?? '',
    );
  }
}

/// 一组音标（含分组标题与描述）。
class IpaPhonemeGroup {
  const IpaPhonemeGroup({
    required this.type,
    required this.title,
    required this.hint,
    required this.items,
  });

  final IpaPhonemeType type;
  final String title;

  /// 分组说明（如「12 个：发音时口型不变的元音」）。
  final String hint;
  final List<IpaPhoneme> items;

  factory IpaPhonemeGroup.fromJson(Map<String, dynamic> json) {
    return IpaPhonemeGroup(
      type: IpaPhonemeType.fromValue(json['type'] as String? ?? ''),
      title: json['title'] as String? ?? '',
      hint: json['hint'] as String? ?? '',
      items: (json['items'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(IpaPhoneme.fromJson)
          .toList(),
    );
  }
}

/// 我的某个音标进度。
class IpaProgressItem {
  const IpaProgressItem({
    required this.symbol,
    required this.learned,
  });

  final String symbol;

  /// 是否已标记「学会了」。
  final bool learned;

  factory IpaProgressItem.fromJson(Map<String, dynamic> json) {
    return IpaProgressItem(
      symbol: json['symbol'] as String? ?? '',
      learned: json['learned'] as bool? ?? false,
    );
  }
}

/// 标记「学会了」的响应。
class IpaLearnedResult {
  const IpaLearnedResult({
    required this.symbol,
    required this.firstTime,
    required this.xpAwarded,
    required this.learnedCount,
  });

  final String symbol;

  /// 是否首次学会（false = 之前已标记过）。
  final bool firstTime;

  /// 本次是否实发 XP（幂等：同一音标只发一次）。
  final bool xpAwarded;

  /// 当前已学会总数。
  final int learnedCount;

  factory IpaLearnedResult.fromJson(Map<String, dynamic> json) {
    return IpaLearnedResult(
      symbol: json['symbol'] as String? ?? '',
      firstTime: json['firstTime'] as bool? ?? false,
      xpAwarded: json['xpAwarded'] as bool? ?? false,
      learnedCount: (json['learnedCount'] as num?)?.toInt() ?? 0,
    );
  }
}
