/// 情景闯关视图（GET /client/stages）。
///
/// 与后端 `StageService.StageOverview` 同构。关卡 = 场景分类：
/// 每关有剧情引入、通关剧情与「累计答对 N 句」的通关线；每章首关默认解锁，
/// 章内顺序解锁（四章是平行入口，不必从第一关顺序刷）。
class StageOverview {
  const StageOverview({
    required this.chapters,
    required this.clearedStages,
    required this.totalStages,
    required this.activeStages,
    required this.claimable,
    required this.recommendedId,
  });

  final List<StageChapter> chapters;
  final int clearedStages;
  final int totalStages;
  final int activeStages;

  /// 可领取奖励的关卡数
  final int claimable;

  /// 推荐关卡 id（第一个已解锁未通关的关卡）
  final int? recommendedId;

  factory StageOverview.fromJson(Map<String, dynamic> json) {
    return StageOverview(
      chapters: (json['chapters'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(StageChapter.fromJson)
              .toList() ??
          const <StageChapter>[],
      clearedStages: json['clearedStages'] as int? ?? 0,
      totalStages: json['totalStages'] as int? ?? 0,
      activeStages: json['activeStages'] as int? ?? 0,
      claimable: json['claimable'] as int? ?? 0,
      recommendedId: json['recommendedId'] as int?,
    );
  }
}

class StageChapter {
  const StageChapter({
    required this.key,
    required this.name,
    required this.subtitle,
    required this.stages,
    required this.clearedCount,
    required this.total,
  });

  final String key;
  final String name;
  final String subtitle;
  final List<StageView> stages;
  final int clearedCount;
  final int total;

  factory StageChapter.fromJson(Map<String, dynamic> json) {
    return StageChapter(
      key: json['key'] as String? ?? '',
      name: json['name'] as String? ?? '',
      subtitle: json['subtitle'] as String? ?? '',
      stages: (json['stages'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(StageView.fromJson)
              .toList() ??
          const <StageView>[],
      clearedCount: json['clearedCount'] as int? ?? 0,
      total: json['total'] as int? ?? 0,
    );
  }
}

class StageView {
  const StageView({
    required this.id,
    required this.categoryId,
    required this.name,
    required this.nameEn,
    required this.icon,
    required this.title,
    required this.intro,
    required this.outro,
    required this.target,
    required this.rewardXp,
    required this.correctCount,
    required this.answerCount,
    required this.progress,
    required this.cleared,
    required this.unlocked,
    required this.claimed,
    required this.bankCount,
  });

  /// 关卡 id（stage_story.id）：对话/领奖接口都用它
  final int id;
  /// 所属场景分类 id（跳转按场景刷题用；关卡与分类已解绑，勿再拿 id 当分类）
  final int categoryId;
  final String name;
  final String? nameEn;
  final String? icon;
  final String title;
  final String intro;
  final String outro;
  final int target;
  final int rewardXp;
  final int correctCount;
  final int answerCount;
  final int progress;
  final bool cleared;
  final bool unlocked;
  final bool claimed;
  final int bankCount;

  factory StageView.fromJson(Map<String, dynamic> json) {
    return StageView(
      id: json['id'] as int? ?? 0,
      categoryId: json['categoryId'] as int? ?? 0,
      name: json['name'] as String? ?? '',
      nameEn: json['nameEn'] as String?,
      icon: json['icon'] as String?,
      title: json['title'] as String? ?? '',
      intro: json['intro'] as String? ?? '',
      outro: json['outro'] as String? ?? '',
      target: json['target'] as int? ?? 1,
      rewardXp: json['rewardXp'] as int? ?? 0,
      correctCount: json['correctCount'] as int? ?? 0,
      answerCount: json['answerCount'] as int? ?? 0,
      progress: json['progress'] as int? ?? 0,
      cleared: json['cleared'] as bool? ?? false,
      unlocked: json['unlocked'] as bool? ?? false,
      claimed: json['claimed'] as bool? ?? false,
      bankCount: json['bankCount'] as int? ?? 0,
    );
  }
}

/// 领取通关奖励结果（POST /client/stages/{id}/claim）。
class StageClaimResult {
  const StageClaimResult({
    required this.awarded,
    required this.alreadyClaimed,
    required this.rewardXp,
    required this.xp,
  });

  final bool awarded;
  final bool alreadyClaimed;
  final int rewardXp;
  final int xp;

  factory StageClaimResult.fromJson(Map<String, dynamic> json) {
    return StageClaimResult(
      awarded: json['awarded'] as bool? ?? false,
      alreadyClaimed: json['alreadyClaimed'] as bool? ?? false,
      rewardXp: json['rewardXp'] as int? ?? 0,
      xp: json['xp'] as int? ?? 0,
    );
  }
}
