/**
 * `qr-image`（零依赖二维码生成库）的最小类型声明。
 * 上游只发 JS 不带 d.ts；本项目只用到同步生成 PNG 的能力，故按需声明。
 */
declare module 'qr-image' {
  /** 同步生成图片 Buffer。 */
  export function imageSync(
    text: string,
    options?: {
      type?: 'png' | 'svg' | 'pdf' | 'eps';
      /** 每个模块的像素尺寸（默认 5） */
      size?: number;
      /** 白边宽度（模块数，默认 4） */
      margin?: number;
      /** 纠错等级（默认 M） */
      ec_level?: 'L' | 'M' | 'Q' | 'H';
    },
  ): Buffer;

  /** 生成可读流（本服务未用）。 */
  export function image(text: string, options?: Record<string, unknown>): NodeJS.ReadableStream;
}
