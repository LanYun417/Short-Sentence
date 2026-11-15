/// 句签闪卡：打开先给卡背，点一下才翻到句子。
///
/// 这里守住四件事：
/// 1. 未翻开时正面不可见（`Opacity` 为 0，两面的布局都保留）；
/// 2. 翻开后句子真的可见（翻面靠 `Transform` 旋转，写成镜像也能过编译，
///    所以必须断言「可见」而不是「存在」）；
/// 3. 翻面靠**点卡片本身**（没有翻面/收起按钮）；
/// 4. 卡背展示的是这张卡独有的「寄语」，不是泛用的揭晓文案。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:client_android/api/models/growth.dart';
import 'package:client_android/sheets/sentence_card_sheet.dart';
import 'package:client_android/theme/motion.dart';

SentenceCard _card() => SentenceCard.fromJson(const <String, dynamic>{
  'id': 7,
  'bizDate': '2026-10-25',
  'title': 'Autumn Stillness',
  'titleZh': '秋之静谧',
  'sentenceEn': 'Golden leaves fall with a gentle, quiet grace.',
  'translationZh': '金叶飘落，静美而温柔。',
  'blessing': '愿你在忙碌里，也留一片安静的落叶。',
  'imageUrl': null,
  'obtainedAt': '2026-10-25T07:00:00.000Z',
});

/// 某段文字所在卡面的不透明度。
///
/// 正反两面都在树里（翻面时两面要共用同一个高度，不能只建当前面），
/// 所以「看不看得见」等价于最近一层 `Opacity` 的值。
double _faceOpacity(WidgetTester tester, String text) {
  final finder = find.ancestor(
    of: find.text(text),
    matching: find.byType(Opacity),
  );
  expect(finder, findsWidgets, reason: '「$text」应当有 Opacity 祖先');
  return tester.widget<Opacity>(finder.first).opacity;
}

Future<void> _open(
  WidgetTester tester, {
  bool reduceMotion = false,
  double textScale = 1,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            disableAnimations: reduceMotion,
            textScaler: TextScaler.linear(textScale),
          ),
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
    ),
  );
  await tester.tap(find.text('打开句签'));
  await tester.pumpAndSettle();
  // 多等一会儿：排除「路由过渡还没结束就点」的干扰
  await tester.pump(const Duration(milliseconds: 800));
}

void main() {
  testWidgets('打开时是卡背：显示寄语，句子被遮住', (tester) async {
    await _open(tester);

    // 卡背展示这张卡独有的寄语
    expect(find.text('愿你在忙碌里，也留一片安静的落叶。'), findsOneWidget);
    expect(find.text('轻触翻开'), findsOneWidget);
    // 日期按网页端的口径显示成「10月25日」
    expect(find.text('10月25日'), findsWidgets);
    // 句子已经在树里（为了两面等高），但正面整体不可见
    expect(
      _faceOpacity(tester, 'Golden leaves fall with a gentle, quiet grace.'),
      0,
    );
  });

  testWidgets('没有寄语的旧卡片用兜底文案', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => Center(
                child: TextButton(
                  onPressed: () => showSentenceCard(
                    context,
                    SentenceCard.fromJson(const <String, dynamic>{
                      'id': 8,
                      'bizDate': '2026-10-24',
                      'title': 'Old',
                      'titleZh': '旧卡',
                      'sentenceEn': 'Old sentence.',
                      'translationZh': '旧句子。',
                      'blessing': '',
                      'imageUrl': null,
                      'obtainedAt': '2026-10-24T07:00:00.000Z',
                    }),
                  ),
                  child: const Text('打开句签'),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('打开句签'));
    await tester.pumpAndSettle();

    expect(find.text('愿你今天，也有一句刚好合心意的话。'), findsOneWidget);
  });

  testWidgets('点卡片本身翻面，再点翻回；没有翻面/收起按钮', (tester) async {
    await _open(tester);

    // 页面上不该有翻面 / 收起按钮
    expect(find.text('翻面'), findsNothing);
    expect(find.text('收起'), findsNothing);

    await tester.tap(find.text('轻触翻开'));
    await tester.pumpAndSettle();

    expect(
      _faceOpacity(tester, 'Golden leaves fall with a gentle, quiet grace.'),
      1,
    );
    expect(_faceOpacity(tester, '愿你在忙碌里，也留一片安静的落叶。'), 0);
    expect(find.text('金叶飘落，静美而温柔。'), findsOneWidget);

    // 再点卡片本身翻回卡背。先等忙锁释放（翻面 520 + 扫光 900）：
    // 锁定期内的点击会被忽略，那是为了避免转一半时打乱翻转方向
    await tester.pump(const Duration(milliseconds: 1600));
    await tester.tap(find.byKey(const ValueKey<String>('card-front-tap')));
    await tester.pumpAndSettle();

    expect(_faceOpacity(tester, '愿你在忙碌里，也留一片安静的落叶。'), 1);
    expect(
      _faceOpacity(tester, 'Golden leaves fall with a gentle, quiet grace.'),
      0,
    );
  });

  testWidgets('翻面是单向的：回来时不会倒着转', (tester) async {
    await _open(tester);

    Matrix4 rotationAt() {
      final transform = tester.widget<Transform>(
        find.byKey(const ValueKey<String>('sentence-card-flip')),
      );
      return transform.transform;
    }

    await tester.tap(find.text('轻触翻开'));
    await tester.pumpAndSettle();
    // 稳态在 1（半圈）：rotateY(π) 让 m00 = -1
    expect(rotationAt().entry(0, 0), closeTo(-1, 0.02), reason: '正面应当转到半圈');

    // 等忙锁释放后再翻回来
    await tester.pump(const Duration(milliseconds: 1600));
    await tester.tap(
      find.text('Golden leaves fall with a gentle, quiet grace.'),
    );
    await tester.pumpAndSettle();
    // 归位到 0（整圈与 0 视觉等价）：m00 回到 1
    expect(rotationAt().entry(0, 0), closeTo(1, 0.02), reason: '翻回来后应当回到封面');
  });

  testWidgets('减弱动效时立刻出结果，不等翻面动画', (tester) async {
    await _open(tester, reduceMotion: true);
    expect(
      Motion.reduced(tester.element(find.text('轻触翻开'))),
      isTrue,
      reason: '测试注入的 disableAnimations 没有生效，后面的断言就没意义了',
    );

    await tester.tap(find.text('轻触翻开'));
    // 只推一帧：确认是「立刻」，而不是等 520ms 转完
    await tester.pump();

    expect(
      _faceOpacity(tester, 'Golden leaves fall with a gentle, quiet grace.'),
      1,
    );
    await tester.pumpAndSettle();
  });

  testWidgets('手机尺寸 + 大字号下卡背不溢出（黄黑斜纹指示条的回归）', (tester) async {
    // 真实缺陷：卡片高度由正面（配图 16:9 + 卡脚）决定，卡背是 Positioned.fill
    // 被拉到同一个高度，而卡背的固定内容（封蜡 + 寄语 + 底部文案）更高，
    // 于是底部溢出十几二十像素，release 包里会真实画出黄黑斜纹 +「BOTTOM OVERFLOWED」。
    // 用手机逻辑尺寸（360x800）与 1.3 倍字号复现：这正是 Medium_Phone 模拟器上的量。
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await _open(tester, textScale: 1.3);

    // RenderFlex 溢出会被框架作为异常上报：有溢出这条就过不去
    expect(tester.takeException(), isNull);
    // 卡背的关键信息要完整在卡内
    expect(find.text('愿你在忙碌里，也留一片安静的落叶。'), findsOneWidget);
    expect(find.text('轻触翻开'), findsOneWidget);
    expect(find.text('短句 · 每天一句，慢慢变好'), findsOneWidget);
  });
}
