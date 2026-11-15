/**
 * 周学习报告海报（Web 端）。
 *
 * 纯 Canvas 2D 手绘，**不引任何截图/海报库**（项目「零新增运行时依赖」硬约束，
 * html2canvas 这类库会拖进几十 KB 且对字体/圆角还原不稳）。海报内容全部来自
 * 服务端聚合的周报数字，与卡片、分享文案同口径。
 *
 * 拆成两层：
 * - `buildPosterModel`：纯数据 → 展示模型（可单测，不依赖 canvas）；
 * - `drawWeeklyPoster`：模型 → canvas 像素（只做绘制，不做计算）。
 */

/** 海报所需的最小周报形状（与 /client/gamify/weekly-report 返回一致）。 */
export interface WeeklyPosterReport {
  answered: number;
  correct: number;
  accuracy: number;
  activeDays: number;
  xpGained: number;
  newAchievements: number;
  streak: number;
  daily: Array<{ date: string; weekday: string; answered: number; correct: number }>;
  topCategory: { name: string; count: number } | null;
  prevAnswered: number;
  deltaAnswered: number;
}

export interface PosterModel {
  /** 主标题与副标题 */
  title: string;
  subtitle: string;
  /** 三个主指标 */
  stats: Array<{ value: string; label: string }>;
  /** 7 天柱：ratio = 当日答题 / 本周峰值，correctRatio = 答对占比 */
  days: Array<{ label: string; ratio: number; correctRatio: number }>;
  /** 次级信息行（按有值才出现的顺序） */
  lines: string[];
  footer: string;
}

/**
 * 周报 → 海报展示模型。
 *
 * 规则：主指标恒为三项（答题 / 正确率 / 活跃天数）；次级信息按「有内容才出现」
 * 排列，空数据时给一句鼓励而不是留白。
 */
export function buildPosterModel(report: WeeklyPosterReport): PosterModel {
  const maxDaily = Math.max(1, ...report.daily.map((d) => d.answered));
  const accuracyPct = Math.round(report.accuracy * 100);

  const lines: string[] = [`本周获得 ${report.xpGained} 经验`];
  if (report.newAchievements > 0) {
    lines.push(`新解锁 ${report.newAchievements} 个成就`);
  }
  if (report.streak > 0) {
    lines.push(`连续打卡 ${report.streak} 天`);
  }
  if (report.topCategory) {
    lines.push(`最常练「${report.topCategory.name}」（${report.topCategory.count} 题）`);
  }
  lines.push(`比上周${report.deltaAnswered >= 0 ? '多' : '少'} ${Math.abs(report.deltaAnswered)} 题`);

  return {
    title: '本周学习报告',
    subtitle: '周一 00:00 至今',
    stats: [
      { value: `${report.answered}`, label: '本周答题' },
      { value: `${accuracyPct}%`, label: '正确率' },
      { value: `${report.activeDays}/7`, label: '活跃天数' },
    ],
    days: report.daily.map((d) => ({
      label: d.weekday.replace('周', ''),
      ratio: d.answered / maxDaily,
      correctRatio: d.answered > 0 ? d.correct / d.answered : 0,
    })),
    lines,
    footer: '每天一句话，攒成这一周',
  };
}

/** 海报画布逻辑尺寸（2x 输出，分享到微信也清晰）。 */
export const POSTER_WIDTH = 720;

const INK = '#0F172A';
const INK_SOFT = '#64748B';
const INK_FAINT = '#94A3B8';
const BRAND = '#0EA5E9';
const FONT_STACK = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", -apple-system, sans-serif';

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 按模型计算画布高度（内容自然撑开，避免固定高度留白/截断）。 */
export function posterHeight(model: PosterModel): number {
  // 头部 210 + 三指标 150 + 柱状 140 + 信息行（每行 44）+ 页脚 110
  return 210 + 150 + 140 + model.lines.length * 44 + 110;
}

/** 把海报画进 canvas（调用方保证 canvas 尺寸 = POSTER_WIDTH × posterHeight）。 */
export function drawWeeklyPoster(ctx: CanvasRenderingContext2D, model: PosterModel): void {
  const W = POSTER_WIDTH;
  const H = posterHeight(model);
  ctx.clearRect(0, 0, W, H);

  // 白底
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // 头部品牌渐变
  const headerH = 210;
  const gradient = ctx.createLinearGradient(0, 0, W, headerH);
  gradient.addColorStop(0, '#0EA5E9');
  gradient.addColorStop(1, '#4F46E5');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, headerH);

  // 品牌字
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `800 30px ${FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('短句', 56, 78);

  // 「每周一句」小胶囊
  ctx.font = `500 18px ${FONT_STACK}`;
  const pillW = ctx.measureText('每周一句').width + 28;
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  rounded(ctx, 56 + 78, 52, pillW, 36, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('每周一句', 56 + 78 + 14, 78);

  // 标题
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 52px ${FONT_STACK}`;
  ctx.fillText(model.title, 56, 150);
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = `400 22px ${FONT_STACK}`;
  ctx.fillText(model.subtitle, 56, 186);

  // 三主指标
  const statY = headerH + 68;
  const colW = (W - 112) / 3;
  const statColors = [INK, '#059669', BRAND];
  model.stats.forEach((stat, i) => {
    const cx = 56 + colW * i + colW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = statColors[i] ?? INK;
    ctx.font = `800 46px ${FONT_STACK}`;
    ctx.fillText(stat.value, cx, statY);
    ctx.fillStyle = INK_FAINT;
    ctx.font = `400 20px ${FONT_STACK}`;
    ctx.fillText(stat.label, cx, statY + 34);
  });

  // 7 天柱状
  const barsTop = headerH + 150;
  const barsBase = barsTop + 96;
  const barColW = (W - 112) / Math.max(1, model.days.length);
  const barW = Math.min(44, barColW * 0.5);
  model.days.forEach((day, i) => {
    const cx = 56 + barColW * i + barColW / 2;
    const h = day.ratio > 0 ? Math.max(10, day.ratio * 96) : 6;
    // 底色（当日总量）
    ctx.fillStyle = day.ratio > 0 ? 'rgba(14,165,233,0.25)' : '#E2E8F0';
    rounded(ctx, cx - barW / 2, barsBase - h, barW, h, 6);
    ctx.fill();
    // 答对部分（叠深色）
    if (day.ratio > 0 && day.correctRatio > 0) {
      const ch = h * day.correctRatio;
      ctx.fillStyle = BRAND;
      rounded(ctx, cx - barW / 2, barsBase - ch, barW, ch, 6);
      ctx.fill();
    }
    ctx.fillStyle = INK_FAINT;
    ctx.font = `400 20px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.fillText(day.label, cx, barsBase + 32);
  });

  // 次级信息
  let lineY = barsBase + 84;
  ctx.textAlign = 'left';
  model.lines.forEach((line) => {
    ctx.fillStyle = line.startsWith('比上周') ? '#059669' : INK_SOFT;
    ctx.font = `400 24px ${FONT_STACK}`;
    ctx.fillText(line, 56, lineY);
    lineY += 44;
  });

  // 页脚分隔线 + 文案
  const footerY = H - 74;
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(56, footerY - 36);
  ctx.lineTo(W - 56, footerY - 36);
  ctx.stroke();

  ctx.fillStyle = INK_FAINT;
  ctx.font = `400 20px ${FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.fillText(model.footer, 56, footerY);
  ctx.fillStyle = BRAND;
  ctx.font = `700 20px ${FONT_STACK}`;
  ctx.textAlign = 'right';
  ctx.fillText('短句', W - 56, footerY);
}
