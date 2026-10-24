/// 句签闪卡：打开先给卡背，点一下才翻到句子。
///
/// 这里守住三件事：
/// 1. 未翻开时正面不可见（`Opacity` 为 0，两面的布局都保留）；
/// 2. 翻开后句子真的可见（翻面靠 `Transform` 旋转，写成镜像也能过编译，
///    所以必须断言「可见」而不是「存在」）；
/// 3. 系统要求减弱动效时，点一下立刻出结果，不转那 520ms。
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:short_sentence/api/models/growth.dart';
import 'package:short_sentence/sheets/sentence_card_sheet.dart';
import 'package:short_sentence/theme/motion.dart';

SentenceCard _card() => SentenceCard.fromJson(const <String, dynamic>{
      'id': 7,
      'bizDate': '2026-10-25',
      'title': 'First Light',
      'titleZh': '初次见面',
      'sentenceEn': 'Nice to meet you.',
      'translationZh': '很高兴认识你。',
      'imageUrl': null,
      'obtainedAt': '2026-10-25T07:00:00.000Z',
    });

/// 某段文字所在卡面的不透明度。
///
/// 正反两面都在树里（翻面时两面要共用同一个高度，不能只建当前面），
/// 所以「看不看得见」等价于最近一层 `Opacity` 的值。
double _faceOpacity(WidgetTester tester, String text) {
  final finder = find.ancestor(of: find.text(text), matching: find.byType(Opacity));
  expect(finder, findsWidgets, reason: '「$text」应当有 Opacity 祖先');
  return tester.widget<Opacity>(finder.first).opacity;
}

Future<void> _open(WidgetTester tester, {bool reduceMotion = false}) async {
  await tester.pumpWidget(
    MaterialApp(
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(disableAnimations: reduceMotion),
        child: child!,
      ),
      home: Scaffold(
        body: Builder(
          builder: (context) => Center(
            child: TextButton(
              onPressed: () => showSentenceCard(context, _card()),
              child: const Text('打开句签'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('打开句签'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('打开时是卡背，句子被遮住', (tester) async {
    await _open(tester);

    expect(find.text('轻触揭晓'), findsOneWidget);
    expect(find.text('2026-10-25'), findsWidgets);
    // 句子已经在树里（为了两面等高），但正面整体不可见
    expect(_faceOpacity(tester, '轻触揭晓'), 1);
    expect(_faceOpacity(tester, 'Nice to meet you.'), 0);
  });

  testWidgets('轻触翻面后看到句子，还能翻回卡背', (tester) async {
    await _open(tester);

    await tester.tap(find.text('轻触揭晓'));
    await tester.pumpAndSettle();

    expect(_faceOpacity(tester, 'Nice to meet you.'), 1);
    expect(_faceOpacity(tester, '轻触揭晓'), 0);
    expect(find.text('很高兴认识你。'), findsOneWidget);
    expect(find.text('初次见面'), findsOneWidget);

    await tester.tap(find.text('翻面'));
    await tester.pumpAndSettle();

    expect(_faceOpacity(tester, '轻触揭晓'), 1);
    expect(_faceOpacity(tester, 'Nice to meet you.'), 0);
  });

  testWidgets('点击收起关闭弹窗', (tester) async {
    await _open(tester);
    await tester.tap(find.text('轻触揭晓'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('收起'));
    await tester.pumpAndSettle();

    expect(find.text('打开句签'), findsOneWidget);
  });

  testWidgets('减弱动效时立刻出结果，不等翻面动画', (tester) async {
    await _open(tester, reduceMotion: true);
    expect(
      Motion.reduced(tester.element(find.text('轻触揭晓'))),
      isTrue,
      reason: '测试注入的 disableAnimations 没有生效，后面的断言就没意义了',
    );

    await tester.tap(find.text('轻触揭晓'));
    // 只推一帧：确认是「立刻」，而不是等 520ms 转完
    await tester.pump();

    expect(_faceOpacity(tester, 'Nice to meet you.'), 1);
    await tester.pumpAndSettle();
  });
}
