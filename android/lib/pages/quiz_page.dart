/// 刷题页（闪卡）——移动端主场景。
///
/// 与 Web 端共用同一套后端契约（抽题 / 判分 / 收藏），但**视觉与交互按手机重做**：
/// - 顶部问候 + 连续天数，替代 Web 端的导航栏；
/// - 进度 Hero 带流动柔光与阶段升温，达标转金橙并彩带庆祝；
/// - 卡片背后叠两层「纸片」，翻卡时只看得到正面在转，层次更真；
/// - 判分后经验值弹入（`+N XP`），成就解锁即时提示；
/// - 背面新增「AI 拓展」「反馈」入口，不打断当前题。
///
/// **翻转不镜像的关键**：背面必须**预旋转 180 度**（Web 端 .card-face--back 的做法）。
/// 只在 90 度时换内容而不预旋转，翻过去看到的就是镜像文字。
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/answer_normalize.dart';
import '../api/auth_api.dart';
import '../api/models/growth.dart';
import '../api/models/question.dart';
import '../state/card_controller.dart';
import '../state/checkin_provider.dart';
import '../state/quiz_controller.dart';
import '../sheets/ai_sheet.dart';
import '../sheets/claim_card.dart';
import '../sheets/report_sheet.dart';
import '../theme.dart';
import '../widgets/app_card.dart';
import '../widgets/aurora.dart';
import '../widgets/celebration.dart';
import '../widgets/count_up.dart';
import '../widgets/empty_state.dart';
import '../widgets/gradient_button.dart';
import '../widgets/press_scale.dart';
import '../widgets/segmented.dart';
import '../widgets/shimmer.dart';
import '../widgets/staggered.dart';

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

  /// 列表控制器：换题时回到顶部。
  ///
  /// 拼词模式下用户常被自动滚到卡片底部，若「下一题」后不回顶，
  /// 新题会从中间开始显示（只能看到图片下半截），像是题目加载错了。
  final ScrollController _scroll = ScrollController();

  /// 拼词模式：已选中的词块（有序）。
  final List<String> _picked = <String>[];

  /// 输入框聚焦态（用于光晕）。
  bool _focused = false;

  /// 本次经验飘字：金额与令牌（令牌变即重播动画）。
  int _xpAmount = 0;
  int _xpToken = 0;

  /// 今日是否已庆祝过（避免每次作答都放彩带）。
  bool _celebrated = false;

  @override
  void initState() {
    super.initState();
    _answerFocus.addListener(_onFocusChanged);
    if (!widget.autoLoad) {
      return;
    }
    // 首屏自动抽题（延到首帧后：此刻才能安全读 Riverpod 状态）
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(quizControllerProvider.notifier).loadNext();
      // 句签入口只需要「今天领没领」；句签册留给成长页去拉
      ref.read(cardControllerProvider.notifier).loadStatus();
    });
  }

  @override
  void dispose() {
    _answerFocus.removeListener(_onFocusChanged);
    _answerController.dispose();
    _answerFocus.dispose();
    _scroll.dispose();
    super.dispose();
  }

  /// 回到列表顶部（换题时调用）。
  void _scrollToTop() {
    if (!_scroll.hasClients) {
      return;
    }
    _scroll.animateTo(0, duration: Motion.normal, curve: Motion.standard);
  }

  void _onFocusChanged() {
    if (_focused != _answerFocus.hasFocus) {
      setState(() => _focused = _answerFocus.hasFocus);
    }
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
    final answer = mode == AnswerMode.assemble
        ? _picked.join(' ')
        : _answerController.text;
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
    _scrollToTop();
    ref.read(quizControllerProvider.notifier).loadNext();
  }

  /// 判分结果到达：经验弹入、成就提示、达标庆祝。
  void _onAnswer(QuizState? previous, QuizState next) {
    final result = next.result;
    if (result == null || previous?.result != null) {
      return;
    }

    if (result.totalXp > 0) {
      setState(() {
        _xpAmount = result.totalXp;
        _xpToken += 1;
      });
    }

    if (result.newAchievements.isNotEmpty) {
      final names = result.newAchievements.map((item) => item.name).join('、');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: <Widget>[
              const Icon(
                Icons.emoji_events_rounded,
                size: 18,
                color: Color(0xFFFBBF24),
              ),
              const SizedBox(width: 8),
              Expanded(child: Text('解锁成就 · $names')),
            ],
          ),
          duration: const Duration(seconds: 3),
        ),
      );
    }

    final before =
        previous?.result?.todayDone ??
        previous?.question?.todayDone ??
        next.question?.todayDone ??
        0;
    final crossedGoal =
        result.todayGoal > 0 &&
        before < result.todayGoal &&
        result.todayDone >= result.todayGoal;
    if (crossedGoal && !_celebrated) {
      _celebrated = true;
      HapticFeedback.mediumImpact();
      // 等翻卡完成再放彩带：翻到一半被挡住会显得突兀
      Future<void>.delayed(Motion.flip, () {
        if (!mounted) {
          return;
        }
        showCelebration(
          context,
          title: '今日目标达成',
          subtitle: '${result.todayDone} / ${result.todayGoal} 句 · 去领今日句签',
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<QuizState>(quizControllerProvider, _onAnswer);

    final state = ref.watch(quizControllerProvider);
    final cards = ref.watch(cardControllerProvider);
    // 测试里（autoLoad=false）不触发网络：否则 Widget 测试会因为真实请求挂掉
    final checkin = widget.autoLoad
        ? ref.watch(todayCheckinProvider).valueOrNull
        : null;

    // 翻转目标角度**由 flipped 直接推导**（而不是累加）：
    // 累加方案依赖 didUpdateWidget 被可靠触发，但提交答案后 QuizPage 自身
    // 参数没变、父级不重建，didUpdateWidget 可能根本不跑——于是 deg 与
    // flipped 脱节，出现「卡片转了一半却还显示正面」的露馅画面。
    // 推导方案没有中间状态可漏，deg 与 flipped 永远一致。
    //
    // 抽下一题(loadingNext)时保持翻转——否则点「下一题」后 flipped 立刻变 false，
    // 卡片会当着用户的面从 180° 往回转、停在中间角度（就是截图里「卡片斜着」的来源）。
    final flipped =
        state.phase == QuizPhase.answered ||
        (state.phase == QuizPhase.loading && state.loadingNext);

    final done = state.result?.todayDone ?? state.question?.todayDone ?? 0;
    final goal = state.result?.todayGoal ?? state.question?.todayGoal ?? 0;
    final goalReached = goal > 0 && done >= goal;

    // Material 透明包一层：Tab 内容由外壳的 Scaffold 提供 Material，
    // 但单独挂载本页（Widget 测试 / 深链）时 TextField 需要它作祖先。
    return Material(
      color: Colors.transparent,
      child: SafeArea(
        bottom: false,
        child: switch (state.phase) {
          // 首次抽题（还没有题）→ 骨架屏；「抽下一题」→ 保持背面走加载态
          QuizPhase.loading when !state.loadingNext => const _SkeletonCard(),
          _ when state.question != null => _buildBody(
            state,
            cards,
            checkin,
            flipped,
            done,
            goal,
            goalReached,
          ),
          _ => EmptyState(
            title: state.error ?? '准备抽题…',
            message: state.error == null ? null : '检查一下网络，或者稍后再试',
            icon: state.error == null
                ? Icons.hourglass_empty_rounded
                : Icons.cloud_off_rounded,
            tone: state.error == null ? EmptyTone.neutral : EmptyTone.error,
            actionLabel: '重新抽题',
            onAction: _next,
          ),
        },
      ),
    );
  }

  Widget _buildBody(
    QuizState state,
    CardState cards,
    CheckinToday? checkin,
    bool flipped,
    int done,
    int goal,
    bool goalReached,
  ) {
    final question = state.question!;

    return ListView(
      controller: _scroll,
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 112),
      children: <Widget>[
        _QuizHeader(streak: checkin?.streak ?? 0, done: done),
        const SizedBox(height: 12),
        StaggeredEntrance(
          index: 0,
          // Hero 里有持续流动的柔光：单独一层重绘边界，
          // 免得它每帧把整段列表（含卡片与图片）一起标记为需要重绘
          child: RepaintBoundary(
            child: _ProgressHero(done: done, goal: goal),
          ),
        ),
        const SizedBox(height: 12),
        if (goalReached && cards.claimable) ...<Widget>[
          StaggeredEntrance(
            index: 1,
            child: _ClaimBanner(
              busy: cards.claiming,
              onTap: () => claimTodayCard(context, ref),
            ),
          ),
          const SizedBox(height: 12),
        ],
        StaggeredEntrance(
          index: 2,
          child: _ModeBar(
            mode: state.mode,
            difficulty: state.difficulty,
            onMode: (mode) {
              _resetInputs();
              _scrollToTop();
              ref.read(quizControllerProvider.notifier).setMode(mode);
            },
            onDifficulty: _pickDifficulty,
          ),
        ),
        const SizedBox(height: 14),
        _StackedCards(
          child: RepaintBoundary(
            child: _FlipCard(
              flipped: flipped,
              frontBuilder: (_) => _FrontFace(
                question: question,
                mode: state.mode,
                busy: state.isBusy,
                focused: _focused,
                answerController: _answerController,
                focusNode: _answerFocus,
                picked: _picked,
                onPick: _pickWord,
                onUndoPick: () => setState(() {
                  if (_picked.isNotEmpty) {
                    _picked.removeLast();
                  }
                }),
                onRemovePick: (index) => setState(() {
                  if (index >= 0 && index < _picked.length) {
                    _picked.removeAt(index);
                  }
                }),
                onSubmit: _submit,
                error: state.error,
              ),
              backBuilder: (_) {
                final current = state.result;
                // 抽下一题时 result 已被清空，但**仍要渲染背面**（显示加载态）：
                // 否则卡片区域会整个消失，观感是「卡片没了」而不是「在加载」。
                final shown = current ?? _placeholderResult;
                return _BackFace(
                  result: shown,
                  userAnswer: _answerController.text,
                  onNext: _next,
                  loading: state.loadingNext,
                  xpAmount: _xpAmount,
                  xpToken: _xpToken,
                  onToggleFavorite: () => ref
                      .read(quizControllerProvider.notifier)
                      .toggleFavorite(),
                  onAi: () => showAiSheet(
                    context,
                    chinese: question.translationZh,
                    word: _firstWord(shown.sentenceEn),
                    sentenceId: question.sentenceId,
                  ),
                  onReport: () async {
                    final submitted = await showReportSheet(
                      context,
                      sentenceId: question.sentenceId,
                    );
                    if (submitted && mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('已收到，感谢你的反馈')),
                      );
                    }
                  },
                );
              },
            ),
          ),
        ),
        const SizedBox(height: 10),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: state.isBusy ? null : _next,
            icon: const Icon(Icons.shuffle_rounded, size: 16),
            label: const Text('换一题'),
            style: TextButton.styleFrom(
              foregroundColor: context.colors.inkSoft,
            ),
          ),
        ),
      ],
    );
  }

  void _pickWord(String word) {
    HapticFeedback.selectionClick();
    setState(() => _picked.add(word));
  }

  Future<void> _pickDifficulty() async {
    final current = ref.read(quizControllerProvider).difficulty;
    final picked = await showModalBottomSheet<int>(
      context: context,
      builder: (sheetContext) => _DifficultySheet(current: current),
    );
    if (picked != null && picked != current) {
      _resetInputs();
      _scrollToTop();
      await ref.read(quizControllerProvider.notifier).setDifficulty(picked);
    }
  }

  static String _firstWord(String sentence) {
    final trimmed = sentence.trim();
    if (trimmed.isEmpty) {
      return '';
    }
    final match = RegExp(r"[A-Za-z][A-Za-z'-]*").firstMatch(trimmed);
    return match?.group(0) ?? '';
  }
}

/* ------------------------------ 头部 ------------------------------ */

class _QuizHeader extends StatelessWidget {
  const _QuizHeader({required this.streak, required this.done});

  final int streak;
  final int done;

  static String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 6) {
      return '夜深了';
    }
    if (hour < 12) {
      return '早上好';
    }
    if (hour < 18) {
      return '下午好';
    }
    return '晚上好';
  }

  static String _dateLabel() {
    final now = DateTime.now();
    const weekdays = <String>['一', '二', '三', '四', '五', '六', '日'];
    return '${now.month}月${now.day}日 · 周${weekdays[now.weekday - 1]}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return StaggeredEntrance(
      offset: const Offset(0, 8),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(4, 6, 4, 2),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    _greeting(),
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontSize: 25,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.8,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${_dateLabel()} · 今天已练 $done 句',
                    style: TextStyle(fontSize: 11.5, color: colors.inkFaint),
                  ),
                ],
              ),
            ),
            if (streak > 0)
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: colors.gold.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Icon(
                      Icons.local_fire_department_rounded,
                      size: 16,
                      color: colors.gold,
                    ),
                    const SizedBox(width: 3),
                    Text(
                      '$streak',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: colors.gold,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/* ------------------------------ 进度 Hero ------------------------------ */

class _ProgressHero extends StatelessWidget {
  const _ProgressHero({required this.done, required this.goal});

  final int done;
  final int goal;

  @override
  Widget build(BuildContext context) {
    final pct = goal <= 0 ? 0.0 : (done / goal).clamp(0.0, 1.0);
    final reached = goal > 0 && done >= goal;
    final stage =
        kHeroStages[heroStageOf(
          goalReached: reached,
          done: done,
          pct: pct * 100,
        )]!;

    return TweenAnimationBuilder<double>(
      // 阶段变化时轻顶一下（key 变→重建动画），而不是常驻缩放
      key: ValueKey<HeroStageKey>(
        heroStageOf(goalReached: reached, done: done, pct: pct * 100),
      ),
      tween: Tween<double>(begin: 1.012, end: 1),
      duration: Motion.reduced(context)
          ? Duration.zero
          : const Duration(milliseconds: 460),
      curve: Motion.spring,
      builder: (context, scale, child) =>
          Transform.scale(scale: scale, child: child),
      child: AnimatedContainer(
        duration: Motion.reduced(context) ? Duration.zero : Motion.slow,
        curve: Motion.standard,
        decoration: BoxDecoration(
          gradient: stage.gradient,
          borderRadius: BorderRadius.circular(26),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: stage.shadow,
              blurRadius: 22,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(26),
          child: Stack(
            children: <Widget>[
              // 流动柔光：让渐变「活着」，而不是一块死色
              Positioned.fill(
                child: AuroraBackground(
                  gradient: const LinearGradient(
                    colors: <Color>[Colors.transparent, Colors.transparent],
                  ),
                  intensity: 0.2,
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(9),
                          ),
                          child: Icon(
                            Icons.local_fire_department_rounded,
                            size: 14,
                            color: stage.onColor,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '今日刷题',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: stage.onColor.withValues(alpha: 0.82),
                            letterSpacing: 0.2,
                          ),
                        ),
                        const Spacer(),
                        if (reached)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 9,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: stage.onColor.withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: <Widget>[
                                Icon(
                                  Icons.check_circle_rounded,
                                  size: 12,
                                  color: stage.onColor,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  '已达标',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: stage.onColor,
                                  ),
                                ),
                              ],
                            ),
                          )
                        else
                          Text(
                            done <= 0 ? '今天还没开始' : _hint(done, goal),
                            style: TextStyle(
                              fontSize: 11.5,
                              color: stage.onColor.withValues(alpha: 0.8),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: <Widget>[
                        CountUpText(
                          value: done,
                          style: TextStyle(
                            fontSize: 38,
                            height: 1,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -1.2,
                            color: stage.onColor,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          '/ $goal 句',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: stage.onColor.withValues(alpha: 0.72),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    _ProgressBar(
                      pct: pct,
                      reached: reached,
                      tone: stage.onColor,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 进度提示语：不说「还差 N 句」（像催作业），与 Web 端 heroHint 同口径。
  static String _hint(int done, int goal) {
    final remain = goal - done;
    if (remain <= 0) {
      return '';
    }
    if (remain == 1) {
      return '最后一句';
    }
    return '还剩 $remain 句';
  }
}

class _ProgressBar extends StatelessWidget {
  const _ProgressBar({
    required this.pct,
    required this.reached,
    required this.tone,
  });

  final double pct;
  final bool reached;

  /// 轨道与光点的基色（跟随阶段前景色，保证在金色底上仍可见）。
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        return SizedBox(
          height: 12,
          child: Stack(
            clipBehavior: Clip.none,
            children: <Widget>[
              Positioned(
                left: 0,
                right: 0,
                top: 2,
                child: Container(
                  height: 8,
                  decoration: BoxDecoration(
                    color: tone.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              AnimatedPositioned(
                duration: Motion.reduced(context)
                    ? Duration.zero
                    : const Duration(milliseconds: 720),
                curve: Motion.decelerate,
                left: 0,
                top: 2,
                width: width * pct,
                height: 8,
                child: Container(
                  decoration: BoxDecoration(
                    // 达标档用奶油色而不是深棕：深棕在金色底上像一条黑杠，
                    // 奶油色与末端光点同色，观感是「整条亮了」
                    color: reached ? const Color(0xFFFFF7E6) : tone,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              AnimatedPositioned(
                duration: Motion.reduced(context)
                    ? Duration.zero
                    : const Duration(milliseconds: 720),
                curve: Motion.decelerate,
                left: (width * pct - 6).clamp(0.0, width - 12),
                top: 0,
                child: Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: reached ? const Color(0xFFFFF7E6) : tone,
                    shape: BoxShape.circle,
                    boxShadow: <BoxShadow>[
                      BoxShadow(
                        color: (reached ? const Color(0xFFFFE7B0) : tone)
                            .withValues(alpha: 0.75),
                        blurRadius: 10,
                        spreadRadius: 1,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/* ------------------------------ 领取句签入口 ------------------------------ */

class _ClaimBanner extends StatelessWidget {
  const _ClaimBanner({required this.busy, required this.onTap});

  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return PressScale(
      onTap: busy ? null : onTap,
      haptic: true,
      scale: 0.98,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: LinearGradient(
            colors: <Color>[
              colors.gold.withValues(alpha: 0.18),
              const Color(0xFFF97316).withValues(alpha: 0.1),
            ],
          ),
          border: Border.all(color: colors.gold.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: <Widget>[
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: <Color>[colors.gold, const Color(0xFFF97316)],
                ),
              ),
              child: busy
                  ? const Padding(
                      padding: EdgeInsets.all(9),
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(
                      Icons.auto_awesome_rounded,
                      size: 17,
                      color: Colors.white,
                    ),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    '今日句签已就绪',
                    style: Theme.of(context).textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700, fontSize: 13.5),
                  ),
                  Text(
                    '轻点领取，收进你的册子',
                    style: TextStyle(fontSize: 11, color: colors.inkSoft),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 20, color: colors.gold),
          ],
        ),
      ),
    );
  }
}

/* ------------------------------ 模式 / 难度 ------------------------------ */

class _ModeBar extends StatelessWidget {
  const _ModeBar({
    required this.mode,
    required this.difficulty,
    required this.onMode,
    required this.onDifficulty,
  });

  final AnswerMode mode;
  final int difficulty;
  final ValueChanged<AnswerMode> onMode;
  final VoidCallback onDifficulty;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      children: <Widget>[
        Expanded(
          child: SegmentedControl<AnswerMode>(
            value: mode,
            onChanged: onMode,
            height: 40,
            segments: const <Segment<AnswerMode>>[
              Segment<AnswerMode>(
                value: AnswerMode.input,
                label: '默写',
                icon: Icons.keyboard_alt_outlined,
              ),
              Segment<AnswerMode>(
                value: AnswerMode.assemble,
                label: '拼词',
                icon: Icons.extension_outlined,
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        PressScale(
          onTap: onDifficulty,
          scale: 0.94,
          child: Container(
            height: 40,
            padding: const EdgeInsets.symmetric(horizontal: 13),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: colors.line),
            ),
            child: Row(
              children: <Widget>[
                Icon(Icons.tune_rounded, size: 15, color: colors.inkSoft),
                const SizedBox(width: 5),
                Text(
                  _label(difficulty),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: colors.inkSoft,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  static String _label(int value) => switch (value) {
    1 => '基础',
    2 => '进阶',
    3 => '挑战',
    _ => '进阶',
  };
}

/// 难度选择弹窗。
class _DifficultySheet extends StatelessWidget {
  const _DifficultySheet({required this.current});

  final int current;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    const options = <({int value, String label, String hint, IconData icon})>[
      (value: 1, label: '基础', hint: 'A1~A2 高频词，单句直陈', icon: Icons.eco_rounded),
      (
        value: 2,
        label: '进阶',
        hint: '一个从句、进阶词或短语动词',
        icon: Icons.trending_up_rounded,
      ),
      (
        value: 3,
        label: '挑战',
        hint: '习语、虚拟语气、多重从句',
        icon: Icons.local_fire_department_rounded,
      ),
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 2, 20, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text('题目难度', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(
            '难度随词汇与语法，不随句子长短',
            style: Theme.of(context).textTheme.labelSmall
                ?.copyWith(color: colors.inkFaint),
          ),
          const SizedBox(height: 16),
          for (final option in options) ...<Widget>[
            PressScale(
              onTap: () => Navigator.of(context).pop(option.value),
              scale: 0.98,
              child: AnimatedContainer(
                duration: Motion.fast,
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 13,
                ),
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: current == option.value
                      ? colors.brand.withValues(alpha: 0.08)
                      : colors.cardMuted,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: current == option.value
                        ? colors.brand.withValues(alpha: 0.5)
                        : colors.line,
                  ),
                ),
                child: Row(
                  children: <Widget>[
                    Icon(
                      option.icon,
                      size: 19,
                      color: current == option.value
                          ? colors.brand
                          : colors.inkSoft,
                    ),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            option.label,
                            style: TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w600,
                              color: colors.ink,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            option.hint,
                            style: TextStyle(
                              fontSize: 11,
                              color: colors.inkFaint,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (current == option.value)
                      Icon(
                        Icons.check_circle_rounded,
                        size: 18,
                        color: colors.brand,
                      ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/* ------------------------------ 卡片层叠外壳 ------------------------------ */

/// 卡片背后叠两层「纸片」，让翻转有纵深。
class _StackedCards extends StatelessWidget {
  const _StackedCards({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    Widget ghost(double opacity) => DecoratedBox(
      decoration: BoxDecoration(
        color: colors.card.withValues(alpha: opacity),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: colors.line.withValues(alpha: 0.6)),
      ),
    );

    return Stack(
      clipBehavior: Clip.none,
      children: <Widget>[
        Positioned(top: 14, left: 14, right: 14, bottom: -8, child: ghost(0.5)),
        Positioned(top: 7, left: 7, right: 7, bottom: -4, child: ghost(0.75)),
        child,
      ],
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

class _FlipCardState extends State<_FlipCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    duration: Motion.flip,
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

/// 卡面容器：白底 + 大圆角 + 双层柔和投影 + 细描边。
class _CardFace extends StatelessWidget {
  const _CardFace({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: colors.line.withValues(alpha: 0.8)),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.06),
            blurRadius: 2,
            offset: const Offset(0, 1),
          ),
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.1),
            blurRadius: 26,
            offset: const Offset(0, 14),
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
    required this.focused,
    required this.answerController,
    required this.focusNode,
    required this.picked,
    required this.onPick,
    required this.onUndoPick,
    required this.onRemovePick,
    required this.onSubmit,
    this.error,
  });

  final Question question;
  final AnswerMode mode;
  final bool busy;
  final bool focused;
  final TextEditingController answerController;
  final FocusNode focusNode;
  final List<String> picked;
  final ValueChanged<String> onPick;
  final VoidCallback onUndoPick;

  /// 点已选词块任意一个即可移除（不必只从末尾撤）。
  final ValueChanged<int> onRemovePick;
  final VoidCallback onSubmit;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.colors;
    final assemble = mode == AnswerMode.assemble && question.words != null;

    return _CardFace(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          // 题头：来源 / 难度 / 分类
          Row(
            children: <Widget>[
              Pill(
                label: question.source == QuestionSource.review ? '复习' : '新题',
                foreground: question.source == QuestionSource.review
                    ? const Color(0xFF7C3AED)
                    : colors.brand,
                background:
                    (question.source == QuestionSource.review
                            ? const Color(0xFF7C3AED)
                            : colors.brand)
                        .withValues(alpha: 0.1),
              ),
              const SizedBox(width: 6),
              Pill(
                label: question.difficultyLabel,
                foreground: colors.gold,
                background: colors.gold.withValues(alpha: 0.12),
              ),
              if (question.categoryName != null) ...<Widget>[
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    question.categoryName!,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: colors.inkFaint,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 18),

          // 题干：居中大字，不加底框（更干净，也让配图成为视觉主体）
          Text(
            question.translationZh,
            textAlign: TextAlign.center,
            style: theme.textTheme.titleLarge?.copyWith(
              fontSize: 20,
              height: 1.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.1,
            ),
          ),
          const SizedBox(height: 16),

          // 场景图 16:9
          ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: question.imageUrl == null
                  ? Container(
                      color: colors.cardMuted,
                      child: Center(
                        child: Text(
                          '配图缺失',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colors.inkFaint,
                          ),
                        ),
                      ),
                    )
                  : CachedNetworkImage(
                      imageUrl: staticUrl(question.imageUrl),
                      fit: BoxFit.cover,
                      fadeInDuration: Motion.normal,
                      placeholder: (context, _) =>
                          const ShimmerBox(height: double.infinity, radius: 0),
                      errorWidget: (context, _, _) => Container(
                        color: colors.cardMuted,
                        child: Center(
                          child: Text(
                            '配图加载失败',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: colors.inkFaint,
                            ),
                          ),
                        ),
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 18),

          // 作答区
          if (assemble)
            _AssembleArea(
              words: question.words!,
              picked: picked,
              onPick: onPick,
              onUndoPick: onUndoPick,
              onRemovePick: onRemovePick,
              onSubmit: onSubmit,
              busy: busy,
            )
          else
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                AnimatedContainer(
                  duration: Motion.fast,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: focused
                        ? <BoxShadow>[
                            BoxShadow(
                              color: colors.brand.withValues(alpha: 0.16),
                              blurRadius: 18,
                              offset: const Offset(0, 4),
                            ),
                          ]
                        : null,
                  ),
                  child: TextField(
                    controller: answerController,
                    focusNode: focusNode,
                    enabled: !busy,
                    textInputAction: TextInputAction.done,
                    textCapitalization: TextCapitalization.none,
                    autocorrect: false,
                    style: const TextStyle(fontSize: 16, height: 1.4),
                    // 聚焦时把输入框滚到键盘上方，并给「确定」留出位置
                    scrollPadding: const EdgeInsets.only(bottom: 190),
                    onSubmitted: (_) => onSubmit(),
                    decoration: const InputDecoration(hintText: '输入对应的英文句子'),
                  ),
                ),
                const SizedBox(height: 12),
                GradientButton(
                  label: '确定',
                  icon: Icons.check_rounded,
                  height: 50,
                  loading: busy,
                  onPressed: busy ? null : onSubmit,
                ),
              ],
            ),

          if (error != null) ...<Widget>[
            const SizedBox(height: 10),
            Row(
              children: <Widget>[
                Icon(
                  Icons.error_outline_rounded,
                  size: 15,
                  color: colors.danger,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    error!,
                    style: TextStyle(color: colors.danger, fontSize: 12.5),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// 拼词作答区：已选（可点回）+ 候选词块。
class _AssembleArea extends StatefulWidget {
  const _AssembleArea({
    required this.words,
    required this.picked,
    required this.onPick,
    required this.onUndoPick,
    required this.onRemovePick,
    required this.onSubmit,
    required this.busy,
  });

  final List<String> words;
  final List<String> picked;
  final ValueChanged<String> onPick;
  final VoidCallback onUndoPick;
  final ValueChanged<int> onRemovePick;
  final VoidCallback onSubmit;
  final bool busy;

  @override
  State<_AssembleArea> createState() => _AssembleAreaState();
}

class _AssembleAreaState extends State<_AssembleArea> {
  /// 「确定」按钮的位置：拼完最后一个词要把它滚进视野。
  final GlobalKey _submitKey = GlobalKey();

  @override
  void didUpdateWidget(covariant _AssembleArea oldWidget) {
    super.didUpdateWidget(oldWidget);
    // 词块刚好用完时，按钮在折叠线以下（图片 + 词块占满了屏），
    // 用户拼完却看不到可以提交，会以为还缺点什么。这里主动滚一下。
    final justCompleted =
        widget.picked.length == widget.words.length &&
        oldWidget.picked.length != widget.words.length;
    if (justCompleted && widget.words.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final target = _submitKey.currentContext;
        if (target != null) {
          Scrollable.ensureVisible(
            target,
            duration: Motion.normal,
            curve: Motion.standard,
            // 0.6 而不是贴近底部：底栏是悬浮的，贴底会被它盖住
            alignment: 0.6,
          );
        }
      });
    }
  }

  /// 已选词块的稳定 key：按「同词第几次出现」编号。
  ///
  /// 用下标做 key 会有一个副作用：删掉中间某个词后，后面所有词的下标都变了，
  /// Flutter 会把它们当成新 widget 重建 → 弹入动画重播一遍，观感像「卡片抖了一下」。
  String _keyOfPicked(int index) {
    final word = widget.picked[index];
    var occurrence = 0;
    for (var i = 0; i < index; i++) {
      if (widget.picked[i] == word) {
        occurrence += 1;
      }
    }
    return 'picked-$word-$occurrence';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.colors;

    // 用局部别名，避免 widget 化后整段都要写 widget.xxx
    final words = widget.words;
    final picked = widget.picked;
    final busy = widget.busy;
    final onPick = widget.onPick;
    final onUndoPick = widget.onUndoPick;
    final onRemovePick = widget.onRemovePick;
    final onSubmit = widget.onSubmit;

    // 候选里扣掉已选中的（同词多处时按出现次数扣）
    final remaining = List<String>.from(words);
    for (final word in picked) {
      final index = remaining.indexOf(word);
      if (index >= 0) {
        remaining.removeAt(index);
      }
    }
    final complete = remaining.isEmpty && picked.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        // 已选
        AnimatedContainer(
          duration: Motion.normal,
          constraints: const BoxConstraints(minHeight: 62, maxHeight: 150),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: colors.cardMuted.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: picked.isEmpty
                  ? colors.line
                  : colors.brand.withValues(alpha: 0.35),
              width: 1.2,
            ),
          ),
          child: SingleChildScrollView(
            child: picked.isEmpty
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      '点下面的词块，按顺序拼成句子',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colors.inkFaint,
                      ),
                    ),
                  )
                : Wrap(
                    spacing: 7,
                    runSpacing: 7,
                    children: <Widget>[
                      for (var i = 0; i < picked.length; i++)
                        _WordChip(
                          key: ValueKey<String>(_keyOfPicked(i)),
                          text: picked[i],
                          picked: true,
                          // 点哪一个就退哪一个：拼错位置时不必从末尾一路撤
                          onTap: busy ? null : () => onRemovePick(i),
                          appear: true,
                        ),
                    ],
                  ),
          ),
        ),
        Row(
          children: <Widget>[
            TextButton.icon(
              onPressed: busy || picked.isEmpty ? null : onUndoPick,
              icon: const Icon(Icons.undo_rounded, size: 15),
              label: const Text('撤销'),
              style: TextButton.styleFrom(
                foregroundColor: colors.inkSoft,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                minimumSize: const Size(0, 36),
              ),
            ),
            const Spacer(),
            Text(
              '${picked.length} / ${words.length} 词',
              style: TextStyle(fontSize: 11, color: colors.inkFaint),
            ),
          ],
        ),
        const SizedBox(height: 4),
        // 候选
        Wrap(
          spacing: 7,
          runSpacing: 7,
          children: <Widget>[
            for (var i = 0; i < remaining.length; i++)
              _WordChip(
                key: ValueKey<String>('bank-$i-${remaining[i]}'),
                text: remaining[i],
                picked: false,
                onTap: busy ? null : () => onPick(remaining[i]),
              ),
          ],
        ),
        const SizedBox(height: 14),
        GradientButton(
          key: _submitKey,
          label: complete ? '确定' : '还有 ${remaining.length} 个词没用',
          height: 50,
          loading: busy,
          onPressed: busy || !complete ? null : onSubmit,
        ),
      ],
    );
  }
}

/// 词块：候选与已选两种形态。
class _WordChip extends StatelessWidget {
  const _WordChip({
    required this.text,
    required this.picked,
    required this.onTap,
    this.appear = false,
    super.key,
  });

  final String text;
  final bool picked;
  final VoidCallback? onTap;

  /// 新加入已选区时做一次弹入。
  final bool appear;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final chip = Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
      decoration: BoxDecoration(
        color: picked ? colors.brand.withValues(alpha: 0.1) : colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: picked ? colors.brand.withValues(alpha: 0.45) : colors.line,
          width: 1.2,
        ),
        boxShadow: picked
            ? null
            : <BoxShadow>[
                BoxShadow(
                  color: colors.shadow.withValues(alpha: 0.06),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 15,
          fontWeight: picked ? FontWeight.w600 : FontWeight.w500,
          color: picked ? colors.brand : colors.ink,
          height: 1.2,
        ),
      ),
    );

    final interactive = PressScale(onTap: onTap, scale: 0.92, child: chip);
    if (!appear) {
      return interactive;
    }
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0.8, end: 1),
      duration: Motion.reduced(context) ? Duration.zero : Motion.normal,
      curve: Motion.spring,
      builder: (context, value, child) => Opacity(
        opacity: value.clamp(0.0, 1.0),
        child: Transform.scale(scale: value, child: child),
      ),
      child: interactive,
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
    required this.onAi,
    required this.onReport,
    required this.xpAmount,
    required this.xpToken,
    this.loading = false,
  });

  final AnswerResult result;
  final String userAnswer;
  final VoidCallback onNext;
  final VoidCallback onToggleFavorite;
  final VoidCallback onAi;
  final VoidCallback onReport;
  final int xpAmount;
  final int xpToken;

  /// 正在抽下一题：显示加载态（对齐 Web 端「保持背面并显示加载态」）。
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.colors;

    if (loading) {
      return _CardFace(
        child: SizedBox(
          height: 260,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2.2),
              ),
              const SizedBox(height: 16),
              Text(
                '加载下一题…',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: colors.inkSoft,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final correct = result.isCorrect;
    final accent = correct ? colors.success : colors.danger;

    return _CardFace(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          // 结果条 + 经验
          StaggeredEntrance(
            offset: const Offset(-14, 0),
            child: Container(
              padding: const EdgeInsets.fromLTRB(14, 11, 12, 11),
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.09),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: <Widget>[
                  Icon(
                    correct ? Icons.check_circle_rounded : Icons.cancel_rounded,
                    size: 20,
                    color: accent,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    correct ? '答对了' : '再想想',
                    style: TextStyle(
                      color: accent,
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
                  const Spacer(),
                  if (xpAmount > 0) _XpBadge(amount: xpAmount, token: xpToken),
                  const SizedBox(width: 6),
                  _FavoriteButton(
                    favorited: result.favorited,
                    onTap: onToggleFavorite,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),

          StaggeredEntrance(
            index: 1,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  result.sentenceEn,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontSize: 21,
                    fontWeight: FontWeight.w700,
                    height: 1.4,
                    letterSpacing: -0.2,
                  ),
                ),
                if (result.ipa != null && result.ipa!.isNotEmpty) ...<Widget>[
                  const SizedBox(height: 6),
                  Text(
                    result.ipa!,
                    style: TextStyle(
                      fontSize: 12.5,
                      color: colors.brand,
                      fontFamily: 'monospace',
                      letterSpacing: 0.2,
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                Text(
                  result.translationZh,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colors.inkSoft,
                    height: 1.6,
                  ),
                ),
              ],
            ),
          ),

          if (result.validAnswers.isNotEmpty) ...<Widget>[
            const SizedBox(height: 16),
            StaggeredEntrance(
              index: 2,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: colors.cardMuted,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      '这些说法也算对',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w600,
                        color: colors.inkFaint,
                      ),
                    ),
                    const SizedBox(height: 5),
                    ...result.validAnswers.map(
                      (answer) => Padding(
                        padding: const EdgeInsets.only(bottom: 3),
                        child: Text(
                          answer,
                          style: TextStyle(
                            fontSize: 13,
                            height: 1.4,
                            color: colors.inkSoft,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],

          if (!correct && userAnswer.trim().isNotEmpty) ...<Widget>[
            const SizedBox(height: 14),
            StaggeredEntrance(
              index: 3,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: colors.cardMuted,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      '你的答案',
                      style: TextStyle(fontSize: 10.5, color: colors.inkFaint),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      userAnswer.trim(),
                      style: TextStyle(
                        fontSize: 13.5,
                        height: 1.45,
                        color: colors.inkSoft,
                        decoration: TextDecoration.lineThrough,
                        decorationColor: colors.danger,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],

          const SizedBox(height: 18),
          StaggeredEntrance(
            index: 4,
            child: Row(
              children: <Widget>[
                _GhostAction(
                  icon: Icons.auto_awesome_rounded,
                  label: 'AI 拓展',
                  onTap: onAi,
                ),
                const SizedBox(width: 8),
                _GhostAction(
                  icon: Icons.flag_outlined,
                  label: '反馈',
                  onTap: onReport,
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          GradientButton(
            label: '下一题',
            icon: Icons.arrow_forward_rounded,
            height: 50,
            onPressed: onNext,
          ),
        ],
      ),
    );
  }
}

/// 经验徽标：每次判分弹入一次。
class _XpBadge extends StatelessWidget {
  const _XpBadge({required this.amount, required this.token});

  final int amount;
  final int token;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return TweenAnimationBuilder<double>(
      key: ValueKey<int>(token),
      tween: Tween<double>(begin: 0.3, end: 1),
      duration: Motion.reduced(context)
          ? Duration.zero
          : const Duration(milliseconds: 520),
      curve: Motion.spring,
      builder: (context, value, child) => Opacity(
        opacity: value.clamp(0.0, 1.0),
        child: Transform.translate(
          offset: Offset(0, 10 * (1 - value)),
          child: Transform.scale(scale: 0.8 + 0.2 * value, child: child),
        ),
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(
          color: colors.gold.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: colors.gold.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(Icons.bolt_rounded, size: 13, color: colors.gold),
            const SizedBox(width: 2),
            Text(
              '+$amount XP',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: colors.gold,
              ),
            ),
          ],
        ),
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
    HapticFeedback.selectionClick();
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
    return PressScale(
      onTap: _handleTap,
      scale: 0.85,
      child: AnimatedScale(
        scale: _pop ? 1.35 : 1,
        duration: Motion.fast,
        curve: Motion.spring,
        child: Padding(
          padding: const EdgeInsets.all(4),
          child: Icon(
            widget.favorited ? Icons.star_rounded : Icons.star_border_rounded,
            size: 23,
            color: widget.favorited
                ? context.colors.gold
                : context.colors.inkFaint,
          ),
        ),
      ),
    );
  }
}

/// 次级操作（背面 AI / 反馈）。
class _GhostAction extends StatelessWidget {
  const _GhostAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Expanded(
      child: PressScale(
        onTap: onTap,
        scale: 0.96,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 11),
          decoration: BoxDecoration(
            color: colors.cardMuted,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: colors.line),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Icon(icon, size: 15, color: colors.inkSoft),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: colors.inkSoft,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/* ------------------------------ 骨架屏 ------------------------------ */

/// 加载骨架屏（Web 端用 USkeleton，这里用微光容器模拟）。
class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
      physics: const NeverScrollableScrollPhysics(),
      children: <Widget>[
        const ShimmerBox(height: 22, width: 120, radius: 8),
        const SizedBox(height: 10),
        const ShimmerBox(height: 13, width: 180, radius: 6),
        const SizedBox(height: 14),
        const ShimmerBox(height: 150, radius: 26),
        const SizedBox(height: 14),
        const ShimmerBox(height: 40, radius: 999),
        const SizedBox(height: 18),
        _CardFace(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: const <Widget>[
              ShimmerBox(height: 16, width: 120, radius: 8),
              SizedBox(height: 18),
              ShimmerBox(height: 52, radius: 10),
              SizedBox(height: 16),
              ShimmerBox(height: 160, radius: 18),
              SizedBox(height: 18),
              ShimmerBox(height: 48, radius: 16),
            ],
          ),
        ),
      ],
    );
  }
}
