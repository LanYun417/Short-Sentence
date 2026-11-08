/// 记忆星系：把用户学过的每个句子画成一颗星，按场景聚成星座。
///
/// 字段与后端 `QuestionsService.getMemoryGalaxy` 的返回同构。
/// 坐标 / 颜色 / 亮度均由后端确定性下发，App 只负责绘制，
/// 保证与 Web 端看到的是同一片星空。
class MemoryGalaxy {
  const MemoryGalaxy({
    required this.stars,
    required this.clusters,
    required this.totalLearned,
    required this.graduated,
    required this.dueCount,
    required this.litClusters,
    required this.totalClusters,
  });

  final List<GalaxyStar> stars;
  final List<GalaxyCluster> clusters;
  final int totalLearned;
  final int graduated;
  final int dueCount;
  final int litClusters;
  final int totalClusters;

  factory MemoryGalaxy.fromJson(Map<String, dynamic> json) {
    return MemoryGalaxy(
      stars: (json['stars'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(GalaxyStar.fromJson)
              .toList() ??
          const <GalaxyStar>[],
      clusters: (json['clusters'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(GalaxyCluster.fromJson)
              .toList() ??
          const <GalaxyCluster>[],
      totalLearned: json['totalLearned'] as int? ?? 0,
      graduated: json['graduated'] as int? ?? 0,
      dueCount: json['dueCount'] as int? ?? 0,
      litClusters: json['litClusters'] as int? ?? 0,
      totalClusters: json['totalClusters'] as int? ?? 0,
    );
  }
}

/// 一颗记忆星。x/y 为 0..1 归一化坐标，radius 为相对半径，brightness 为 0..1 亮度。
class GalaxyStar {
  const GalaxyStar({
    required this.x,
    required this.y,
    required this.radius,
    required this.brightness,
    required this.tone,
    required this.categoryId,
  });

  final double x;
  final double y;
  final double radius;
  final double brightness;
  /// gold / stable / faded
  final String tone;
  final int categoryId;

  factory GalaxyStar.fromJson(Map<String, dynamic> json) {
    return GalaxyStar(
      x: (json['x'] as num?)?.toDouble() ?? 0,
      y: (json['y'] as num?)?.toDouble() ?? 0,
      radius: (json['radius'] as num?)?.toDouble() ?? 1,
      brightness: (json['brightness'] as num?)?.toDouble() ?? 0.5,
      tone: json['tone'] as String? ?? 'stable',
      categoryId: json['categoryId'] as int? ?? 0,
    );
  }
}

/// 一个星座（场景分类）。未点亮的 starCount 为 0，画成虚线轮廓表示「待探索」。
class GalaxyCluster {
  const GalaxyCluster({
    required this.categoryId,
    required this.name,
    required this.nameEn,
    required this.x,
    required this.y,
    required this.starCount,
    required this.graduated,
    required this.dueCount,
    required this.avgStrength,
  });

  final int categoryId;
  final String name;
  final String? nameEn;
  final double x;
  final double y;
  final int starCount;
  final int graduated;
  final int dueCount;
  final double avgStrength;

  factory GalaxyCluster.fromJson(Map<String, dynamic> json) {
    return GalaxyCluster(
      categoryId: json['categoryId'] as int? ?? 0,
      name: json['name'] as String? ?? '',
      nameEn: json['nameEn'] as String?,
      x: (json['x'] as num?)?.toDouble() ?? 0.5,
      y: (json['y'] as num?)?.toDouble() ?? 0.5,
      starCount: json['starCount'] as int? ?? 0,
      graduated: json['graduated'] as int? ?? 0,
      dueCount: json['dueCount'] as int? ?? 0,
      avgStrength: (json['avgStrength'] as num?)?.toDouble() ?? 0,
    );
  }
}
