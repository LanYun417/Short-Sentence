/// 启动页：等令牌/资料恢复完成后跳转。
///
/// 与 Web 端 SSR 守卫的思路一致——**先恢复再决定去哪**，
/// 而不是先进首页再被弹回登录页（那样会闪一下）。
///
/// 视觉上只做一件事：品牌标从略小淡入到原尺寸，配一圈柔光。
/// 启动页停留时间很短，动画必须一眼就完成，不能让人等它播完。
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../state/auth_controller.dart';
import '../theme.dart';

class SplashPage extends ConsumerStatefulWidget {
  const SplashPage({super.key});

  @override
  ConsumerState<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends ConsumerState<SplashPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 720),
  );

  late final Animation<double> _fade = CurvedAnimation(
    parent: _controller,
    curve: Motion.decelerate,
  );

  @override
  void initState() {
    super.initState();
    _controller.forward();
    _restore();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _restore() async {
    final auth = ref.read(authControllerProvider.notifier);
    await auth.initialize();
    if (!mounted) {
      return;
    }
    final loggedIn = ref.read(authControllerProvider).isLoggedIn;
    context.go(loggedIn ? '/' : '/login');
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final reduce = Motion.reduced(context);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: systemUiOverlay(context, navBarColor: colors.canvas),
      child: Scaffold(
        body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: <Color>[
              colors.canvasTint.withValues(alpha: 0.6),
              colors.canvas.withValues(alpha: 0),
            ],
            stops: const <double>[0, 0.7],
          ),
        ),
        child: Stack(
          children: <Widget>[
            Positioned(
              top: -140,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  width: 340,
                  height: 340,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: <Color>[
                        colors.brand.withValues(alpha: 0.16),
                        colors.brand.withValues(alpha: 0),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Center(
              child: FadeTransition(
                opacity: reduce ? const AlwaysStoppedAnimation<double>(1) : _fade,
                child: ScaleTransition(
                  scale: reduce
                      ? const AlwaysStoppedAnimation<double>(1)
                      : Tween<double>(begin: 0.9, end: 1).animate(
                          CurvedAnimation(parent: _controller, curve: Motion.spring),
                        ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: <BoxShadow>[
                            BoxShadow(
                              color: const Color(0xFF6366F1).withValues(alpha: 0.28),
                              blurRadius: 28,
                              offset: const Offset(0, 12),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(20),
                          child: Image.asset(
                            'assets/brand/logo.png',
                            width: 76,
                            height: 76,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      ShaderMask(
                        shaderCallback: (bounds) => brandGradient.createShader(bounds),
                        blendMode: BlendMode.srcIn,
                        child: const Text(
                          '短句',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 3,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '每天一句，慢慢变好',
                        style: TextStyle(fontSize: 11.5, color: colors.inkFaint),
                      ),
                      const SizedBox(height: 30),
                      SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: colors.brand),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
    );
  }
}
