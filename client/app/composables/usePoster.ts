/**
 * 打卡海报（html2canvas 动态加载 + 下载）。
 * 刻意动态 import：海报只在打卡完成时用到，不进首屏包。
 */
import type { CheckinResult } from '~/types';

export function usePoster() {
  /** 生成中 */
  const generating = ref(false);

  /**
   * 渲染节点为 PNG 并触发浏览器下载。
   * @param element 海报 DOM 节点（需已在文档中，建议离屏但非 display:none）
   */
  async function generate(element: HTMLElement): Promise<void> {
    generating.value = true;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(element, {
        // 图片走同源 /static，useCORS 兜底异常场景
        useCORS: true,
        backgroundColor: '#f8fafc',
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `短句打卡-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      generating.value = false;
    }
  }

  return { generating, generate };
}

/** 海报所需的当日代表句（取第一条高亮）。 */
export function posterHighlight(checkin: CheckinResult): { sentenceEn: string; translationZh: string } | null {
  return checkin.highlights[0] ?? null;
}
