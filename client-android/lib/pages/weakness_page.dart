/// 弱点词根页：近 30 天错题按词自动归类。
///
/// 与 Web `pages/weakness.vue` / 小程序 `pages/weakness` 同口径：
/// 服务端已经过滤功能词并附上中文释义、词根解析，这里只做展示。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/questions_api.dart';
import '../api/models/weakness.dart';
import '../state/shell_controller.dart';
import '../theme.dart';
import '../widgets/app_card.dart';

class WeaknessPage extends ConsumerStatefulWidget {
  const WeaknessPage({super.key});

  @override
  ConsumerState<WeaknessPage> createState() => _WeaknessPageState();
}

class _WeaknessPageState extends ConsumerState<WeaknessPage> {
  late Future<WeaknessReport> _future =
      ref.read(questionsApiProvider).weakness();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('弱点词根')),
      body: FutureBuilder<WeaknessReport>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Text(
                    '加载失败，请稍后重试',
                    style: TextStyle(color: context.colors.inkSoft),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () => setState(() {
                      _future = ref.read(questionsApiProvider).weakness();
                    }),
                    child: const Text('重试'),
                  ),
                ],
              ),
            );
          }
          final report = snapshot.data!;
          if (report.items.isEmpty) {
            return Center(
              child: Text(
                '最近没有需要补的词，继续保持！',
                style: TextStyle(color: context.colors.inkSoft),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async {
              setState(() {
                _future = ref.read(questionsApiProvider).weakness();
              });
              await _future;
            },
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              itemCount: report.items.length,
              separatorBuilder: (context, index) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final item = report.items[index];
                return AppCard(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text(
                                  item.word,
                                  style: Theme.of(context).textTheme.titleMedium
                                      ?.copyWith(fontWeight: FontWeight.w700),
                                ),
                                if (item.meaning != null && item.meaning!.isNotEmpty)
                                  Text(
                                    item.meaning!,
                                    style: Theme.of(context).textTheme.bodySmall,
                                  ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: context.colors.danger.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              '错 ${item.wrongCount} 次',
                              style: TextStyle(
                                fontSize: 11,
                                color: context.colors.danger,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (item.rootAnalysis != null && item.rootAnalysis!.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            item.rootAnalysis!,
                            style: TextStyle(
                              fontSize: 12,
                              color: context.colors.brand,
                            ),
                          ),
                        ),
                      for (final example in item.examples)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            '${example.translationZh}（你的作答：${example.userAnswer}）',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          // 和 Web / 小程序一致：一键进纯复习抽题
          ref.read(shellControllerProvider.notifier).go(0);
          Navigator.of(context).pop();
        },
        icon: const Icon(Icons.repeat_rounded),
        label: const Text('去复习'),
      ),
    );
  }
}
