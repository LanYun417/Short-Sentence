/// 路由表。
///
/// 用 go_router 的 `redirect` 做登录守卫（对应 Web 端的
/// `middleware/auth.ts`）：未登录访问首页 → 回登录页；
/// 已登录访问登录页 → 回首页。
///
/// 令牌判断直接读 Riverpod 的登录态（首屏 already 由
/// `authController.initialize()` 从安全存储恢复完成，见 [redirect] 注释）。
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'pages/home_page.dart';
import 'pages/login_page.dart';
import 'pages/quiz_page.dart';
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
      GoRoute(path: '/', builder: (context, state) => const HomePage()),
      GoRoute(path: '/quiz', builder: (context, state) => const QuizPage()),
    ],
  );
});
