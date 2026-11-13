/// 语句库「返回顶部」回归测试。
///
/// 守两件事：
/// 1. 刚进页面 / 没滚多少时按钮不出现（不占地方、不抢视线）；
/// 2. 滚过一屏后点它，列表真的回顶。
///
/// 之所以值得一个用例：这个按钮此前不存在，用户反馈「语句库没有返回顶部」。
/// 它容易在后续改滚动逻辑时被顺手改坏（比如忘了在 _onScroll 里更新显隐）。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:client_android/api/models/library_item.dart';
import 'package:client_android/pages/library_page.dart';
import 'package:client_android/state/library_controller.dart';
import 'package:client_android/theme/motion.dart';

SentenceLibraryItem _item(int id) => SentenceLibraryItem.fromJson(<String, dynamic>{
      'sentenceId': id,
      'sentenceEn': 'Sentence number $id in the library list.',
      'translationZh': '语句库里的第 $id 句。',
      'ipa': null,
      'imageUrl': null,
      'categoryName': '日常',
      'difficulty': 1,
      'createdAt': '2026-10-25T08:00:00.000Z',
      'reviewLevel': null,
      'nextReviewAt': null,
      'isCorrect': null,
      'userAnswer': null,
    });

/// 预置「已加载」的状态：三个分区都给了总数，阻止页面去预取（会发真网请求）。
LibraryState _loaded() {
  final items = List<SentenceLibraryItem>.generate(
    20,
    (i) => _item(1000 + i),
  );
  return LibraryState(
    tab: LibraryTab.favorites,
    tabs: <LibraryTab, LibraryTabData>{
      LibraryTab.favorites: LibraryTabData(
        items: items,
        total: items.length,
        page: 1,
        loadedOnce: true,
      ),
      LibraryTab.review: const LibraryTabData(total: 5, loadedOnce: true),
      LibraryTab.history: const LibraryTabData(total: 8, loadedOnce: true),
    },
  );
}

double _buttonOpacity(WidgetTester tester) {
  final finder = find.ancestor(
    of: find.byIcon(Icons.arrow_upward_rounded),
    matching: find.byType(AnimatedOpacity),
  );
  expect(finder, findsWidgets, reason: '按钮外层应是一层 AnimatedOpacity');
  return tester.widget<AnimatedOpacity>(finder.first).opacity;
}

void main() {
  setUp(() => Motion.loopAnimations = false);
  tearDown(() => Motion.loopAnimations = true);

  testWidgets('没滚动时不显示返回顶部，滚过一屏后出现并能回顶', (tester) async {
    final container = ProviderContainer();
    container.read(libraryControllerProvider.notifier).state = _loaded();

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: LibraryPage()),
      ),
    );
    await tester.pump();

    expect(_buttonOpacity(tester), 0, reason: '刚进页面不该占地方');

    // 一次拖过一屏：20 条内容足够滚出 700px
    await tester.drag(find.byType(ListView).first, const Offset(0, -900));
    await tester.pump();
    expect(_buttonOpacity(tester), 1, reason: '滚过一屏后应当浮出来');

    // 点它 → 回顶 → 按钮随之收起
    await tester.tap(find.byIcon(Icons.arrow_upward_rounded));
    await tester.pumpAndSettle();
    expect(_buttonOpacity(tester), 0, reason: '回顶后按钮应当收起');

    // 第一条应回到顶部附近（回顶生效的直接证据）
    final topLeft =
        tester.getTopLeft(find.text('Sentence number 1000 in the library list.'));
    expect(topLeft.dy, lessThan(200));
  });
}
