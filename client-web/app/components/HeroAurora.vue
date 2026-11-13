<script setup lang="ts">
/**
 * 今日进度 Hero 的「液态流体 + 星光」背景层（WebGL 着色器，零新增依赖）。
 *
 * 为什么不用纯 CSS：径向光斑只能做出「雾状柔光」，移动时像一团雾在平移，
 * 缺少液体的翻卷、拉丝与表面结构。这里用一段自定义片元着色器（域扭曲 FBM 噪声）
 * 实时合成液态大理石般的流体渐变；颜色随卡片阶段（from/via/to）平滑过渡。
 * WebGL 不可用时回退为静态径向渐变，不影响可读性。
 *
 * 星光仍是 DOM 层：外层随流体漂移（位移 + 末端淡出），内层呼吸闪烁。
 * 尊重 prefers-reduced-motion（只渲染一帧静态流体）与页面不可见时暂停。
 */
const props = withDefaults(
  defineProps<{
    /** 阶段主色（未开始青蓝 → 冲刺玫红 → 达标金橙） */
    from?: string;
    via?: string;
    to?: string;
  }>(),
  {
    from: '#0ea5e9',
    via: '#6366f1',
    to: '#8b5cf6',
  },
);

// ===== 星光：固定位置 / 尺寸 / 闪烁相位（确定性，不随机）=====
const BASE_STARS = [
  { x: 7, y: 18, s: 2, d: 0, dur: 3.6 },
  { x: 16, y: 62, s: 1.5, d: 1.2, dur: 4.4 },
  { x: 24, y: 33, s: 2.4, d: 2.1, dur: 3.2 },
  { x: 33, y: 78, s: 1.6, d: 0.6, dur: 5 },
  { x: 41, y: 22, s: 2, d: 3, dur: 4 },
  { x: 52, y: 55, s: 1.4, d: 1.8, dur: 4.8 },
  { x: 58, y: 14, s: 2.2, d: 0.3, dur: 3.4 },
  { x: 66, y: 70, s: 1.6, d: 2.6, dur: 5.2 },
  { x: 73, y: 38, s: 2, d: 1, dur: 3.8 },
  { x: 81, y: 20, s: 1.5, d: 3.4, dur: 4.6 },
  { x: 86, y: 60, s: 2.2, d: 0.9, dur: 3.5 },
  { x: 92, y: 33, s: 1.6, d: 2.3, dur: 5.4 },
  { x: 12, y: 44, s: 1.4, d: 1.5, dur: 4.2 },
  { x: 47, y: 84, s: 1.8, d: 0.4, dur: 4 },
  { x: 78, y: 82, s: 1.4, d: 2.8, dur: 5 },
  { x: 38, y: 48, s: 1.6, d: 1.1, dur: 4.4 },
] as const;

// 流动参数：按索引确定性派生（不随机），让星点形成一股缓慢上飘的「星流」。
const STARS = BASE_STARS.map((star, i) => ({
  ...star,
  fx: 40 + (i % 4) * 14,
  fy: -26 + (i % 3) * 13,
  fdur: 8 + (i % 5) * 1.4,
  fd: -(i % 7) * 1.4,
}));

// ===== WebGL 液态流体 =====
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas');

/** 全屏三角形顶点着色器 */
const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/** 液态流体片元着色器（域扭曲 FBM；PRECISION 由运行时精度探测替换） */
const FRAG = `
precision PRECISION float;

uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_from;
uniform vec3 u_via;
uniform vec3 u_to;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv;
  p.x *= u_res.x / u_res.y;

  float t = u_time * 0.10;

  // 第一层域扭曲：让噪声本身被另一团噪声推动
  vec2 q;
  q.x = fbm(p + vec2(0.0, t));
  q.y = fbm(p + vec2(5.2, 1.3) - vec2(t * 0.7, 0.0));

  // 第二层域扭曲：液体翻卷 / 拉丝的关键
  vec2 r;
  r.x = fbm(p + 2.2 * q + vec2(1.7, 9.2) + t * 0.55);
  r.y = fbm(p + 2.2 * q + vec2(8.3, 2.8) - t * 0.45);

  float f = fbm(p + 2.6 * r);

  // 三色映射，形成流动的色带
  vec3 col = mix(u_from, u_via, smoothstep(0.18, 0.55, f));
  col = mix(col, u_to, smoothstep(0.52, 0.92, f + 0.25 * r.x));

  // 光泽：随流体移动的柔光带，制造液体表面反光
  float sheen = smoothstep(0.62, 1.0, fbm(p * 1.35 + r * 1.4 + vec2(t * 0.9, -t * 0.7)));
  col += sheen * 0.16;

  // 边缘压暗，增加液体体积感（同时保证白色文字可读）
  float vig = smoothstep(1.15, 0.2, length(uv - 0.5));
  col *= mix(0.84, 1.0, vig);

  gl_FragColor = vec4(col, 1.0);
}
`;

/** 把 #rgb / #rrggbb / rgb() 解析成 0~1 的三元组；无法解析时给深蓝兜底。 */
function parseColor(input: string): [number, number, number] {
  const text = input.trim();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    let body = hex[1]!;
    if (body.length === 3) {
      body = body
        .split('')
        .map((ch) => ch + ch)
        .join('');
    }
    const value = Number.parseInt(body, 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(text);
  if (rgb) {
    return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
  }
  return [0.08, 0.11, 0.2];
}

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) {
    return;
  }

  const gl = ((): WebGLRenderingContext | null => {
    try {
      return canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power',
      });
    } catch {
      return null;
    }
  })();
  // WebGL 不可用：保留 CSS 兜底渐变，不抛错、不空卡
  if (!gl) {
    return;
  }
  const ctx = gl;

  const compile = (type: number, source: string): WebGLShader | null => {
    const shader = ctx.createShader(type);
    if (!shader) {
      return null;
    }
    ctx.shaderSource(shader, source);
    ctx.compileShader(shader);
    if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
      ctx.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const highFloat = ctx.getShaderPrecisionFormat(ctx.FRAGMENT_SHADER, ctx.HIGH_FLOAT);
  const precision = highFloat && highFloat.precision > 0 ? 'highp' : 'mediump';

  const vertexShader = compile(ctx.VERTEX_SHADER, VERT);
  const fragmentShader = compile(ctx.FRAGMENT_SHADER, FRAG.replace('PRECISION', precision));
  if (!vertexShader || !fragmentShader) {
    return;
  }

  const program = ctx.createProgram();
  if (!program) {
    return;
  }
  ctx.attachShader(program, vertexShader);
  ctx.attachShader(program, fragmentShader);
  ctx.linkProgram(program);
  if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
    ctx.deleteProgram(program);
    return;
  }
  ctx.useProgram(program);

  // 全屏三角形（比两个三角形的四边形少一次插值边界）
  const buffer = ctx.createBuffer();
  ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
  ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW);
  const position = ctx.getAttribLocation(program, 'a_pos');
  ctx.enableVertexAttribArray(position);
  ctx.vertexAttribPointer(position, 2, ctx.FLOAT, false, 0, 0);

  const uRes = ctx.getUniformLocation(program, 'u_res');
  const uTime = ctx.getUniformLocation(program, 'u_time');
  const uFrom = ctx.getUniformLocation(program, 'u_from');
  const uVia = ctx.getUniformLocation(program, 'u_via');
  const uTo = ctx.getUniformLocation(program, 'u_to');

  // 目标色（props 变化时更新）与当前色（每帧向目标插值，模拟 0.8s 升温过渡）
  const target = {
    from: parseColor(props.from),
    via: parseColor(props.via),
    to: parseColor(props.to),
  };
  const current = {
    from: [...target.from] as [number, number, number],
    via: [...target.via] as [number, number, number],
    to: [...target.to] as [number, number, number],
  };
  let colorKey = `${props.from}|${props.via}|${props.to}`;

  const syncTargets = (): void => {
    const key = `${props.from}|${props.via}|${props.to}`;
    if (key === colorKey) {
      return;
    }
    colorKey = key;
    target.from = parseColor(props.from);
    target.via = parseColor(props.via);
    target.to = parseColor(props.to);
  };

  const resize = (): void => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      ctx.viewport(0, 0, width, height);
    }
    ctx.uniform2f(uRes, canvas.width, canvas.height);
  };

  let time = 5.5;
  const render = (): void => {
    ctx.uniform1f(uTime, time);
    ctx.uniform3f(uFrom, current.from[0], current.from[1], current.from[2]);
    ctx.uniform3f(uVia, current.via[0], current.via[1], current.via[2]);
    ctx.uniform3f(uTo, current.to[0], current.to[1], current.to[2]);
    ctx.drawArrays(ctx.TRIANGLES, 0, 3);
  };

  const reduced =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  resize();
  // 先同步画一帧：alpha:false 的画布未绘制时是不透明黑，
  // 且后台标签页 rAF 会被暂停——首帧不能只依赖动画循环。
  render();

  let raf = 0;
  let lastTs = 0;
  let visible = true;

  // 上下文丢失（GPU 重置 / 内存压力）时隐藏画布，露出 CSS 兜底，避免留一块不透明黑。
  const onContextLost = (event: Event): void => {
    event.preventDefault();
    cancelAnimationFrame(raf);
    canvas.style.display = 'none';
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  const tick = (now: number): void => {
    raf = requestAnimationFrame(tick);
    if (document.hidden || !visible) {
      return;
    }
    // 液态流动很慢，30fps 足够顺滑，且明显省电
    if (now - lastTs < 33) {
      return;
    }
    const dt = lastTs ? Math.min((now - lastTs) / 1000, 0.1) : 0.033;
    lastTs = now;
    time += dt;

    syncTargets();
    const k = 1 - Math.exp(-dt * 6);
    for (let i = 0; i < 3; i += 1) {
      current.from[i]! += (target.from[i]! - current.from[i]!) * k;
      current.via[i]! += (target.via[i]! - current.via[i]!) * k;
      current.to[i]! += (target.to[i]! - current.to[i]!) * k;
    }
    render();
  };

  const resizeObserver = new ResizeObserver(() => {
    resize();
    if (reduced) {
      render();
    }
  });
  resizeObserver.observe(canvas);

  const intersectionObserver = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
  });
  intersectionObserver.observe(canvas);

  if (reduced) {
    render();
  } else {
    raf = requestAnimationFrame(tick);
  }

  onBeforeUnmount(() => {
    cancelAnimationFrame(raf);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    ctx.deleteBuffer(buffer);
    ctx.deleteProgram(program);
    ctx.deleteShader(vertexShader);
    ctx.deleteShader(fragmentShader);
  });
});
</script>

<template>
  <div class="pointer-events-none absolute inset-0 overflow-hidden">
    <!-- WebGL 不可用时的静态兜底（也是首帧前的底色） -->
    <div class="ss-hero-fallback absolute inset-0" />

    <!-- 液态流体画布 -->
    <canvas ref="canvas" class="absolute inset-0 block h-full w-full" aria-hidden="true" />

    <!-- 星光：外圈随流体漂移（位移 + 末端淡出），内圈原地呼吸闪烁 -->
    <span
      v-for="(star, i) in STARS"
      :key="i"
      class="ss-star-flow absolute"
      :style="{
        left: `${star.x}%`,
        top: `${star.y}%`,
        '--fx': `${star.fx}px`,
        '--fy': `${star.fy}px`,
        '--fdur': `${star.fdur}s`,
        '--fdelay': `${star.fd}s`,
      }"
    >
      <span
        class="ss-star block rounded-full bg-white"
        :style="{
          width: `${star.s}px`,
          height: `${star.s}px`,
          boxShadow: `0 0 ${star.s + 2}px rgba(255, 255, 255, 0.9)`,
          '--twk-dur': `${star.dur}s`,
          '--twk-delay': `${star.d}s`,
        }"
      />
    </span>
  </div>
</template>
