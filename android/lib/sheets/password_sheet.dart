/// 修改密码弹窗。
///
/// 改密成功后服务端会写 `passwordChangedAt`，旧令牌随即失效——
/// 所以这里**不做「静默继续」**：明确告诉用户需要重新登录，并主动回到登录页，
/// 否则用户会在下一次请求时才被弹出去，以为 App 出了故障。
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/password_policy.dart';
import '../state/auth_controller.dart';
import '../theme/palette.dart';

/// 打开改密弹窗；返回 true 表示密码已修改（调用方负责引导重新登录）。
Future<bool> showPasswordSheet(BuildContext context) async {
  final changed = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => const _PasswordSheet(),
  );
  return changed ?? false;
}

class _PasswordSheet extends ConsumerStatefulWidget {
  const _PasswordSheet();

  @override
  ConsumerState<_PasswordSheet> createState() => _PasswordSheetState();
}

class _PasswordSheetState extends ConsumerState<_PasswordSheet> {
  final _old = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  /// 邮箱验证码（改密必须验证邮箱归属：光有旧密码不够）
  final _code = TextEditingController();

  bool _obscure = true;
  bool _saving = false;
  String? _error;
  bool _sendingCode = false;
  int _codeCountdown = 0;
  Timer? _codeTimer;
  String? _codeMessage;

  @override
  void dispose() {
    _codeTimer?.cancel();
    _old.dispose();
    _next.dispose();
    _confirm.dispose();
    _code.dispose();
    super.dispose();
  }

  /// 发送验证码到当前账号邮箱（60 秒倒计时）。
  Future<void> _sendCode() async {
    final email = ref.read(authControllerProvider).user?.email ?? '';
    if (email.isEmpty) {
      setState(() => _codeMessage = '未获取到账号邮箱，请重新登录后重试');
      return;
    }
    setState(() {
      _sendingCode = true;
      _codeMessage = null;
    });
    final failure = await ref
        .read(authControllerProvider.notifier)
        .sendEmailCode(email: email, purpose: 'reset');
    if (!mounted) {
      return;
    }
    setState(() {
      _sendingCode = false;
      _codeMessage = failure ?? '验证码已发送，请查收邮箱（含垃圾箱）';
    });
    if (failure != null) {
      return;
    }
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

  Future<void> _submit() async {
    if (_saving) {
      return;
    }
    final oldPassword = _old.text;
    final newPassword = _next.text;
    if (oldPassword.isEmpty) {
      setState(() => _error = '请输入原密码');
      return;
    }
    if (!isPasswordLengthValid(newPassword)) {
      setState(() => _error = kPasswordHint);
      return;
    }
    final hasLetter = RegExp('[A-Za-z]').hasMatch(newPassword);
    final hasDigit = RegExp('[0-9]').hasMatch(newPassword);
    if (!hasLetter || !hasDigit) {
      setState(() => _error = '新密码需同时包含字母和数字');
      return;
    }
    if (newPassword != _confirm.text) {
      setState(() => _error = '两次输入的新密码不一致');
      return;
    }
    final emailCode = _code.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(emailCode)) {
      setState(() => _error = '请输入 6 位邮箱验证码');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final error = await ref.read(authControllerProvider.notifier).changePassword(
          oldPassword: oldPassword,
          newPassword: newPassword,
          emailCode: emailCode,
        );
    if (!mounted) {
      return;
    }
    if (error != null) {
      setState(() {
        _saving = false;
        _error = error;
      });
      return;
    }
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final theme = Theme.of(context);

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 2, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(child: Text('修改密码', style: theme.textTheme.titleLarge)),
                  IconButton(
                    onPressed: () => setState(() => _obscure = !_obscure),
                    icon: Icon(
                      _obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                      size: 20,
                      color: colors.inkSoft,
                    ),
                    tooltip: _obscure ? '显示密码' : '隐藏密码',
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '修改后需要用新密码重新登录',
                style: theme.textTheme.labelSmall?.copyWith(color: colors.inkFaint),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: _old,
                obscureText: _obscure,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(hintText: '原密码'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _next,
                obscureText: _obscure,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(hintText: '新密码（$kPasswordHint）'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _confirm,
                obscureText: _obscure,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(hintText: '再输入一次新密码'),
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: _code,
                      keyboardType: TextInputType.number,
                      textInputAction: TextInputAction.done,
                      maxLength: 6,
                      onSubmitted: (_) => _submit(),
                      decoration: const InputDecoration(
                        hintText: '邮箱验证码',
                        counterText: '',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: OutlinedButton(
                      onPressed: (_sendingCode || _codeCountdown > 0) ? null : _sendCode,
                      child: Text(
                        _sendingCode
                            ? '发送中'
                            : _codeCountdown > 0
                                ? '${_codeCountdown}s'
                                : '发送验证码',
                        style: const TextStyle(fontSize: 12.5),
                      ),
                    ),
                  ),
                ],
              ),
              if (_codeMessage != null) ...<Widget>[
                const SizedBox(height: 4),
                Text(
                  _codeMessage!,
                  style: TextStyle(fontSize: 12, color: colors.inkSoft),
                ),
              ],
              if (_error != null) ...<Widget>[
                const SizedBox(height: 12),
                Row(
                  children: <Widget>[
                    Icon(Icons.error_outline_rounded, size: 16, color: colors.danger),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _error!,
                        style: TextStyle(color: colors.danger, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _saving ? null : _submit,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('确认修改'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
