/// 词根词典模型。
///
/// 与后端 `WordRootItem` / `WordPart` 逐字段对应
/// （见 api 的 `modules/client/word-root/word-root.service.ts`）。
library;

/// 词缀部件（前缀 / 词根 / 后缀）。
class WordPart {
  const WordPart({required this.type, required this.text, required this.meaning});

  /// prefix 前缀 / root 词根 / suffix 后缀。
  final String type;

  /// 部件文本（如 `un-`）。
  final String text;

  /// 部件含义（如「否定」）。
  final String meaning;

  factory WordPart.fromJson(Map<String, dynamic> json) {
    return WordPart(
      type: json['type'] as String? ?? 'root',
      text: json['text'] as String? ?? '',
      meaning: json['meaning'] as String? ?? '',
    );
  }

  /// 中文类型标签。
  String get typeLabel => switch (type) {
        'prefix' => '前缀',
        'suffix' => '后缀',
        _ => '词根',
      };
}

/// 词根词条。
class WordRootItem {
  const WordRootItem({
    required this.word,
    required this.phonetic,
    required this.meaning,
    required this.parts,
    required this.explanation,
    required this.related,
    required this.source,
    required this.searchCount,
  });

  final String word;
  final String? phonetic;
  final String? meaning;
  final List<WordPart> parts;
  final String explanation;
  final List<String> related;

  /// 来源：ai 实时解析 / seed 种子 / 等。
  final String source;

  final int searchCount;

  factory WordRootItem.fromJson(Map<String, dynamic> json) {
    final parts = json['parts'];
    final related = json['related'];
    return WordRootItem(
      word: json['word'] as String? ?? '',
      phonetic: json['phonetic'] as String?,
      meaning: json['meaning'] as String?,
      parts: parts is List
          ? parts.whereType<Map<String, dynamic>>().map(WordPart.fromJson).toList()
          : const <WordPart>[],
      explanation: json['explanation'] as String? ?? '',
      related: related is List ? related.whereType<String>().toList() : const <String>[],
      source: json['source'] as String? ?? '',
      searchCount: (json['searchCount'] as num?)?.toInt() ?? 0,
    );
  }
}
