/// 意见反馈（弹窗）回归测试。
///
/// 守住四件事：
/// 1. 默认在「提交反馈」页，类型选择 + 内容 + 联系方式齐全；
/// 2. **提交真的发出 `POST /client/feedback` 且带对 payload**（type / content /
///    platform:android），不是只本地清空就完事；
/// 3. 提交成功后自动切到「我的反馈」并刷新列表，且弹出已收到提示；
/// 4. 「我的反馈」渲染服务端条目（状态标签 + 运营回复），空列表有空态。
///
/// 用假 adapter 记录请求路径与请求体来断言「发没发、发了什么」，比只看 UI 更可靠。
library;

import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:short_sentence/api/dio_client.dart';
import 'package:short_sentence/sheets/feedback_sheet.dart';
import 'package:short_sentence/theme/motion.dart';

/// 记录请求路径与请求体的假 adapter。
class _RecordAdapter implements HttpClientAdapter {
  final List<String> calls = <String>[];

  /// 最近一次提交的请求体（POST /client/feedback 时记录）。
  Map<String, dynamic>? lastFeedback;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelRequest,
  ) async {
    calls.add('${options.method} ${options.path}');
    final Object? payload = switch (options.path) {
      '/client/feedback' => <String, dynamic>{
          'id': 99,
          'type': 'feature',
          'content': '希望支持自定义每日题量',
          'contact': null,
          'platform': 'android',
          'status': 0,
          'reply': null,
          'createdAt': '2026-10-27T02:00:00.000Z',
          'handledAt': null,
        },
      '/client/feedback/mine' => <String, dynamic>{
          'list': <Map<String, dynamic>>[
            <String, dynamic>{
              'id': 99,
              'type': 'feature',
              'content': '希望支持自定义每日题量',
              'contact': null,
              'platform': 'android',
              'status': 1,
              'reply': '已收到，下个版本会支持自定义题量',
              'createdAt': '2026-10-27T02:00:00.000Z',
              'handledAt': '2026-10-27T03:00:00.000Z',
            },
          ],
          'total': 1,
          'page': 1,
          'pageSize': 50,
        },
      _ => null,
    };
    if (options.path == '/client/feedback' && options.data is Map<String, dynamic>) {
      lastFeedback = Map<String, dynamic>.from(options.data as Map<String, dynamic>);
    }
    return ResponseBody.fromString(
      jsonEncode(<String, dynamic>{'code': 200, 'message': 'ok', 'data': payload}),
      200,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>['application/json; charset=utf-8'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// 打开弹窗：包一层带按钮的页面，点按钮走真实入口 showFeedbackSheet。
Future<void> _pumpSheet(WidgetTester tester, HttpClientAdapter adapter) async {
  // 提交表单较高，放大测试视口让提交按钮进入可视区（否则 tap 落在屏外不触发 _submit）。
  tester.view.physicalSize = const Size(800, 1200);
  tester.view.devicePixelRatio = 1;
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        dioProvider.overrideWithValue(Dio()..httpClientAdapter = adapter),
      ],
      child: MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => Center(
              child: TextButton(
                onPressed: () => showFeedbackSheet(context),
                child: const Text('打开反馈'),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('打开反馈'));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    Motion.loopAnimations = false;
  });
  tearDown(() {
    Motion.loopAnimations = true;
  });

  testWidgets('提交反馈页：类型选择 / 内容 / 联系方式齐全', (tester) async {
    final adapter = _RecordAdapter();
    await _pumpSheet(tester, adapter);

    expect(find.text('意见反馈'), findsOneWidget);
    expect(find.text('提交反馈'), findsWidgets); // 分段按钮 + 提交按钮
    expect(find.text('功能建议'), findsOneWidget);
    expect(find.text('使用异常'), findsOneWidget);
    expect(find.text('内容问题'), findsOneWidget);
    expect(find.text('体验建议'), findsOneWidget);
    // 默认未发任何请求（提交页是纯表单）
    expect(adapter.calls, isEmpty);
  });

  testWidgets('空内容提交给出校验提示，且未发请求', (tester) async {
    final adapter = _RecordAdapter();
    await _pumpSheet(tester, adapter);

    await tester.tap(find.widgetWithText(FilledButton, '提交反馈'));
    await tester.pumpAndSettle();

    expect(find.text('请先描述你的反馈'), findsOneWidget);
    expect(adapter.calls, isEmpty);
  });

  testWidgets('提交有效内容：发出 POST 且 payload 正确，成功后切到我的反馈', (tester) async {
    final adapter = _RecordAdapter();
    await _pumpSheet(tester, adapter);

    // 内容输入框（第一个 TextField）
    await tester.enterText(
      find.byType(TextField).at(0),
      '希望支持自定义每日题量',
    );
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, '提交反馈'));
    await tester.pumpAndSettle();

    // 真的发了提交请求
    expect(adapter.calls, contains('POST /client/feedback'));
    // payload 校验：类型默认 feature、内容、平台 android
    expect(adapter.lastFeedback?['type'], 'feature');
    expect(adapter.lastFeedback?['content'], '希望支持自定义每日题量');
    expect(adapter.lastFeedback?['platform'], 'android');
    // 提交后自动切到「我的反馈」并拉列表
    expect(adapter.calls, contains('GET /client/feedback/mine'));
    // 我刚提交的反馈出现，且含运营回复
    expect(find.text('希望支持自定义每日题量'), findsOneWidget);
    expect(find.text('已收到，下个版本会支持自定义题量'), findsOneWidget);
    // 成功提示
    expect(find.text('已收到你的反馈，我们会尽快处理'), findsOneWidget);
  });

  testWidgets('我的反馈：渲染服务端条目与状态标签', (tester) async {
    final adapter = _RecordAdapter();
    await _pumpSheet(tester, adapter);

    await tester.tap(find.text('我的反馈'));
    await tester.pumpAndSettle();

    expect(adapter.calls, contains('GET /client/feedback/mine'));
    expect(find.text('希望支持自定义每日题量'), findsOneWidget);
    expect(find.text('已处理'), findsOneWidget);
    expect(find.text('运营回复'), findsOneWidget);
  });

  testWidgets('空列表显示空态', (tester) async {
    final adapter = _EmptyAdapter();
    await _pumpSheet(tester, adapter);

    await tester.tap(find.text('我的反馈'));
    await tester.pumpAndSettle();

    expect(find.text('还没有提交过反馈'), findsOneWidget);
  });
}

/// 返回空列表的假 adapter。
class _EmptyAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelRequest,
  ) async {
    final Object payload = options.path.startsWith('/client/feedback')
        ? <String, dynamic>{'list': <Map<String, dynamic>>[], 'total': 0, 'page': 1, 'pageSize': 50}
        : <String, dynamic>{};
    return ResponseBody.fromString(
      jsonEncode(<String, dynamic>{'code': 200, 'message': 'ok', 'data': payload}),
      200,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>['application/json; charset=utf-8'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
