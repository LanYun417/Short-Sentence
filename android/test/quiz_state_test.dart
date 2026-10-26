/// 刷题状态回归测试。
///
/// 这里锁的是两个**曾经真实踩过**的坑：
/// 1. `copyWith` 漏字段：`loadingNext` 曾没被复制，导致「点下一题」时
///    卡片当着用户的面往回翻（截图里「卡片斜着」）；
/// 2. 判分结果的经验字段：`xpEarned/goalBonus/newAchievements` 解析错位
///    不会报错，只会让「+N XP」显示成 0 或成就提示不出现。
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:short_sentence/api/models/question.dart';
import 'package:short_sentence/api/questions_api.dart';
import 'package:short_sentence/state/quiz_controller.dart';

/// 只回成功判分的假 API：绕开真实网络，专测「提交后模式是否被重置」这类
/// 纯状态机行为。
class _StubQuestionsApi extends QuestionsApi {
  _StubQuestionsApi() : super(Dio());

  @override
  Future<AnswerResult> answer(
    int sentenceId,
    String userAnswer, {
    int? elapsedMs,
    AnswerMode mode = AnswerMode.input,
  }) async =>
      AnswerResult.fromJson(<String, dynamic>{
        'sentenceId': sentenceId,
        'isCorrect': true,
        'sentenceEn': userAnswer,
        'validAnswers': <String>[],
        'translationZh': '测试',
        'favorited': false,
        'todayDone': 1,
        'todayGoal': 20,
      });
}

void main() {
  group('QuizState.copyWith', () {
    test('保留 loadingNext（否则抽下一题会当面翻回正面）', () {
      const state = QuizState(phase: QuizPhase.loading, loadingNext: true);
      final next = state.copyWith(phase: QuizPhase.loading);
      expect(next.loadingNext, isTrue);
    });

    test('保留难度，切换模式不会把难度重置', () {
      const state = QuizState(difficulty: 3);
      final next = state.copyWith(mode: AnswerMode.assemble);
      expect(next.difficulty, 3);
    });

    test('显式关闭 loadingNext', () {
      const state = QuizState(phase: QuizPhase.loading, loadingNext: true);
      expect(state.copyWith(loadingNext: false).loadingNext, isFalse);
    });
  });

  group('AnswerResult 经验字段', () {
    test('作答经验 + 目标奖励一起解析，totalXp 为两者之和', () {
      final result = AnswerResult.fromJson(<String, dynamic>{
        'sentenceId': 1,
        'isCorrect': true,
        'sentenceEn': 'I will call you as soon as I arrive.',
        'validAnswers': <String>[],
        'translationZh': '我一到就给你打电话',
        'favorited': false,
        'todayDone': 20,
        'todayGoal': 20,
        'xpEarned': 10,
        'goalBonus': 20,
        'newAchievements': <Map<String, dynamic>>[
          <String, dynamic>{'code': 'first_step', 'name': '初次落笔'},
        ],
      });

      expect(result.xpEarned, 10);
      expect(result.goalBonus, 20);
      expect(result.totalXp, 30);
      expect(result.newAchievements.single.name, '初次落笔');
    });

    test('旧版后端（没有这些字段）按 0 / 空处理，不崩', () {
      final result = AnswerResult.fromJson(<String, dynamic>{
        'sentenceId': 1,
        'isCorrect': false,
        'sentenceEn': 'x',
        'translationZh': 'x',
        'favorited': false,
        'todayDone': 1,
        'todayGoal': 20,
      });
      expect(result.totalXp, 0);
      expect(result.newAchievements, isEmpty);
    });
  });

  group('作答模式持久化', () {
    test('拼词模式提交后模式保持拼词（不会自动跳回默写）', () async {
      final container = ProviderContainer(
        overrides: [questionsApiProvider.overrideWithValue(_StubQuestionsApi())],
      );
      final controller = container.read(quizControllerProvider.notifier);
      // 用户在拼词模式答了一题
      controller.state = QuizState(
        question: Question.fromJson(const <String, dynamic>{
          'sentenceId': 1,
          'translationZh': '测试',
          'source': 'new',
          'words': <String>['a', 'b'],
        }),
        phase: QuizPhase.answering,
        mode: AnswerMode.assemble,
      );

      await controller.submit('a b');

      // 修复前：提交后 resetMode() 把模式切回 input，下一题就变默写了。
      expect(container.read(quizControllerProvider).mode, AnswerMode.assemble);
    });
  });
}
