/// 「短句」App 入口。
///
/// 结构：ProviderScope（Riverpod 根）→ MaterialApp.router（go_router）。
/// 主题跟随系统亮/暗，与 Web 端 `colorMode` 的取向一致。
///
/// 令牌失效（401 且刷新也失败）的处理链：
/// Dio 拦截器 → [setUnauthorizedHandler] 注册的回调 →
/// [AuthController.handleUnauthorized] 清登录态 → 路由守卫带回登录页。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/dio_client.dart';
import 'router.dart';
import 'state/auth_controller.dart';
import 'theme.dart';

void main() {
  runApp(const ProviderScope(child: ShortSentenceApp()));
}

class ShortSentenceApp extends ConsumerWidget {
  const ShortSentenceApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    // 令牌失效回调：只注册一次（build 可能因主题变化重跑，重复注册无害但没必要）
    setUnauthorizedHandler(
      () => ref.read(authControllerProvider.notifier).handleUnauthorized(),
    );

    return MaterialApp.router(
      title: '短句',
      debugShowCheckedModeBanner: false,
      theme: lightTheme,
      darkTheme: darkTheme,
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}
