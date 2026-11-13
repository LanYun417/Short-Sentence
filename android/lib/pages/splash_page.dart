/// 启动页：先恢复令牌/资料，再带着一段品牌入场动画跳转到首页。
///
/// 与 Web 端 SSR 守卫思路一致——**先恢复再决定去哪**，而不是先进首页再被弹回登录页。
///
/// 入场动画（约 1.2s，一眼完成、绝不让人等它播完）：
/// 1. Logo 从 0.7 弹到 1.0 + 淡入，背后一圈柔光晕先放大再淡出；
/// 2. 标语「短句」逐字从下方滑入；
/// 3. 副标语「每天一句，慢慢变好」随后淡入；
/// 4. 末尾浮出加载圈（等令牌恢复完成后由 `_restore` 跳转）。
///
/// 全部自绘、**零新增依赖**；尊重系统「减少动态效果」设置。
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../state/auth_controller.dart';
import '../theme.dart';

/// 启动页展示的品牌标语（逐字入场）。
const String _brandSlogan = '短句';

class SplashPage extends ConsumerStatefulWidget {
  const SplashPage({super.key});

  @override
  ConsumerState<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends ConsumerState<SplashPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  );

  // 入场各段（用 Interval 把一条时间轴切成错峰的轨道）
  late final Animation<double> _logoScale;
  late final Animation<double> _logoFade;
  late final Animation<double> _haloScale;
  late final Animation<double> _haloFade;
  late final Animation<double> _subFade;
  late final Animation<double> _spinnerFade;
  late final List<Animation<double>> _letterSlides = <Animation<double>>[];
  late final List<Animation<double>> _letterFades = <Animation<double>>[];

  @override
  void initState() {
    super.initState();

    final slogan = _brandSlogan;
    for (var i = 0; i < slogan.length; i += 1) {
      final start = 0.24 + i * 0.12;
      _letterSlides.add(
        Tween<double>(begin: 22, end: 0).animate(
          CurvedAnimation(
            parent: _controller,
            curve: Interval(start, start + 0.26, curve: Motion.decelerate),
          ),
        ),
      );
      _letterFades.add(
        Tween<double>(begin: 0, end: 1).animate(
          CurvedAnimation(
            parent: _controller,
            curve: Interval(start, start + 0.22, curve: Motion.decelerate),
          ),
        ),
      );
    }

    _logoScale = Tween<double>(begin: 0.7, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Interval(0, 0.45, curve: Motion.spring)),
    );
    _logoFade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Interval(0, 0.4, curve: Motion.decelerate)),
    );
    _haloScale = Tween<double>(begin: 0.8, end: 1.7).animate(
      CurvedAnimation(parent: _controller, curve: Interval(0, 0.55, curve: Motion.decelerate)),
    );
    _haloFade = Tween<double>(begin: 0.5, end: 0).animate(
      CurvedAnimation(parent: _controller, curve: Interval(0.05, 0.55, curve: Motion.decelerate)),
    );
    _subFade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Interval(0.5, 0.8, curve: Motion.decelerate)),
    );
    _spinnerFade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Interval(0.62, 0.9, curve: Motion.decelerate)),
    );

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

    final Widget logo = ScaleTransition(
      scale: reduce ? const AlwaysStoppedAnimation<double>(1) : _logoScale,
      child: FadeTransition(
        opacity: reduce ? const AlwaysStoppedAnimation<double>(1) : _logoFade,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                boxShadow: <BoxShadow>[
                  BoxShadow(
                    color: brandGradientMid.withValues(alpha: 0.3),
                    blurRadius: 30,
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
            Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                for (var i = 0; i < _brandSlogan.length; i += 1)
                  _SloganLetter(
                    char: _brandSlogan[i],
                    slide: reduce ? null : _letterSlides[i],
                    fade: reduce ? null : _letterFades[i],
                  ),
              ],
            ),
          ],
        ),
      ),
    );

    final Widget sub = FadeTransition(
      opacity: reduce ? const AlwaysStoppedAnimation<double>(1) : _subFade,
      child: Text(
        '每天一句，慢慢变好',
        style: TextStyle(fontSize: 11.5, color: colors.inkFaint, letterSpacing: 0.5),
      ),
    );

    final Widget spinner = FadeTransition(
      opacity: reduce ? const AlwaysStoppedAnimation<double>(1) : _spinnerFade,
      child: SizedBox(
        width: 20,
        height: 20,
        child: CircularProgressIndicator(strokeWidth: 2, color: colors.brand),
      ),
    );

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
              // 顶部一圈品牌光晕：放大并淡出，给 Logo 入场垫一层「亮起来」的感觉
              Positioned(
                top: -140,
                left: 0,
                right: 0,
                child: Center(
                  child: FadeTransition(
                    opacity: reduce ? const AlwaysStoppedAnimation<double>(0) : _haloFade,
                    child: ScaleTransition(
                      scale: reduce ? const AlwaysStoppedAnimation<double>(1) : _haloScale,
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
                ),
              ),
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    logo,
                    const SizedBox(height: 8),
                    sub,
                    const SizedBox(height: 30),
                    spinner,
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 标语里的单个字：从下方滑入 + 淡入（错峰由父级传入的动画驱动）。
class _SloganLetter extends StatelessWidget {
  const _SloganLetter({required this.char, this.slide, this.fade});

  final String char;
  final Animation<double>? slide;
  final Animation<double>? fade;

  @override
  Widget build(BuildContext context) {
    if (slide == null || fade == null) {
      return _glyph(context);
    }
    return AnimatedBuilder(
      animation: Listenable.merge(<Listenable>[slide!, fade!]),
      builder: (context, _) {
        return Transform.translate(
          offset: Offset(0, slide!.value),
          child: Opacity(opacity: fade!.value, child: _glyph(context)),
        );
      },
    );
  }

  Widget _glyph(BuildContext context) {
    return ShaderMask(
      shaderCallback: (bounds) => brandGradient.createShader(bounds),
      blendMode: BlendMode.srcIn,
      child: Text(
        char,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 26,
          fontWeight: FontWeight.w800,
          letterSpacing: 3,
        ),
      ),
    );
  }
}
