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

import 'pages/achievements_page.dart';
import 'pages/account_delete_page.dart';
import 'pages/boss_page.dart';
import 'pages/submissions_page.dart';
import 'pages/chain_page.dart';
import 'pages/dialogue_page.dart';
import 'pages/ipa_page.dart';
import 'pages/leaderboard_page.dart';
import 'pages/login_page.dart';
import 'pages/scene_page.dart';
import 'pages/scenes_page.dart';
import 'pages/script_page.dart';
import 'pages/shell_page.dart';
import 'pages/splash_page.dart';
import 'pages/stage_list_page.dart';
import 'pages/team_page.dart';
import 'pages/vip_page.dart';
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
      GoRoute(
        path: '/leaderboard',
        builder: (context, state) => const LeaderboardPage(),
      ),
      GoRoute(path: '/boss', builder: (context, state) => const BossPage()),
      GoRoute(
        path: '/submissions',
        builder: (context, state) => const SubmissionsPage(),
      ),
      GoRoute(
        path: '/stages',
        builder: (context, state) => const StageListPage(),
      ),
      GoRoute(
        path: '/stages/scene/:id',
        builder: (context, state) =>
            ScenePage(id: int.parse(state.pathParameters['id']!)),
      ),
      GoRoute(
        path: '/stages/script/:id',
        builder: (context, state) =>
            ScriptPage(id: int.parse(state.pathParameters['id']!)),
      ),
      GoRoute(
        path: '/stages/:id',
        builder: (context, state) => DialoguePage(
          id: int.parse(state.pathParameters['id']!),
          scriptId: state.extra is int ? state.extra as int : null,
        ),
      ),
      GoRoute(path: '/chains', builder: (context, state) => const ChainPage()),
      GoRoute(path: '/team', builder: (context, state) => const TeamPage()),
      GoRoute(path: '/ipa', builder: (context, state) => const IpaPage()),
      GoRoute(path: '/vip', builder: (context, state) => const VipPage()),
      GoRoute(
        path: '/achievements',
        builder: (context, state) => const AchievementsPage(),
      ),
      GoRoute(path: '/scenes', builder: (context, state) => const ScenesPage()),
      GoRoute(
        path: '/account-delete',
        builder: (context, state) => const AccountDeletePage(),
      ),
    ],
  );
});
