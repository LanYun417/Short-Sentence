/// 情景闯关视图模型（与后端 `StageService` 逐字段对应）。
///
/// 关卡 = 场景长对话：每关用户扮演 `userRole` 与 1~3 个 AI 角色围绕 `goal`
/// 对话，聊够 `minTurns` 且 AI 判定目标达成才通关；关掉「翻译」开关通关经验 +50%
/// （服务端反作弊：按是否全程未开启判定）。会话持久化（`activeSessionId` 续聊）。
///
/// **兼容字段**：后端在新 `StageView` 上仍下发 `@deprecated` 的
/// `target/correctCount/answerCount/bankCount`，用于 Android 旧版关卡页
/// （即成长页 _StageCard 的「X / Y 句」副标签）。这里原样保留，保证旧页面编译通过。
library;

/* ------------------------------ 角色 / 关卡 ------------------------------ */

/// 一关出场的一个 AI 角色。
class StageRole {
  const StageRole({
    required this.nameEn,
    required this.name,
    required this.emoji,
  });

  final String nameEn;
  final String name;
  final String emoji;

  factory StageRole.fromJson(Map<String, dynamic> json) {
    return StageRole(
      nameEn: json['nameEn'] as String? ?? '',
      name: json['name'] as String? ?? '',
      emoji: json['emoji'] as String? ?? '',
    );
  }
}

/// 单关视图（挂在剧本下；id = stage_story.id）。
class StageView {
  const StageView({
    required this.id,
    required this.scriptId,
    required this.categoryId,
    required this.name,
    required this.nameEn,
    required this.icon,
    required this.title,
    required this.intro,
    required this.outro,
    required this.goal,
    required this.minTurns,
    required this.maxTurns,
    required this.roles,
    required this.rewardXp,
    required this.cleared,
    required this.unlocked,
    required this.claimed,
    required this.progress,
    required this.turns,
    required this.legacyCorrectCount,
    required this.target,
    required this.correctCount,
    required this.answerCount,
    required this.bankCount,
    required this.activeSessionId,
  });

  /// 关卡 id（stage_story.id）：对话/领奖接口都用它
  final int id;

  /// 所属剧本 id
  final int scriptId;

  /// 所属场景分类 id（统计/题库入口用）
  final int categoryId;

  /// 场景分类名（旧客户端展示用）
  final String name;
  final String? nameEn;
  final String? icon;

  /// 剧情化关卡标题
  final String title;

  /// 开场白（未通关时展示）
  final String intro;

  /// 通关后结语
  final String outro;

  /// 本关对话目标
  final String goal;

  /// 通关所需最少用户轮数
  final int minTurns;

  /// 硬上限轮数
  final int maxTurns;

  /// 出场角色（1~3 人）
  final List<StageRole> roles;

  final int rewardXp;

  /// 是否已通关（对话口径）
  final bool cleared;

  /// 是否已解锁
  final bool unlocked;

  /// 奖励是否已领取
  final bool claimed;

  /// 进度百分比（通关 100；进行中按轮数估算，封顶 90）
  final int progress;

  /// 最近一次通关对话的轮数
  final int turns;

  /// 旧版「答对句数」（仅历史展示，不再决定通关）
  final int legacyCorrectCount;

  /// @deprecated 兼容旧版关卡页：新口径下等于 minTurns
  final int target;

  /// @deprecated 兼容旧版关卡页：新口径下等于当前会话轮数
  final int correctCount;

  /// @deprecated 兼容旧版关卡页
  final int answerCount;

  /// @deprecated 兼容旧版关卡页：该场景就绪题数
  final int bankCount;

  /// 进行中的会话 id（没有则 null）
  final int? activeSessionId;

  factory StageView.fromJson(Map<String, dynamic> json) {
    final roles = json['roles'];
    return StageView(
      id: (json['id'] as num?)?.toInt() ?? 0,
      scriptId: (json['scriptId'] as num?)?.toInt() ?? 0,
      categoryId: (json['categoryId'] as num?)?.toInt() ?? 0,
      name: json['name'] as String? ?? '',
      nameEn: json['nameEn'] as String?,
      icon: json['icon'] as String?,
      title: json['title'] as String? ?? '',
      intro: json['intro'] as String? ?? '',
      outro: json['outro'] as String? ?? '',
      goal: json['goal'] as String? ?? '',
      minTurns: (json['minTurns'] as num?)?.toInt() ?? 0,
      maxTurns: (json['maxTurns'] as num?)?.toInt() ?? 0,
      roles: roles is List
          ? roles.whereType<Map<String, dynamic>>().map(StageRole.fromJson).toList()
          : const <StageRole>[],
      rewardXp: (json['rewardXp'] as num?)?.toInt() ?? 0,
      cleared: json['cleared'] as bool? ?? false,
      unlocked: json['unlocked'] as bool? ?? false,
      claimed: json['claimed'] as bool? ?? false,
      progress: (json['progress'] as num?)?.toInt() ?? 0,
      turns: (json['turns'] as num?)?.toInt() ?? 0,
      legacyCorrectCount: (json['legacyCorrectCount'] as num?)?.toInt() ?? 0,
      target: (json['target'] as num?)?.toInt() ?? 0,
      correctCount: (json['correctCount'] as num?)?.toInt() ?? 0,
      answerCount: (json['answerCount'] as num?)?.toInt() ?? 0,
      bankCount: (json['bankCount'] as num?)?.toInt() ?? 0,
      activeSessionId: (json['activeSessionId'] as num?)?.toInt(),
    );
  }
}

/* ------------------------------ 剧本 / 场景 ------------------------------ */

/// 一个剧本（挂在场景下，包含若干关卡）。
class StageScript {
  const StageScript({
    required this.id,
    required this.categoryId,
    required this.name,
    required this.blurb,
    required this.coverUrl,
    required this.stageCount,
    required this.clearedCount,
    required this.completed,
  });

  /// 剧本 id（stage_script.id）
  final int id;

  /// 所属场景分类 id
  final int categoryId;
  final String name;

  /// 剧本一句话简介
  final String blurb;

  /// AI 生成的封面图 URL；未生成时为 null（前端回落渐变+图标）
  final String? coverUrl;

  /// 该剧本下可见关卡数
  final int stageCount;

  /// 我已通关的关卡数
  final int clearedCount;

  /// 该剧本是否全部通关
  final bool completed;

  factory StageScript.fromJson(Map<String, dynamic> json) {
    return StageScript(
      id: (json['id'] as num?)?.toInt() ?? 0,
      categoryId: (json['categoryId'] as num?)?.toInt() ?? 0,
      name: json['name'] as String? ?? '',
      blurb: json['blurb'] as String? ?? '',
      coverUrl: json['coverUrl'] as String?,
      stageCount: (json['stageCount'] as num?)?.toInt() ?? 0,
      clearedCount: (json['clearedCount'] as num?)?.toInt() ?? 0,
      completed: json['completed'] as bool? ?? false,
    );
  }
}

/// 一个场景（顶层：场景分类 + 其下剧本/关卡汇总）。
class StageScene {
  const StageScene({
    required this.id,
    required this.name,
    required this.nameEn,
    required this.icon,
    required this.scriptCount,
    required this.stageCount,
    required this.clearedCount,
    required this.coverUrl,
  });

  final int id;
  final String name;
  final String? nameEn;
  final String? icon;

  /// 该场景下启用的剧本数
  final int scriptCount;

  /// 该场景下可见关卡数
  final int stageCount;

  /// 我已通关的关卡数
  final int clearedCount;

  /// 场景卡封面 = 第一个有封面的剧本封面（都没有则 null）
  final String? coverUrl;

  factory StageScene.fromJson(Map<String, dynamic> json) {
    return StageScene(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: json['name'] as String? ?? '',
      nameEn: json['nameEn'] as String?,
      icon: json['icon'] as String?,
      scriptCount: (json['scriptCount'] as num?)?.toInt() ?? 0,
      stageCount: (json['stageCount'] as num?)?.toInt() ?? 0,
      clearedCount: (json['clearedCount'] as num?)?.toInt() ?? 0,
      coverUrl: json['coverUrl'] as String?,
    );
  }
}

/// 章节视图（兼容旧客户端）：一个剧本 = 一个章节。
class StageChapter {
  const StageChapter({
    required this.key,
    required this.name,
    required this.subtitle,
    required this.coverUrl,
    required this.stages,
    required this.clearedCount,
    required this.total,
  });

  final String key;
  final String name;
  final String subtitle;
  final String? coverUrl;
  final List<StageView> stages;
  final int clearedCount;
  final int total;

  factory StageChapter.fromJson(Map<String, dynamic> json) {
    final stages = json['stages'];
    return StageChapter(
      key: json['key'] as String? ?? '',
      name: json['name'] as String? ?? '',
      subtitle: json['subtitle'] as String? ?? '',
      coverUrl: json['coverUrl'] as String?,
      stages: stages is List
          ? stages.whereType<Map<String, dynamic>>().map(StageView.fromJson).toList()
          : const <StageView>[],
      clearedCount: (json['clearedCount'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}

/* ------------------------------ 总览 / 详情 ------------------------------ */

/// 闯关总览。
class StageOverview {
  const StageOverview({
    required this.scenes,
    required this.chapters,
    required this.clearedStages,
    required this.totalStages,
    required this.activeStages,
    required this.claimable,
    required this.recommendedId,
  });

  /// 顶层场景（新客户端地图首页用）
  final List<StageScene> scenes;

  /// 剧本平铺（兼容旧客户端：一个剧本 = 一个 chapter）
  final List<StageChapter> chapters;

  final int clearedStages;
  final int totalStages;

  /// 已解锁但未通关的关卡数
  final int activeStages;

  /// 可领取奖励的关卡数
  final int claimable;

  /// 当前推荐关卡（第一个已解锁未通关；story id）
  final int? recommendedId;

  factory StageOverview.fromJson(Map<String, dynamic> json) {
    final scenes = json['scenes'];
    final chapters = json['chapters'];
    return StageOverview(
      scenes: scenes is List
          ? scenes.whereType<Map<String, dynamic>>().map(StageScene.fromJson).toList()
          : const <StageScene>[],
      chapters: chapters is List
          ? chapters.whereType<Map<String, dynamic>>().map(StageChapter.fromJson).toList()
          : const <StageChapter>[],
      clearedStages: (json['clearedStages'] as num?)?.toInt() ?? 0,
      totalStages: (json['totalStages'] as num?)?.toInt() ?? 0,
      activeStages: (json['activeStages'] as num?)?.toInt() ?? 0,
      claimable: (json['claimable'] as num?)?.toInt() ?? 0,
      recommendedId: (json['recommendedId'] as num?)?.toInt(),
    );
  }
}

/// 场景详情（场景 → 剧本列表）。
class StageSceneDetail {
  const StageSceneDetail({
    required this.scene,
    required this.scripts,
  });

  final StageScene scene;
  final List<StageScript> scripts;

  factory StageSceneDetail.fromJson(Map<String, dynamic> json) {
    final scene = json['scene'];
    final scripts = json['scripts'];
    return StageSceneDetail(
      scene: scene is Map<String, dynamic>
          ? StageScene.fromJson(scene)
          : StageScene(
              id: 0,
              name: '',
              nameEn: null,
              icon: null,
              scriptCount: 0,
              stageCount: 0,
              clearedCount: 0,
              coverUrl: null,
            ),
      scripts: scripts is List
          ? scripts.whereType<Map<String, dynamic>>().map(StageScript.fromJson).toList()
          : const <StageScript>[],
    );
  }
}

/// 剧本详情（剧本 → 关卡列表）。
class StageScriptDetail {
  const StageScriptDetail({
    required this.script,
    required this.scene,
    required this.stages,
    required this.clearedCount,
    required this.total,
  });

  final StageScript script;
  final StageSceneSceneRef scene;
  final List<StageView> stages;
  final int clearedCount;
  final int total;

  factory StageScriptDetail.fromJson(Map<String, dynamic> json) {
    final script = json['script'];
    final scene = json['scene'];
    final stages = json['stages'];
    return StageScriptDetail(
      script: script is Map<String, dynamic>
          ? StageScript.fromJson(script)
          : StageScript(
              id: 0,
              categoryId: 0,
              name: '',
              blurb: '',
              coverUrl: null,
              stageCount: 0,
              clearedCount: 0,
              completed: false,
            ),
      scene: StageSceneSceneRef.fromJson(
        scene is Map<String, dynamic> ? scene : const <String, dynamic>{},
      ),
      stages: stages is List
          ? stages.whereType<Map<String, dynamic>>().map(StageView.fromJson).toList()
          : const <StageView>[],
      clearedCount: (json['clearedCount'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}

/// 剧本详情里的精简场景引用（只有 id/name/nameEn/icon）。
class StageSceneSceneRef {
  const StageSceneSceneRef({
    required this.id,
    required this.name,
    required this.nameEn,
    required this.icon,
  });

  final int id;
  final String name;
  final String? nameEn;
  final String? icon;

  factory StageSceneSceneRef.fromJson(Map<String, dynamic> json) {
    return StageSceneSceneRef(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: json['name'] as String? ?? '',
      nameEn: json['nameEn'] as String?,
      icon: json['icon'] as String?,
    );
  }
}

/* ------------------------------ 对话 / 领奖 ------------------------------ */

/// 领取通关奖励结果（POST /client/stages/{id}/claim）。
class StageClaimResult {
  const StageClaimResult({
    required this.awarded,
    required this.alreadyClaimed,
    required this.rewardXp,
    required this.bonusXp,
    required this.xp,
  });

  final bool awarded;
  final bool alreadyClaimed;
  final int rewardXp;

  /// 无翻译通关的额外加成经验（全程关闭翻译才计）
  final int bonusXp;
  final int xp;

  factory StageClaimResult.fromJson(Map<String, dynamic> json) {
    return StageClaimResult(
      awarded: json['awarded'] as bool? ?? false,
      alreadyClaimed: json['alreadyClaimed'] as bool? ?? false,
      rewardXp: (json['rewardXp'] as num?)?.toInt() ?? 0,
      bonusXp: (json['bonusXp'] as num?)?.toInt() ?? 0,
      xp: (json['xp'] as num?)?.toInt() ?? 0,
    );
  }
}

/// 一句场景对话消息。
class StageDialogueMessage {
  const StageDialogueMessage({
    required this.id,
    required this.role,
    required this.speaker,
    required this.contentEn,
    required this.contentZh,
    required this.createdAt,
  });

  final int id;

  /// 'npc' | 'user'
  final String role;
  final String? speaker;
  final String contentEn;
  final String? contentZh;
  final DateTime createdAt;

  factory StageDialogueMessage.fromJson(Map<String, dynamic> json) {
    return StageDialogueMessage(
      id: (json['id'] as num?)?.toInt() ?? 0,
      role: json['role'] as String? ?? 'npc',
      speaker: json['speaker'] as String?,
      contentEn: json['contentEn'] as String? ?? '',
      contentZh: json['contentZh'] as String?,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

/// 对话结束后的中文复盘。
class StageFeedback {
  const StageFeedback({
    required this.summary,
    required this.highlights,
    required this.improvements,
  });

  final String summary;
  final List<String> highlights;
  final List<String> improvements;

  factory StageFeedback.fromJson(Map<String, dynamic> json) {
    final highlights = json['highlights'];
    final improvements = json['improvements'];
    return StageFeedback(
      summary: json['summary'] as String? ?? '',
      highlights: highlights is List
          ? highlights.whereType<String>().toList()
          : const <String>[],
      improvements: improvements is List
          ? improvements.whereType<String>().toList()
          : const <String>[],
    );
  }
}

/// 一条候选英文短句（点一下填入输入框）。
class StageDialogueHint {
  const StageDialogueHint({required this.en, required this.zh});

  final String en;

  /// 中文翻译（用户关闭翻译时为空或不显示）
  final String zh;

  factory StageDialogueHint.fromJson(Map<String, dynamic> json) {
    return StageDialogueHint(
      en: json['en'] as String? ?? '',
      zh: json['zh'] as String? ?? '',
    );
  }
}

/// 进入关卡时返回的会话（含开场白与历史消息）。
class StageDialogue {
  const StageDialogue({
    required this.sessionId,
    required this.status,
    required this.turnCount,
    required this.goalReached,
    required this.cleared,
    required this.showTranslation,
    required this.hints,
    required this.title,
    required this.intro,
    required this.goal,
    required this.minTurns,
    required this.maxTurns,
    required this.roles,
    required this.messages,
    required this.summary,
    required this.feedback,
  });

  final int sessionId;
  final String status;
  final int turnCount;
  final bool goalReached;
  final bool cleared;

  /// 当前是否显示中文翻译
  final bool showTranslation;

  /// 当前候选英文短句（动态更新）
  final List<StageDialogueHint> hints;
  final String title;
  final String intro;
  final String goal;
  final int minTurns;
  final int maxTurns;
  final List<StageRole> roles;
  final List<StageDialogueMessage> messages;
  final String? summary;
  final StageFeedback? feedback;

  factory StageDialogue.fromJson(Map<String, dynamic> json) {
    final hints = json['hints'];
    final roles = json['roles'];
    final messages = json['messages'];
    final feedback = json['feedback'];
    return StageDialogue(
      sessionId: (json['sessionId'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? '',
      turnCount: (json['turnCount'] as num?)?.toInt() ?? 0,
      goalReached: json['goalReached'] as bool? ?? false,
      cleared: json['cleared'] as bool? ?? false,
      showTranslation: json['showTranslation'] as bool? ?? true,
      hints: hints is List
          ? hints.whereType<Map<String, dynamic>>().map(StageDialogueHint.fromJson).toList()
          : const <StageDialogueHint>[],
      title: json['title'] as String? ?? '',
      intro: json['intro'] as String? ?? '',
      goal: json['goal'] as String? ?? '',
      minTurns: (json['minTurns'] as num?)?.toInt() ?? 0,
      maxTurns: (json['maxTurns'] as num?)?.toInt() ?? 0,
      roles: roles is List
          ? roles.whereType<Map<String, dynamic>>().map(StageRole.fromJson).toList()
          : const <StageRole>[],
      messages: messages is List
          ? messages
              .whereType<Map<String, dynamic>>()
              .map(StageDialogueMessage.fromJson)
              .toList()
          : const <StageDialogueMessage>[],
      summary: json['summary'] as String?,
      feedback: feedback is Map<String, dynamic>
          ? StageFeedback.fromJson(feedback)
          : null,
    );
  }

  /// 局部更新（对话页发完一句后刷新轮数 / 候选短句用）。
  StageDialogue copyWith({
    int? turnCount,
    List<StageDialogueHint>? hints,
    bool? showTranslation,
  }) {
    return StageDialogue(
      sessionId: sessionId,
      status: status,
      turnCount: turnCount ?? this.turnCount,
      goalReached: goalReached,
      cleared: cleared,
      showTranslation: showTranslation ?? this.showTranslation,
      hints: hints ?? this.hints,
      title: title,
      intro: intro,
      goal: goal,
      minTurns: minTurns,
      maxTurns: maxTurns,
      roles: roles,
      messages: messages,
      summary: summary,
      feedback: feedback,
    );
  }
}

/// 一轮对话结果。
class StageTurnResult {
  const StageTurnResult({
    required this.replies,
    required this.turnCount,
    required this.goalReached,
    required this.ended,
    required this.cleared,
    required this.hints,
    required this.summary,
    required this.feedback,
  });

  /// 本轮 AI 回复（1~3 条，每条含角色名/英文/中文）
  final List<StageTurnReply> replies;
  final int turnCount;
  final bool goalReached;

  /// 本轮之后会话是否结束（达到 maxTurns 或目标达成）
  final bool ended;

  /// 本轮之后是否已通关（目标达成）
  final bool cleared;

  /// 本轮模型给出的候选英文短句（动态更新）
  final List<StageDialogueHint> hints;
  final String? summary;
  final StageFeedback? feedback;

  factory StageTurnResult.fromJson(Map<String, dynamic> json) {
    final replies = json['replies'];
    final hints = json['hints'];
    final feedback = json['feedback'];
    return StageTurnResult(
      replies: replies is List
          ? replies
              .whereType<Map<String, dynamic>>()
              .map(StageTurnReply.fromJson)
              .toList()
          : const <StageTurnReply>[],
      turnCount: (json['turnCount'] as num?)?.toInt() ?? 0,
      goalReached: json['goalReached'] as bool? ?? false,
      ended: json['ended'] as bool? ?? false,
      cleared: json['cleared'] as bool? ?? false,
      hints: hints is List
          ? hints.whereType<Map<String, dynamic>>().map(StageDialogueHint.fromJson).toList()
          : const <StageDialogueHint>[],
      summary: json['summary'] as String?,
      feedback: feedback is Map<String, dynamic>
          ? StageFeedback.fromJson(feedback)
          : null,
    );
  }
}

/// 一条 AI 对话回复。
class StageTurnReply {
  const StageTurnReply({
    required this.speaker,
    required this.contentEn,
    required this.contentZh,
  });

  /// 角色 nameEn（用户发言为 null）
  final String speaker;
  final String contentEn;
  final String contentZh;

  factory StageTurnReply.fromJson(Map<String, dynamic> json) {
    return StageTurnReply(
      speaker: json['speaker'] as String? ?? '',
      contentEn: json['contentEn'] as String? ?? '',
      contentZh: json['contentZh'] as String? ?? '',
    );
  }
}
