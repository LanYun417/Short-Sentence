/// 弱点词根：模型解析 + 页面渲染（三端口径一致的最小回归）。
library;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:client_android/api/models/user.dart';
import 'package:client_android/api/models/weakness.dart';
import 'package:client_android/api/questions_api.dart';
import 'package:client_android/pages/weakness_page.dart';
import 'package:client_android/theme/motion.dart';

class _FakeQuestionsApi extends QuestionsApi {
  _FakeQuestionsApi() : super(Dio());

  @override
  Future<WeaknessReport> weakness() async {
    return WeaknessReport.fromJson(<String, dynamic>{
      'windowDays': 30,
      'totalWrong': 2,
      'items': <dynamic>[
        <String, dynamic>{
          'word': 'unavoidable',
          'meaning': '不可避免的',
          'rootAnalysis': 'un- 不 + avoid 避开',
          'wrongCount': 2,
          'totalCount': 3,
          'examples': <dynamic>[
            <String, dynamic>{
              'sentenceId': 1,
              'translationZh': '这是不可避免的。',
              'imageUrl': null,
              'userAnswer': 'avoidable',
            },
          ],
        },
      ],
    });
  }
}

void main() {
  setUp(() => Motion.loopAnimations = false);
  tearDown(() => Motion.loopAnimations = true);

  test('UserProfile 读取周报邮件订阅开关（缺省为 0）', () {
    final user = UserProfile.fromJson(<String, dynamic>{
      'id': 1,
      'email': 'a@example.com',
      'weeklyReportEmail': 1,
    });
    expect(user.weeklyReportEmail, 1);
    expect(user.toJson()['weeklyReportEmail'], 1);
    expect(
      UserProfile.fromJson(<String, dynamic>{}).weeklyReportEmail,
      0,
    );
  });

  testWidgets('弱点词根页按词展示错次、释义与例句', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          questionsApiProvider.overrideWithValue(_FakeQuestionsApi()),
        ],
        child: const MaterialApp(home: WeaknessPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('弱点词根'), findsWidgets);
    expect(find.text('unavoidable'), findsOneWidget);
    expect(find.text('不可避免的'), findsOneWidget);
    expect(find.text('错 2 次'), findsOneWidget);
    expect(find.textContaining('这是不可避免的。'), findsOneWidget);
  });
}
