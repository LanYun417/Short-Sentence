/**
 * 编辑资料：头像 / 昵称 / 签名 / 性别 / 生日。
 *
 * 头像走 `wx.uploadFile`（单文件），其余字段走 `PUT /client/auth/me`。
 * 修改密码需要邮箱验证码三段式，小程序暂不提供（可在 Web 端改）。
 */
import type { ClientUserProfile } from '../../services/types';
import { request, uploadFile } from '../../utils/request';
import { fetchProfile, isLoggedIn, sessionReady } from '../../utils/auth';
import { showError, toast, toastSuccess } from '../../utils/feedback';
import { absoluteUrl } from '../../utils/format';
import { goLogin } from '../../utils/nav';
import { getCachedUser, saveCachedUser } from '../../utils/storage';

/** 性别选项。 */
const GENDERS = [
  { value: 'secret', label: '保密' },
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
];

interface EditData {
  genders: typeof GENDERS;
  nickname: string;
  signature: string;
  gender: string;
  birthday: string;
  avatarUrl: string;
  loading: boolean;
  saving: boolean;
  uploading: boolean;
}

interface EditCustom {
  applyUser(user: ClientUserProfile): void;
  onNickname(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onSignature(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onPickGender(event: WechatMiniprogram.TouchEvent): void;
  onBirthday(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  onPickAvatar(): Promise<void>;
  onSave(): Promise<void>;
}

Page<EditData, EditCustom>({
  data: {
    genders: GENDERS,
    nickname: '',
    signature: '',
    gender: 'secret',
    birthday: '',
    avatarUrl: '',
    loading: true,
    saving: false,
    uploading: false,
  },

  async onLoad() {
    await sessionReady();
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    const cached = getCachedUser();
    if (cached) {
      this.applyUser(cached);
    }
    try {
      const user = await fetchProfile();
      this.applyUser(user);
    } catch {
      // 离线时用缓存显示，不打断编辑
      this.setData({ loading: false });
    }
  },

  /** 把资料写进表单。 */
  applyUser(user: ClientUserProfile) {
    this.setData({
      nickname: user.nickname ?? '',
      signature: user.signature ?? '',
      gender: user.gender || 'secret',
      birthday: user.birthday ? user.birthday.slice(0, 10) : '',
      avatarUrl: absoluteUrl(user.avatarUrl),
      loading: false,
    });
  },

  /** 昵称。 */
  onNickname(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ nickname: event.detail.value });
  },

  /** 签名。 */
  onSignature(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ signature: event.detail.value });
  },

  /** 性别。 */
  onPickGender(event: WechatMiniprogram.TouchEvent) {
    const value = String(event.currentTarget.dataset.value ?? '');
    if (GENDERS.some((item) => item.value === value)) {
      this.setData({ gender: value });
    }
  },

  /** 生日。 */
  onBirthday(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ birthday: event.detail.value });
  },

  /** 选图并上传头像。 */
  async onPickAvatar() {
    if (this.data.uploading) {
      return;
    }
    try {
      const picked = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
      });
      const filePath = picked.tempFiles[0]?.tempFilePath;
      if (!filePath) {
        return;
      }
      this.setData({ uploading: true });
      const user = await uploadFile<ClientUserProfile>('/client/auth/avatar', filePath, { name: 'file' });
      saveCachedUser(user);
      this.applyUser(user);
      this.setData({ uploading: false });
      toastSuccess('头像已更新');
    } catch (error) {
      this.setData({ uploading: false });
      showError(error, '头像上传失败');
    }
  },

  /** 保存资料。 */
  async onSave() {
    const nickname = this.data.nickname.trim();
    if (!nickname) {
      toast('昵称不能为空');
      return;
    }
    if (this.data.saving) {
      return;
    }
    this.setData({ saving: true });
    try {
      const payload: Record<string, unknown> = { nickname, gender: this.data.gender };
      if (this.data.signature.trim()) {
        payload.signature = this.data.signature.trim();
      }
      if (this.data.birthday) {
        payload.birthday = this.data.birthday;
      }
      const user = await request<ClientUserProfile>('/client/auth/me', { method: 'PUT', data: payload });
      saveCachedUser(user);
      this.setData({ saving: false });
      toastSuccess('已保存');
      setTimeout(() => {
        wx.navigateBack();
      }, 600);
    } catch (error) {
      this.setData({ saving: false });
      showError(error);
    }
  },
});
