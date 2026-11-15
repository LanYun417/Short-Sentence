/// 注销账号页回归测试。
///
/// 守三件事（对应「不可逆操作」的三道关）：
/// 1. 页面把影响说明、可选原因、身份校验都渲染出来；
/// 2. **没填验证码时只给提示、绝不发请求**——不能靠 UI 兜底，服务端也得挡住；
/// 3. 填码后提交真的发出 `DELETE /client/auth/me`，且 payload 带 emailCode
///    与选中的 reasonType（原因可选，但选了就必须带上）。
library;

import 'dart:convert';

import 'package:client_android/api/dio_client.dart';
import 'package:client_android/pages/account_delete_page.dart';
import 'package:client_android/theme/motion.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// 记录请求路径与 DELETE 请求体，其余一律返回成功信封。
class _RecordAdapter implements HttpClientAdapter {
  final List<String> calls = <String>[];

  /// 最近一次 DELETE 的请求体（注销 payload）。
  Object? lastDeleteBody;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelRequest,
  ) async {
    calls.add('${options.method} ${options.path}');
    if (options.method == 'DELETE') {
      lastDeleteBody = options.data;
    }
    return ResponseBody.fromString(
      jsonEncode(<String, dynamic>{'code': 200, 'message': 'ok', 'data': null}),
      200,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>['application/json'],
      },
    );
  }
}

/// 断言用：是否发过某个请求。
bool _called(List<String> calls, String method, String path) =>
    calls.contains('$method $path');

Future<void> _pumpPage(WidgetTester tester, HttpClientAdapter adapter) async {
  tester.view.physicalSize = const Size(820, 1400);
  tester.view.devicePixelRatio = 1;

  final router = GoRouter(
    initialLocation: '/account-delete',
    routes: <RouteBase>[
      GoRoute(
        path: '/account-delete',
        builder: (context, state) => const AccountDeletePage(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) =>
            const Scaffold(body: Center(child: Text('登录页'))),
      ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        dioProvider.overrideWithValue(Dio()..httpClientAdapter = adapter),
      ],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    // Widget 测试不能跑无限动画
    Motion.loopAnimations = false;
    // flutter_secure_storage 的内存实现（认证控制器 logout 会清存储）
    FlutterSecureStorage.setMockInitialValues(<String, String>{});
  });

  tearDown(() {
    Motion.loopAnimations = true;
  });

  testWidgets('渲染影响说明 / 可选原因 / 身份校验', (tester) async {
    final adapter = _RecordAdapter();
    await _pumpPage(tester, adapter);

    // 标题与提交按钮都叫「注销账号」
    expect(find.text('注销账号'), findsNWidgets(2));
    expect(find.text('注销后会发生什么'), findsOneWidget);
    expect(find.text('可选，不填也能注销'), findsOneWidget);
    expect(find.text('身份校验'), findsOneWidget);

    // 6 个原因标签
    for (final String label in <String>[
      '没时间练',
      '内容太难',
      '内容不满意',
      '使用有问题',
      '隐私顾虑',
      '其他原因',
    ]) {
      expect(find.text(label), findsOneWidget);
    }

    // 纯表单，进入页面不应发任何请求
    expect(adapter.calls, isEmpty);
  });

  testWidgets('未填验证码提交：只给提示，不发请求', (tester) async {
    final adapter = _RecordAdapter();
    await _pumpPage(tester, adapter);

    await tester.tap(find.text('注销账号').last);
    await tester.pumpAndSettle();

    expect(find.text('请先获取并填写 6 位邮箱验证码'), findsOneWidget);
    expect(adapter.calls, isEmpty);
  });

  testWidgets('填码并选原因后提交：发出 DELETE 且 payload 正确，随后回登录页', (tester) async {
    final adapter = _RecordAdapter();
    await _pumpPage(tester, adapter);

    // 第一个 TextField 是补充说明，第二个是验证码
    await tester.enterText(find.byType(TextField).at(1), '246810');
    await tester.pumpAndSettle();

    // 选一个原因
    await tester.tap(find.text('内容太难'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('注销账号').last);
    await tester.pumpAndSettle();

    // 确认弹窗
    expect(find.text('确认注销？'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, '确认注销'));
    await tester.pumpAndSettle();

    expect(_called(adapter.calls, 'DELETE', '/client/auth/me'), isTrue);
    final Map<dynamic, dynamic> body =
        adapter.lastDeleteBody! as Map<dynamic, dynamic>;
    expect(body['emailCode'], '246810');
    expect(body['reasonType'], 'too_hard');

    // 注销成功后回登录页
    expect(find.text('登录页'), findsOneWidget);
  });
}
