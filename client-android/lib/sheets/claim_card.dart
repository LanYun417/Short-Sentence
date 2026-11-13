/// 领取今日句签 → 直接展示海报。
///
/// 刷题页与成长页共用：领取入口出现在两处，但「可领 / 未达标 / 未就绪」的
/// 提示必须完全一致，否则用户会以为是两套不同的规则。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/card_controller.dart';
import 'sentence_card_sheet.dart';

/// 领取并展示。
Future<void> claimTodayCard(BuildContext context, WidgetRef ref) async {
  final messenger = ScaffoldMessenger.of(context);
  final card = await ref.read(cardControllerProvider.notifier).claim();
  if (!context.mounted) {
    return;
  }
  if (card == null) {
    final state = ref.read(cardControllerProvider);
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          state.error ?? '今天的句签还没准备好，稍后再来看看',
        ),
      ),
    );
    return;
  }
  await showSentenceCard(context, card);
}
