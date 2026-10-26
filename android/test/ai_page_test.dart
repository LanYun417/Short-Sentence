/// AI 页与词根模型测试。
///
/// 重点守两件事：
/// 1. **词根词典入口必须存在**——之前 AI 功能只藏在「答题后翻到背面」的弹层里，
///    用户不答题就永远看不到，功能存在但不可达等于没有；
/// 2. `WordRootItem` 解析不能因为字段缺失/类型不符而崩（后端字段会演进）。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:short_sentence/api/ai_api.dart';
import 'package:short_sentence/api/models/word_root.dart';
import 'package:short_sentence/pages/ai_page.dart';

void main() {
  group('WordRootItem 解析', () {
    test('完整词条', () {
      final item = WordRootItem.fromJson(<String, dynamic>{
        'word': 'unavoidable',
        'phonetic': '/ˌʌnəˈvɔɪdəbl/',
        'meaning': 'adj. 不可避免的',
        'parts': <Map<String, dynamic>>[
          <String, dynamic>{'type': 'prefix', 'text': 'un-', 'meaning': '否定'},
          <String, dynamic>{'type': 'root', 'text': 'avoid', 'meaning': '避开'},
        ],
        'explanation': 'un-（否定）+ avoid（避开）+ -able（可…的）',
        'related': <String>['avoidable', 'avoid'],
        'source': 'ai',
        'searchCount': 3,
      });

      expect(item.word, 'unavoidable');
      expect(item.parts, hasLength(2));
      expect(item.parts.first.typeLabel, '前缀');
      expect(item.parts[1].typeLabel, '词根');
      expect(item.related, <String>['avoidable', 'avoid']);
    });

    test('缺字段不崩（后端演进兼容）', () {
      final item = WordRootItem.fromJson(<String, dynamic>{'word': 'test'});
      expect(item.word, 'test');
      expect(item.parts, isEmpty);
      expect(item.related, isEmpty);
      expect(item.phonetic, isNull);
    });

    test('parts 类型异常时按空处理', () {
      final item = WordRootItem.fromJson(<String, dynamic>{
        'word': 'x',
        'parts': 'not-a-list',
      });
      expect(item.parts, isEmpty);
    });

    test('未知 type 回落词根', () {
      final item = WordRootItem.fromJson(<String, dynamic>{
        'word': 'x',
        'parts': <Map<String, dynamic>>[
          <String, dynamic>{'type': 'weird', 'text': 'a', 'meaning': 'b'},
        ],
      });
      expect(item.parts.first.typeLabel, '词根');
    });
  });

  group('AiPage 三个 Tab 齐备', () {
    testWidgets('场景造句 / 词根拆解 / 词根词典都在', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: <Override>[
            // 额度徽标会拉 /client/ai/quota：测试环境没有后端，
            // 真实请求会留下悬挂定时器让用例失败，这里给固定值。
            aiQuotaProvider.overrideWith(
              (ref) async => const AiQuota(used: 0, limit: 50, remaining: 50),
            ),
          ],
          child: MaterialApp(
            home: Scaffold(body: const AiPage(autoLoad: false)),
          ),
        ),
      );
      // 首帧（词根词典面板会发请求，测试环境失败但不影响 Tab 渲染）
      await tester.pump();

      expect(find.text('场景造句'), findsOneWidget);
      expect(find.text('词根拆解'), findsOneWidget);
      // 这一条是本次修复的核心：词根词典此前完全缺失
      expect(find.text('词根词典'), findsOneWidget);
    });
  });
}
