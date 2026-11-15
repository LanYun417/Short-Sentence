import type { ClientUserProfile } from '../services/types';

declare global {
  /** App 全局数据（app.ts 写入，页面按需读取）。 */
  interface IAppOption {
    globalData: {
      user: ClientUserProfile | null;
    };
  }
}

export {};
