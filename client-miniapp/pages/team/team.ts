/**
 * 小分队：组队（自建 / 凭码加入 / 随机匹配）+ 群聊。
 *
 * 后端是游标分页的 REST 群聊（无 WebSocket），页面可见时按 8 秒轮询最新一页；
 * 改名接口是 PATCH（wx.request 不支持），故小程序不提供改名。
 */
import {
  createTeam,
  fetchMyTeam,
  fetchTeamMessages,
  joinTeam,
  leaveTeam,
  matchTeam,
  recallTeamMessage,
  renameTeam,
  sendTeamMessage,
} from '../../services/team';
import type { TeamMessage, TeamView } from '../../services/types';
import { isLoggedIn, sessionReady } from '../../utils/auth';
import { showError, toast, toastSuccess } from '../../utils/feedback';
import { goLogin } from '../../utils/nav';

/** 轮询间隔（毫秒）。 */
const POLL_INTERVAL = 8000;

/** 消息视图模型。 */
interface MessageView {
  id: number;
  nickname: string;
  content: string;
  time: string;
  isMe: boolean;
  canRecall: boolean;
  recalled: boolean;
}

/** 队员视图模型（头像位只放首字，避免整段昵称挤进圆圈）。 */
interface MemberView {
  userId: number;
  label: string;
  initial: string;
  checkedIn: boolean;
  isMe: boolean;
}

interface TeamData {
  team: TeamView | null;
  members: MemberView[];
  messages: MessageView[];
  input: string;
  nameInput: string;
  codeInput: string;
  loading: boolean;
  busy: boolean;
  sending: boolean;
  anchor: string;
}

interface TeamCustom {
  timer: number;
  seq: number;
  refresh(): Promise<void>;
  loadMessages(): Promise<void>;
  startPolling(): void;
  stopPolling(): void;
  toView(message: TeamMessage): MessageView;
  toMembers(team: TeamView): MemberView[];
  onName(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onCode(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onCreate(): Promise<void>;
  onJoin(): Promise<void>;
  onMatch(): Promise<void>;
  onLeave(): void;
  onRename(): void;
  onSend(): Promise<void>;
  onRecall(event: WechatMiniprogram.TouchEvent): void;
}

Page<TeamData, TeamCustom>({
  data: {
    team: null,
    members: [],
    messages: [],
    input: '',
    nameInput: '',
    codeInput: '',
    loading: true,
    busy: false,
    sending: false,
    anchor: '',
  },

  timer: 0,
  seq: 0,

  async onShow() {
    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    await this.refresh();
    this.startPolling();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  /** 队员 → 视图模型。 */
  toMembers(team: TeamView): MemberView[] {
    return team.members.map((member) => ({
      userId: member.userId,
      label: member.isMe ? '我' : member.nickname,
      initial: member.nickname ? member.nickname.charAt(0) : '?',
      checkedIn: member.checkedIn,
      isMe: member.isMe,
    }));
  },

  /** 拉我的小队，有队伍就拉一次消息。 */
  async refresh() {
    try {
      const team = await fetchMyTeam();
      this.setData({
        team,
        members: team ? this.toMembers(team) : [],
        loading: false,
      });
      if (team) {
        await this.loadMessages();
      } else {
        this.setData({ messages: [] });
      }
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },

  /** 拉最新一页消息。 */
  async loadMessages() {
    try {
      const page = await fetchTeamMessages();
      const messages = page.list.map((item) => this.toView(item));
      this.setData({
        messages,
        anchor: messages.length > 0 ? `m${messages.length - 1}` : '',
      });
    } catch {
      // 轮询失败静默：下一轮会自愈，不打扰用户
    }
  },

  /** 开始轮询。 */
  startPolling() {
    this.stopPolling();
    this.timer = setInterval(() => {
      if (this.data.team) {
        void this.loadMessages();
      }
    }, POLL_INTERVAL) as unknown as number;
  },

  /** 停止轮询。 */
  stopPolling() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = 0;
    }
  },

  /** 消息 → 视图模型。 */
  toView(message: TeamMessage): MessageView {
    this.seq += 1;
    const raw = message.createdAt ?? '';
    return {
      id: message.id,
      nickname: message.nickname || '队友',
      content: message.status === 'recalled' ? '这条消息已撤回' : message.content,
      time: raw.length >= 16 ? raw.slice(11, 16) : '',
      isMe: message.isMe,
      canRecall: message.canRecall,
      recalled: message.status === 'recalled',
    };
  },

  /** 队名输入。 */
  onName(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ nameInput: event.detail.value });
  },

  /** 组队码输入。 */
  onCode(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ codeInput: event.detail.value });
  },

  /** 聊天输入。 */
  onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ input: event.detail.value });
  },

  /** 创建队伍。 */
  async onCreate() {
    const name = this.data.nameInput.trim();
    if (!name) {
      toast('给小队起个名字');
      return;
    }
    if (this.data.busy) {
      return;
    }
    this.setData({ busy: true });
    try {
      await createTeam(name);
      this.setData({ busy: false, nameInput: '' });
      toastSuccess('小队已创建');
      await this.refresh();
      this.startPolling();
    } catch (error) {
      this.setData({ busy: false });
      showError(error);
    }
  },

  /** 凭码加入。 */
  async onJoin() {
    const code = this.data.codeInput.trim().toUpperCase();
    if (!code) {
      toast('填一下组队码');
      return;
    }
    if (this.data.busy) {
      return;
    }
    this.setData({ busy: true });
    try {
      await joinTeam(code);
      this.setData({ busy: false, codeInput: '' });
      toastSuccess('已加入小队');
      await this.refresh();
      this.startPolling();
    } catch (error) {
      this.setData({ busy: false });
      showError(error);
    }
  },

  /** 随机匹配。 */
  async onMatch() {
    if (this.data.busy) {
      return;
    }
    this.setData({ busy: true });
    try {
      await matchTeam();
      this.setData({ busy: false });
      toastSuccess('匹配成功');
      await this.refresh();
      this.startPolling();
    } catch (error) {
      this.setData({ busy: false });
      showError(error);
    }
  },

  /** 退出小队。 */
  onLeave() {
    wx.showModal({
      title: '退出小队',
      content: '退出后将失去队内聊天与组队加成，确定退出？',
      confirmText: '退出',
      confirmColor: '#ef4444',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        void leaveTeam()
          .then(() => {
            this.stopPolling();
            this.setData({ team: null, messages: [] });
            toastSuccess('已退出小队');
          })
          .catch((error: unknown) => {
            showError(error);
          });
      },
    });
  },

  /** 修改小队名（任意成员可改，改完全队可见）。 */
  onRename() {
    const team = this.data.team;
    if (!team) {
      return;
    }
    wx.showModal({
      title: '修改小队名',
      editable: true,
      content: team.name,
      placeholderText: '2~20 个字',
      confirmText: '保存',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        const name = (res.content ?? '').trim();
        if (!name || name === team.name) {
          return;
        }
        void renameTeam(name)
          .then((view) => {
            this.setData({ team: view, members: this.toMembers(view) });
            toastSuccess('已改名');
          })
          .catch((error: unknown) => {
            showError(error);
          });
      },
    });
  },

  /** 发消息。 */
  async onSend() {
    const content = this.data.input.trim();
    if (!content || this.data.sending) {
      return;
    }
    this.setData({ sending: true });
    try {
      await sendTeamMessage(content);
      this.setData({ input: '', sending: false });
      await this.loadMessages();
    } catch (error) {
      this.setData({ sending: false });
      showError(error);
    }
  },

  /** 长按撤回自己的消息。 */
  onRecall(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index as string);
    const message = this.data.messages[index];
    if (!message || !message.canRecall) {
      return;
    }
    wx.showModal({
      title: '撤回消息',
      content: '2 分钟内可以撤回这条消息。',
      confirmText: '撤回',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        void recallTeamMessage(message.id)
          .then(() => this.loadMessages())
          .catch((error: unknown) => {
            showError(error);
          });
      },
    });
  },
});
