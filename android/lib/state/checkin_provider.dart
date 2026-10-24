/// 今日打卡（轻量）：只用来取连续天数与今日进度。
///
/// 刷题页头部要显示「连续 N 天」，但不需要整个成长概览——
/// 单独一个 FutureProvider，避免为了一个小数字去拉成就与场景地图。
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/library_api.dart';
import '../api/models/growth.dart';

/// 今日打卡状态（未打卡为 null）。
final todayCheckinProvider = FutureProvider<CheckinToday?>((ref) {
  return ref.watch(libraryApiProvider).checkinToday();
});
