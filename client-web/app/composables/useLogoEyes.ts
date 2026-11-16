/**
 * 吉祥物「闭眼」状态：聚焦密码/验证码等敏感输入时，Logo 闭眼表示「不看」。
 *
 * 全局共享（所有 AppLogo 实例都响应），引用计数支持多处输入同时聚焦：
 * 任意一个敏感输入聚焦即闭眼，全部失焦才重新睁眼。
 *
 * 实现说明：用**模块级 ref** 而非 useState——本状态只由客户端 focus/blur 事件
 * 驱动，SSR 永不修改（服务端永远渲染睁眼，各请求间不存在状态泄漏），
 * 且模块级 ref 不依赖 Nuxt 实例上下文，事件处理器里也能安全读写。
 */
import { ref } from 'vue';

/** 当前聚焦中的敏感输入数量（>0 = 闭眼）。导出供 AppLogo 等直接 watch。 */
export const maskCount = ref(0);

/** Logo 是否应闭眼。 */
export function logoEyesClosed(): boolean {
  return maskCount.value > 0;
}

/**
 * 登记一个敏感输入框（返回反登记函数）。
 *
 * 用法：聚焦时 `const release = registerSecretInput()`，失焦/卸载时 `release()`。
 * 组件里配合 onBeforeUnmount 调 release，避免输入框先卸载导致计数不收场。
 */
export function registerSecretInput(): () => void {
  maskCount.value += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    maskCount.value = Math.max(0, maskCount.value - 1);
  };
}

/** 便捷方法：给输入元素绑 focus/blur 自动闭眼（v-bind 到 UInput 等组件）。 */
export function secretInputHandlers(): { onFocus: () => void; onBlur: () => void } {
  let release: (() => void) | null = null;
  return {
    onFocus: () => {
      if (!release) release = registerSecretInput();
    },
    onBlur: () => {
      release?.();
      release = null;
    },
  };
}
