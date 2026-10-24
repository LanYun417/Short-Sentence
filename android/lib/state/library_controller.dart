/// 语句库状态：收藏 / 复习 / 历史三个列表，各自独立分页。
///
/// 为什么要按 Tab 分开缓存：三个接口数据源不同（收藏夹按收藏时间、
/// 复习池按到期时间、历史按作答时间），切回来时若重新拉第一页，
/// 用户已经翻到的位置就丢了——手机上翻列表的成本比桌面高得多。
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../api/library_api.dart';
import '../api/models/library_item.dart';
import '../api/questions_api.dart';

/// 语句库分区。
enum LibraryTab {
  favorites('收藏', '收藏的句子随时回看'),
  review('复习', '到期该复习的句子，趁热打铁'),
  history('历史', '你答过的每一句');

  const LibraryTab(this.label, this.hint);

  final String label;
  final String hint;
}

/// 单个分区的数据。
class LibraryTabData {
  const LibraryTabData({
    this.items = const <SentenceLibraryItem>[],
    this.total = 0,
    this.page = 0,
    this.loading = false,
    this.loadingMore = false,
    this.error,
    this.loadedOnce = false,
  });

  final List<SentenceLibraryItem> items;
  final int total;

  /// 已加载到第几页（0 = 还没加载）。
  final int page;

  /// 首屏加载中（骨架屏）。
  final bool loading;

  /// 触底加载中（底部小转圈）。
  final bool loadingMore;

  final String? error;

  /// 是否至少成功加载过一次（用于区分「空列表」与「还没加载」）。
  final bool loadedOnce;

  bool get hasMore => items.length < total;

  LibraryTabData copyWith({
    List<SentenceLibraryItem>? items,
    int? total,
    int? page,
    bool? loading,
    bool? loadingMore,
    String? error,
    bool? loadedOnce,
    bool clearError = false,
  }) {
    return LibraryTabData(
      items: items ?? this.items,
      total: total ?? this.total,
      page: page ?? this.page,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      error: clearError ? null : (error ?? this.error),
      loadedOnce: loadedOnce ?? this.loadedOnce,
    );
  }
}

/// 语句库状态。
class LibraryState {
  const LibraryState({this.tab = LibraryTab.favorites, this.tabs = const {}});

  final LibraryTab tab;
  final Map<LibraryTab, LibraryTabData> tabs;

  LibraryTabData get current => tabs[tab] ?? const LibraryTabData();
  LibraryTabData of(LibraryTab tab) => tabs[tab] ?? const LibraryTabData();

  LibraryState copyWith({LibraryTab? tab, Map<LibraryTab, LibraryTabData>? tabs}) {
    return LibraryState(tab: tab ?? this.tab, tabs: tabs ?? this.tabs);
  }
}

/// 每页条数。手机上 12 条一屏多一点，加载节奏刚好。
const int kLibraryPageSize = 12;

/// 语句库控制器。
class LibraryController extends Notifier<LibraryState> {
  @override
  LibraryState build() => const LibraryState();

  LibraryApi get _api => ref.read(libraryApiProvider);

  /// 切分区（未加载过则拉第一页）。
  Future<void> switchTab(LibraryTab tab) async {
    if (state.tab == tab) {
      return;
    }
    state = state.copyWith(tab: tab);
    final data = state.of(tab);
    if (!data.loadedOnce && !data.loading) {
      await _load(tab, refresh: true);
    }
  }

  /// 下拉刷新 / 首次加载。
  Future<void> refresh([LibraryTab? tab]) async {
    await _load(tab ?? state.tab, refresh: true);
  }

  /// 触底加载下一页。
  Future<void> loadMore() async {
    final tab = state.tab;
    final data = state.of(tab);
    if (data.loading || data.loadingMore || !data.hasMore) {
      return;
    }
    await _load(tab, refresh: false);
  }

  Future<void> _load(LibraryTab tab, {required bool refresh}) async {
    final before = state.of(tab);
    final nextPage = refresh ? 1 : before.page + 1;
    _update(
      tab,
      before.copyWith(
        loading: refresh,
        loadingMore: !refresh,
        clearError: true,
      ),
    );

    try {
      final result = switch (tab) {
        LibraryTab.favorites => await _api.favorites(page: nextPage, pageSize: kLibraryPageSize),
        LibraryTab.review => await _api.review(page: nextPage, pageSize: kLibraryPageSize),
        LibraryTab.history => await _api.history(page: nextPage, pageSize: kLibraryPageSize),
      };
      final merged = refresh ? result.list : <SentenceLibraryItem>[...before.items, ...result.list];
      _update(
        tab,
        LibraryTabData(
          items: merged,
          total: result.total,
          page: nextPage,
          loadedOnce: true,
        ),
      );
    } catch (error) {
      _update(
        tab,
        before.copyWith(
          loading: false,
          loadingMore: false,
          error: _message(error),
          loadedOnce: before.loadedOnce,
        ),
      );
    }
  }

  /// 取消收藏（乐观更新：先从列表移除，失败再放回并提示）。
  Future<bool> unfavorite(SentenceLibraryItem item) async {
    final before = state.of(LibraryTab.favorites);
    if (!before.items.any((element) => element.sentenceId == item.sentenceId)) {
      return false;
    }
    _update(
      LibraryTab.favorites,
      before.copyWith(
        items: before.items
            .where((element) => element.sentenceId != item.sentenceId)
            .toList(growable: false),
        total: (before.total - 1).clamp(0, 1 << 30),
      ),
    );
    try {
      await ref.read(questionsApiProvider).toggleFavorite(item.sentenceId);
      return true;
    } catch (error) {
      _update(LibraryTab.favorites, before.copyWith(error: _message(error)));
      return false;
    }
  }

  /// 撤销取消收藏：把条目按原位置放回（服务端已取消，这里重新收藏）。
  Future<void> restoreFavorite(SentenceLibraryItem item, int index) async {
    final before = state.of(LibraryTab.favorites);
    final items = <SentenceLibraryItem>[...before.items];
    items.insert(index.clamp(0, items.length), item);
    _update(
      LibraryTab.favorites,
      before.copyWith(items: items, total: before.total + 1),
    );
    try {
      await ref.read(questionsApiProvider).toggleFavorite(item.sentenceId);
    } catch (error) {
      _update(LibraryTab.favorites, before.copyWith(error: _message(error)));
    }
  }

  void _update(LibraryTab tab, LibraryTabData data) {
    state = state.copyWith(tabs: <LibraryTab, LibraryTabData>{...state.tabs, tab: data});
  }

  static String _message(Object error) {
    if (error is ApiException) {
      return error.message;
    }
    return '加载失败，请稍后重试';
  }
}

/// 语句库控制器 Provider。
final libraryControllerProvider = NotifierProvider<LibraryController, LibraryState>(
  LibraryController.new,
);
