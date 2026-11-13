/// 排行榜页回归测试（Web / Android 共用同一套榜单口径）。
///
/// 守四件事：
/// 1. 「周期 × 指标」两段都在，7 个榜都能选到（新增周/月榜时最容易漏）；
/// 2. 切换会按新 type 重新取数，文案口径随周期/指标变化；
/// 3. 打卡榜单位是天、文案是累计口径，且隐藏指标段；
/// 4. 空榜显示空态而不是空白页。
///
/// 网络用假 API 顶掉，不碰真实后端；Motion.loopAnimations 必须关，
/// 否则循环动效会让 pumpAndSettle 永不静止。
library;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:client_android/api/leaderboard_api.dart';
import 'package:client_android/api/models/leaderboard.dart';
import 'package:client_android/pages/leaderboard_page.dart';
import 'package:client_android/theme/motion.dart';

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

  test('周期 × 指标覆盖 7 个后端榜单类型', () {
    expect(
      <LeaderboardType>[
        leaderboardTypeOf(LeaderboardPeriod.today, LeaderboardMetric.answered),
        leaderboardTypeOf(LeaderboardPeriod.today, LeaderboardMetric.correct),
        leaderboardTypeOf(LeaderboardPeriod.week, LeaderboardMetric.answered),
        leaderboardTypeOf(LeaderboardPeriod.week, LeaderboardMetric.correct),
        leaderboardTypeOf(LeaderboardPeriod.month, LeaderboardMetric.answered),
        leaderboardTypeOf(LeaderboardPeriod.month, LeaderboardMetric.correct),
        leaderboardTypeOf(LeaderboardPeriod.checkin, LeaderboardMetric.answered),
      ],
      <LeaderboardType>[
        LeaderboardType.todayAnswered,
        LeaderboardType.todayCorrect,
        LeaderboardType.weekAnswered,
        LeaderboardType.weekCorrect,
        LeaderboardType.monthAnswered,
        LeaderboardType.monthCorrect,
        LeaderboardType.checkinTotal,
      ],
    );
    expect(<String>{
      for (final LeaderboardType type in LeaderboardType.values) type.apiValue,
    }.length, 7);
    expect(LeaderboardType.checkinTotal.unit, '天');
    expect(LeaderboardType.monthCorrect.unit, '题');
  });

  testWidgets('二维切换会按新 type 取数，打卡榜为累计口径且隐藏指标段', (tester) async {
    final api = _FakeLeaderboardApi();
    await _pumpPage(tester, api);

    expect(find.text('排行榜'), findsWidgets);
    for (final String label in <String>['今日榜', '周榜', '月榜', '打卡榜', '答题数', '答对数']) {
      expect(find.text(label), findsOneWidget);
    }
    expect(find.text('你今天答题第 1 名 · 22 题'), findsOneWidget);
    expect(find.text('22 题'), findsOneWidget);
    expect(find.text('刷题达人'), findsOneWidget);

    await tester.tap(find.text('答对数'));
    await tester.pumpAndSettle();
    expect(find.text('你今天答对第 1 名 · 22 题'), findsOneWidget);

    await tester.tap(find.text('月榜'));
    await tester.pumpAndSettle();
    expect(find.text('你近 30 天答对第 1 名 · 22 题'), findsOneWidget);

    await tester.tap(find.text('打卡榜'));
    await tester.pumpAndSettle();
    expect(find.text('你累计打卡第 1 名 · 12 天'), findsOneWidget);
    expect(find.text('12 天'), findsOneWidget);
    expect(find.text('打卡达人'), findsOneWidget);
    expect(find.text('22 题'), findsNothing);
    expect(find.text('答对数'), findsNothing); // 打卡周期只有一个口径
    expect(api.calls, <LeaderboardType>[
      LeaderboardType.todayAnswered,
      LeaderboardType.todayCorrect,
      LeaderboardType.monthCorrect,
      LeaderboardType.checkinTotal,
    ]);
  });

  testWidgets('空榜显示空态，打卡榜空态文案单独区分', (tester) async {
    final api = _FakeLeaderboardApi(empty: true);
    await _pumpPage(tester, api);

    expect(find.text('今天还没有人上榜'), findsOneWidget);
    expect(find.text('今天还没上榜，去刷几题吧'), findsOneWidget);

    await tester.tap(find.text('周榜'));
    await tester.pumpAndSettle();
    expect(find.text('近 7 天还没有人上榜'), findsOneWidget);

    await tester.tap(find.text('打卡榜'));
    await tester.pumpAndSettle();

    expect(find.text('还没有人打卡'), findsOneWidget);
    expect(find.text('还没打过卡，去完成今日目标吧'), findsOneWidget);
  });
}
