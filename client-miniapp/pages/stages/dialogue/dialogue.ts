/**
 * 关卡对话：用户与 1~3 个 AI 角色围绕目标进行英语角色扮演。
 *
 * 规则（服务端权威）：
 * - 通关 = 聊够 minTurns 轮 **且** 模型判定目标达成；
 * - 达到 maxTurns 仍未达成 → 本局结束但可重来；
 * - 翻译开关随每条消息上送（服务端 translationUsed 粘性），全程关翻译有额外加成。
 *
 * 注意：`PATCH /:id/dialogue/translation` 不在小程序里调用——wx.request 不支持 PATCH，
 * 而发消息接口的 showTranslation 已足够持久化该偏好。
 */
import { claimStage, endDialogue, sendStageMessage, startDialogue } from '../../../services/stage';
import type { StageDialogueHint, StageDialogueView } from '../../../services/types';
import { isLoggedIn, sessionReady } from '../../../utils/auth';
import { haptic, showError, toast, toastSuccess } from '../../../utils/feedback';
import { goLogin } from '../../../utils/nav';

/** 一条聊天气泡（视图模型）。 */
interface Bubble {
  key: string;
  role: 'npc' | 'user';
  speaker: string;
  emoji: string;
  en: string;
  zh: string;
}

interface DialogueData {
  stageId: number;
  title: string;
  goal: string;
  intro: string;
  messages: Bubble[];
  hints: StageDialogueHint[];
  showTranslation: boolean;
  input: string;
  turnCount: number;
  minTurns: number;
  maxTurns: number;
  sending: boolean;
  loading: boolean;
  errorText: string;
  ended: boolean;
  cleared: boolean;
  summary: string;
  highlights: string[];
  improvements: string[];
  anchor: string;
  claimTip: string;
  claimed: boolean;
}

interface DialogueCustom {
  stageId: number;
  /** 气泡 key 自增序号 */
  seq: number;
  /** speaker(nameEn) → 展示信息 */
  roleMap: Record<string, { emoji: string; label: string }>;
  load(restart: boolean): Promise<void>;
  applyView(view: StageDialogueView): void;
  toBubble(message: {
    role: 'npc' | 'user';
    speaker: string | null;
    contentEn: string;
    contentZh: string | null;
  }): Bubble;
  onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onPickHint(event: WechatMiniprogram.TouchEvent): void;
  onSend(): Promise<void>;
  onToggleTranslation(): void;
  onEnd(): void;
  doEnd(): Promise<void>;
  onClaim(): Promise<void>;
  onRestart(): void;
  onBack(): void;
  onRetry(): void;
}

Page<DialogueData, DialogueCustom>({
  data: {
    stageId: 0,
    title: '',
    goal: '',
    intro: '',
    messages: [],
    hints: [],
    showTranslation: true,
    input: '',
    turnCount: 0,
    minTurns: 0,
    maxTurns: 0,
    sending: false,
    loading: true,
    errorText: '',
    ended: false,
    cleared: false,
    summary: '',
    highlights: [],
    improvements: [],
    anchor: '',
    claimTip: '',
    claimed: false,
  },

  stageId: 0,
  seq: 0,
  roleMap: {},

  async onLoad(options: Record<string, string | undefined>) {
    this.stageId = Number(options.id ?? 0);
    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    if (!this.stageId) {
      this.setData({ loading: false, errorText: '关卡不存在' });
      return;
    }
    await this.load(false);
  },

  /** 进入 / 重开一局。 */
  async load(restart: boolean) {
    this.setData({ loading: true, errorText: '' });
    try {
      const view = await startDialogue(this.stageId, restart);
      this.applyView(view);
    } catch (error) {
      this.setData({ loading: false, errorText: '进入关卡失败，请稍后重试' });
      showError(error);
    }
  },

  /** 把服务端视图铺到页面。 */
  applyView(view: StageDialogueView) {
    const roleMap: Record<string, { emoji: string; label: string }> = {};
    view.roles.forEach((role) => {
      roleMap[role.nameEn] = { emoji: role.emoji || '💬', label: role.nameEn || role.name };
    });
    this.roleMap = roleMap;
    this.seq = 0;
    const messages = view.messages.map((message) => this.toBubble(message));
    const ended = view.status !== 'active';
    this.setData({
      title: view.title,
      goal: view.goal,
      intro: view.intro,
      messages,
      hints: view.hints ?? [],
      showTranslation: view.showTranslation !== false,
      turnCount: view.turnCount,
      minTurns: view.minTurns,
      maxTurns: view.maxTurns,
      loading: false,
      ended,
      cleared: view.cleared,
      summary: view.summary || view.feedback?.summary || '',
      highlights: view.feedback?.highlights ?? [],
      improvements: view.feedback?.improvements ?? [],
      anchor: messages.length > 0 ? `m${messages.length - 1}` : '',
      claimed: false,
      claimTip: '',
    });
    wx.setNavigationBarTitle({ title: view.title || '闯关' });
  },

  /** 服务端消息 → 气泡。 */
  toBubble(message: {
    role: 'npc' | 'user';
    speaker: string | null;
    contentEn: string;
    contentZh: string | null;
  }): Bubble {
    const key = `b${this.seq}`;
    this.seq += 1;
    if (message.role === 'user') {
      return {
        key,
        role: 'user',
        speaker: '',
        emoji: '🧑',
        en: message.contentEn,
        zh: message.contentZh ?? '',
      };
    }
    const role = message.speaker ? this.roleMap[message.speaker] : undefined;
    return {
      key,
      role: 'npc',
      speaker: role?.label ?? message.speaker ?? '',
      emoji: role?.emoji ?? '💬',
      en: message.contentEn,
      zh: message.contentZh ?? '',
    };
  },

  /** 输入框。 */
  onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ input: event.detail.value });
  },

  /** 点候选短句填入输入框（不直接发送，留给用户改）。 */
  onPickHint(event: WechatMiniprogram.TouchEvent) {
    const en = String(event.currentTarget.dataset.en ?? '');
    if (en) {
      this.setData({ input: en });
    }
  },

  /** 发送一句。 */
  async onSend() {
    if (this.data.sending || this.data.ended) {
      return;
    }
    const content = this.data.input.trim();
    if (!content) {
      toast('先说点什么吧');
      return;
    }
    if (!/[A-Za-z0-9]/.test(content)) {
      toast('这一关请用英语说一句');
      return;
    }

    // 乐观追加用户气泡
    const optimistic = this.toBubble({ role: 'user', speaker: null, contentEn: content, contentZh: null });
    const messages = this.data.messages.concat(optimistic);
    this.setData({
      messages,
      input: '',
      sending: true,
      anchor: `m${messages.length - 1}`,
    });

    try {
      const result = await sendStageMessage(this.stageId, content, this.data.showTranslation);
      const replies = result.replies.map((reply) =>
        this.toBubble({
          role: 'npc',
          speaker: reply.speaker,
          contentEn: reply.contentEn,
          contentZh: reply.contentZh,
        }),
      );
      const next = this.data.messages.concat(replies);
      this.setData({
        messages: next,
        hints: result.hints ?? [],
        turnCount: result.turnCount,
        sending: false,
        ended: result.ended,
        cleared: result.cleared,
        summary: result.summary || result.feedback?.summary || '',
        highlights: result.feedback?.highlights ?? [],
        improvements: result.feedback?.improvements ?? [],
        anchor: `m${next.length - 1}`,
      });
      haptic('light');
      if (result.cleared) {
        toastSuccess('目标达成');
      }
    } catch (error) {
      // 发送失败：回滚这条气泡并还原输入，避免与服务端历史不一致
      this.setData({
        messages: this.data.messages.filter((item) => item.key !== optimistic.key),
        input: content,
        sending: false,
        anchor: this.data.messages.length > 0 ? `m${this.data.messages.length - 1}` : '',
      });
      showError(error, '发送失败，请重试');
    }
  },

  /** 切换中文翻译显示。 */
  onToggleTranslation() {
    this.setData({ showTranslation: !this.data.showTranslation });
  },

  /** 主动结束对话。 */
  onEnd() {
    wx.showModal({
      title: '结束本局',
      content: '结束后本局不计通关，可以重新开始。确定结束？',
      confirmText: '结束',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        void this.doEnd();
      },
    });
  },

  /** 真正结束。 */
  async doEnd() {
    try {
      const view = await endDialogue(this.stageId);
      this.applyView(view);
    } catch (error) {
      showError(error);
    }
  },

  /** 领取通关奖励。 */
  async onClaim() {
    if (this.data.claimed) {
      return;
    }
    try {
      const result = await claimStage(this.stageId);
      this.setData({
        claimed: true,
        claimTip: result.alreadyClaimed ? '奖励此前已领取' : `获得 ${result.xp} XP`,
      });
      if (!result.alreadyClaimed) {
        toastSuccess(`+${result.xp} XP`);
      }
    } catch (error) {
      showError(error);
    }
  },

  /** 再来一局。 */
  onRestart() {
    void this.load(true);
  },

  /** 返回：有栈就回上一页。 */
  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.redirectTo({ url: '/pages/stages/index/index' });
  },

  /** 进入失败重试。 */
  onRetry() {
    void this.load(false);
  },
});
