/// 成长状态：等级 / XP / 成就 / 场景地图 + 今日打卡。
///
/// 这两个接口一起拉：成长页首屏要同时展示「我练了多少」与「我到了哪一级」，
/// 分两次串行请求会让首屏空一下——并行发出，任一失败都给出可重试的错误态。
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../api/library_api.dart';
import '../api/models/growth.dart';

/// 成长页数据。
class GrowthState {
  const GrowthState({
    this.overview,
    this.today,
    this.loading = false,
    this.error,
  });

  final GamifyOverview? overview;
  final CheckinToday? today;
  final bool loading;
  final String? error;

  bool get loaded => overview != null;

  int get xp => overview?.xp ?? 0;
  LevelInfo? get level => overview?.level;
  List<AchievementView> get achievements => overview?.achievements ?? const <AchievementView>[];
  List<SceneMapItem> get scenes => overview?.sceneMap ?? const <SceneMapItem>[];

  List<AchievementView> get unlockedList =>
      achievements.where((item) => item.unlocked).toList(growable: false);

  GrowthState copyWith({
    GamifyOverview? overview,
    CheckinToday? today,
    bool? loading,
    String? error,
    bool clearError = false,
  }) {
    return GrowthState(
      overview: overview ?? this.overview,
      today: today ?? this.today,
      loading: loading ?? this.loading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// 成长控制器。
class GrowthController extends Notifier<GrowthState> {
  @override
  GrowthState build() => const GrowthState();

  LibraryApi get _api => ref.read(libraryApiProvider);

  /// 加载（[force] 为 false 且已有数据时直接返回，切 Tab 回来不重复请求）。
  Future<void> load({bool force = false}) async {
    if (state.loading) {
      return;
    }
    if (state.loaded && !force) {
      return;
    }
    state = state.copyWith(loading: true, clearError: true);
    try {
      final results = await Future.wait<Object?>(<Future<Object?>>[
        _api.gamify(),
        _api.checkinToday(),
      ]);
      state = GrowthState(
        overview: results[0] as GamifyOverview,
        today: results[1] as CheckinToday?,
      );
    } catch (error) {
      state = state.copyWith(loading: false, error: _message(error));
    }
  }

  Future<void> refresh() => load(force: true);

  static String _message(Object error) {
    if (error is ApiException) {
      return error.message;
    }
    return '成长数据加载失败';
  }
}

/// 成长控制器 Provider。
final growthControllerProvider = NotifierProvider<GrowthController, GrowthState>(
  GrowthController.new,
);
