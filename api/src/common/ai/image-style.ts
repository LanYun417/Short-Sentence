/**
 * 全站生图渲染风格的硬约束：纯粹扁平 2D 动画插画。
 *
 * 为什么单独抽出来：三类产物各有自己的视觉语言——题目配图与节日封面是扁平卡通、
 * 闯关/剧本/场景封面是绘本插画、每日句签是柔和治愈系，这是刻意设计，不要抹平。
 * 但「渲染质感必须是纯粹扁平 2D 动画」是三者共同的底线，集中在这里由三套后缀
 * 统一拼接，避免以后改一处漏两处；审核器按同一口径拦截，被拒的图走自动重新生成
 * （见 sentence-gen.service.ts 的 generateReviewedCover）。
 *
 * 2026-11-11 用户反馈：部分图是「2D + 半写实」的混合质感——整体是插画，但带写实
 * 光影、厚涂笔触、真实材质或伪 3D 体积感。这类图既不是照片也不是 3D CGI，旧版
 * 只禁「照片 / 3D」的约束与审核规则会全部放行，导致同一批卡片画风不统一。
 * 所以这里不只禁照片与 3D，还要把渲染质感本身锁死在平涂赛璐璐：
 * 正向给出可判定的特征（纯色块 / 干净线稿 / 哑光），负向逐一列出半写实的具体表现。
 *
 * 注意：只统一「渲染底层」，不统一配色与主题——三套后缀仍可各有 warm pastel /
 * storybook / healing 的色调差异，但不允许再出现诱导写实光影与细节的措辞。
 */
export const IMAGE_2D_HARD_STYLE =
  'STRICT STYLE (overrides any other style wording): pure flat 2D animation illustration, ' +
  'cel-shaded flat color fills, crisp clean outlines, simplified shapes, matte solid colors, ' +
  'NO realistic or volumetric lighting, NO cinematic lighting, NO realistic shadows or highlights, ' +
  'NO gradients used as shading, NO realistic textures, NO realistic skin / fabric / material detail, ' +
  'NO painterly or thick-painted rendering, NO airbrushed shading, NO photorealistic detail, ' +
  'NO semi-realistic / semi-realism style, NO 2D-with-realistic-shading hybrid look, ' +
  'NO pseudo-3D depth, NO CGI-like glossy or beveled surfaces, ' +
  'NOT a photograph, NOT photorealistic, NOT a 3D or CGI render, NOT live-action, NOT a real-person photo';
