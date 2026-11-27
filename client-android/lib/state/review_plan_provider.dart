/// 今日复习计划（轻量）：只为了语句库复习 Tab 顶部的数字概览。
///
/// 单独一个 autoDispose provider：离开语句库就释放，回来重新拉（数字会随作答变化），
/// 且失败返回 null——计划只是锦上添花，不该让整个语句库变成错误页。
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/questions_api.dart';
import '../api/models/review_plan.dart';

final reviewPlanProvider = FutureProvider<ReviewPlan?>((ref) async {
  try {
    return await ref.watch(questionsApiProvider).reviewPlan();
  } catch (_) {
    return null;
  }
});
