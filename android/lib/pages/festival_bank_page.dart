/// 题库页：场景题库 + 节日题库网格，挑一个专门刷。
///
/// 为什么独立成页：刷题页是「一题一屏」的核心场景，几十个题库入口平铺在那里
/// 会把题卡顶出首屏。所以刷题页不再常驻题库入口，改由这里进（刷题仍在刷题页完成）。
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
  /// 两组题库并行拉取（场景 + 节日），一起落一张骨架屏。
  late final Future<(List<CategoryBank>, List<FestivalBank>)> _banks;

  @override
  void initState() {
    super.initState();
    final api = ref.read(questionsApiProvider);
    _banks = (api.listCategories(), api.listFestivals()).wait;
  }

  /// 挑一个场景：锁定该场景题库（后台抽题），同时切回刷题页继续刷。
  void _pickCategory(int id) {
    unawaited(ref.read(quizControllerProvider.notifier).setCategory(id));
    ref.read(shellControllerProvider.notifier).go(0);
  }

  /// 挑一个节日：锁定该节日题库（后台抽题），同时切回刷题页继续刷。
  void _pickFestival(String name) {
    unawaited(ref.read(quizControllerProvider.notifier).setFestival(name));
    ref.read(shellControllerProvider.notifier).go(0);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return SafeArea(
      bottom: false,
      child: FutureBuilder<(List<CategoryBank>, List<FestivalBank>)>(
        future: _banks,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const _BankSkeleton();
          }
          final (categories, festivals) =
              snapshot.data ?? (const <CategoryBank>[], const <FestivalBank>[]);
          if (categories.isEmpty && festivals.isEmpty) {
            return const _EmptyState();
          }
          return SingleChildScrollView(
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
                        '场景与节日全年常驻，挑一个专门刷',
                        style: TextStyle(fontSize: 12, color: colors.inkFaint),
                      ),
                    ],
                  ),
                ),
                if (categories.isNotEmpty) ...<Widget>[
                  _SectionHeader(title: '场景题库', count: categories.length),
                  _CategoryGrid(categories: categories, onPick: _pickCategory),
                ],
                if (festivals.isNotEmpty) ...<Widget>[
                  _SectionHeader(title: '节日题库', count: festivals.length),
                  _FestivalGrid(festivals: festivals, onPick: _pickFestival),
                ],
                // 底部留出 Tab 栏 + 安全区的余量，最后一排卡片不被压住
                const SizedBox(height: 120),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// 区块标题。
class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.count});

  final String title;
  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 6, 20, 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Text(
            title,
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: colors.ink),
          ),
          Text('$count 个', style: TextStyle(fontSize: 11, color: colors.inkFaint)),
        ],
      ),
    );
  }
}

/// 场景网格：白底卡片（与节日的彩色满铺区分开——场景是日常，节日是特殊）。
class _CategoryGrid extends StatelessWidget {
  const _CategoryGrid({required this.categories, required this.onPick});

  final List<CategoryBank> categories;
  final ValueChanged<int> onPick;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 20),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.35,
      ),
      itemCount: categories.length,
      itemBuilder: (context, index) {
        final item = categories[index];
        final ready = item.count > 0;
        return PressScale(
          // 没题的场景不可点（点了也只会得到「暂无可用题目」）
          onTap: ready ? () => onPick(item.id) : null,
          scale: 0.95,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: colors.line),
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
                        item.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: colors.ink,
                        ),
                      ),
                    ),
                    Icon(Icons.place_outlined, size: 15, color: colors.brand),
                  ],
                ),
                Text(
                  ready ? '${item.count} 题' : '准备中',
                  style: TextStyle(
                    fontSize: 11,
                    color: ready ? colors.inkFaint : colors.inkFaint.withValues(alpha: 0.7),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// 节日网格：彩色满铺卡片，按它在一年中的位置取色，一眼能分出季节。
class _FestivalGrid extends StatelessWidget {
  const _FestivalGrid({required this.festivals, required this.onPick});

  final List<FestivalBank> festivals;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 20),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.35,
      ),
      itemCount: festivals.length,
      itemBuilder: (context, index) {
        final item = festivals[index];
        final raw = item.date != null && item.date!.length >= 7 ? item.date!.substring(5, 7) : '01';
        final month = int.tryParse(raw) ?? 1;
        final color = HSLColor.fromAHSL(1, ((month - 1) / 12) * 360, 0.72, 0.46).toColor();
        return PressScale(
          onTap: () => onPick(item.name),
          scale: 0.95,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color,
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
                        item.name,
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
                  '${item.count} 题',
                  style: const TextStyle(fontSize: 11, color: Colors.white70),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// 加载中占位。
class _BankSkeleton extends StatelessWidget {
  const _BankSkeleton();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 30, 20, 0),
      children: <Widget>[
        for (var row = 0; row < 3; row++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: <Widget>[
                for (var col = 0; col < 2; col++)
                  Expanded(
                    child: Container(
                      height: 80,
                      margin: EdgeInsets.only(right: col == 0 ? 10 : 0),
                      decoration: BoxDecoration(
                        color: colors.cardMuted,
                        borderRadius: BorderRadius.circular(18),
                      ),
                    ),
                  ),
              ],
            ),
          ),
      ],
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
            '题库正在准备中',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.inkSoft),
          ),
          const SizedBox(height: 4),
          Text(
            '铺好后这里会列出所有场景与节日',
            style: TextStyle(fontSize: 12, color: colors.inkFaint),
          ),
        ],
      ),
    );
  }
}
