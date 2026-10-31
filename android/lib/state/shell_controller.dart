/// 外壳 Tab 索引：供子页面跨页跳转用。
///
/// 场景：题库页挑完一个节日要切回刷题页继续刷——子页面够不到 ShellPage 的
/// 内部状态，只能通过这个共享索引请求切换。
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Tab 顺序：0 刷题 / 1 题库 / 2 语句库 / 3 AI / 4 成长 / 5 我的。
class ShellController extends Notifier<int> {
  @override
  int build() => 0;

  /// 切到指定 Tab（已经在该 Tab 时忽略）。
  void go(int index) {
    if (index != state) {
      state = index;
    }
  }
}

/// 外壳 Tab 索引 Provider。
final shellControllerProvider = NotifierProvider<ShellController, int>(ShellController.new);
