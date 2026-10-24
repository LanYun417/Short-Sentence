/// 刷题页（闪卡）。
///
/// 交互与 Web 端 `pages/index.vue` 保持一致：
/// - 正面：场景图 + 中文题干 + 作答区（默写 / 拼词）；
/// - 提交 → 服务端判分 → **翻卡**到背面（正确答案 + 音标 + 收藏）；
/// - 背面点「下一题」抽新题；拼词模式提交后自动切回默写。
///
/// 翻卡用 `AnimatedBuilder` + `Transform` 的正反面切换：
/// 旋转到 90° 时更换内容（既看不到接缝，也避免文字镜像）。
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/answer_normalize.dart';
import '../api/models/question.dart';
import '../state/quiz_controller.dart';

class QuizPage extends ConsumerStatefulWidget {
  const QuizPage({this.autoLoad = true, super.key});

  /// 进入页面时是否自动抽题。
  ///
  /// 生产恒为 true；测试里传 false，避免 `initState` 触发真实网络请求
  /// （测试环境没有后端，且会留下悬挂定时器让用例失败）。
  final bool autoLoad;

  @override
  ConsumerState<QuizPage> createState() => _QuizPageState();
}

class _QuizPageState extends ConsumerState<QuizPage> {
  final _answerController = TextEditingController();
  final _answerFocus = FocusNode();

  /// 拼词模式：已选中的词块（有序）。
  final List<String> _picked = <String>[];

  @override
  void initState() {
    super.initState();
    if (!widget.autoLoad) {
      return;
    }
    // 首屏自动抽题（延到首帧后：此刻才能安全读 Riverpod 状态）
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(quizControllerProvider.notifier).loadNext();
    });
  }

  @override
  void dispose() {
    _answerController.dispose();
    _answerFocus.dispose();
    super.dispose();
  }

  void _resetInputs() {
    _answerController.clear();
    _picked.clear();
  }

  /// 本地提交闸门（同 LoginPage）：`_submit()` 是 async，Riverpod 的 busy
  /// 回写到按钮有窗口期，键盘「完成」键 + 按钮可各触发一次 → 同一答案提交两次。
  /// 判分本身虽不「单次有效」，但会**重复记一次 sentence_record / 多发一次 XP**，
  /// 属于服务端数据污染。用同步布尔量从机制上堵住。
  bool _submitting = false;

  Future<void> _submit() async {
    if (_submitting) {
      return;
    }
    final mode = ref.read(quizControllerProvider).mode;
    final answer = mode == AnswerMode.assemble ? _picked.join(' ') : _answerController.text;
    if (isBlankAnswer(answer)) {
      return;
    }
    _submitting = true;
    _answerFocus.unfocus();
    try {
      await ref.read(quizControllerProvider.notifier).submit(answer);
      // 拼词模式提交后切回默写（下一次抽题按更难的模式走）
      if (mode == AnswerMode.assemble) {
        ref.read(quizControllerProvider.notifier).resetMode();
      }
    } finally {
      _submitting = false;
    }
  }

  void _next() {
    _resetInputs();
    ref.read(quizControllerProvider.notifier).loadNext();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(quizControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('刷题'),
        actions: [
          // 会话统计（正确率）
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Text(
                state.stats.done == 0
                    ? '—'
                    : '${state.stats.correct}/${state.stats.done}',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        // 判定顺序：先看有没有题，再看阶段。
        //
        // 原来的写法是 `QuizPhase.idle when question == null → 空态`，
        // 其余一律 `_buildCard`——一旦阶段已是 answering/submitting/answered
        // 而题目因故是 null，就会走到 `state.question!` 崩掉。
        // 现在**只有确实拿到题**才渲染卡片，空态兜住其余所有情况。
        child: switch (state.phase) {
          QuizPhase.loading => const Center(child: CircularProgressIndicator()),
          _ when state.question != null => _buildCard(context, state),
          _ => _EmptyState(
              error: state.error,
              onRetry: () => ref.read(quizControllerProvider.notifier).loadNext(),
            ),
        },
      ),
    );
  }

  Widget _buildCard(BuildContext context, QuizState state) {
    final question = state.question!;
    final result = state.result;
    final flipped = state.isAnswered && result != null;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _ProgressHeader(question: question),
        const SizedBox(height: 12),
        _FlipCard(
          flipped: flipped,
          frontBuilder: (_) => _FrontFace(
            question: question,
            mode: state.mode,
            busy: state.isBusy,
            answerController: _answerController,
            focusNode: _answerFocus,
            picked: _picked,
            onPick: (word) => setState(() => _picked.add(word)),
            onUndoPick: () => setState(() {
              if (_picked.isNotEmpty) {
                _picked.removeLast();
              }
            }),
            onSubmit: _submit,
            onToggleMode: (mode) {
              _resetInputs();
              ref.read(quizControllerProvider.notifier).setMode(mode);
            },
            error: state.error,
          ),
          // 兜底：万一翻牌动画进行中结果被清空（切题），渲染空而不是崩
          backBuilder: (_) {
            final current = state.result;
            return current == null
                ? const SizedBox.shrink()
                : _BackFace(
                    result: current,
                    onNext: _next,
                    onToggleFavorite: () =>
                        ref.read(quizControllerProvider.notifier).toggleFavorite(),
                  );
          },
        ),
      ],
    );
  }
}

/* ------------------------------ 进度头 ------------------------------ */

class _ProgressHeader extends StatelessWidget {
  const _ProgressHeader({required this.question});

  final Question question;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: question.source == QuestionSource.review
                ? scheme.tertiaryContainer
                : scheme.secondaryContainer,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            question.source == QuestionSource.review ? '复习' : '新题',
            style: Theme.of(context).textTheme.labelSmall,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          '${question.difficultyLabel}'
          '${question.categoryName == null ? '' : ' · ${question.categoryName}'}',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
        ),
        const Spacer(),
        Text(
          '今日 ${question.todayDone}/${question.todayGoal}',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 56,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: question.todayProgress,
              minHeight: 6,
              backgroundColor: scheme.surfaceContainerHighest,
            ),
          ),
        ),
      ],
    );
  }
}

/* ------------------------------ 翻卡容器 ------------------------------ */

class _FlipCard extends StatelessWidget {
  const _FlipCard({
    required this.flipped,
    required this.frontBuilder,
    required this.backBuilder,
  });

  final bool flipped;

  /// 正面 / 背面的**构造器**（不是构造好的 Widget）。
  ///
  /// 为什么必须是 builder：背面依赖判分结果（`AnswerResult`），
  /// 而它在提交前一直是 null。若把 `back: _BackFace(result: result!)`
  /// 作为实参直接传进来，这个表达式会在 `_buildCard` 运行时**立即求值**，
  /// 于是「卡片还没翻」也会解引用 null → 每次进刷题页必崩
  /// （Null check operator used on a null value）。
  /// 改成 builder 后，只有 `showBack` 为真时才构造背面。
  final WidgetBuilder frontBuilder;
  final WidgetBuilder backBuilder;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: flipped ? 1 : 0),
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeInOutCubic,
      builder: (context, t, child) {
        // 前半段转正面、后半段转背面：在 90° 处换内容，
        // 用户看不到接缝，文字也不会镜像
        final showBack = t >= 0.5;
        final angle = t * 3.14159;
        return Transform(
          alignment: Alignment.center,
          transform: Matrix4.identity()..rotateY(angle),
          child: showBack ? backBuilder(context) : frontBuilder(context),
        );
      },
    );
  }
}

/* ------------------------------ 正面 ------------------------------ */

class _FrontFace extends StatelessWidget {
  const _FrontFace({
    required this.question,
    required this.mode,
    required this.busy,
    required this.answerController,
    required this.focusNode,
    required this.picked,
    required this.onPick,
    required this.onUndoPick,
    required this.onSubmit,
    required this.onToggleMode,
    this.error,
  });

  final Question question;
  final AnswerMode mode;
  final bool busy;
  final TextEditingController answerController;
  final FocusNode focusNode;
  final List<String> picked;
  final ValueChanged<String> onPick;
  final VoidCallback onUndoPick;
  final VoidCallback onSubmit;
  final ValueChanged<AnswerMode> onToggleMode;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 场景图
        if (question.imageUrl != null)
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: AspectRatio(
              aspectRatio: 16 / 10,
              child: CachedNetworkImage(
                imageUrl: question.imageUrl!,
                fit: BoxFit.cover,
                placeholder: (context, _) => Container(
                  color: theme.colorScheme.surfaceContainerHighest,
                  child: const Center(child: CircularProgressIndicator()),
                ),
                errorWidget: (context, _, _) => Container(
                  color: theme.colorScheme.surfaceContainerHighest,
                  child: const Center(child: Icon(Icons.broken_image_outlined)),
                ),
              ),
            ),
          ),
        const SizedBox(height: 16),

        // 中文题干
        Text(
          question.translationZh,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 20),

        // 作答区
        if (mode == AnswerMode.assemble && question.words != null)
          _AssembleArea(
            words: question.words!,
            picked: picked,
            onPick: onPick,
            onUndoPick: onUndoPick,
            busy: busy,
          )
        else
          TextField(
            controller: answerController,
            focusNode: focusNode,
            enabled: !busy,
            textInputAction: TextInputAction.done,
            textCapitalization: TextCapitalization.none,
            autocorrect: false,
            minLines: 1,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: '英文',
              hintText: '敲出对应的英文句子',
            ),
            onSubmitted: (_) => onSubmit(),
          ),

        if (error != null) ...[
          const SizedBox(height: 12),
          Text(error!, style: TextStyle(color: theme.colorScheme.error, fontSize: 13)),
        ],

        const SizedBox(height: 16),
        FilledButton(
          onPressed: busy ? null : onSubmit,
          child: busy
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('提交'),
        ),
        const SizedBox(height: 8),
        // 模式切换
        TextButton.icon(
          onPressed: busy
              ? null
              : () => onToggleMode(
                    mode == AnswerMode.assemble ? AnswerMode.input : AnswerMode.assemble,
                  ),
          icon: Icon(
            mode == AnswerMode.assemble ? Icons.keyboard : Icons.extension,
            size: 18,
          ),
          label: Text(mode == AnswerMode.assemble ? '切换为默写' : '切换为拼词'),
        ),
      ],
    );
  }
}

/// 拼词作答区：已选词块（可撤销）+ 候选词块。
class _AssembleArea extends StatelessWidget {
  const _AssembleArea({
    required this.words,
    required this.picked,
    required this.onPick,
    required this.onUndoPick,
    required this.busy,
  });

  final List<String> words;
  final List<String> picked;
  final ValueChanged<String> onPick;
  final VoidCallback onUndoPick;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // 候选里扣掉已选中的（同词多处时按出现次数扣）
    final remaining = List<String>.from(words);
    for (final word in picked) {
      final index = remaining.indexOf(word);
      if (index >= 0) {
        remaining.removeAt(index);
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 已选
        Container(
          constraints: const BoxConstraints(minHeight: 56),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: theme.colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (picked.isEmpty)
                Text(
                  '点下面的词块拼句子',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              for (final word in picked)
                Chip(
                  label: Text(word),
                  visualDensity: VisualDensity.compact,
                ),
            ],
          ),
        ),
        if (picked.isNotEmpty)
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: busy ? null : onUndoPick,
              icon: const Icon(Icons.undo, size: 16),
              label: const Text('撤销'),
            ),
          ),
        const SizedBox(height: 8),
        // 候选
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final word in remaining)
              ActionChip(
                label: Text(word),
                onPressed: busy ? null : () => onPick(word),
              ),
          ],
        ),
      ],
    );
  }
}

/* ------------------------------ 背面 ------------------------------ */

class _BackFace extends StatelessWidget {
  const _BackFace({
    required this.result,
    required this.onNext,
    required this.onToggleFavorite,
  });

  final AnswerResult result;
  final VoidCallback onNext;
  final VoidCallback onToggleFavorite;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final correct = result.isCorrect;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 判定条
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: correct
                ? scheme.primaryContainer
                : scheme.errorContainer,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Icon(
                correct ? Icons.check_circle_outline : Icons.cancel_outlined,
                color: correct ? scheme.onPrimaryContainer : scheme.onErrorContainer,
              ),
              const SizedBox(width: 8),
              Text(
                correct ? '答对了' : '答错了',
                style: TextStyle(
                  color: correct ? scheme.onPrimaryContainer : scheme.onErrorContainer,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // 配图（判分后同样能看）
        if (result.imageUrl != null)
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: AspectRatio(
              aspectRatio: 16 / 10,
              child: CachedNetworkImage(
                imageUrl: result.imageUrl!,
                fit: BoxFit.cover,
                placeholder: (context, _) => Container(
                  color: scheme.surfaceContainerHighest,
                  child: const Center(child: CircularProgressIndicator()),
                ),
                errorWidget: (context, _, _) => const SizedBox.shrink(),
              ),
            ),
          ),
        const SizedBox(height: 16),

        // 中文
        Text(
          result.translationZh,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: scheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 8),

        // 标准答案
        Text(
          result.sentenceEn,
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w700,
            height: 1.35,
          ),
        ),
        if (result.ipa != null && result.ipa!.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(result.ipa!, style: theme.textTheme.bodySmall),
        ],

        // 等价表达
        if (result.validAnswers.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text('也可接受：', style: theme.textTheme.labelSmall),
          const SizedBox(height: 4),
          ...result.validAnswers.map(
            (answer) => Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text('· $answer', style: theme.textTheme.bodySmall),
            ),
          ),
        ],

        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: onToggleFavorite,
                icon: Icon(
                  result.favorited ? Icons.star : Icons.star_border,
                  size: 18,
                ),
                label: Text(result.favorited ? '已收藏' : '收藏'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                onPressed: onNext,
                child: const Text('下一题'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/* ------------------------------ 空态 ------------------------------ */

class _EmptyState extends StatelessWidget {
  const _EmptyState({this.error, required this.onRetry});

  final String? error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              error == null ? Icons.hourglass_empty : Icons.cloud_off,
              size: 48,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 16),
            Text(
              error ?? '准备抽题…',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.tonalIcon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('重新抽题'),
            ),
          ],
        ),
      ),
    );
  }
}
