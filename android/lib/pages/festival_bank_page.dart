/// 题库页：全年节日题库网格，挑一个节日专门刷。
///
/// 为什么独立成页：刷题页是「一题一屏」的核心场景，二十多个节日入口平铺在那里
/// 会把题卡顶出首屏。所以刷题页不再常驻节日入口，改由这里进。
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/models/question.dart';
import '../api/questions_api.dart';
import '../state/quiz_controller.dart';
import '../state/shell_controller.dart';
import '../theme.dart';
import '../widgets/press_scale.dart';

class FestivalBankPage extends ConsumerStatefulWidget {
  const FestivalBankPage({super.key});

  @override
  ConsumerState<FestivalBankPage> createState() => _FestivalBankPageState();
}

class _FestivalBankPageState extends ConsumerState<FestivalBankPage> {
  late final Future<List<FestivalBank>> _festivals;

  @override
  void initState() {
    super.initState();
    _festivals = ref.read(questionsApiProvider).listFestivals();
  }

  /// 挑一个节日：锁定该节日题库（后台抽题），同时切回刷题页继续刷。
  void _pick(String name) {
    unawaited(ref.read(quizControllerProvider.notifier).setFestival(name));
    ref.read(shellControllerProvider.notifier).go(0);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  '题库',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: colors.ink),
                ),
                const SizedBox(height: 4),
                Text(
                  '节日题库全年常驻，挑一个节日专门刷',
                  style: TextStyle(fontSize: 12, color: colors.inkFaint),
                ),
              ],
            ),
          ),
          Expanded(
            child: FutureBuilder<List<FestivalBank>>(
              future: _festivals,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const _GridSkeleton();
                }
                final items = snapshot.data ?? const <FestivalBank>[];
                if (items.isEmpty) {
                  return const _EmptyState();
                }
                return GridView.builder(
                  // 底部留出 Tab 栏 + 安全区的余量，最后一排卡片不被压住
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 120),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 1.35,
                  ),
                  itemCount: items.length,
                  itemBuilder: (context, index) => _FestivalCard(
                    bank: items[index],
                    onTap: () => _pick(items[index].name),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// 单个节日卡片：按它在一年中的位置取色，一眼能分出季节。
class _FestivalCard extends StatelessWidget {
  const _FestivalCard({required this.bank, required this.onTap});

  final FestivalBank bank;
  final VoidCallback onTap;

  /// 12 色环按月份均匀分布（1 月最冷、7 月最暖）。
  Color _hueColor() {
    final raw = bank.date != null && bank.date!.length >= 7 ? bank.date!.substring(5, 7) : '01';
    final month = int.tryParse(raw) ?? 1;
    return HSLColor.fromAHSL(1, ((month - 1) / 12) * 360, 0.72, 0.46).toColor();
  }

  @override
  Widget build(BuildContext context) {
    return PressScale(
      onTap: onTap,
      scale: 0.95,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: _hueColor(),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: Text(
                    bank.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
                const Icon(Icons.auto_awesome_rounded, size: 15, color: Colors.white70),
              ],
            ),
            Text(
              '${bank.count} 题',
              style: const TextStyle(fontSize: 11, color: Colors.white70),
            ),
          ],
        ),
      ),
    );
  }
}

/// 加载中占位。
class _GridSkeleton extends StatelessWidget {
  const _GridSkeleton();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 120),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.35,
      ),
      itemCount: 6,
      itemBuilder: (context, index) => Container(
        decoration: BoxDecoration(
          color: colors.cardMuted,
          borderRadius: BorderRadius.circular(18),
        ),
      ),
    );
  }
}

/// 空态：题库还没铺满（运营侧正在生成）。
class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(Icons.calendar_month_outlined, size: 40, color: colors.inkFaint),
          const SizedBox(height: 12),
          Text(
            '节日题库正在准备中',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.inkSoft),
          ),
          const SizedBox(height: 4),
          Text(
            '铺好后这里会列出全年所有节日',
            style: TextStyle(fontSize: 12, color: colors.inkFaint),
          ),
        ],
      ),
    );
  }
}
