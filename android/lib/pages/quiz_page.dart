/// 刷题页（闪卡）。
///
/// 与 Web 端 `pages/index.vue` + `components/QuestionCard.vue` 逐项对齐：
/// - **今日进度 Hero**：配色随完成度升温（青蓝 - 品牌蓝紫 - 紫 - 玫红橙 - 金橙），
///   见 theme.dart 的 kHeroStages / heroStageOf，取值与 Web 端 HERO_STAGES 一致；
/// - **三段式翻转**：提交 -> +180 度看背面；下一题 -> 再 +180 度回正面，
///   一路同方向（从左往右）不回翻；
/// - 正面 = 题干 + 16:9 场景图 + 作答区；背面 = 结果条 + 答案 + 音标 + 等价表达；
/// - 加载用骨架屏（而不是转圈），错误态可重试，另有「换一题」跳过当前题。
///
/// **翻转不镜像的关键**：背面必须**预旋转 180 度**（Web 端 .card-face--back 的做法）。
/// 只在 90 度时换内容而不预旋转，翻过去看到的就是镜像文字。
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/answer_normalize.dart';
import '../api/auth_api.dart';
import '../api/models/question.dart';
import '../state/quiz_controller.dart';
import '../theme.dart';
import '../theme/brand.dart';

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

  /// 提交闸门（同 LoginPage）：`_submit()` 是 async，Riverpod 的 busy
  /// 回写到按钮有窗口期，键盘「完成」键 + 按钮可各触发一次 -> 同一答案提交两次，
  /// 会重复记 sentence_record、重复发 XP（服务端数据污染）。
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
      if (mode == AnswerMode.assemble) {
        ref.read(quizControllerProvider.notifier).resetMode();
      }
    } finally {
      _submitting = false;
    }
  }

  /// 抽下一题期间用于撑住背面外壳的占位结果（result 已被清空）。
  AnswerResult get _placeholderResult => const AnswerResult(
        sentenceId: 0,
        isCorrect: false,
        sentenceEn: '',
        validAnswers: <String>[],
        translationZh: '',
        ipa: null,
        imageUrl: null,
        favorited: false,
        todayDone: 0,
        todayGoal: 0,
      );

  void _next() {
    _resetInputs();
    ref.read(quizControllerProvider.notifier).loadNext();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(quizControllerProvider);

    // 翻转目标角度**由 flipped 直接推导**（而不是累加）：
    // 累加方案依赖 didUpdateWidget 被可靠触发，但提交答案后 QuizPage 自身
    // 参数没变、父级不重建，didUpdateWidget 可能根本不跑——于是 deg 与
    // flipped 脱节，出现「卡片转了一半却还显示正面」的露馅画面。
    // 推导方案没有中间状态可漏，deg 与 flipped 永远一致。
    //
    // 取模是为了让「下一题」时从 360 回到 0 而不是继续涨（数值无界会丢精度），
    // 同时保持方向一致：false->0、true->180，永远同向。
    // 翻转态。**抽下一题(loadingNext)时保持翻转**——否则点「下一题」后
    // flipped 立刻变 false，卡片会当着用户的面从 180° 往回转、停在中间角度
    // （就是截图里「卡片斜着」的来源）。
    // Web 端的做法是保持背面并显示加载态，新题到达后同方向继续翻。
    //
    // 为什么用 state.loadingNext 而不是页面里暂存：loadNext() 一进去就
    // clearResult，flipped 的依据(result)当场就没了，页面根本来不及暂存。
    // 必须在**状态层**就标记「这次 loading 是要保持背面的」。
    final flipped = state.phase == QuizPhase.answered ||
        (state.phase == QuizPhase.loading && state.loadingNext);

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
      appBar: AppBar(
        title: const Text('刷题'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Text(
                state.stats.done == 0 ? '—' : '${state.stats.correct}/${state.stats.done}',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: switch (state.phase) {
          // 首次抽题（还没有题）→ 骨架屏；「抽下一题」→ 保持背面走加载态
          QuizPhase.loading when !state.loadingNext => const _SkeletonCard(),
          _ when state.question != null => _buildCard(context, state, flipped),
          _ => _EmptyState(
              error: state.error,
              onRetry: () => ref.read(quizControllerProvider.notifier).loadNext(),
            ),
        },
      ),
    );
  }

  Widget _buildCard(BuildContext context, QuizState state, bool flipped) {
    final question = state.question!;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        _ProgressHero(
          done: state.result?.todayDone ?? question.todayDone,
          goal: state.result?.todayGoal ?? question.todayGoal,
        ),
        const SizedBox(height: 12),
        _ModePicker(
          mode: state.mode,
          onChanged: (mode) {
            _resetInputs();
            ref.read(quizControllerProvider.notifier).setMode(mode);
          },
        ),
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
            error: state.error,
          ),
          backBuilder: (_) {
            final current = state.result;
            // 抽下一题时 result 已被清空，但**仍要渲染背面**（显示加载态）：
            // 否则卡片区域会整个消失，观感是「卡片没了」而不是「在加载」。
            // 用一个占位 result 撑住背面外壳。
            final shown = current ?? _placeholderResult;
            return _BackFace(
              result: shown,
              userAnswer: _answerController.text,
              onNext: _next,
              loading: state.loadingNext,
              onToggleFavorite: () =>
                  ref.read(quizControllerProvider.notifier).toggleFavorite(),
            );
          },
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: state.isBusy ? null : _next,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('换一题'),
          ),
        ),
      ],
    );
  }
}

/* ------------------------------ 今日进度 Hero ------------------------------ */

class _ProgressHero extends StatelessWidget {
  const _ProgressHero({required this.done, required this.goal});

  final int done;
  final int goal;

  @override
  Widget build(BuildContext context) {
    final pct = goal <= 0 ? 0.0 : (done / goal).clamp(0.0, 1.0);
    final reached = goal > 0 && done >= goal;
    final stage = kHeroStages[heroStageOf(goalReached: reached, done: done, pct: pct * 100)]!;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: stage.gradient,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(color: stage.shadow, blurRadius: 18, offset: const Offset(0, 6)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.local_fire_department,
                            size: 16, color: Colors.white70),
                        const SizedBox(width: 6),
                        Text(
                          '今日刷题',
                          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                                color: Colors.white70,
                                fontWeight: FontWeight.w500,
                              ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    RichText(
                      text: TextSpan(
                        children: [
                          TextSpan(
                            text: '$done',
                            style: const TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              height: 1.1,
                            ),
                          ),
                          TextSpan(
                            text: ' / $goal 句',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w500,
                              color: Colors.white70,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (reached)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.check_circle, size: 14, color: Colors.white),
                      SizedBox(width: 4),
                      Text('已达标',
                          style: TextStyle(
                              fontSize: 12,
                              color: Colors.white,
                              fontWeight: FontWeight.w500)),
                    ],
                  ),
                )
              else
                Text(
                  done <= 0 ? '今天还没开始' : _hint(done, goal),
                  style: const TextStyle(fontSize: 12, color: Colors.white70),
                ),
            ],
          ),
          const SizedBox(height: 14),
          // 进度条：末端光点跟住完成度（Web 端 ss-hero-dot 的做法）
          LayoutBuilder(builder: (context, constraints) {
            final w = constraints.maxWidth;
            return Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  height: 8,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 700),
                  curve: Curves.easeOut,
                  height: 8,
                  width: w * pct,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                AnimatedPositioned(
                  duration: const Duration(milliseconds: 700),
                  curve: Curves.easeOut,
                  left: (w * pct - 6).clamp(0.0, w - 12),
                  top: -2,
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: reached ? const Color(0xFFFDE68A) : Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: reached
                              ? const Color(0xFFFBBF24).withValues(alpha: 0.75)
                              : Colors.white.withValues(alpha: 0.5),
                          blurRadius: 8,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          }),
        ],
      ),
    );
  }

  /// 进度提示语：不说「还差 N 句」（像催作业），与 Web 端 heroHint 同口径。
  String _hint(int done, int goal) {
    final remain = goal - done;
    if (remain <= 0) {
      return '';
    }
    if (remain == 1) {
      return '最后一句';
    }
    return '加油，还剩 $remain 句';
  }
}

/* ------------------------------ 作答方式切换 ------------------------------ */

class _ModePicker extends StatelessWidget {
  const _ModePicker({required this.mode, required this.onChanged});

  final AnswerMode mode;
  final ValueChanged<AnswerMode> onChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          _ModeTab(
            label: '默写',
            icon: Icons.keyboard,
            active: mode == AnswerMode.input,
            onTap: () => onChanged(AnswerMode.input),
          ),
          _ModeTab(
            label: '拼词',
            icon: Icons.extension,
            active: mode == AnswerMode.assemble,
            onTap: () => onChanged(AnswerMode.assemble),
          ),
        ],
      ),
    );
  }
}

class _ModeTab extends StatelessWidget {
  const _ModeTab({
    required this.label,
    required this.icon,
    required this.active,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            gradient: active ? brandGradient : null,
            color: active ? null : Colors.transparent,
            borderRadius: BorderRadius.circular(11),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 15, color: active ? Colors.white : scheme.onSurfaceVariant),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: active ? Colors.white : scheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/* ------------------------------ 翻卡容器 ------------------------------ */

class _FlipCard extends StatefulWidget {
  const _FlipCard({
    required this.flipped,
    required this.frontBuilder,
    required this.backBuilder,
  });

  final bool flipped;
  final WidgetBuilder frontBuilder;
  final WidgetBuilder backBuilder;

  @override
  State<_FlipCard> createState() => _FlipCardState();
}

class _FlipCardState extends State<_FlipCard> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    duration: const Duration(milliseconds: 450),
    vsync: this,
  );

  @override
  void initState() {
    super.initState();
    // 初始就对齐（避免首帧闪一下正面再翻）
    _controller.value = widget.flipped ? 1 : 0;
  }

  @override
  void didUpdateWidget(covariant _FlipCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.flipped != widget.flipped) {
      // 用控制器驱动：稳态必然是 0 或 1，**不可能停在中间值**。
      // （TweenAnimationBuilder 的补间值在某些时序下会滞留在中途。）
      if (widget.flipped) {
        _controller.forward();
      } else {
        _controller.reverse();
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value;
        // 超过一半时切背面，且背面预旋转 180 度——否则翻过去是镜像文字。
        final showBack = t >= 0.5;
        return Transform(
          // 显式按容器中心旋转：不设 alignment 时 Transform 默认按左上角转，
          // 在宽度不确定的 ListView 里会偏，观感就是「卡片斜着」。
          alignment: Alignment.center,
          // 纯 2D rotateY（不加透视）：透视会让卡片在 180 度也显得歪。
          transform: Matrix4.rotationY(t * 3.1415926),
          child: showBack
              ? Transform(
                  alignment: Alignment.center,
                  transform: Matrix4.rotationY(3.1415926),
                  child: widget.backBuilder(context),
                )
              : widget.frontBuilder(context),
        );
      },
    );
  }
}

/* ------------------------------ 卡片正反面共用外壳 ------------------------------ */

/// 卡面容器：白底 + 大圆角 + 柔和投影 + 细描边。
/// 对应 Web 端 `card-face rounded-3xl bg-white p-5 shadow-xl ring-1 ring-black/5`。
class _CardFace extends StatelessWidget {
  const _CardFace({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: scheme.shadow.withValues(alpha: 0.08),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: child,
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
  final String? error;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return _CardFace(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 题头：来源 / 难度 / 分类
          Row(
            children: [
              _Pill(
                text: question.source == QuestionSource.review ? '复习' : '新题',
                background: question.source == QuestionSource.review
                    ? scheme.tertiaryContainer
                    : scheme.primaryContainer,
                foreground: question.source == QuestionSource.review
                    ? scheme.onTertiaryContainer
                    : scheme.onPrimaryContainer,
              ),
              const SizedBox(width: 6),
              _Pill(
                text: question.difficultyLabel,
                background: scheme.secondaryContainer,
                foreground: scheme.onSecondaryContainer,
              ),
              if (question.categoryName != null) ...[
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    question.categoryName!,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 14),

          // 题干（浅底圆角块，居中——与 Web 端一致）
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: scheme.surfaceContainerHighest.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              question.translationZh,
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
                height: 1.4,
              ),
            ),
          ),
          const SizedBox(height: 14),

          // 场景图 16:9
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: question.imageUrl == null
                  ? Container(
                      color: scheme.surfaceContainerHighest,
                      child: Center(
                        child: Text(
                          '配图缺失',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    )
                  : CachedNetworkImage(
                      imageUrl: staticUrl(question.imageUrl),
                      fit: BoxFit.cover,
                      placeholder: (context, _) => Container(
                        color: scheme.surfaceContainerHighest,
                        child: const Center(child: CircularProgressIndicator()),
                      ),
                      errorWidget: (context, _, _) => Container(
                        color: scheme.surfaceContainerHighest,
                        child: Center(
                          child: Text(
                            '配图加载失败',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 16),

          // 作答区
          if (mode == AnswerMode.assemble && question.words != null)
            _AssembleArea(
              words: question.words!,
              picked: picked,
              onPick: onPick,
              onUndoPick: onUndoPick,
              onSubmit: onSubmit,
              busy: busy,
            )
          else
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: answerController,
                    focusNode: focusNode,
                    enabled: !busy,
                    textInputAction: TextInputAction.done,
                    textCapitalization: TextCapitalization.none,
                    autocorrect: false,
                    onSubmitted: (_) => onSubmit(),
                    decoration: const InputDecoration(
                      hintText: '输入对应的英文句子',
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                FilledButton(
                  onPressed: busy ? null : onSubmit,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(84, 48),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: busy
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('确定'),
                ),
              ],
            ),

          if (error != null) ...[
            const SizedBox(height: 10),
            Text(error!, style: TextStyle(color: scheme.error, fontSize: 13)),
          ],
        ],
      ),
    );
  }
}

/// 小 pill 标签（来源 / 难度）。
class _Pill extends StatelessWidget {
  const _Pill({
    required this.text,
    required this.background,
    required this.foreground,
  });

  final String text;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          color: foreground,
        ),
      ),
    );
  }
}

/// 拼词作答区：已选（可撤销）+ 候选词块。
class _AssembleArea extends StatelessWidget {
  const _AssembleArea({
    required this.words,
    required this.picked,
    required this.onPick,
    required this.onUndoPick,
    required this.onSubmit,
    required this.busy,
  });

  final List<String> words;
  final List<String> picked;
  final ValueChanged<String> onPick;
  final VoidCallback onUndoPick;
  final VoidCallback onSubmit;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

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
          constraints: const BoxConstraints(minHeight: 52),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: scheme.surfaceContainerHighest.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (picked.isEmpty)
                Text(
                  '点下面的词块拼句子',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              for (final word in picked)
                Chip(
                  label: Text(word),
                  visualDensity: VisualDensity.compact,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
            ],
          ),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: busy || picked.isEmpty ? null : onUndoPick,
            icon: const Icon(Icons.undo, size: 15),
            label: const Text('撤销'),
          ),
        ),
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
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton(
            onPressed: busy ? null : onSubmit,
            style: FilledButton.styleFrom(
              minimumSize: const Size(120, 48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: busy
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('确定'),
          ),
        ),
      ],
    );
  }
}

/* ------------------------------ 背面 ------------------------------ */

class _BackFace extends StatelessWidget {
  const _BackFace({
    required this.result,
    required this.userAnswer,
    required this.onNext,
    required this.onToggleFavorite,
    this.loading = false,
  });

  final AnswerResult result;

  /// 正在抽下一题：显示加载态（对齐 Web 端「保持背面并显示加载态」）。
  final bool loading;

  /// 用户提交的答案（答错时展示并划掉，与 Web 端一致）。
  final String userAnswer;

  final VoidCallback onNext;
  final VoidCallback onToggleFavorite;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final correct = result.isCorrect;

    // 结果条配色：对 = 绿，错 = 玫红（Web 端 emerald / rose）
    final barBg = correct
        ? const Color(0xFFECFDF5)
        : const Color(0xFFFFF1F2);
    final barFg = correct
        ? const Color(0xFF047857)
        : const Color(0xFFBE123C);

    if (loading) {
      return _CardFace(
        child: SizedBox(
          height: 240,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const CircularProgressIndicator(strokeWidth: 2),
              const SizedBox(height: 14),
              Text(
                '加载下一题…',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ],
          ),
        ),
      );
    }

    return _CardFace(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 结果条
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              color: barBg,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                Icon(
                  correct ? Icons.check_circle : Icons.cancel,
                  size: 20,
                  color: barFg,
                ),
                const SizedBox(width: 8),
                Text(
                  correct ? '答对了' : '再想想',
                  style: TextStyle(
                    color: barFg,
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
                const Spacer(),
                // 收藏（点击有缩放反馈）
                _FavoriteButton(
                  favorited: result.favorited,
                  onTap: onToggleFavorite,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // 标准答案
          Text(
            result.sentenceEn,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w600,
              height: 1.35,
            ),
          ),

          // 音标
          if (result.ipa != null && result.ipa!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              result.ipa!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: brandColor,
                fontFamily: 'monospace',
              ),
            ),
          ],

          // 等价表达
          if (result.validAnswers.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              '这些说法也算对',
              style: theme.textTheme.labelSmall?.copyWith(
                color: scheme.onSurfaceVariant,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 6),
            ...result.validAnswers.map(
              (answer) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  answer,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: scheme.onSurfaceVariant,
                    height: 1.35,
                  ),
                ),
              ),
            ),
          ],

          const SizedBox(height: 12),
          Text(
            result.translationZh,
            style: theme.textTheme.bodySmall?.copyWith(
              color: scheme.onSurfaceVariant,
            ),
          ),

          // 答错时展示用户的答案（划掉）
          if (!correct && userAnswer.trim().isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: scheme.surfaceContainerHighest.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '你的答案',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    userAnswer.trim(),
                    style: TextStyle(
                      color: scheme.onSurfaceVariant,
                      decoration: TextDecoration.lineThrough,
                      decorationColor: scheme.error,
                      height: 1.3,
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 20),

          // 底部：提示 + 下一题
          Row(
            children: [
              Expanded(
                child: Text(
                  '回车继续',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ),
              FilledButton.icon(
                onPressed: onNext,
                style: FilledButton.styleFrom(
                  minimumSize: const Size(120, 46),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                label: const Text('下一题'),
                icon: const Icon(Icons.arrow_forward, size: 17),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// 收藏按钮：点击瞬时放大（Web 端 favPop 的反馈）。
class _FavoriteButton extends StatefulWidget {
  const _FavoriteButton({required this.favorited, required this.onTap});

  final bool favorited;
  final VoidCallback onTap;

  @override
  State<_FavoriteButton> createState() => _FavoriteButtonState();
}

class _FavoriteButtonState extends State<_FavoriteButton> {
  bool _pop = false;

  void _handleTap() {
    setState(() => _pop = true);
    Future<void>.delayed(const Duration(milliseconds: 400), () {
      if (mounted) {
        setState(() => _pop = false);
      }
    });
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _handleTap,
      child: AnimatedScale(
        scale: _pop ? 1.25 : 1,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOutBack,
        child: Container(
          padding: const EdgeInsets.all(7),
          decoration: BoxDecoration(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Icon(
            widget.favorited ? Icons.star : Icons.star_border,
            size: 20,
            color: widget.favorited
                ? const Color(0xFFF59E0B)
                : Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}

/* ------------------------------ 骨架屏 / 空态 ------------------------------ */

/// 加载骨架屏（Web 端用 USkeleton，这里用 shimmer 容器模拟）。
class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final bone = scheme.surfaceContainerHighest.withValues(alpha: 0.6);
    Widget box(double height, {double? width, double radius = 16}) => Container(
          height: height,
          width: width,
          decoration: BoxDecoration(
            color: bone,
            borderRadius: BorderRadius.circular(radius),
          ),
        );

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        box(96, radius: 24),
        const SizedBox(height: 12),
        box(44, radius: 14),
        const SizedBox(height: 12),
        _CardFace(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              box(56, radius: 16),
              const SizedBox(height: 14),
              box(160, radius: 16),
              const SizedBox(height: 14),
              box(150, radius: 16),
              const SizedBox(height: 16),
              box(48, radius: 12),
            ],
          ),
        ),
      ],
    );
  }
}

/// 空态（抽题失败 / 题库为空）。
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
