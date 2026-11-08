/// 后端图标名 → 本地图标。
///
/// 后端存的是 lucide 图标名（成就 `icon`、场景 `icon`），与 Web 端的
/// `i-lucide-*` 同源。Flutter 端不引图标包，这里做一张显式映射表：
/// **未命中的名字回落到通用图标**，不至于因为加了新成就就显示空白。
///
/// ⚠️ 新增图标要三处同步：本表、`client/app/components/GrowthPanel.vue` 的
/// ICON_MAP、后端种子（`prisma/seed.service.ts`）。名字必须是 lucide 里真实
/// 存在的，否则 Web 端画不出图标（App 端只是回落成通用图标，看不出问题）。
library;

import 'package:flutter/material.dart';

/// 图标映射。
IconData appIcon(String? name) {
  return switch (name) {
    // ---------- 场景（句子分类） ----------
    'house' => Icons.home_rounded,
    'briefcase' => Icons.work_rounded,
    'airplane' || 'plane' => Icons.flight_takeoff_rounded,
    'cup-hot' || 'coffee' => Icons.local_cafe_rounded,
    'people' || 'users' || 'users-round' => Icons.groups_rounded,
    'book' => Icons.menu_book_rounded,
    'shopping-bag' => Icons.shopping_bag_rounded,
    'stethoscope' => Icons.monitor_heart_rounded,
    'dumbbell' => Icons.fitness_center_rounded,
    'heart' => Icons.favorite_rounded,
    'laptop' => Icons.laptop_mac_rounded,
    'sofa' => Icons.chair_rounded,
    'clapperboard' => Icons.movie_rounded,
    'cloud-sun' => Icons.wb_sunny_rounded,
    // ---------- 成就 ----------
    'footprints' => Icons.directions_walk_rounded,
    'flame' || 'fire' || 'flame-kindling' => Icons.local_fire_department_rounded,
    'trophy' => Icons.emoji_events_rounded,
    'target' => Icons.gps_fixed_rounded,
    'award' => Icons.workspace_premium_rounded,
    'medal' => Icons.military_tech_rounded,
    'crown' => Icons.stars_rounded,
    'gem' => Icons.diamond_rounded,
    'compass' => Icons.explore_rounded,
    'rocket' => Icons.rocket_launch_rounded,
    'swords' => Icons.sports_martial_arts_rounded,
    'notebook-pen' => Icons.edit_note_rounded,
    'calendar-check' => Icons.event_available_rounded,
    'bookmark' => Icons.bookmark_rounded,
    'map' => Icons.map_rounded,
    'globe' => Icons.public_rounded,
    'trending-up' => Icons.trending_up_rounded,
    'sparkles' => Icons.auto_awesome_rounded,
    'star' => Icons.star_rounded,
    'zap' => Icons.bolt_rounded,
    // ---------- 排行榜配套成就 ----------
    'list-ordered' => Icons.format_list_numbered_rounded,
    'badge-check' => Icons.verified_rounded,
    'calendar-days' => Icons.calendar_month_rounded,
    'flag' => Icons.flag_rounded,
    'chevrons-up' => Icons.keyboard_double_arrow_up_rounded,
    // ---------- 弱连接小队成就 ----------
    'handshake' => Icons.people_rounded,
    // ---------- 情景闯关成就 ----------
    // `map` 已在上面「通用」段落里映射过，这里只补 route
    'route' => Icons.route_rounded,
    _ => Icons.auto_awesome_rounded,
  };
}
