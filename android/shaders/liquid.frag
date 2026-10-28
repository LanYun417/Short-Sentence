#version 460 core
#include <flutter/runtime_effect.glsl>

// 液态流体：与 Web 端 client/app/components/HeroAurora.vue 的片元着色器同算法
// （两层域扭曲 FBM → 三色映射 → 柔光 → 暗角），保证两端观感一致。
// Flutter 通过 FragmentProgram.fromAsset 在构建期用 impellerc 编译本文件。

uniform vec2 uSize;
uniform float uTime;
uniform vec3 uFrom;
uniform vec3 uVia;
uniform vec3 uTo;

out vec4 fragColor;

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
  vec2 uv = FlutterFragCoord().xy / uSize;
  vec2 p = uv;
  p.x *= uSize.x / uSize.y;

  float t = uTime * 0.10;

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
  vec3 col = mix(uFrom, uVia, smoothstep(0.18, 0.55, f));
  col = mix(col, uTo, smoothstep(0.52, 0.92, f + 0.25 * r.x));

  // 光泽：随流体移动的柔光带
  float sheen = smoothstep(0.62, 1.0, fbm(p * 1.35 + r * 1.4 + vec2(t * 0.9, -t * 0.7)));
  col += sheen * 0.16;

  // 边缘压暗，增加液体体积感（同时保证前景文字可读）
  float vig = smoothstep(1.15, 0.2, length(uv - 0.5));
  col *= mix(0.84, 1.0, vig);

  fragColor = vec4(col, 1.0);
}
