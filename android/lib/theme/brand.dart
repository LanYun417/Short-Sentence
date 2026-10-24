/// 今日进度 Hero 的阶段配色。
///
/// 与 Web 端 `pages/index.vue` 的 `HERO_STAGES` **逐值一致**：
/// 配色随完成度升温——还没开始时冷静的青蓝（不催人），冲刺时玫红橙，
/// 达标转金橙给奖励感。三端观感统一。
library;

import 'package:flutter/material.dart';

/// 一个阶段的渐变与阴影色。
class HeroStage {
  const HeroStage({
    required this.from,
    required this.via,
    required this.to,
    required this.shadow,
    this.onColor = Colors.white,
  });

  final Color from;
  final Color via;
  final Color to;

  /// 阴影色（带透明度，直接用于 BoxShadow）。
  final Color shadow;

  /// 前景色（文字/图标）。
  ///
  /// 达标档是亮金色，白字对比度只有 1.7:1，几乎看不清；
  /// 换成深棕后既保住金色底，文字也读得出来。
  final Color onColor;

  LinearGradient get gradient => LinearGradient(
        colors: <Color>[from, via, to],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
}

/// Hero 阶段 key。
enum HeroStageKey { idle, warmup, push, sprint, done }

/// 各阶段配色（顺序与 Web 端 HERO_STAGES 一致）。
const Map<HeroStageKey, HeroStage> kHeroStages = <HeroStageKey, HeroStage>{
  // 还没开始：青蓝，冷静、不催人
  HeroStageKey.idle: HeroStage(
    from: Color(0xFF0284C7),
    via: Color(0xFF0E7490),
    to: Color(0xFF0F766E),
    shadow: Color(0x40089148),
  ),
  // 起步 1~33%：品牌蓝紫
  HeroStageKey.warmup: HeroStage(
    from: Color(0xFF0EA5E9),
    via: Color(0xFF6366F1),
    to: Color(0xFF8B5CF6),
    shadow: Color(0x406366F1),
  ),
  // 推进 34~66%：紫
  HeroStageKey.push: HeroStage(
    from: Color(0xFF6366F1),
    via: Color(0xFF8B5CF6),
    to: Color(0xFFD946EF),
    shadow: Color(0x4DA855F7),
  ),
  // 冲刺 67~99%：紫 → 玫红 → 橙，已经热起来了
  HeroStageKey.sprint: HeroStage(
    from: Color(0xFF8B5CF6),
    via: Color(0xFFF43F5E),
    to: Color(0xFFF97316),
    shadow: Color(0x4DF43F5E),
  ),
  // 达标：金橙，奖励感
  HeroStageKey.done: HeroStage(
    from: Color(0xFFFBBF24),
    via: Color(0xFFF59E0B),
    to: Color(0xFFF97316),
    shadow: Color(0x59F97316),
    onColor: Color(0xFF4A2400),
  ),
};

/// 按完成度选阶段（达标优先判定，与 Web 端 heroStage 同口径）。
HeroStageKey heroStageOf({required bool goalReached, required int done, required double pct}) {
  if (goalReached) {
    return HeroStageKey.done;
  }
  if (done <= 0) {
    return HeroStageKey.idle;
  }
  if (pct >= 67) {
    return HeroStageKey.sprint;
  }
  if (pct >= 34) {
    return HeroStageKey.push;
  }
  return HeroStageKey.warmup;
}
