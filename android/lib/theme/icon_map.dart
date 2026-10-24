/// 后端图标名 → 本地图标。
///
/// 后端存的是 lucide 图标名（成就 `icon`、场景 `icon`），与 Web 端的
/// `i-lucide-*` 同源。Flutter 端不引图标包，这里做一张显式映射表：
/// **未命中的名字回落到通用图标**，不至于因为加了新成就就显示空白。
library;

import 'package:flutter/material.dart';

/// 图标映射。
IconData appIcon(String? name) {
  return switch (name) {
    'house' => Icons.home_rounded,
    'briefcase' => Icons.work_rounded,
    'airplane' => Icons.flight_takeoff_rounded,
    'cup-hot' => Icons.local_cafe_rounded,
    'people' => Icons.groups_rounded,
    'book' => Icons.menu_book_rounded,
    'footprints' => Icons.directions_walk_rounded,
    'flame' || 'fire' => Icons.local_fire_department_rounded,
    'trophy' => Icons.emoji_events_rounded,
    'target' => Icons.gps_fixed_rounded,
    'award' => Icons.workspace_premium_rounded,
    'bookmark' => Icons.bookmark_rounded,
    'map' => Icons.map_rounded,
    'globe' => Icons.public_rounded,
    'trending-up' => Icons.trending_up_rounded,
    'sparkles' => Icons.auto_awesome_rounded,
    'star' => Icons.star_rounded,
    'zap' => Icons.bolt_rounded,
    _ => Icons.auto_awesome_rounded,
  };
}
