/// 刷题页回归测试：卡片未翻转时不得解引用判分结果。
///
/// 这个 bug 的真实形态：`_FlipCard` 的 `back:` 实参在 `_buildCard` 运行时
/// **立即求值**，于是 `result!` 在「卡片还没翻、result 还是 null」时就被解引用
/// → 每次进入刷题页必崩（Null check operator used on a null value）。
///
/// 所以这里刻意在 **result 为 null**（未提交答案）的状态下渲染页面：
/// 修复前它会抛异常，修复后（改为 builder）才能正常显示正面。
///
/// 用 `QuizPage(autoLoad: false)` 关掉首屏自动抽题：测试环境没有后端，
/// 且那次请求会留下悬挂定时器让用例失败。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:short_sentence/api/models/question.dart';
import 'package:short_sentence/pages/quiz_page.dart';
import 'package:short_sentence/state/quiz_controller.dart';
import 'package:short_sentence/theme/motion.dart';

Question _question() => Question.fromJson(const <String, dynamic>{
      'sentenceId': 1117,
      'translationZh': '我一到就会给你打电话。',
      'imageUrl': null,
      'categoryName': '旅行出行',
      'difficulty': 2,
      'todayDone': 3,
      'todayGoal': 20,
      'source': 'new',
      'words': null,
    });

AnswerResult _result() => AnswerResult.fromJson(const <String, dynamic>{
      'sentenceId': 1117,
      'isCorrect': true,
      'sentenceEn': 'I will call you as soon as I arrive.',
      'validAnswers': <String>[],
      'translationZh': '我一到就会给你打电话。',
      'favorited': false,
      'todayDone': 4,
      'todayGoal': 20,
    });

/// 挂载一个预置好状态的 QuizPage，并返回可改状态的容器。
Future<ProviderContainer> _pump(WidgetTester tester, QuizState state) async {
  final container = ProviderContainer();
  container.read(quizControllerProvider.notifier).state = state;
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: QuizPage(autoLoad: false)),
    ),
  );
  return container;
}

void main() {
  // 页面里的极光/微光是无限循环动画，会让 pumpAndSettle 永远等不到静止；
  // 测试里统一关掉（生产默认开启，见 Motion.loopAnimations 注释）。
  setUp(() => Motion.loopAnimations = false);
  tearDown(() => Motion.loopAnimations = true);

  testWidgets('未提交答案时渲染正面，不解引用 null 的 result', (tester) async {
    await _pump(
      tester,
      QuizState(question: _question(), phase: QuizPhase.answering),
    );

    expect(find.text('我一到就会给你打电话。'), findsOneWidget);
    expect(find.text('确定'), findsOneWidget);
    // 背面元素不在（还没翻卡）——这一条正是当年崩溃的场景
    expect(find.text('下一题'), findsNothing);
    expect(find.text('收藏'), findsNothing);
  });

  testWidgets('抽题失败（无题）时显示空态，不崩', (tester) async {
    await _pump(
      tester,
      const QuizState(
        phase: QuizPhase.idle,
        error: '网络异常，请检查网络连接',
      ),
    );

    expect(find.text('网络异常，请检查网络连接'), findsOneWidget);
    expect(find.text('重新抽题'), findsOneWidget);
  });

  testWidgets('判分后翻到背面（下一题 / 收藏）', (tester) async {
    await _pump(
      tester,
      QuizState(
        question: _question(),
        phase: QuizPhase.answered,
        result: _result(),
      ),
    );
    // 翻牌是 420ms 动画，等它播完背面才出现
    await tester.pumpAndSettle();

    expect(find.text('I will call you as soon as I arrive.'), findsOneWidget);
    expect(find.text('下一题'), findsOneWidget);
    // 收藏是星形图标（对齐 Web 端 favPop 设计），不是文字按钮
    expect(find.byIcon(Icons.star_border_rounded), findsOneWidget);
    expect(find.text('这些说法也算对'), findsNothing); // 本题无等价表达
  });

  testWidgets('拼词模式展示候选词块', (tester) async {
    await _pump(
      tester,
      QuizState(
        question: Question.fromJson(const <String, dynamic>{
          'sentenceId': 2,
          'translationZh': '测试',
          'source': 'new',
          'words': <String>['call', 'you', 'I'],
        }),
        phase: QuizPhase.answering,
        mode: AnswerMode.assemble,
      ),
    );

    expect(find.text('call'), findsOneWidget);
    expect(find.text('you'), findsOneWidget);
    // 「撤销」常驻显示（未选中时置灰），这是设计调整后的行为
    expect(find.text('撤销'), findsOneWidget);
  });

  testWidgets('翻转角度与 flipped 一致（不会出现转一半还显示正面）', (tester) async {
    final container = await _pump(
      tester,
      QuizState(question: _question(), phase: QuizPhase.answering),
    );
    // 未提交：正面
    expect(find.text('确定'), findsOneWidget);

    // 提交判分：flipped 变 true，目标角度必须同步到 180
    container.read(quizControllerProvider.notifier).state = QuizState(
      question: _question(),
      phase: QuizPhase.answered,
      result: _result(),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();

    // 背面出现、正面消失——证明 deg 与 flipped 没有脱节
    expect(find.text('下一题'), findsOneWidget);
    expect(find.text('确定'), findsNothing);
  });

  testWidgets('配图 URL 经 staticUrl 拼成绝对地址', (tester) async {
    // 后端返回的是相对路径 /static/webp/xxx.webp，
    // 直接喂给 CachedNetworkImage 会请求失败（曾经的 bug：显示「配图加载失败」）。
    final container = await _pump(
      tester,
      QuizState(
        question: Question.fromJson(<String, dynamic>{
          'sentenceId': 1117,
          'translationZh': 'x',
          'source': 'new',
          'imageUrl': '/static/webp/demo.webp',
        }),
        phase: QuizPhase.answering,
      ),
    );
    await tester.pump();

    // 页面上不应出现「配图加载失败」/「配图缺失」
    expect(find.text('配图加载失败'), findsNothing);
    expect(find.text('配图缺失'), findsNothing);

    // CachedNetworkImage 内部用的已是绝对地址
    final image = tester.widget<CachedNetworkImage>(find.byType(CachedNetworkImage));
    expect(image.imageUrl, startsWith('http'));
    expect(image.imageUrl, endsWith('/static/webp/demo.webp'));
    container.dispose();
  });

  testWidgets('点下一题后卡片保持背面（不当用户面往回翻）', (tester) async {
    // 曾经的 bug：loadNext() 一进去就 phase=loading + clearResult，
    // flipped 立刻变 false → 卡片当着用户的面从 180° 往回转，
    // 停在中间角度就是「卡片斜着」。现在 loading 期间应保持翻转态。
    final container = await _pump(
      tester,
      QuizState(
        question: _question(),
        phase: QuizPhase.answered,
        result: _result(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('下一题'), findsOneWidget);

    // 进入抽题中
    container.read(quizControllerProvider.notifier).state = QuizState(
      question: _question(),
      phase: QuizPhase.loading,
      loadingNext: true,
    );
    await tester.pump();

    // 仍应是背面（加载态），而不是回到正面
    expect(find.text('加载下一题…'), findsOneWidget);
    expect(find.text('确定'), findsNothing);
    container.dispose();
  });
}
