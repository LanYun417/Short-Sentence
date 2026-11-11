/// 成长体系模型：XP 等级、成就、场景地图、句签、打卡。
///
/// 与后端 `GamifyOverview` / `SentenceCardView` / `CheckinToday`
/// 逐字段对应（见 api 的 `modules/client/gamify|sentence-card|checkin`）。
library;

/// CEFR 等级信息。
class LevelInfo {
  const LevelInfo({
    required this.code,
    required this.name,
    required this.min,
    required this.next,
    this.nextName,
    required this.toNext,
    required this.progress,
  });

  /// 等级码（A1~C2）。仅用于调试/兼容，界面不再展示。
  final String code;

  /// 等级名（如「进阶」）。界面展示这个，而不是 code。
  final String name;

  /// 当前等级起始 XP。
  final int min;

  /// 下一等级起始 XP（满级为 null）。
  final int? next;

  /// 下一等级名称（满级为 null）。
  final String? nextName;

  /// 距下一等级还需 XP（满级为 0）。
  final int toNext;

  /// 当前等级进度 0~100（满级为 100）。
  final int progress;

  bool get isMax => next == null;

  factory LevelInfo.fromJson(Map<String, dynamic> json) {
    return LevelInfo(
      code: json['code'] as String? ?? 'A1',
      name: json['name'] as String? ?? '',
      min: (json['min'] as num?)?.toInt() ?? 0,
      next: (json['next'] as num?)?.toInt(),
      nextName: json['nextName'] as String?,
      toNext: (json['toNext'] as num?)?.toInt() ?? 0,
      progress: (json['progress'] as num?)?.toInt() ?? 0,
    );
  }
}

/// 成就。
class AchievementView {
  const AchievementView({
    required this.code,
    required this.name,
    required this.description,
    required this.icon,
    required this.category,
    required this.rewardXp,
    required this.unlocked,
    required this.unlockedAt,
  });

  final String code;
  final String name;
  final String description;

  /// 图标名（后端下发，前端映射到本地图标）。
  final String icon;

  /// 分组：persist 坚持 / behavior 行为 / luck 运气。
  final String category;

  /// 奖励 XP。
  final int rewardXp;

  /// 是否已解锁。
  final bool unlocked;

  /// 解锁时间（ISO；未解锁为 null）。
  final DateTime? unlockedAt;

  factory AchievementView.fromJson(Map<String, dynamic> json) {
    return AchievementView(
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      icon: json['icon'] as String? ?? '',
      category: json['category'] as String? ?? '',
      rewardXp: (json['rewardXp'] as num?)?.toInt() ?? 0,
      unlocked: json['unlocked'] as bool? ?? false,
      unlockedAt: DateTime.tryParse(json['unlockedAt'] as String? ?? ''),
    );
  }

  String get categoryLabel => switch (category) {
        'persist' => '坚持',
        'behavior' => '行为',
        'luck' => '运气',
        _ => category,
      };
}

/// 场景探索地图项。
class SceneMapItem {
  const SceneMapItem({
    required this.id,
    required this.name,
    required this.nameEn,
    required this.icon,
    required this.unlocked,
    required this.practicedCount,
  });

  final int id;
  final String name;
  final String? nameEn;
  final String? icon;

  /// 是否已解锁（练过该场景至少 1 句）。
  final bool unlocked;

  /// 该场景已练句子数。
  final int practicedCount;

  factory SceneMapItem.fromJson(Map<String, dynamic> json) {
    return SceneMapItem(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: json['name'] as String? ?? '',
      nameEn: json['nameEn'] as String?,
      icon: json['icon'] as String?,
      unlocked: json['unlocked'] as bool? ?? false,
      practicedCount: (json['practicedCount'] as num?)?.toInt() ?? 0,
    );
  }
}

/// 成长概览。
class GamifyOverview {
  const GamifyOverview({
    required this.xp,
    required this.level,
    required this.achievements,
    required this.unlockedAchievements,
    required this.totalAchievements,
    required this.sceneMap,
    required this.unlockedScenes,
    required this.totalScenes,
  });

  final int xp;
  final LevelInfo level;
  final List<AchievementView> achievements;
  final int unlockedAchievements;
  final int totalAchievements;
  final List<SceneMapItem> sceneMap;
  final int unlockedScenes;
  final int totalScenes;

  factory GamifyOverview.fromJson(Map<String, dynamic> json) {
    final achievements = json['achievements'];
    final sceneMap = json['sceneMap'];
    return GamifyOverview(
      xp: (json['xp'] as num?)?.toInt() ?? 0,
      level: LevelInfo.fromJson(
        (json['level'] as Map<String, dynamic>?) ?? const <String, dynamic>{},
      ),
      achievements: achievements is List
          ? achievements.whereType<Map<String, dynamic>>().map(AchievementView.fromJson).toList()
          : const <AchievementView>[],
      unlockedAchievements: (json['unlockedAchievements'] as num?)?.toInt() ?? 0,
      totalAchievements: (json['totalAchievements'] as num?)?.toInt() ?? 0,
      sceneMap: sceneMap is List
          ? sceneMap.whereType<Map<String, dynamic>>().map(SceneMapItem.fromJson).toList()
          : const <SceneMapItem>[],
      unlockedScenes: (json['unlockedScenes'] as num?)?.toInt() ?? 0,
      totalScenes: (json['totalScenes'] as num?)?.toInt() ?? 0,
    );
  }
}

/// 句签。
class SentenceCard {
  const SentenceCard({
    required this.id,
    required this.bizDate,
    required this.title,
    required this.titleZh,
    required this.sentenceEn,
    required this.translationZh,
    required this.blessing,
    required this.imageUrl,
    required this.obtainedAt,
  });

  final int id;

  /// 业务日期（YYYY-MM-DD）。
  final String bizDate;

  /// 标题（英文）。
  final String title;

  /// 标题（中文）。
  final String titleZh;

  final String sentenceEn;
  final String translationZh;

  /// 寄语（这张卡独有的一句；老卡片为空，展示侧有兜底文案）。
  final String blessing;
  final String? imageUrl;

  /// 获得时间（null = 未领取）。
  final DateTime? obtainedAt;

  bool get obtained => obtainedAt != null;

  factory SentenceCard.fromJson(Map<String, dynamic> json) {
    return SentenceCard(
      id: (json['id'] as num?)?.toInt() ?? 0,
      bizDate: json['bizDate'] as String? ?? '',
      title: json['title'] as String? ?? '',
      titleZh: json['titleZh'] as String? ?? '',
      sentenceEn: json['sentenceEn'] as String? ?? '',
      translationZh: json['translationZh'] as String? ?? '',
      blessing: json['blessing'] as String? ?? '',
      imageUrl: json['imageUrl'] as String?,
      obtainedAt: DateTime.tryParse(json['obtainedAt'] as String? ?? ''),
    );
  }
}

/// 未拥有的句签（成长页「查看未拥有」用）。
///
/// 后端 `/client/sentence-card/missing` 返回最近的未拥有句签（按业务日期倒序），
/// `total` 可能大于 `list.length`——列表只给一页预览，总数单独给。
class MissingSentenceCards {
  const MissingSentenceCards({required this.total, required this.list});

  final int total;
  final List<SentenceCard> list;

  factory MissingSentenceCards.fromJson(Map<String, dynamic> json) {
    final list = json['list'];
    return MissingSentenceCards(
      total: (json['total'] as num?)?.toInt() ?? 0,
      list: list is List
          ? list.whereType<Map<String, dynamic>>().map(SentenceCard.fromJson).toList()
          : const <SentenceCard>[],
    );
  }
}

/// 今日句签状态（轻量：只有「领没领」与业务日期，不含卡片内容）。
///
/// 后端 `/client/sentence-card/today` 的返回是 `{ obtained, bizDate }`：
/// 这里曾误当成完整卡片解析，结果 `obtainedAt` 永远为 null，
/// 表现为「领取成功了，入口还在」。
class TodayCardStatus {
  const TodayCardStatus({required this.obtained, required this.bizDate});

  final bool obtained;
  final String bizDate;

  factory TodayCardStatus.fromJson(Map<String, dynamic> json) {
    return TodayCardStatus(
      obtained: json['obtained'] as bool? ?? false,
      bizDate: json['bizDate'] as String? ?? '',
    );
  }
}

/// 今日打卡状态。
class CheckinToday {
  const CheckinToday({
    required this.date,
    required this.doneCount,
    required this.goalCount,
    required this.streak,
    required this.completed,
  });

  final String date;
  final int doneCount;
  final int goalCount;
  final int streak;
  final bool completed;

  double get progress =>
      goalCount <= 0 ? 0 : (doneCount / goalCount).clamp(0, 1).toDouble();

  factory CheckinToday.fromJson(Map<String, dynamic> json) {
    return CheckinToday(
      date: json['date'] as String? ?? '',
      doneCount: (json['doneCount'] as num?)?.toInt() ?? 0,
      goalCount: (json['goalCount'] as num?)?.toInt() ?? 0,
      streak: (json['streak'] as num?)?.toInt() ?? 0,
      completed: json['completed'] as bool? ?? false,
    );
  }
}
