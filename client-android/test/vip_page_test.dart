/// 会员中心页回归测试。
///
/// 守三件事：
/// 1. 套餐与权益按服务端返回渲染（价格分转元、年卡角标）；
/// 2. 点「微信扫码支付」真的发出 POST /client/pay/create，channel=android；
/// 3. 二维码弹层显示应付金额（扫错单的代价很高，金额必须与服务端一致）。
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:client_android/api/dio_client.dart';
import 'package:client_android/pages/vip_page.dart';
import 'package:client_android/theme/motion.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// 1×1 透明 PNG（Image.memory 需要真实图片数据）。
final Uint8List _tinyPng = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
);

/// 记录请求并按路径返回固定信封。
class _PayAdapter implements HttpClientAdapter {
  final List<String> calls = <String>[];
  Object? lastCreateBody;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelRequest,
  ) async {
    calls.add('${options.method} ${options.path}');
    final Object payload;
    if (options.path == '/client/pay/skus') {
      payload = <String, dynamic>{
        'enabled': true,
        'skus': <Map<String, dynamic>>[
          <String, dynamic>{
            'code': 'vip_month',
            'name': '会员月卡',
            'price': 1200,
            'durationDays': 30,
            'benefits': <String>['AI 私教每日 200 次'],
          },
          <String, dynamic>{
            'code': 'vip_year',
            'name': '会员年卡',
            'price': 6800,
            'durationDays': 365,
            'benefits': <String>['AI 私教每日 200 次'],
          },
          <String, dynamic>{
            'code': 'vip_lifetime',
            'name': '终身会员',
            'price': 12800,
            'durationDays': 0,
            'benefits': <String>['一次买断，永久有效'],
          },
        ],
        'vip': <String, dynamic>{'vip': false, 'lifetime': false, 'expiresAt': null, 'skuCode': null},
      };
    } else if (options.path == '/client/pay/create') {
      lastCreateBody = options.data;
      payload = <String, dynamic>{
        'orderNo': 'SS20260101000000abcdef',
        'amount': 6800,
        'channel': 'android',
        'expiresAt': DateTime.now().toUtc().add(const Duration(minutes: 30)).toIso8601String(),
        'codeUrl': 'weixin://wxpay/bizpayurl?pr=test',
        'qrDataUrl': 'data:image/png;base64,${base64Encode(_tinyPng)}',
      };
    } else {
      payload = <String, dynamic>{
        'orderNo': 'SS20260101000000abcdef',
        'status': 'pending',
        'amount': 6800,
        'paidAt': null,
        'vip': <String, dynamic>{'vip': false, 'lifetime': false, 'expiresAt': null, 'skuCode': null},
      };
    }
    return ResponseBody.fromString(
      jsonEncode(<String, dynamic>{'code': 200, 'message': 'ok', 'data': payload}),
      200,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>['application/json'],
      },
    );
  }
}

Future<void> _pumpPage(WidgetTester tester, HttpClientAdapter adapter) async {
  tester.view.physicalSize = const Size(820, 1600);
  tester.view.devicePixelRatio = 1;

  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[dioProvider.overrideWithValue(Dio()..httpClientAdapter = adapter)],
      child: const MaterialApp(home: VipPage()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    Motion.loopAnimations = false;
  });

  tearDown(() {
    Motion.loopAnimations = true;
  });

  testWidgets('渲染三档套餐与权益', (tester) async {
    final adapter = _PayAdapter();
    await _pumpPage(tester, adapter);

    expect(find.text('会员中心'), findsOneWidget);
    expect(find.text('会员月卡'), findsOneWidget);
    expect(find.text('会员年卡'), findsOneWidget);
    expect(find.text('终身会员'), findsOneWidget);
    expect(find.text('最划算'), findsOneWidget);
    // 12800 分 = ¥128
    expect(find.textContaining('128'), findsWidgets);
    expect(find.text('微信扫码支付'), findsOneWidget);
    expect(adapter.calls, contains('GET /client/pay/skus'));
  });

  testWidgets('下单：POST create 带 android 渠道，弹层显示应付金额', (tester) async {
    final adapter = _PayAdapter();
    await _pumpPage(tester, adapter);

    await tester.tap(find.text('微信扫码支付'));
    // 弹层里有 1s 倒计时 + 2.5s 轮询计时器，不能 pumpAndSettle（永远不静止）
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    // 让首轮 status 请求（含 Dio 内部的 0ms 定时器）有机会完成
    await tester.pump(const Duration(seconds: 1));

    expect(adapter.calls, contains('POST /client/pay/create'));
    final body = adapter.lastCreateBody as Map<String, dynamic>?;
    expect(body?['skuCode'], 'vip_year');
    expect(body?['channel'], 'android');
    expect(find.textContaining('应付 ¥68.00'), findsOneWidget);

    // 关闭弹层并卸载页面：轮询/倒计时计时器必须随 dispose 取消，否则测试收尾会报 pending timer
    Navigator.of(tester.element(find.text('稍后支付'))).pop();
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 1));
  });
}