/// AI 拓展结果解析测试。
///
/// 这些解析是「看起来有内容、其实是脏数据」的高发区：
/// 模型偶尔会包 ```json 代码块或前后加解释，宽容解析必须能吃掉；
/// 而真正缺字段时必须返回 null，让 UI 回退成原文——
/// 半个结构化卡片（比如有音标没句子）比纯文本更让人困惑。
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:short_sentence/api/ai_result.dart';

void main() {
  group('ExpandResult.tryParse', () {
    test('标准单行 JSON', () {
      final result = ExpandResult.tryParse(
        '{"sentence":"Could you speak a bit louder?","phonetic":"/kʊd juː spiːk/","note":"请对方说大声点"}',
      );
      expect(result, isNotNull);
      expect(result!.sentence, 'Could you speak a bit louder?');
      expect(result.phonetic, '/kʊd juː spiːk/');
      expect(result.note, '请对方说大声点');
    });

    test('被 ```json 代码块包住也能解析', () {
      final result = ExpandResult.tryParse(
        '```json\n{"sentence":"I am on my way.","phonetic":"/aɪ æm/","note":"在路上"}\n```',
      );
      expect(result?.sentence, 'I am on my way.');
    });

    test('缺 sentence 视为失败（回退原文，不渲染空卡片）', () {
      expect(ExpandResult.tryParse('{"phonetic":"/x/","note":"只有音标"}'), isNull);
    });

    test('纯文本/半截 JSON 返回 null', () {
      expect(ExpandResult.tryParse('抱歉，我无法回答'), isNull);
      expect(ExpandResult.tryParse('{"sentence":"未完'), isNull);
    });
  });

  group('WordRootResult.tryParse', () {
    test('词素链按原顺序解析', () {
      final result = WordRootResult.tryParse(
        '{"phonetic":"/ˌʌnəˈvɔɪdəbl/","meaning":"adj. 不可避免的",'
        '"parts":[{"type":"prefix","text":"un-","meaning":"否定"},'
        '{"type":"root","text":"avoid","meaning":"避免"},'
        '{"type":"suffix","text":"-able","meaning":"可…的"}],'
        '"explanation":"un + avoid + able，无法避免的","related":["avoidable","avoidance"]}',
      );
      expect(result, isNotNull);
      expect(result!.parts.length, 3);
      expect(result.parts.first.typeLabel, '前缀');
      expect(result.parts[1].text, 'avoid');
      expect(result.parts.last.typeLabel, '后缀');
      expect(result.related, contains('avoidable'));
    });

    test('parts 里缺 text 的条目跳过，不产生空标签', () {
      final result = WordRootResult.tryParse(
        '{"meaning":"n. 测试","parts":[{"type":"root","meaning":"无文本"},{"type":"root","text":"test"}]}',
      );
      expect(result!.parts.length, 1);
      expect(result.parts.single.text, 'test');
    });

    test('meaning 与 parts 都为空视为失败', () {
      expect(WordRootResult.tryParse('{"phonetic":"/x/"}'), isNull);
    });
  });
}
