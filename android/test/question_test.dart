/// 刷题模型解析测试。
///
/// 这三类解析是最高频出错的地方，且**错了很难在 UI 上发现**
/// （字段名写错只会得到 null/0，界面表现为"没数据"而不是报错）：
/// - `Question.fromJson`：words 只在拼词模式下发，输入模式必须是 null；
/// - `AnswerResult.fromJson`：validAnswers 是可选数组；
/// - `normalizeAnswer`：必须与后端同口径，三端任一侧单独放宽都会造成
///   「前端对、后端错」的割裂体验。
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:short_sentence/api/answer_normalize.dart';
import 'package:short_sentence/api/models/question.dart';

void main() {
  group('Question.fromJson', () {
    test('输入模式：words 为 null（不把答案提前给用户）', () {
      final question = Question.fromJson(<String, dynamic>{
        'sentenceId': 1117,
        'translationZh': '我一到就会给你打电话。',
        'imageUrl': 'static/xxx.webp',
        'categoryName': '旅行出行',
        'difficulty': 2,
        'todayDone': 6,
        'todayGoal': 20,
        'source': 'new',
        'words': null,
      });

      expect(question.sentenceId, 1117);
      expect(question.words, isNull);
      expect(question.source, QuestionSource.newQuestion);
      expect(question.difficultyLabel, '进阶');
      expect(question.todayProgress, closeTo(0.3, 0.001));
    });

    test('拼词模式：words 是打乱词块数组', () {
      final question = Question.fromJson(<String, dynamic>{
        'sentenceId': 1,
        'translationZh': 'x',
        'source': 'review',
        'words': <String>['call', 'you', 'will', 'I'],
      });

      expect(question.source, QuestionSource.review);
      expect(question.words, <String>['call', 'you', 'will', 'I']);
    });

    test('words 类型不对时按 null 处理（不崩）', () {
      final question = Question.fromJson(<String, dynamic>{
        'sentenceId': 1,
        'translationZh': 'x',
        'source': 'new',
        'words': 'not-a-list',
      });
      expect(question.words, isNull);
    });

    test('source 未知值时回落 new（不抛异常）', () {
      final question = Question.fromJson(<String, dynamic>{
        'sentenceId': 1,
        'translationZh': 'x',
        'source': 'whatever',
      });
      expect(question.source, QuestionSource.newQuestion);
    });

    test('todayGoal 为 0 时进度为 0（不除零）', () {
      final question = Question.fromJson(<String, dynamic>{
        'sentenceId': 1,
        'translationZh': 'x',
        'todayDone': 0,
        'todayGoal': 0,
      });
      expect(question.todayProgress, 0);
    });
  });

  group('AnswerResult.fromJson', () {
    test('解析正确答案与等价表达', () {
      final result = AnswerResult.fromJson(<String, dynamic>{
        'sentenceId': 1117,
        'isCorrect': true,
        'sentenceEn': 'I will call you as soon as I arrive.',
        'validAnswers': <String>["I'll call you as soon as I arrive."],
        'translationZh': '我一到就会给你打电话。',
        'ipa': '/aɪ wɪl kɔːl juː/',
        'imageUrl': 'static/x.webp',
        'favorited': false,
        'todayDone': 7,
        'todayGoal': 20,
      });

      expect(result.isCorrect, isTrue);
      expect(result.validAnswers, hasLength(1));
      expect(result.favorited, isFalse);
      expect(result.ipa, '/aɪ wɪl kɔːl juː/');
    });

    test('validAnswers 缺省时是空数组（不是 null）', () {
      final result = AnswerResult.fromJson(<String, dynamic>{
        'sentenceId': 1,
        'isCorrect': false,
        'sentenceEn': 'x',
      });
      expect(result.validAnswers, isEmpty);
      expect(result.favorited, isFalse);
    });
  });

  group('normalizeAnswer（与后端同口径）', () {
    test('小写 + 去首尾标点 + 压缩空白', () {
      expect(normalizeAnswer('  I will call you.  '), 'i will call you');
      expect(normalizeAnswer('I   will    call you'), 'i will call you');
      expect(normalizeAnswer("I'll call you!"), "i'll call you");
    });

    test('首尾空白与非字母数字被剥掉', () {
      expect(normalizeAnswer('...Hello, World!!!'), 'hello, world');
      expect(normalizeAnswer(''), '');
    });

    test('isBlankAnswer 只认「什么都没有」', () {
      expect(isBlankAnswer('   '), isTrue);
      expect(isBlankAnswer(' ... '), isTrue);
      expect(isBlankAnswer('hi'), isFalse);
    });
  });
}
