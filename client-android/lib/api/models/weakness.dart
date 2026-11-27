/// 弱点词根报告（对应后端 /client/questions/weakness）。
library;

class WeakExample {
  const WeakExample({
    required this.sentenceId,
    required this.translationZh,
    required this.userAnswer,
  });

  final int sentenceId;
  final String translationZh;
  final String userAnswer;
}

class WeakRootItem {
  const WeakRootItem({
    required this.word,
    required this.meaning,
    required this.rootAnalysis,
    required this.wrongCount,
    required this.totalCount,
    required this.examples,
  });

  final String word;
  final String? meaning;
  final String? rootAnalysis;
  final int wrongCount;
  final int totalCount;
  final List<WeakExample> examples;
}

class WeaknessReport {
  const WeaknessReport({
    required this.windowDays,
    required this.totalWrong,
    required this.items,
  });

  final int windowDays;
  final int totalWrong;
  final List<WeakRootItem> items;

  factory WeaknessReport.fromJson(Map<String, dynamic> json) {
    return WeaknessReport(
      windowDays: (json['windowDays'] as num?)?.toInt() ?? 30,
      totalWrong: (json['totalWrong'] as num?)?.toInt() ?? 0,
      items: (json['items'] as List<dynamic>? ?? <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(
            (item) => WeakRootItem(
              word: item['word'] as String? ?? '',
              meaning: item['meaning'] as String?,
              rootAnalysis: item['rootAnalysis'] as String?,
              wrongCount: (item['wrongCount'] as num?)?.toInt() ?? 0,
              totalCount: (item['totalCount'] as num?)?.toInt() ?? 0,
              examples: (item['examples'] as List<dynamic>? ?? <dynamic>[])
                  .whereType<Map<String, dynamic>>()
                  .map(
                    (example) => WeakExample(
                      sentenceId: (example['sentenceId'] as num?)?.toInt() ?? 0,
                      translationZh: example['translationZh'] as String? ?? '',
                      userAnswer: example['userAnswer'] as String? ?? '',
                    ),
                  )
                  .toList(),
            ),
          )
          .toList(),
    );
  }
}
