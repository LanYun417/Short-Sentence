/// 登录 / 注册页。
///
/// 视觉上与新外壳对齐：柔光背景 + 白卡表单 + 品牌渐变主按钮，
/// 而不是把输入框直接铺在页面上——登录是用户看到的第一屏，
/// 观感不统一会让后面的页面显得「两个 App」。
///
/// **验证策略**（与 Web 端一致）：
/// - 登录：账号 + 密码即可，**不再需要验证码**（防爆破靠 IP 限流 + 账号失败锁定）；
/// - 注册：必须先获取邮箱验证码（`/client/auth/email-code`），60 秒一封、5 分钟有效。
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/gestures.dart';
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../config/app_config.dart';
import '../config/password_policy.dart';
import '../services/url_launcher.dart';
import '../state/auth_controller.dart';
import '../theme.dart';
import '../widgets/app_card.dart';
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
  /// 注册用的邮箱验证码
  final _emailCodeController = TextEditingController();

  bool _isRegister = false;
  bool _obscure = true;
  /// 验证码发送中
  bool _sendingCode = false;
  /// 重发倒计时（秒，0 = 可发送）
  int _codeCountdown = 0;
  Timer? _codeTimer;
  /// 验证码相关的行内提示（发送成功 / 失败原因）
  String? _codeMessage;
  /// 是否已勾选同意用户协议与隐私政策（注册前置）
  bool _agreed = false;
  /// 未勾选协议的行内报错（点注册时才出现，不提前红脸）
  String? _agreedError;

  /// 切换登录/注册时收起上一次的错误：换了模式还挂着旧报错会让人以为新表单也有问题。
  bool _showError = true;

  @override
  void dispose() {
    _codeTimer?.cancel();
    _emailController.dispose();
    _passwordController.dispose();
    _emailCodeController.dispose();
    super.dispose();
  }

  /// 发送注册验证码（60 秒倒计时；失败原因直接展示在表单里）。
  Future<void> _sendCode() async {
    final email = _emailController.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _codeMessage = '请先填写正确的邮箱');
      return;
    }
    setState(() {
      _sendingCode = true;
      _codeMessage = null;
    });
    final failure = await ref
        .read(authControllerProvider.notifier)
        .sendEmailCode(email: email, purpose: 'register');
    if (!mounted) {
      return;
    }
    setState(() {
      _sendingCode = false;
      _codeMessage = failure ?? '验证码已发送，请查收邮箱（含垃圾箱）';
    });
    if (failure == null) {
      _startCountdown();
    }
  }

  void _startCountdown() {
    _codeTimer?.cancel();
    setState(() => _codeCountdown = 60);
    _codeTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        _codeCountdown -= 1;
        if (_codeCountdown <= 0) {
          timer.cancel();
        }
      });
    });
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
    // 注册必须勾选协议（服务端 also 强校验，这里先挡一步给明确行内提示）
    if (_isRegister && !_agreed) {
      setState(() => _agreedError = '请先阅读并同意用户协议与隐私政策');
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
              emailCode: _emailCodeController.text.trim(),
              agreed: _agreed,
            )
          : await auth.login(_emailController.text, _passwordController.text);
      if (ok) {
        // 登录态变化**不会**自动触发 go_router 的 redirect（它只认路由事件），
        // 所以这里必须显式跳转，否则用户会停在登录页、以为没登上。
        if (mounted) {
          context.go('/');
        }
        return;
      }
    } finally {
      _submitting = false;
    }
  }

  void _toggleMode() {
    setState(() {
      _isRegister = !_isRegister;
      _showError = false;
      _formKey = GlobalKey<FormState>();
      _codeMessage = null;
      // 回登录模式时清掉勾选态：下次注册要重新确认
      if (!_isRegister) {
        _agreed = false;
        _agreedError = null;
      }
    });
    _emailCodeController.clear();
  }

  /// 法务链接段（《用户协议》/《隐私政策》）：点击走原生桥开系统浏览器，
  /// 零新增运行时依赖。地址由 apiBaseUrl 去掉 /api 推导（同源部署即站点根）。
  TextSpan _legalLinkSpan(String text, String url) {
    return TextSpan(
      text: text,
      style: TextStyle(
        color: context.colors.brand,
        fontWeight: FontWeight.w600,
      ),
      recognizer: TapGestureRecognizer()..onTap = () => UrlLauncher.open(url),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authControllerProvider);
    final colors = context.colors;
    final theme = Theme.of(context);
    final isRegister = _isRegister;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: systemUiOverlay(context, navBarColor: colors.canvas),
      child: Scaffold(
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
                                      helperText: isRegister ? kPasswordHint : null,
                                    ),
                                    validator: (value) {
                                      final text = value ?? '';
                                      if (text.isEmpty) {
                                        return '请输入密码';
                                      }
                                      if (isRegister && text.length < kPasswordMinLength) {
                                        return '密码至少 $kPasswordMinLength 位';
                                      }
                                      return null;
                                    },
                                  ),
                                  // 注册才需要邮箱验证码：登录是账号 + 密码
                                  if (isRegister) ...<Widget>[
                                    const SizedBox(height: 12),
                                    Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: <Widget>[
                                        Expanded(
                                          child: TextFormField(
                                            controller: _emailCodeController,
                                            keyboardType:
                                                TextInputType.number,
                                            textInputAction:
                                                TextInputAction.done,
                                            maxLength: 6,
                                            decoration: const InputDecoration(
                                              hintText: '邮箱验证码',
                                              counterText: '',
                                              prefixIcon: Icon(
                                                Icons.shield_outlined,
                                                size: 20,
                                              ),
                                            ),
                                            validator: (value) {
                                              final text =
                                                  value?.trim() ?? '';
                                              if (!RegExp(
                                                r'^\d{6}$',
                                              ).hasMatch(text)) {
                                                return '请输入 6 位邮箱验证码';
                                              }
                                              return null;
                                            },
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Padding(
                                          padding: const EdgeInsets.only(
                                            top: 2,
                                          ),
                                          child: OutlinedButton(
                                            onPressed:
                                                (_sendingCode ||
                                                    _codeCountdown > 0)
                                                ? null
                                                : _sendCode,
                                            child: Text(
                                              _sendingCode
                                                  ? '发送中'
                                                  : _codeCountdown > 0
                                                  ? '${_codeCountdown}s'
                                                  : '发送验证码',
                                              style: const TextStyle(
                                                fontSize: 12.5,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (_codeMessage != null) ...<Widget>[
                                      const SizedBox(height: 6),
                                      Text(
                                        _codeMessage!,
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: colors.inkSoft,
                                        ),
                                      ),
                                    ],
                                    // 协议勾选：注册即同意时点，不勾不给提交
                                    const SizedBox(height: 14),
                                    Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: <Widget>[
                                        SizedBox(
                                          width: 26,
                                          height: 26,
                                          child: Checkbox(
                                            value: _agreed,
                                            onChanged: (value) => setState(() {
                                              _agreed = value ?? false;
                                              if (_agreed) {
                                                _agreedError = null;
                                              }
                                            }),
                                            materialTapTargetSize:
                                                MaterialTapTargetSize.shrinkWrap,
                                          ),
                                        ),
                                        const SizedBox(width: 2),
                                        Expanded(
                                          child: Text.rich(
                                            TextSpan(
                                              style: TextStyle(
                                                fontSize: 12,
                                                height: 1.5,
                                                color: colors.inkSoft,
                                              ),
                                              children: <InlineSpan>[
                                                const TextSpan(
                                                  text: '已仔细阅读并同意',
                                                ),
                                                _legalLinkSpan(
                                                  '《用户协议》',
                                                  '${AppConfig.staticBaseUrl}/terms',
                                                ),
                                                const TextSpan(text: '与'),
                                                _legalLinkSpan(
                                                  '《隐私政策》',
                                                  '${AppConfig.staticBaseUrl}/privacy',
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (_agreedError != null) ...<Widget>[
                                      const SizedBox(height: 4),
                                      Text(
                                        _agreedError!,
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: colors.danger,
                                        ),
                                      ),
                                    ],
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
