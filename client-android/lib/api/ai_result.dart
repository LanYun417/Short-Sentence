/// AI 拓展结果：解析流式输出里的单行 JSON。
///
/// 后端提示词要求「单行紧凑 JSON，不要代码块」，但模型偶尔仍会包一层 ```json
/// 或前后带一句解释。这里做**宽容解析**：截取第一个 `{` 到最后一个 `}` 再解码，
/// 解析失败返回 null，由调用方回退显示原文——绝不把脏数据渲染成结构化卡片。
library;

import 'dart:convert';

/// 场景造句结果。
class ExpandResult {
  const ExpandResult({required this.sentence, required this.phonetic, required this.note});

  final String sentence;
  final String phonetic;
  final String note;

  static ExpandResult? tryParse(String raw) {
    final json = _decodeLoose(raw);
    if (json == null) {
      return null;
    }
    final sentence = (json['sentence'] as String?)?.trim() ?? '';
    if (sentence.isEmpty) {
      return null;
    }
    return ExpandResult(
      sentence: sentence,
      phonetic: (json['phonetic'] as String?)?.trim() ?? '',
      note: (json['note'] as String?)?.trim() ?? '',
    );
  }
}

/// 词素（前缀 / 词根 / 后缀）。
class WordRootPart {
  const WordRootPart({required this.type, required this.text, required this.meaning});

  /// prefix / root / suffix。
  final String type;
  final String text;
  final String meaning;

  String get typeLabel => switch (type) {
        'prefix' => '前缀',
        'suffix' => '后缀',
        _ => '词根',
      };
}

/// 词根拆解结果。
class WordRootResult {
  const WordRootResult({
    required this.phonetic,
    required this.meaning,
    required this.parts,
    required this.explanation,
    required this.related,
  });

  final String phonetic;
  final String meaning;
  final List<WordRootPart> parts;
  final String explanation;
  final List<String> related;

  static WordRootResult? tryParse(String raw) {
    final json = _decodeLoose(raw);
    if (json == null) {
      return null;
    }
    final meaning = (json['meaning'] as String?)?.trim() ?? '';
    final parts = <WordRootPart>[];
    final rawParts = json['parts'];
    if (rawParts is List) {
      for (final item in rawParts) {
        if (item is Map<String, dynamic>) {
          final text = (item['text'] as String?)?.trim() ?? '';
          if (text.isEmpty) {
            continue;
          }
          parts.add(
            WordRootPart(
              type: (item['type'] as String?)?.trim() ?? 'root',
              text: text,
              meaning: (item['meaning'] as String?)?.trim() ?? '',
            ),
          );
        }
      }
    }
    if (meaning.isEmpty && parts.isEmpty) {
      return null;
    }
    final related = <String>[];
    final rawRelated = json['related'];
    if (rawRelated is List) {
      for (final item in rawRelated) {
        if (item is String && item.trim().isNotEmpty) {
          related.add(item.trim());
        }
      }
    }
    return WordRootResult(
      phonetic: (json['phonetic'] as String?)?.trim() ?? '',
      meaning: meaning,
      parts: parts,
      explanation: (json['explanation'] as String?)?.trim() ?? '',
      related: related,
    );
  }
}

Map<String, dynamic>? _decodeLoose(String raw) {
  final start = raw.indexOf('{');
  final end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  final candidate = raw.substring(start, end + 1);
  try {
    final decoded = jsonDecode(candidate);
    return decoded is Map<String, dynamic> ? decoded : null;
  } on FormatException {
    return null;
  }
}
