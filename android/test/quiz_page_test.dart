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
import 'package:flutter_test/flutter_test.dart';
import 'package:short_sentence/api/models/question.dart';
import 'package:short_sentence/pages/quiz_page.dart';
import 'package:short_sentence/state/quiz_controller.dart';

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
  testWidgets('未提交答案时渲染正面，不解引用 null 的 result', (tester) async {
    await _pump(
      tester,
      QuizState(question: _question(), phase: QuizPhase.answering),
    );

    expect(find.text('我一到就会给你打电话。'), findsOneWidget);
    expect(find.text('提交'), findsOneWidget);
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
    expect(find.text('收藏'), findsOneWidget);
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
    expect(find.text('撤销'), findsNothing); // 未选中时不显示撤销
  });
}
