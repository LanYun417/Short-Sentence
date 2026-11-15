/// 每日 Boss 页（路由 /boss）。
///
/// 每天固定一道挑战题（服务端按日期确定性选取，所有人同题），答对额外 +30 经验，
/// 一天一次（服务端幂等）。题面不含英文原句——提交后才揭晓答案与解析。
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/auth_api.dart' show staticUrl;
import '../api/models/boss.dart';
import '../api/questions_api.dart';
import '../theme/motion.dart';
import '../theme/palette.dart';
import '../widgets/app_card.dart';
import '../widgets/page_header.dart';
import '../widgets/press_scale.dart';
import '../widgets/tts_button.dart';

/// 今日 Boss（每次进页拉一次；提交后 invalidate 刷新通关状态）。
final bossProvider = FutureProvider<BossToday>((ref) async {
  return ref.watch(questionsApiProvider).boss();
});

class BossPage extends ConsumerStatefulWidget {
  const BossPage({super.key});

  @override
  ConsumerState<BossPage> createState() => _BossPageState();
}

class _BossPageState extends ConsumerState<BossPage> {
  final TextEditingController _controller = TextEditingController();
  bool _submitting = false;
  String? _error;
  BossAnswerResult? _result;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit(BossQuestion question) async {
    final answer = _controller.text.trim();
    if (answer.isEmpty || _submitting) {
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final result = await ref.read(questionsApiProvider).answerBoss(question.sentenceId, answer);
      if (!mounted) {
        return;
      }
      setState(() => _result = result);
      if (result.isCorrect) {
        // 通关后刷新头部状态（服务端权威，不在本地改 cleared）
        ref.invalidate(bossProvider);
      }
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error.toString());
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final theme = Theme.of(context);
    final bossAsync = ref.watch(bossProvider);

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
          children: <Widget>[
            PageHeader(
              title: '每日 Boss',
              subtitle: '每天一道挑战句 · 答对额外 +30 经验 · 一天一次',
            ),
            bossAsync.when(
              loading: () => const AppCard(
                child: SizedBox(
                  height: 140,
                  child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                ),
              ),
              error: (error, _) => AppCard(
                child: Column(
                  children: <Widget>[
                    Text('加载失败：$error',
                        style: theme.textTheme.bodySmall?.copyWith(color: colors.inkSoft),
                        textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: () => ref.invalidate(bossProvider),
                      child: const Text('重试'),
                    ),
                  ],
                ),
              ),
              data: (boss) => _buildBody(boss, theme),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(BossToday boss, ThemeData theme) {
    final colors = context.colors;

    // 已通关且本次没在答题：给通关态
    if (boss.cleared && _result == null) {
      return _ClearedCard(bonusXp: boss.bonusXp, date: boss.date);
    }
    final question = boss.question;
    if (question == null) {
      return AppCard(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 28),
          child: Text('今天的 Boss 还在准备中，晚点再来看看',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkSoft)),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        AppCard(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Row(
                children: <Widget>[
                  if (question.categoryName != null)
                    _Chip(text: question.categoryName!, color: colors.brand),
                  const SizedBox(width: 8),
                  _Chip(
                    // 难度只可能是 1~3；越界（脏数据）时按最高难度显示，不越界取下标
                    text: question.difficulty >= 1 && question.difficulty <= 3
                        ? const <String>['', '基础', '进阶', '挑战'][question.difficulty]
                        : '挑战',
                    color: const Color(0xFFF59E0B),
                  ),
                  const Spacer(),
                  Text('+${boss.bonusXp} 经验',
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: const Color(0xFFD97706),
                        fontWeight: FontWeight.w700,
                      )),
                ],
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: colors.cardMuted,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  question.translationZh,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    height: 1.4,
                  ),
                ),
              ),
              if (question.imageUrl != null) ...<Widget>[
                const SizedBox(height: 14),
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: AspectRatio(
                    aspectRatio: 16 / 9,
                    child: CachedNetworkImage(
                      imageUrl: staticUrl(question.imageUrl!),
                      fit: BoxFit.cover,
                      fadeInDuration: Motion.normal,
                      errorWidget: (context, _, _) => Container(color: colors.cardMuted),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 14),
              TextField(
                controller: _controller,
                enabled: _result == null,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(question),
                decoration: const InputDecoration(
                  hintText: '写出这句英文…',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              if (_result == null)
                PressScale(
                  onTap: _submitting ? null : () => _submit(question),
                  child: Container(
                    height: 46,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: <Color>[Color(0xFFF59E0B), Color(0xFFEA580C)],
                      ),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Center(
                      child: _submitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('挑战',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                              )),
                    ),
                  ),
                ),
              if (_error != null) ...<Widget>[
                const SizedBox(height: 10),
                Text(_error!, style: theme.textTheme.bodySmall?.copyWith(color: Colors.red)),
              ],
            ],
          ),
        ),
        if (_result != null) ...<Widget>[
          const SizedBox(height: 14),
          _ResultCard(
            result: _result!,
            onRetry: () => setState(() {
              _result = null;
              _controller.clear();
            }),
          ),
        ],
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.text, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(text,
          style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}

/// 已通关态。
class _ClearedCard extends StatelessWidget {
  const _ClearedCard({required this.bonusXp, required this.date});

  final int bonusXp;
  final String date;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 22),
        child: Column(
          children: <Widget>[
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: <Color>[Color(0xFFF59E0B), Color(0xFFEA580C)],
                ),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Icon(Icons.emoji_events_outlined, color: Colors.white, size: 32),
            ),
            const SizedBox(height: 14),
            Text('今天已经通关了',
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text('$date · 已拿到 +$bonusXp 经验\n明天 0 点刷新下一道 Boss',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(color: context.colors.inkSoft, height: 1.6)),
          ],
        ),
      ),
    );
  }
}

/// 作答结果。
class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.result, required this.onRetry});

  final BossAnswerResult result;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.colors;
    final accent = result.isCorrect ? const Color(0xFF059669) : const Color(0xFFE11D48);

    return AppCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(result.isCorrect ? Icons.check_circle : Icons.cancel, color: accent, size: 20),
              const SizedBox(width: 6),
              Text(result.isCorrect ? '挑战成功' : '差一点',
                  style: theme.textTheme.titleSmall?.copyWith(color: accent, fontWeight: FontWeight.w700)),
              const SizedBox(width: 8),
              if (result.bossCleared)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text('今日通关',
                      style: TextStyle(color: Color(0xFFB45309), fontSize: 10, fontWeight: FontWeight.w700)),
                ),
              const Spacer(),
              if (result.xpEarned > 0)
                Text('+${result.xpEarned} 经验',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: const Color(0xFFD97706),
                      fontWeight: FontWeight.w700,
                    )),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: Text(result.sentenceEn,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      height: 1.4,
                    )),
              ),
              const SizedBox(width: 6),
              SentenceTtsButton(text: result.sentenceEn, lang: 'en-US'),
            ],
          ),
          if (result.ipa != null && result.ipa!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(result.ipa!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colors.brand,
                    fontFamily: 'monospace',
                  )),
            ),
          if (result.explanation != null && result.explanation!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(result.explanation!,
                  style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkSoft, height: 1.7)),
            ),
          if (!result.isCorrect) ...<Widget>[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('再试一次'),
            ),
          ],
        ],
      ),
    );
  }
}