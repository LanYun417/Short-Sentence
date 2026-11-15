/**
 * 刷题页：单卡状态机 + 3D 翻转 + 输入/拼词双模式。
 *
 * 状态流转：loadQuestion → answering → onSubmit → flipped → onNext → loadQuestion …
 * 判分完全由后端裁决（normalizeAnswer 不收宽），前端只负责收集答案与展示。
 */
import { fetchNextQuestion, reportSentence, submitAnswer, toggleFavorite } from '../../services/question';
import type { NextQuestionParams, ReportReason } from '../../services/question';
import type { AnswerResult, NextQuestion } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { haptic, showError, toast, toastSuccess } from '../../utils/feedback';
import { absoluteUrl } from '../../utils/format';
import { goLogin } from '../../utils/nav';
import { getAnswerMode, getDifficulty, setAnswerMode, type AnswerMode } from '../../utils/storage';

/** 一个可选词块（拼词模式）。 */
interface WordChip {
  key: string;
  text: string;
  used: boolean;
}

/** 已选词（点击可退回）。 */
interface PickedWord {
  key: string;
  text: string;
}

/** 空结果（避免 WXML 里访问 null 的属性；未翻转时不可见）。 */
const EMPTY_RESULT: AnswerResult = {
  sentenceId: 0,
  isCorrect: false,
  sentenceEn: '',
  validAnswers: [],
  translationZh: '',
  ipa: null,
  explanation: null,
  imageUrl: null,
  favorited: false,
  todayDone: 0,
  todayGoal: 0,
  xpEarned: 0,
  goalBonus: 0,
  newAchievements: [],
};

interface PracticeData {
  question: NextQuestion | null;
  result: AnswerResult;
  answer: string;
  chips: WordChip[];
  picked: PickedWord[];
  mode: AnswerMode;
  submitting: boolean;
  flipped: boolean;
  loading: boolean;
  errorText: string;
  imageUrl: string;
  progressText: string;
  percent: number;
  xpText: string;
  achievementText: string;
  favorited: boolean;
  /** 反馈提交中（防连点） */
  reporting: boolean;
  /** 举报原因候选项（与后端四选一一致） */
  reasons: ReportReasonItem[];
  /** 举报弹层是否展开 */
  reportVisible: boolean;
  /** 已选举报原因（空表示未选） */
  reportReason: ReportReason | '';
  /** 补充说明（选填） */
  reportNote: string;
  /** 输入框是否聚焦（只驱动描边，不参与判分） */
  inputFocused: boolean;
}

interface PracticeCustom {
  /** 本题开始时间（算作答耗时） */
  startedAt: number;
  /** 本次抽题的来源限定（复习入口带过来） */
  onlyReview: boolean;
  /** 题库入口带过来的场景限定 */
  categoryId: number;
  /** 题库入口带过来的节日限定 */
  festival: string;
  loadQuestion(): Promise<void>;
  currentAnswer(): string;
  parseOptions(options: Record<string, string | undefined>): void;
  onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onInputFocus(): void;
  onInputBlur(): void;
  onPickChip(event: WechatMiniprogram.TouchEvent): void;
  onUnpickWord(event: WechatMiniprogram.TouchEvent): void;
  onSubmit(): Promise<void>;
  onNext(): void;
  onSwitchMode(event: WechatMiniprogram.TouchEvent): void;
  onToggleFavorite(): Promise<void>;
  onReport(): void;
  onReportCancel(): void;
  onReportMask(): void;
  onPickReason(event: WechatMiniprogram.TouchEvent): void;
  onReportNote(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onReportSubmit(): void;
  onBack(): void;
  onRetry(): void;
}

/** 举报原因（严格四选一，与后端 @IsIn 校验一一对应）。 */
interface ReportReasonItem {
  label: string;
  value: ReportReason;
  hint: string;
}

const REPORT_REASONS: ReportReasonItem[] = [
  { label: '翻译或英文有误', value: 'wrong', hint: '中文对不上、英文有语法问题' },
  { label: '配图与句子不符', value: 'image', hint: '图和内容不匹配、画错' },
  { label: '内容不适当', value: 'inappropriate', hint: '敏感、不适或误导' },
  { label: '其他问题', value: 'other', hint: '音标、解析、其他' },
];

Page<PracticeData, PracticeCustom>({
  data: {
    question: null,
    result: EMPTY_RESULT,
    answer: '',
    chips: [],
    picked: [],
    mode: getAnswerMode(),
    submitting: false,
    flipped: false,
    loading: true,
    errorText: '',
    imageUrl: '',
    progressText: '',
    percent: 0,
    xpText: '',
    achievementText: '',
    favorited: false,
    reporting: false,
    inputFocused: false,
    reportVisible: false,
    reportReason: '',
    reportNote: '',
    reasons: REPORT_REASONS,
  },

  startedAt: 0,
  onlyReview: false,
  categoryId: 0,
  festival: '',

  async onLoad(options: Record<string, string | undefined>) {
    this.parseOptions(options);
    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    await this.loadQuestion();
  },

  /** 解析页面参数（复习入口 / 题库限定）。 */
  parseOptions(options: Record<string, string | undefined>) {
    this.onlyReview = options.source === 'review';
    this.categoryId = Number(options.categoryId ?? 0) || 0;
    this.festival = options.festival ? decodeURIComponent(options.festival) : '';
  },

  /** 抽下一张卡。 */
  async loadQuestion() {
    this.setData({ loading: true, errorText: '' });
    try {
      const difficulty = getDifficulty();
      const params: NextQuestionParams = {};
      if (this.onlyReview) {
        // 纯复习不给难度：难度只作用于新题，复习题必须按间隔排期走
        params.source = 'review';
      } else {
        params.difficulty = difficulty;
        if (this.categoryId) {
          params.categoryId = this.categoryId;
        }
        if (this.festival) {
          params.festival = this.festival;
        }
      }
      const question = await fetchNextQuestion(params);
      const goal = question.todayGoal || 0;
      const percent = goal > 0 ? Math.max(0, Math.min(100, Math.round((question.todayDone / goal) * 100))) : 0;
      // 拼词词块恒定下发；万一老题缺词块，退回默写模式，避免「无词可点」卡死
      const words = question.words ?? [];
      const mode: AnswerMode = words.length === 0 ? 'input' : this.data.mode;
      this.setData({
        question,
        result: EMPTY_RESULT,
        answer: '',
        mode,
        picked: [],
        chips: words.map((text, index) => ({ key: `w${index}`, text, used: false })),
        flipped: false,
        loading: false,
        submitting: false,
        imageUrl: absoluteUrl(question.imageUrl),
        progressText: goal > 0 ? `${question.todayDone} / ${goal}` : '',
        percent,
        xpText: '',
        achievementText: '',
        favorited: false,
      });
      this.startedAt = Date.now();
    } catch (error) {
      this.setData({ loading: false, errorText: '抽题失败，请检查网络后重试' });
      showError(error, '抽题失败，请稍后重试');
    }
  },

  /** 当前答案（输入模式取输入框，拼词模式取已选词）。 */
  currentAnswer(): string {
    if (this.data.mode === 'assemble') {
      return this.data.picked.map((item) => item.text).join(' ');
    }
    return this.data.answer.trim();
  },

  /** 输入框输入。 */
  /** 输入框聚焦态（只影响描边，不影响取值）。 */
  onInputFocus() {
    this.setData({ inputFocused: true });
  },

  onInputBlur() {
    this.setData({ inputFocused: false });
  },

  onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ answer: event.detail.value });
  },

  /** 点选词块。 */
  onPickChip(event: WechatMiniprogram.TouchEvent) {
    if (this.data.flipped) {
      return;
    }
    const index = Number(event.currentTarget.dataset.index as string);
    const chip = this.data.chips[index];
    if (!chip || chip.used) {
      return;
    }
    const chips = this.data.chips.slice();
    chips[index] = { ...chip, used: true };
    this.setData({ chips, picked: this.data.picked.concat({ key: chip.key, text: chip.text }) });
  },

  /** 退回已选词。 */
  onUnpickWord(event: WechatMiniprogram.TouchEvent) {
    if (this.data.flipped) {
      return;
    }
    const index = Number(event.currentTarget.dataset.index as string);
    const word = this.data.picked[index];
    if (!word) {
      return;
    }
    const chips = this.data.chips.map((chip) => (chip.key === word.key ? { ...chip, used: false } : chip));
    this.setData({ chips, picked: this.data.picked.filter((_, i) => i !== index) });
  },

  /** 提交答案 → 翻转。 */
  async onSubmit() {
    const question = this.data.question;
    if (!question || this.data.submitting || this.data.flipped) {
      return;
    }
    const answer = this.currentAnswer();
    if (!answer) {
      toast(this.data.mode === 'assemble' ? '先拼出这句话吧' : '先写出这句话吧');
      return;
    }
    this.setData({ submitting: true });
    try {
      const elapsedMs = this.startedAt > 0 ? Date.now() - this.startedAt : 0;
      const result = await submitAnswer(question.sentenceId, answer, this.data.mode, Math.min(elapsedMs, 3_600_000));
      const xp = (result.xpEarned ?? 0) + (result.goalBonus ?? 0);
      const fresh = (result.newAchievements ?? []).map((item) => item.name).join('、');
      const goal = result.todayGoal || 0;
      this.setData({
        result,
        submitting: false,
        flipped: true,
        favorited: result.favorited,
        xpText: xp > 0 ? `+${xp} XP` : '',
        achievementText: fresh ? `解锁成就：${fresh}` : '',
        progressText: goal > 0 ? `${result.todayDone} / ${goal}` : '',
        percent: goal > 0 ? Math.max(0, Math.min(100, Math.round((result.todayDone / goal) * 100))) : 0,
      });
      haptic(result.isCorrect ? 'light' : 'medium');
      if (result.isCorrect) {
        toastSuccess('答对了');
      }
    } catch (error) {
      this.setData({ submitting: false });
      showError(error);
    }
  },

  /** 下一题。 */
  onNext() {
    if (this.data.loading) {
      return;
    }
    void this.loadQuestion();
  },

  /** 切换作答模式（按产品约定：切模式即重抽一张）。 */
  onSwitchMode(event: WechatMiniprogram.TouchEvent) {
    const mode = event.currentTarget.dataset.mode as AnswerMode;
    if (mode !== 'input' && mode !== 'assemble') {
      return;
    }
    if (mode === this.data.mode) {
      return;
    }
    setAnswerMode(mode);
    this.setData({ mode });
    void this.loadQuestion();
  },

  /** 收藏 / 取消收藏。 */
  async onToggleFavorite() {
    const question = this.data.question;
    if (!question) {
      return;
    }
    try {
      const res = await toggleFavorite(question.sentenceId);
      this.setData({ favorited: res.favorited });
      toast(res.favorited ? '已收藏' : '已取消收藏');
    } catch (error) {
      showError(error);
    }
  },

  /**
   * 反馈这道题：打开底部弹层，原因四选一（后端 @IsIn 只认这四个值）
   * + 可补充说明，一步提交。不用 wx.showActionSheet/showModal：
   * 两步原生弹窗在各端样式割裂，而且模拟器里 action sheet 只剩遮罩不渲染面板，
   * 自定义弹层风格统一、键盘遮挡自适应。
   */
  onReport(): void {
    const sentenceId = this.data.result.sentenceId;
    if (this.data.reporting || sentenceId <= 0) {
      return;
    }
    this.setData({ reportVisible: true, reportReason: '', reportNote: '' });
  },

  onReportCancel(): void {
    if (this.data.reporting) {
      return;
    }
    this.setData({ reportVisible: false });
  },

  /** 阻止点击遮罩关闭弹层（须显式取消，防止误触丢填写内容）。 */
  onReportMask(): void {},

  onPickReason(event: WechatMiniprogram.TouchEvent): void {
    this.setData({ reportReason: event.currentTarget.dataset.reason as ReportReason });
  },

  onReportNote(event: WechatMiniprogram.CustomEvent<{ value: string }>): void {
    this.setData({ reportNote: event.detail.value });
  },

  onReportSubmit(): void {
    const reason = this.data.reportReason as ReportReason;
    if (this.data.reporting || !reason) {
      return;
    }
    this.setData({ reporting: true });
    const description = this.data.reportNote.trim().slice(0, 500) || undefined;
    void reportSentence({ sentenceId: this.data.result.sentenceId, reason, description })
      .then(() => {
        this.setData({ reporting: false, reportVisible: false });
        toastSuccess('已收到，感谢你的反馈');
      })
      .catch((error: unknown) => {
        this.setData({ reporting: false });
        showError(error);
      });
  },

  /** 关闭：举报弹层开着先只关它，否则回上一页 / 回首页。 */
  onBack() {
    if (this.data.reportVisible) {
      this.onReportCancel();
      return;
    }
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/index/index' });
  },

  /** 失败重试。 */
  onRetry() {
    void this.loadQuestion();
  },

  /** 分享：答过之后把这道题的英文分享出去（题面不泄题）。 */
  onShareAppMessage() {
    const english = this.data.result?.sentenceEn ?? '';
    const share: { title: string; path: string; imageUrl?: string } = {
      title: english ? `今天学到一句：${english}` : '看中文写英文，一天一句就够了',
      path: '/pages/index/index',
    };
    if (english && this.data.imageUrl) {
      share.imageUrl = this.data.imageUrl;
    }
    return share;
  },
});
