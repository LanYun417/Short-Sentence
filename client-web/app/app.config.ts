/**
 * 应用级运行时配置（@nuxt/ui 主题令牌）。
 *
 * @nuxt/ui v4 的语义色（primary / success / warning / error…）在启动时由
 * 运行时插件读取本文件的 `ui.colors` 生成 CSS 变量（--ui-color-primary-500 等），
 * 因此这里必须写成 Tailwind 色板名，不能写具体色值。
 *
 * 配色沿用本项目改造前的视觉语义：sky 为主色、slate 为中性色，
 * 保证重构后与既有设计不产生割裂。
 */
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'sky',
      secondary: 'sky',
      success: 'green',
      info: 'sky',
      warning: 'amber',
      error: 'red',
      neutral: 'slate',
    },
  },
});
