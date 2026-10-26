/// 刷题状态控制器（对应 Web 端 `stores/practice.ts` 的职责）。
///
/// 状态机（与后端返回严格对齐）：
/// ```
/// idle → loading → answering ──提交──▶ submitting → answered
///                     ▲                        │
///                     └──────── next() ◀───────┘
/// ```
/// - `answering`：题目已到手，等用户作答；
/// - `submitting`：答案已提交，等判分（按钮转圈）；
/// - `answered`：拿到判分结果，**卡片已翻到背面**，等用户点「下一题」。
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../api/models/question.dart';
import '../api/questions_api.dart';

/// 一次会话的累计统计（本次启动后；不入库，仅用于会话内展示）。
class QuizStats {
  const QuizStats({this.done = 0, this.correct = 0});

  final int done;
  final int correct;

  double get accuracy => done == 0 ? 0 : correct / done;

  QuizStats copyWith({int? done, int? correct}) => QuizStats(
        done: done ?? this.done,
        correct: correct ?? this.correct,
      );
}

/// 刷题状态。
class QuizState {
  const QuizState({
    this.question,
    this.result,
    this.phase = QuizPhase.idle,
    this.error,
    this.stats = const QuizStats(),
    this.mode = AnswerMode.input,
    this.startedAt,
    this.loadingNext = false,
    this.difficulty = 2,
  });

  /// 当前题目（null = 尚未抽到）
  final Question? question;

  /// 判分结果（非 null 表示已翻到背面）
  final AnswerResult? result;

  final QuizPhase phase;

  /// 错误提示（抽题/提交失败时）
  final String? error;

  /// 是否正在抽**下一题**（此时应保持背面显示加载态，而非翻回正面）。
  ///
  /// 与 `phase == loading` 的区别：首次抽题（无题）也是 loading，但那时
  /// 应显示骨架屏；只有「已答过 → 抽下一题」才需要保持背面。
  final bool loadingNext;

  final QuizStats stats;

  /// 当前作答模式（拼词模式下提交后切回默写，见 [submit]）
  final AnswerMode mode;

  /// 本题开始时间（计时费用）
  final DateTime? startedAt;

  /// 目标难度（1 易 / 2 中 / 3 难）。只作用于新题；复习题仍按间隔重复排期走。
  final int difficulty;

  bool get isAnswered => phase == QuizPhase.answered;

  bool get isBusy => phase == QuizPhase.loading || phase == QuizPhase.submitting;

  /// 本题是否已是收藏态（判分后由服务端告知）。
  bool get favorited => result?.favorited ?? false;

  QuizState copyWith({
    Question? question,
    AnswerResult? result,
    QuizPhase? phase,
    String? error,
    QuizStats? stats,
    AnswerMode? mode,
    DateTime? startedAt,
    bool clearError = false,
    bool clearResult = false,
    bool clearQuestion = false,
    bool? loadingNext,
    int? difficulty,
  }) {
    return QuizState(
      question: clearQuestion ? null : (question ?? this.question),
      result: clearResult ? null : (result ?? this.result),
      phase: phase ?? this.phase,
      error: clearError ? null : (error ?? this.error),
      stats: stats ?? this.stats,
      mode: mode ?? this.mode,
      startedAt: startedAt ?? this.startedAt,
      // 曾经漏掉这一行：loadingNext 永远回到 false，
      // 于是「点下一题」时卡片会当着用户的面往回翻（见 quiz_page 注释）。
      loadingNext: loadingNext ?? this.loadingNext,
      difficulty: difficulty ?? this.difficulty,
    );
  }
}

/// 刷题阶段。
enum QuizPhase {
  /// 空闲（尚未抽题）
  idle,

  /// 抽题中
  loading,

  /// 待作答
  answering,

  /// 判分中
  submitting,

  /// 已出结果（已翻卡）
  answered,
}

/// 刷题控制器。
class QuizController extends Notifier<QuizState> {
  @override
  QuizState build() => const QuizState();

  QuestionsApi get _api => ref.read(questionsApiProvider);

  /// 切换作答模式（同时重新抽题：模式决定是否下发词块）。
  void setMode(AnswerMode mode) {
    if (state.mode == mode) {
      return;
    }
    // 不清 result：加载期间保留上一题的 todayDone，避免「今日刷题」
    // 在切模式时也短暂回落（见 [loadNext] 的说明）。
    state = state.copyWith(mode: mode, error: null);
    loadNext();
  }

  /// 抽下一题。
  Future<void> loadNext({int? difficulty}) async {
    // 注：这里**不**清 result。加载期间要保留上一题的 result（连同它的
    // todayDone），否则页面会回落到 question.todayDone（抽题时的旧计数，
    // 还没算上刚答的这题），表现为「今日刷题」先 -1 再 +1 的闪烁。
    // 新题真正到达（或失败回idle）时才会清掉 result。
    state = state.copyWith(
      phase: QuizPhase.loading,
      clearError: true,
      error: null,
      // 已答过题才需要保持背面；首次抽题走骨架屏
      loadingNext: state.phase == QuizPhase.answered,
    );
    try {
      final question = await _api.next(
        NextQuestionQuery(difficulty: difficulty ?? state.difficulty, mode: state.mode),
      );
      state = state.copyWith(
        question: question,
        phase: QuizPhase.answering,
        startedAt: DateTime.now(),
        clearError: true,
        clearResult: true,
        loadingNext: false,
      );
    } catch (error) {
      // 必须清掉旧题：否则用户点「下一题」失败后，看到的还是上一张卡，
      // 会误以为已经抽到新题（而它其实已经答过了）。
      state = state.copyWith(
        phase: QuizPhase.idle,
        error: _message(error),
        clearQuestion: true,
        loadingNext: false,
      );
    }
  }

  /// 切换难度（立刻按新难度抽题；只影响新题）。
  Future<void> setDifficulty(int value) async {
    final next = value.clamp(1, 3);
    if (state.difficulty == next) {
      return;
    }
    // 同样不清 result（见 [loadNext]：保留 todayDone，避免计数回落）。
    state = state.copyWith(difficulty: next, error: null);
    await loadNext();
  }

  /// 提交答案（提交后服务端返回判分与完整答案）。
  Future<void> submit(String userAnswer) async {
    final question = state.question;
    if (question == null || state.isBusy) {
      return;
    }
    state = state.copyWith(phase: QuizPhase.submitting, clearError: true, error: null);

    final elapsedMs = state.startedAt == null
        ? null
        : DateTime.now().difference(state.startedAt!).inMilliseconds;

    try {
      final result = await _api.answer(
        question.sentenceId,
        userAnswer,
        elapsedMs: elapsedMs,
        mode: state.mode,
      );
      state = state.copyWith(
        result: result,
        phase: QuizPhase.answered,
        stats: state.stats.copyWith(
          done: state.stats.done + 1,
          correct: state.stats.correct + (result.isCorrect ? 1 : 0),
        ),
        clearError: true,
      );
    } catch (error) {
      // 提交失败：留在作答态让用户重试，不要把题目弄丢
      state = state.copyWith(phase: QuizPhase.answering, error: _message(error));
    }
  }

  /// 收藏 / 取消收藏当前题（判分后才能调，因为要基于已返回的 favorited）。
  Future<void> toggleFavorite() async {
    final question = state.question;
    final result = state.result;
    if (question == null || result == null || state.isBusy) {
      return;
    }
    try {
      final favorited = await _api.toggleFavorite(question.sentenceId);
      state = state.copyWith(result: result.copyWith(favorited: favorited));
    } catch (error) {
      state = state.copyWith(error: _message(error));
    }
  }

  static String _message(Object error) {
    if (error is ApiException) {
      return error.message;
    }
    return '操作失败，请稍后重试';
  }
}

/// 刷题控制器 Provider。
final quizControllerProvider = NotifierProvider<QuizController, QuizState>(
  QuizController.new,
);
