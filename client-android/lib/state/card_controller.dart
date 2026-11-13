/// 每日句签状态：今日是否可领 / 是否已领 / 我的句签册。
///
/// 句签是「达标后的奖励」，不是导航目标，所以**不在底部 Tab 里**：
/// 刷题页达标后浮出入口，成长页可回看整册。
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../api/library_api.dart';
import '../api/models/growth.dart';

/// 句签状态。
class CardState {
  const CardState({
    this.todayObtained = false,
    this.todayDate = '',
    this.mine = const <SentenceCard>[],
    this.mineLoaded = false,
    this.missing = const <SentenceCard>[],
    this.missingTotal = 0,
    this.missingLoaded = false,
    this.loading = false,
    this.claiming = false,
    this.error,
  });

  /// 今日句签是否已领取（后端只给状态，不含卡片内容）。
  final bool todayObtained;

  /// 今日业务日期（YYYY-MM-DD，空串表示还没查到）。
  final String todayDate;

  /// 我的句签册（按日期倒序）。
  final List<SentenceCard> mine;

  /// 句签册是否已拉过（刷题页只查「今天领没领」，不需要整个册子）。
  final bool mineLoaded;

  /// 未拥有的句签（成长页「查看未拥有」预览）。
  final List<SentenceCard> missing;

  /// 未拥有句签总数（可能大于 [missing].length）。
  final int missingTotal;

  /// 未拥有列表是否已拉过。
  final bool missingLoaded;

  final bool loading;
  final bool claiming;
  final String? error;

  bool get claimed => todayObtained;

  /// 今日是否还有可领的句签。
  ///
  /// 「今天有没有生成」由后端是否拒绝领取来兜底：入口只按「未领取 + 已达标」显示，
  /// 未就绪时点击会得到「还没准备好」的提示，不会出现空入口。
  bool get claimable => !todayObtained;

  CardState copyWith({
    bool? todayObtained,
    String? todayDate,
    List<SentenceCard>? mine,
    bool? mineLoaded,
    List<SentenceCard>? missing,
    int? missingTotal,
    bool? missingLoaded,
    bool? loading,
    bool? claiming,
    String? error,
    bool clearError = false,
  }) {
    return CardState(
      todayObtained: todayObtained ?? this.todayObtained,
      todayDate: todayDate ?? this.todayDate,
      mine: mine ?? this.mine,
      mineLoaded: mineLoaded ?? this.mineLoaded,
      missing: missing ?? this.missing,
      missingTotal: missingTotal ?? this.missingTotal,
      missingLoaded: missingLoaded ?? this.missingLoaded,
      loading: loading ?? this.loading,
      claiming: claiming ?? this.claiming,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// 句签控制器。
class CardController extends Notifier<CardState> {
  @override
  CardState build() => const CardState();

  LibraryApi get _api => ref.read(libraryApiProvider);

  /// 只查今日状态（刷题页用）。
  ///
  /// 刷题页只需要知道「今天领没领」，不需要整个句签册——
  /// 少一个请求、少一份列表传输，首屏更快。
  Future<void> loadStatus({bool force = false}) async {
    if (state.todayDate.isNotEmpty && !force) {
      return;
    }
    try {
      final status = await _api.todayCardStatus();
      state = state.copyWith(
        todayObtained: status.obtained,
        todayDate: status.bizDate,
        clearError: true,
      );
    } catch (error) {
      state = state.copyWith(error: _message(error));
    }
  }

  /// 加载今日状态与句签册（成长页用；已加载过则跳过，除非 [force]）。
  Future<void> load({bool force = false}) async {
    if (state.loading) {
      return;
    }
    if (state.todayDate.isNotEmpty && state.mineLoaded && !force) {
      return;
    }
    state = state.copyWith(loading: true, clearError: true);
    try {
      final results = await Future.wait<Object?>(<Future<Object?>>[
        _api.todayCardStatus(),
        _api.myCards(),
      ]);
      final status = results[0] as TodayCardStatus;
      state = CardState(
        todayObtained: status.obtained,
        todayDate: status.bizDate,
        mine: (results[1] as List<SentenceCard>?) ?? const <SentenceCard>[],
        mineLoaded: true,
      );
    } catch (error) {
      state = state.copyWith(loading: false, error: _message(error));
    }
  }

  /// 领取今日句签。
  ///
  /// 返回 null 有两种情况：未达标（后端拒绝）或今日句签未就绪。
  /// 调用方据此给不同提示——「再刷几题」比「领取失败」有用得多。
  Future<SentenceCard?> claim() async {
    if (state.claiming) {
      return null;
    }
    state = state.copyWith(claiming: true, clearError: true);
    try {
      final card = await _api.claimCard();
      if (card == null) {
        state = state.copyWith(claiming: false);
        return null;
      }
      final mine = <SentenceCard>[
        card,
        ...state.mine.where((item) => item.id != card.id),
      ];
      state = CardState(
        todayObtained: true,
        todayDate: state.todayDate,
        mine: mine,
        mineLoaded: state.mineLoaded,
      );
      return card;
    } catch (error) {
      state = state.copyWith(claiming: false, error: _message(error));
      return null;
    }
  }

  Future<void> refresh() => load(force: true);

  /// 加载未拥有的句签（成长页「查看未拥有」）。
  Future<void> loadMissing({bool force = false}) async {
    if (state.missingLoaded && !force) {
      return;
    }
    try {
      final data = await _api.missing();
      state = state.copyWith(
        missing: data.list,
        missingTotal: data.total,
        missingLoaded: true,
        clearError: true,
      );
    } catch (error) {
      state = state.copyWith(error: _message(error));
    }
  }

  static String _message(Object error) {
    if (error is ApiException) {
      return error.message;
    }
    return '句签加载失败';
  }
}

/// 句签控制器 Provider。
final cardControllerProvider = NotifierProvider<CardController, CardState>(
  CardController.new,
);
