/// 排行榜页回归测试（Web / Android 三端共用同一套榜单口径）。
///
/// 守四件事：
/// 1. 三个 tab 都在（答题榜 / 答对榜 / 打卡榜）——加第三个榜时最容易漏；
/// 2. 切换 tab 会重新取数，且「打卡榜」的单位是天、名次文案是累计口径；
/// 3. 今日两榜的单位是题、名次文案是今日口径；
/// 4. 空榜显示空态而不是空白页。
///
/// 网络用假 API 顶掉，不碰真实后端；Motion.loopAnimations 必须关，
/// 否则循环动效会让 pumpAndSettle 永不静止。
library;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:short_sentence/api/leaderboard_api.dart';
import 'package:short_sentence/api/models/leaderboard.dart';
import 'package:short_sentence/pages/leaderboard_page.dart';
import 'package:short_sentence/theme/motion.dart';

class _FakeLeaderboardApi extends LeaderboardApi {
  _FakeLeaderboardApi({this.empty = false}) : super(Dio());

  final bool empty;
  final List<LeaderboardType> calls = <LeaderboardType>[];

  @override
  Future<LeaderboardResult> fetch(LeaderboardType type) async {
    calls.add(type);
    final checkin = type == LeaderboardType.checkinTotal;
    final count = checkin ? 12 : 22;
    return LeaderboardResult(
      type: type,
      date: '2026-11-07',
      top: empty
          ? const <LeaderboardRow>[]
          : <LeaderboardRow>[
              LeaderboardRow(
                rank: 1,
                userId: 7,
                nickname: checkin ? '打卡达人' : '刷题达人',
                avatarUrl: null,
                count: count,
              ),
            ],
      me: empty ? null : LeaderboardMe(rank: 1, count: count),
    );
  }
}

Future<void> _pumpPage(WidgetTester tester, _FakeLeaderboardApi api) async {
  final container = ProviderContainer(
    overrides: <Override>[leaderboardApiProvider.overrideWithValue(api)],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: LeaderboardPage()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => Motion.loopAnimations = false);
  tearDown(() => Motion.loopAnimations = true);

  testWidgets('三个榜单都在，切到打卡榜后单位与名次文案变成累计口径', (tester) async {
    final api = _FakeLeaderboardApi();
    await _pumpPage(tester, api);

    expect(find.text('排行榜'), findsWidgets);
    expect(find.text('答题榜'), findsOneWidget);
    expect(find.text('答对榜'), findsOneWidget);
    expect(find.text('打卡榜'), findsOneWidget);
    expect(find.text('你今天答题第 1 名 · 22 题'), findsOneWidget);
    expect(find.text('22 题'), findsOneWidget);
    expect(find.text('刷题达人'), findsOneWidget);

    await tester.tap(find.text('打卡榜'));
    await tester.pumpAndSettle();

    expect(find.text('你累计打卡第 1 名 · 12 天'), findsOneWidget);
    expect(find.text('12 天'), findsOneWidget);
    expect(find.text('打卡达人'), findsOneWidget);
    expect(find.text('22 题'), findsNothing);
    expect(api.calls, <LeaderboardType>[
      LeaderboardType.todayAnswered,
      LeaderboardType.checkinTotal,
    ]);
  });

  testWidgets('空榜显示空态，打卡榜空态文案单独区分', (tester) async {
    final api = _FakeLeaderboardApi(empty: true);
    await _pumpPage(tester, api);

    expect(find.text('今天还没有人上榜'), findsOneWidget);
    expect(find.text('今天还没上榜，去刷几题吧'), findsOneWidget);

    await tester.tap(find.text('打卡榜'));
    await tester.pumpAndSettle();

    expect(find.text('还没有人打卡'), findsOneWidget);
    expect(find.text('还没打过卡，去完成今日目标吧'), findsOneWidget);
  });
}
