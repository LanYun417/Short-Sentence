/**
 * CSV 导出通用逻辑。
 *
 * 泛化来源：题库、客户端用户与三类日志（登录 / 操作 / HTTP）共 5 处导出，
 * 逐字重复同一套「闸门 → 请求 → 下载 → 提示 → 复位」，却已经长出三种差异：
 * 1. 失败文案两套——日志页只说「导出失败」，题库/用户页会提醒「可能超过单次导出行数上限」；
 * 2. 请求中闸门 5 处各写一遍（漏一处的页面就能被连点出重复下载）；
 * 3. 文件名与日期后缀格式 5 处各拼一次，改一处就漂移。
 *
 * 统一口径：
 * - 成功提示统一「导出成功」；
 * - 失败**不再弹第二个框**：请求层已把后端的具体原因（如「导出超过行数上限」）展示过，
 *   页面再补一句只会叠出两个错误框——与 `useBatchDelete` 的「失败提示由请求层统一弹出」同口径；
 * - 文件名统一 `<业务名>_<YYYYMMDD_HHmmss>.csv`。
 */
import { ElMessage } from '@/utils/element';
import { formatDate } from '@/utils/format';
import { downloadBlob } from '@/utils/download';

/** 单次导出的上下文（调用方负责把分页参数剥掉）。 */
export interface CsvExportContext<T> {
  /** 导出接口（返回 Blob） */
  api: (params: T) => Promise<Blob>;
  /** 查询参数 */
  params: T;
  /** 文件名主干（不含日期后缀与扩展名），如「题库」「HTTP访问日志」 */
  name: string;
}

/**
 * CSV 导出。
 * @returns 请求中状态与导出入口
 */
export function useCsvExport() {
  /** 请求进行中（防连点重复下载） */
  const exporting = ref(false);

  /**
   * 执行一次导出。
   * @param context 接口、查询参数与文件名主干
   */
  async function exportCsv<T>(context: CsvExportContext<T>): Promise<void> {
    if (exporting.value) {
      return;
    }
    exporting.value = true;
    try {
      const blob = await context.api(context.params);
      downloadBlob(blob, `${context.name}_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}.csv`);
      ElMessage.success('导出成功');
    } catch {
      // 不在这里弹错误框：请求层已展示后端返回的具体原因（含「超过导出行数上限」），
      // 再补一句「导出失败」只会让用户看到两个 toast。这里只负责复位状态。
    } finally {
      exporting.value = false;
    }
  }

  return { exporting, exportCsv };
}
