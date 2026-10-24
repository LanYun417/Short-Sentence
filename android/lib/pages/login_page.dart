/// 登录 / 注册页。
///
/// 视觉上与新外壳对齐：柔光背景 + 白卡表单 + 品牌渐变主按钮，
/// 而不是把输入框直接铺在页面上——登录是用户看到的第一屏，
/// 观感不统一会让后面的页面显得「两个 App」。
///
/// **为什么带图形验证码**：后端 `CAPTCHA_ENABLED` 默认开启，
/// 不带验证码的登录/注册请求会被直接拒绝（「验证码错误或已过期」）。
/// 因此验证码不是可选项：先 [CaptchaField] 拉图，提交时连同 id / code 一起发。
///
/// 失败后必须**换一张**：后端验证码单次有效，失败即作废，
/// 不换则用户重试只会再吃一次「验证码错误」（与 Web 端同样的处理）。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/auth_api.dart';
import '../state/auth_controller.dart';
import '../theme.dart';
import '../widgets/app_card.dart';
import '../widgets/captcha_field.dart';
import '../widgets/gradient_button.dart';
import '../widgets/staggered.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  /// 可替换：切换登录/注册时换一个新的 key，
  /// 让表单字段重建——旧模式下的「请输入密码/验证码」红字会一起消失，
  /// 而 TextEditingController 里的内容不受影响。
  GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _captchaController = TextEditingController();

  bool _isRegister = false;
  bool _obscure = true;
  String? _captchaId;
  String? _captchaImage;

  /// 切换登录/注册时收起上一次的错误：换了模式还挂着旧报错会让人以为新表单也有问题。
  bool _showError = true;

  @override
  void initState() {
    super.initState();
    _loadCaptcha();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _captchaController.dispose();
    super.dispose();
  }

  Future<void> _loadCaptcha() async {
    try {
      final captcha = await ref.read(authApiProvider).fetchCaptcha();
      if (!mounted) {
        return;
      }
      setState(() {
        _captchaId = captcha.enabled ? captcha.captchaId : null;
        _captchaImage = captcha.enabled ? captcha.image : null;
      });
    } catch (_) {
      // 拉不到验证码不阻塞表单：服务端会给出明确错误
    }
  }

  /// 本地提交闸门。
  ///
  /// 为什么不能只靠按钮的 `state.submitting` 置灰：`_submit()` 是 async，
  /// 第一次 `await` 返回前 Riverpod 的 submitting 还没回写到按钮上，
  /// 这段窗口里按钮仍是可点的；键盘「完成」键也能再触发一次。
  /// 结果是**同一个 captchaId 被提交两次**——服务端验证码单次有效，
  /// 第一次明明成功了，第二次必然 400，于是用户看到「验证码错误」，
  /// 而账号其实已经登录（服务端日志可见 200 紧跟 400）。
  ///
  /// 用同步的本地布尔量做闸门：进函数即置位，finally 才释放，
  /// 不依赖任何异步状态回写。
  bool _submitting = false;

  Future<void> _submit() async {
    if (_submitting) {
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }
    _submitting = true;
    setState(() => _showError = true);
    try {
      final auth = ref.read(authControllerProvider.notifier);
      final ok = _isRegister
          ? await auth.register(
              _emailController.text,
              _passwordController.text,
              captchaId: _captchaId,
              captchaCode: _captchaController.text,
            )
          : await auth.login(
              _emailController.text,
              _passwordController.text,
              captchaId: _captchaId,
              captchaCode: _captchaController.text,
            );
      if (ok) {
        // 登录态变化**不会**自动触发 go_router 的 redirect（它只认路由事件），
        // 所以这里必须显式跳转，否则用户会停在登录页、以为没登上。
        if (mounted) {
          context.go('/');
        }
        return;
      }
      // 失败即换一张（单次有效，见文件头注释）
      _captchaController.clear();
      await _loadCaptcha();
    } finally {
      _submitting = false;
    }
  }

  void _toggleMode() {
    setState(() {
      _isRegister = !_isRegister;
      _showError = false;
      _formKey = GlobalKey<FormState>();
    });
    _captchaController.clear();
    _loadCaptcha();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authControllerProvider);
    final colors = context.colors;
    final theme = Theme.of(context);
    final isRegister = _isRegister;

    return Scaffold(
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: <Color>[
              colors.canvasTint.withValues(alpha: 0.72),
              colors.canvas.withValues(alpha: 0),
            ],
            stops: const <double>[0, 0.62],
          ),
        ),
        child: Stack(
          children: <Widget>[
            // 两团柔光：让纯色背景有层次，又不会像插画那样抢主体
            Positioned(
              top: -110,
              right: -80,
              child: _Glow(
                size: 300,
                color: colors.brand.withValues(alpha: 0.16),
              ),
            ),
            Positioned(
              top: 140,
              left: -120,
              child: _Glow(
                size: 260,
                color: const Color(0xFF8B5CF6).withValues(alpha: 0.13),
              ),
            ),
            SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 28, 24, 28),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 420),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: <Widget>[
                          StaggeredEntrance(index: 0, child: const _Brand()),
                          const SizedBox(height: 30),
                          StaggeredEntrance(
                            index: 1,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text(
                                  isRegister ? '创建账号' : '欢迎回来',
                                  style: theme.textTheme.headlineMedium
                                      ?.copyWith(
                                        fontSize: 30,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: -1,
                                      ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  isRegister
                                      ? '一个账号，同步收藏、打卡与复习进度'
                                      : '登录后继续今天的刷题',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: colors.inkSoft,
                                    fontSize: 12.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 22),
                          StaggeredEntrance(
                            index: 2,
                            child: AppCard(
                              padding: const EdgeInsets.fromLTRB(
                                18,
                                20,
                                18,
                                20,
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: <Widget>[
                                  TextFormField(
                                    controller: _emailController,
                                    keyboardType: TextInputType.emailAddress,
                                    textInputAction: TextInputAction.next,
                                    autofillHints: const <String>[
                                      AutofillHints.email,
                                    ],
                                    decoration: const InputDecoration(
                                      hintText: '邮箱',
                                      prefixIcon: Icon(
                                        Icons.alternate_email_rounded,
                                        size: 20,
                                      ),
                                    ),
                                    validator: (value) {
                                      final text = value?.trim() ?? '';
                                      if (text.isEmpty) {
                                        return '请输入邮箱';
                                      }
                                      if (!text.contains('@')) {
                                        return '邮箱格式不正确';
                                      }
                                      return null;
                                    },
                                  ),
                                  const SizedBox(height: 12),
                                  TextFormField(
                                    controller: _passwordController,
                                    obscureText: _obscure,
                                    textInputAction: TextInputAction.next,
                                    autofillHints: const <String>[
                                      AutofillHints.password,
                                    ],
                                    decoration: InputDecoration(
                                      hintText: '密码',
                                      prefixIcon: const Icon(
                                        Icons.lock_outline_rounded,
                                        size: 20,
                                      ),
                                      suffixIcon: IconButton(
                                        onPressed: () => setState(
                                          () => _obscure = !_obscure,
                                        ),
                                        tooltip: _obscure ? '显示密码' : '隐藏密码',
                                        icon: Icon(
                                          _obscure
                                              ? Icons.visibility_off_outlined
                                              : Icons.visibility_outlined,
                                          size: 19,
                                          color: colors.inkFaint,
                                        ),
                                      ),
                                      helperText: isRegister
                                          ? '6~32 位，需同时包含字母和数字'
                                          : null,
                                    ),
                                    validator: (value) {
                                      final text = value ?? '';
                                      if (text.isEmpty) {
                                        return '请输入密码';
                                      }
                                      if (isRegister && text.length < 6) {
                                        return '密码至少 6 位';
                                      }
                                      return null;
                                    },
                                  ),
                                  if (_captchaImage != null) ...<Widget>[
                                    const SizedBox(height: 12),
                                    CaptchaField(
                                      image: _captchaImage!,
                                      controller: _captchaController,
                                      onRefresh: _loadCaptcha,
                                    ),
                                  ],
                                  if (state.error != null &&
                                      _showError) ...<Widget>[
                                    const SizedBox(height: 14),
                                    _ErrorBanner(message: state.error!),
                                  ],
                                  const SizedBox(height: 20),
                                  GradientButton(
                                    label: isRegister ? '注册并登录' : '登录',
                                    icon: isRegister
                                        ? Icons.person_add_alt_1_rounded
                                        : Icons.arrow_forward_rounded,
                                    loading: state.submitting,
                                    onPressed: state.submitting
                                        ? null
                                        : _submit,
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          StaggeredEntrance(
                            index: 3,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: <Widget>[
                                Text(
                                  isRegister ? '已经有账号了？' : '第一次来？',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: colors.inkFaint,
                                  ),
                                ),
                                TextButton(
                                  onPressed: state.submitting
                                      ? null
                                      : _toggleMode,
                                  child: Text(isRegister ? '去登录' : '创建账号'),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 6),
                          Center(
                            child: Text(
                              '每天 20 句 · 间隔重复 · 看图学英语',
                              style: TextStyle(
                                fontSize: 10.5,
                                color: colors.inkFaint,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 品牌行：圆角 Logo + 渐变字标。
class _Brand extends StatelessWidget {
  const _Brand();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(15),
            boxShadow: <BoxShadow>[
              BoxShadow(
                color: const Color(0xFF6366F1).withValues(alpha: 0.28),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(15),
            child: Image.asset(
              'assets/brand/logo.png',
              width: 46,
              height: 46,
              fit: BoxFit.cover,
            ),
          ),
        ),
        const SizedBox(width: 12),
        ShaderMask(
          shaderCallback: (bounds) => brandGradient.createShader(bounds),
          blendMode: BlendMode.srcIn,
          child: const Text(
            '短句',
            style: TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              letterSpacing: 2,
            ),
          ),
        ),
      ],
    );
  }
}

/// 柔光圆（径向渐变，比 blur 滤镜便宜）。
class _Glow extends StatelessWidget {
  const _Glow({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: <Color>[color, color.withValues(alpha: 0)],
          ),
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: colors.danger.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.danger.withValues(alpha: 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.error_outline_rounded, size: 17, color: colors.danger),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: colors.danger,
                fontSize: 12.5,
                height: 1.45,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
