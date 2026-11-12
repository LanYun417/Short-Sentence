/**
 * ECharts 按需引入（客户端共享注册入口）。
 *
 * 与 admin 的 `utils/echarts.ts` 同款方式：只注册实际用到的图表类型/组件，
 * 避免全量引入 echarts（约 1.1MB）拖大产物。客户端目前只用柱状图 + 折线图。
 *
 * ⚠️ 按需注册的坑：漏注册的组件只会在控制台打 warning、图表区空白，新增图表时务必在此补充。
 */
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

export default echarts;
