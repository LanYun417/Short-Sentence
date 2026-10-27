/// 消息中心（公告弹窗）回归测试。
///
/// 守住三件事：
/// 1. 列表能渲染服务端公告，且未读用小红点表达；
/// 2. **点开即已读**——必须真的发出 `POST /client/notices/:id/read`，
///    并在界面上立即反映为已读（乐观标记，不等重拉）；
/// 3. 「全部已读」调 `POST /client/notices/read-all`。
///
/// 用假 adapter 记录请求路径来断言「发没发」，比只看 UI 更可靠
/// （UI 可能只是本地状态变了，后端其实没收到）。
library;

import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:short_sentence/api/dio_client.dart';
import 'package:short_sentence/sheets/notice_sheet.dart';

/// 记录请求路径并按路径返回固定数据的假 adapter。
class _RecordAdapter implements HttpClientAdapter {
  final List<String> calls = <String>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelRequest,
  ) async {
    calls.add('${options.method} ${options.path}');
    final Object? payload = switch (options.path) {
      '/client/notices' => <String, dynamic>{
          'list': <Map<String, dynamic>>[
            <String, dynamic>{
              'id': 1,
              'title': '新场景已上线',
              'content': '购物消费 / 健康医疗 / 运动健身等 8 个新场景已上线。',
              'noticeType': 3,
              'link': null,
              'isRead': 0,
              'pinned': 1,
              'publishedAt': '2026-10-27T02:00:00.000Z',
            },
            <String, dynamic>{
              'id': 2,
              'title': '维护完成',
              'content': '本次维护已完成，服务已恢复。',
              'noticeType': 2,
              'link': null,
              'isRead': 1,
              'pinned': 0,
              'publishedAt': '2026-10-26T02:00:00.000Z',
            },
          ],
          'total': 2,
          'page': 1,
          'pageSize': 50,
        },
      '/client/notices/unread-count' => <String, dynamic>{'count': 1},
      '/client/notices/read-all' => <String, dynamic>{'count': 1},
      _ => null,
    };
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

/// 打开弹窗：包一层带按钮的页面，点按钮走真实入口 showNoticeSheet。
Future<void> _pumpSheet(WidgetTester tester, HttpClientAdapter adapter) async {
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
                onPressed: () => showNoticeSheet(context),
                child: const Text('打开消息'),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('打开消息'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('消息中心：渲染公告列表与未读数', (tester) async {
    final adapter = _RecordAdapter();
    await _pumpSheet(tester, adapter);

    // 首屏拉列表 + 未读数（未读数用于头部文案，红点由列表推算）
    expect(adapter.calls, contains('GET /client/notices'));
    expect(find.text('消息中心'), findsOneWidget);
    expect(find.text('新场景已上线'), findsOneWidget);
    expect(find.text('维护完成'), findsOneWidget);
    // 一条未读 → 头部显示未读条数与「全部已读」按钮
    expect(find.text('1 条未读'), findsOneWidget);
    expect(find.text('全部已读'), findsOneWidget);
    // 置顶标签与类型标签
    expect(find.text('置顶'), findsOneWidget);
    expect(find.text('活动'), findsOneWidget);
  });

  testWidgets('点开公告即标记已读：发出 read 请求且未读清零', (tester) async {
    final adapter = _RecordAdapter();
    await _pumpSheet(tester, adapter);

    await tester.tap(find.text('新场景已上线'));
    await tester.pumpAndSettle();

    expect(adapter.calls, contains('POST /client/notices/1/read'));
    // 乐观标记后头部不再有未读提示
    expect(find.text('1 条未读'), findsNothing);
    expect(find.text('全部已读'), findsNothing);
  });

  testWidgets('全部已读：调用 read-all 并重新拉取列表', (tester) async {
    final adapter = _RecordAdapter();
    await _pumpSheet(tester, adapter);
    adapter.calls.clear();

    await tester.tap(find.text('全部已读'));
    await tester.pumpAndSettle();

    expect(adapter.calls, contains('POST /client/notices/read-all'));
    // 执行后重新拉一次列表（用服务端状态覆盖本地乐观标记）
    expect(adapter.calls, contains('GET /client/notices'));
  });

  testWidgets('已读公告不重复发 read 请求（幂等点开不打扰后端）', (tester) async {
    final adapter = _RecordAdapter();
    await _pumpSheet(tester, adapter);
    adapter.calls.clear();

    await tester.tap(find.text('维护完成'));
    await tester.pumpAndSettle();

    expect(
      adapter.calls.where((call) => call.startsWith('POST /client/notices/2/read')),
      isEmpty,
    );
  });

  testWidgets('空列表显示空态', (tester) async {
    final adapter = _EmptyAdapter();
    await _pumpSheet(tester, adapter);
    expect(find.text('暂时没有消息'), findsOneWidget);
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
    final Object payload = options.path == '/client/notices'
        ? <String, dynamic>{'list': <Map<String, dynamic>>[], 'total': 0, 'page': 1, 'pageSize': 50}
        : <String, dynamic>{'count': 0};
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
