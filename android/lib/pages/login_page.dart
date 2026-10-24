/// 登录 / 注册页。
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

import '../api/auth_api.dart';
import '../api/models/user.dart';
import '../state/auth_controller.dart';
import '../widgets/brand_header.dart';
import '../widgets/captcha_field.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _captchaController = TextEditingController();

  bool _isRegister = false;
  String? _captchaId;
  String? _captchaImage;

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

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }
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
    if (!ok) {
      // 失败即换一张（单次有效，见文件头注释）
      _captchaController.clear();
      await _loadCaptcha();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authControllerProvider);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const BrandHeader(),
                    const SizedBox(height: 32),
                    Text(
                      _isRegister ? '创建账号' : '欢迎回来',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _isRegister ? '一个账号同步收藏、打卡与复习进度' : '登录后继续今天的刷题',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                    ),
                    const SizedBox(height: 24),
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.email],
                      decoration: const InputDecoration(
                        labelText: '邮箱',
                        prefixIcon: Icon(Icons.mail_outline),
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
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: true,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [
                        AutofillHints.password,
                      ],
                      decoration: InputDecoration(
                        labelText: '密码',
                        prefixIcon: const Icon(Icons.lock_outline),
                        helperText: _isRegister ? '6~32 位，需同时包含字母和数字' : null,
                      ),
                      validator: (value) {
                        final text = value ?? '';
                        if (text.isEmpty) {
                          return '请输入密码';
                        }
                        if (_isRegister && text.length < 6) {
                          return '密码至少 6 位';
                        }
                        return null;
                      },
                    ),
                    if (_captchaImage != null) ...[
                      const SizedBox(height: 16),
                      CaptchaField(
                        image: _captchaImage!,
                        controller: _captchaController,
                        onRefresh: _loadCaptcha,
                      ),
                    ],
                    if (state.error != null) ...[
                      const SizedBox(height: 16),
                      _ErrorBanner(message: state.error!),
                    ],
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: state.submitting ? null : _submit,
                      child: state.submitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(_isRegister ? '注册并登录' : '登录'),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: state.submitting
                          ? null
                          : () {
                                setState(() => _isRegister = !_isRegister);
                                _captchaController.clear();
                                _loadCaptcha();
                              },
                      child: Text(_isRegister ? '已有账号？去登录' : '还没有账号？去注册'),
                    ),
                  ],
                ),
              ),
            ),
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
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: scheme.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, size: 18, color: scheme.onErrorContainer),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: scheme.onErrorContainer, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

/// 供路由使用的「当前用户」便捷读取（登录成功后 HomePage 立即展示）。
UserProfile? currentUser(AuthState state) => state.user;
