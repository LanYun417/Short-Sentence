/// 词根词典页回归测试。
///
/// 守两个真实报过的 bug：
/// 1. **长释义横向溢出**——parts 的 chip 放在 `Wrap` 里，而 Wrap 给子项的是
///    无界宽度，`balc- 横梁、脚手架（源自伦巴第语 balko，经意大利语…）`
///    这种长释义会把 Row 撑出屏幕，出现 RIGHT OVERFLOWED 黄黑条。
///    Flutter 里溢出会抛 RenderFlex overflowed 异常，所以只要能渲染不报错，
///    就说明约束生效了。
/// 2. **列表底部被 tabbar 遮挡**——底部 padding 必须留够（108），
///    否则最后一两条永远滑不出来。
library;

import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:short_sentence/api/ai_api.dart';
import 'package:short_sentence/api/dio_client.dart';
import 'package:short_sentence/pages/ai_page.dart';

/// 固定返回一段词根列表的假 adapter（不发真实请求）。
class _StubAdapter implements HttpClientAdapter {
  _StubAdapter(this.payload);

  final Object payload;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelRequest,
  ) async {
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

/// 一条带**超长释义**的词条，用于复现横向溢出。
Map<String, dynamic> _longMeaningItem() => <String, dynamic>{
      'word': 'balcony',
      'phonetic': '/ˈbælkəni/',
      'meaning': 'n. 阳台；（剧院的）楼座，楼上包厢',
      'parts': <Map<String, dynamic>>[
        <String, dynamic>{
          'type': 'root',
          'text': 'balc-',
          'meaning': '横梁、脚手架（源自伦巴第语 balko，经意大利语 balcone 传入英语，指由横梁搭起的平台）',
        },
        <String, dynamic>{
          'type': 'suffix',
          'text': '-ony',
          'meaning': '名词后缀，表示场所或事物',
        },
      ],
      'explanation': 'balcony 借自意大利语 balcone，其词根可追溯到伦巴第语 balko（横梁、脚手架），'
          '本义是「由横梁搭起的平台」，后加名词后缀 -ony 固定为英语形式。',
      'related': <String>['balk', 'balconet', 'balconied', 'balustrade'],
      'source': 'ai',
      'searchCount': 1,
    };

Future<void> _pump(WidgetTester tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        dioProvider.overrideWithValue(
          Dio()..httpClientAdapter = _StubAdapter(<Map<String, dynamic>>[_longMeaningItem()]),
        ),
        aiQuotaProvider.overrideWith(
          (ref) async => const AiQuota(used: 0, limit: 50, remaining: 50),
        ),
      ],
      child: const MaterialApp(home: Scaffold(body: AiPage())),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('超长释义不横向溢出（曾出现 RIGHT OVERFLOWED）', (tester) async {
    // 用窄屏更容易触发溢出（手机宽度约 390）
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await _pump(tester);

    // 切到「词根词典」
    await tester.tap(find.text('词根词典'));
    await tester.pumpAndSettle();

    // 词条渲染出来了
    expect(find.text('balcony'), findsOneWidget);

    // 展开看拆解（长释义在这里）
    await tester.tap(find.text('balcony'));
    await tester.pumpAndSettle();

    // 长释义确实渲染出来了（渲染过程若发生 RenderFlex overflow，
    // flutter_test 会把它记为测试失败，所以这一步也顺带覆盖了溢出）。
    //
    // 说明：这里**刻意不**断言「释义的祖先里有 Flexible」——试过
    // find.byType(Flexible) 和 find.ancestor 两种写法，都会因为
    // ExpansionTile / ListView 内部本来就有 Flexible 而永远成立，
    // 属于「看着守住了、其实没守」的假测试。宁可少一条断言，
    // 也不留一条骗人的。
    expect(find.textContaining('经意大利语 balcone 传入英语'), findsOneWidget);
  });

  testWidgets('列表底部留出 tabbar 空间（108）', (tester) async {
    await _pump(tester);
    await tester.tap(find.text('词根词典'));
    await tester.pumpAndSettle();

    // 找到词典列表的 padding：底部必须是 108，否则会被底部 Tab 栏遮住
    final lists = tester.widgetList<ListView>(find.byType(ListView));
    final bottoms = lists
        .map((list) => (list.padding as EdgeInsets?)?.bottom)
        .whereType<double>()
        .toList();
    expect(bottoms, contains(108.0));
  });

  testWidgets('三个 Tab 都在（场景造句 / 词根拆解 / 词根词典）', (tester) async {
    await _pump(tester);
    expect(find.text('场景造句'), findsOneWidget);
    expect(find.text('词根拆解'), findsOneWidget);
    expect(find.text('词根词典'), findsOneWidget);
  });
}
