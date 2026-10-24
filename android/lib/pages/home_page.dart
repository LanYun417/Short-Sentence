/// 首页（登录后的落地页）。
///
/// 当前只做「连通性自检 + 账号信息」：
/// - 顶部展示当前用户（证明令牌链路通）；
/// - 「测试接口」按钮打一次 `/auth/me`，把结果或错误显示出来——
///   首次运行时用来验证 `10.0.2.2` 是否真的连到宿主机 API；
/// - 底部是登出。
///
/// 刷题主链路（questions/next 等）在后续步骤接入。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../api/auth_api.dart';
import '../api/models/user.dart';
import '../state/auth_controller.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  String? _probeResult;
  bool _probing = false;

  Future<void> _probe() async {
    setState(() => _probing = true);
    try {
      final profile = await ref.read(authApiProvider).me();
      if (!mounted) {
        return;
      }
      setState(() => _probeResult = '✅ /auth/me 通：${profile.nickname}（id=${profile.id}）');
    } catch (error) {
      if (!mounted) {
        return;
      }
      final message = switch (error) {
        final ApiException e => e.message,
        _ => error.toString(),
      };
      setState(() => _probeResult = '❌ $message');
    } finally {
      if (mounted) {
        setState(() => _probing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('短句'),
        actions: [
          IconButton(
            tooltip: '登出',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 16),
            CircleAvatar(
              radius: 36,
              backgroundColor: Theme.of(context).colorScheme.primaryContainer,
              child: Text(
                (user?.nickname ?? '?').substring(0, 1),
                style: TextStyle(
                  fontSize: 28,
                  color: Theme.of(context).colorScheme.onPrimaryContainer,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              user?.nickname ?? '未登录',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              user?.email ?? '',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 32),
            FilledButton.tonalIcon(
              onPressed: _probing ? null : _probe,
              icon: _probing
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.wifi_tethering),
              label: const Text('测试接口连通性'),
            ),
            if (_probeResult != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(_probeResult!, style: const TextStyle(fontSize: 13)),
              ),
            ],
            const Spacer(),
            Text(
              '刷题主链路开发中',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 首页也需要展示用户资料时使用（例如从 /me 刷新后）。
UserProfile? profileOf(AuthState state) => state.user;
