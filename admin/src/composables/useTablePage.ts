/**
 * 三段式列表页（筛选 + 表格 + 分页撑满内容区）的表格高度。
 *
 * 配合 `styles/index.css` 的 `.table-page` 系列类使用：
 * - 宽屏(>=768px)：返回 '100%' 交给 `el-table` 的 height，表头固定、表体在表格内部滚动，
 *   分页常驻内容区底部，不必滑到页尾；
 * - 窄屏(<768px)：返回 undefined，不设定高，退回原来的整页滚动
 *   （筛选条件换行后高度不可控，固定布局会把表格压得过矮）。
 *
 * 只负责高度，不碰页面结构与业务逻辑；页面接入方式见 `.table-page` 注释。
 */
import { computed, type ComputedRef } from 'vue';
import { useMediaQuery } from '@vueuse/core';

export function useTablePage(): { tableHeight: ComputedRef<string | undefined> } {
  const isWideScreen = useMediaQuery('(min-width: 768px)');
  const tableHeight = computed<string | undefined>(() => (isWideScreen.value ? '100%' : undefined));
  return { tableHeight };
}
