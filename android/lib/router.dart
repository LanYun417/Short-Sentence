/// 路由表。
///
/// 用 go_router 的 `redirect` 做登录守卫（对应 Web 端的
/// `middleware/auth.ts`）：未登录访问首页 → 回登录页；
/// 已登录访问登录页 → 回首页。
///
/// 首页是 [ShellPage]（四个 Tab），不再有单独的 `/quiz` 路由：
/// 刷题是 Tab 之一，用路由栈再压一层会让「返回」行为变得费解。
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'pages/login_page.dart';
import 'pages/shell_page.dart';
import 'pages/splash_page.dart';
import 'state/auth_controller.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final loggedIn = auth.isLoggedIn;
      final atSplash = state.matchedLocation == '/splash';
      final atLogin = state.matchedLocation == '/login';

      // 恢复未完成时停在 splash（initialize 完成后由 splash 自行 next）
      if (!auth.initialized) {
        return atSplash ? null : '/splash';
      }
      if (!loggedIn && !atLogin) {
        return '/login';
      }
      if (loggedIn && atLogin) {
        return '/';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (context, state) => const SplashPage()),
      GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
      GoRoute(path: '/', builder: (context, state) => const ShellPage()),
    ],
  );
});
