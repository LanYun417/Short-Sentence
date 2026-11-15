/// 注销账号页（路由 /account-delete）。
///
/// 注销**不可逆**，所以三道关（与小程序 `pages/account-delete`、Web
/// `pages/account-delete.vue` 同构）：
/// 1. 必须填邮箱验证码——光有登录态不够，那可能只是别人开着的手机；
/// 2. 原因可选——不能拿问卷卡住用户的注销权利，但选了会匿名留存；
/// 3. 提交前再确认一次（不是防用户，是防手滑）。
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/api_exception.dart';
import '../api/auth_api.dart';
import '../state/auth_controller.dart';
import '../theme/palette.dart';
import '../widgets/app_card.dart';
import '../widgets/page_header.dart';
import '../widgets/press_scale.dart';

/// 注销原因（与后端 `DELETION_REASON_TYPES` 对齐；不选则不传）。
class _Reason {
  const _Reason(this.value, this.label);

  final String value;
  final String label;
}

const List<_Reason> _reasons = <_Reason>[
  _Reason('no_time', '没时间练'),
  _Reason('too_hard', '内容太难'),
  _Reason('content', '内容不满意'),
  _Reason('bugs', '使用有问题'),
  _Reason('privacy', '隐私顾虑'),
  _Reason('other', '其他原因'),
];

class AccountDeletePage extends ConsumerStatefulWidget {
  const AccountDeletePage({super.key});

  @override
  ConsumerState<AccountDeletePage> createState() => _AccountDeletePageState();
}

class _AccountDeletePageState extends ConsumerState<AccountDeletePage> {
  /// 重发间隔（与后端 60 秒节流一致）
  static const int _resendSeconds = 60;

  final TextEditingController _detail = TextEditingController();
  final TextEditingController _code = TextEditingController();

  /// 选中的原因（null = 未选择，提交时不传）
  String? _reason;
  bool _sending = false;
  bool _submitting = false;
  int _countdown = 0;
  Timer? _timer;
  String? _message;

  @override
  void dispose() {
    _timer?.cancel();
    _detail.dispose();
    _code.dispose();
    super.dispose();
  }

  AuthApi get _api => ref.read(authApiProvider);

  /// 60 秒重发倒计时。
  void _startCountdown() {
    _timer?.cancel();
    setState(() => _countdown = _resendSeconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (Timer timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_countdown <= 1) {
        timer.cancel();
        setState(() => _countdown = 0);
        return;
      }
      setState(() => _countdown -= 1);
    });
  }

  /// 发注销验证码（服务端只发给本人邮箱）。
  Future<void> _sendCode() async {
    if (_sending || _countdown > 0) {
      return;
    }
    setState(() {
      _sending = true;
      _message = null;
    });
    try {
      await _api.sendDeletionCode();
      if (!mounted) {
        return;
      }
      _startCountdown();
      setState(() => _message = '验证码已发送，请查收邮箱');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _message = error.message);
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }

  /// 提交：校验 → 确认 → 注销。
  Future<void> _submit() async {
    if (_submitting) {
      return;
    }
    if (_code.text.trim().length != 6) {
      setState(() => _message = '请先获取并填写 6 位邮箱验证码');
      return;
    }

    final colors = context.colors;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('确认注销？'),
        content: const Text('注销后账号无法找回：学习记录、成就、收藏与打卡都会被清除。'),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('再想想'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: colors.danger),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('确认注销'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      return;
    }

    setState(() {
      _submitting = true;
      _message = null;
    });
    try {
      await _api.deleteAccount(
        emailCode: _code.text,
        reasonType: _reason,
        reasonDetail: _detail.text,
      );
      // 服务端已令令牌失效：清本地态后回登录页
      await ref.read(authControllerProvider.notifier).logout();
      if (!mounted) {
        return;
      }
      context.go('/login');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _message = error.message);
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final theme = Theme.of(context);
    final String? email = ref.watch(authControllerProvider).user?.email;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
          children: <Widget>[
            PageHeader(title: '注销账号', subtitle: '注销不可逆，请先确认已知悉下面的影响'),

            // 影响说明
            AppCard(
              padding: const EdgeInsets.all(16),
              color: colors.danger.withValues(alpha: 0.06),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    '注销后会发生什么',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: colors.danger,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _WarnLine('学习记录、错题本与收藏会被清除', color: colors.danger),
                  _WarnLine('经验值、成就、打卡与排行榜名次会消失', color: colors.danger),
                  _WarnLine('账号无法找回；原邮箱可重新注册一个全新账号', color: colors.danger),
                ],
              ),
            ),

            // 原因（可选）
            AppCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: <Widget>[
                      Text(
                        '为什么离开',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '可选，不填也能注销',
                        style: TextStyle(fontSize: 11, color: colors.inkFaint),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: <Widget>[
                      for (final _Reason item in _reasons)
                        _ReasonChip(
                          label: item.label,
                          selected: _reason == item.value,
                          onTap: () => setState(() {
                            // 再点一次取消选择
                            _reason = _reason == item.value ? null : item.value;
                          }),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _Field(
                    controller: _detail,
                    hint: '想补充两句？我们会认真看（可不填）',
                    maxLines: 3,
                    maxLength: 200,
                  ),
                ],
              ),
            ),

            // 身份校验
            AppCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    '身份校验',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '验证码将发送到 ${email ?? '账号邮箱'}',
                    style: TextStyle(fontSize: 11.5, color: colors.inkFaint),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: _Field(
                          controller: _code,
                          hint: '邮箱收到的 6 位验证码',
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                        ),
                      ),
                      const SizedBox(width: 8),
                      PressScale(
                        onTap: _sending || _countdown > 0 ? null : _sendCode,
                        child: Container(
                          height: 46,
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: _countdown > 0
                                ? colors.cardMuted
                                : colors.brand.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Text(
                            _countdown > 0
                                ? '$_countdown s 后重发'
                                : (_sending ? '发送中…' : '获取验证码'),
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                              color: _countdown > 0
                                  ? colors.inkFaint
                                  : colors.brand,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            if (_message != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  _message!,
                  style: TextStyle(fontSize: 12.5, color: colors.inkSoft),
                ),
              ),

            const SizedBox(height: 16),
            PressScale(
              onTap: _submitting ? null : _submit,
              child: Container(
                height: 50,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colors.danger,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.2,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        '注销账号',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: Text(
                '注销后如需继续练习，可用原邮箱重新注册',
                style: TextStyle(fontSize: 11.5, color: colors.inkFaint),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/* ------------------------------ 小组件 ------------------------------ */

/// 警戒行。
class _WarnLine extends StatelessWidget {
  const _WarnLine(this.text, {required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text('· ', style: TextStyle(fontSize: 13, height: 1.5, color: color)),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 12.5,
                height: 1.5,
                color: color.withValues(alpha: 0.9),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 原因标签（可反选）。
class _ReasonChip extends StatelessWidget {
  const _ReasonChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return PressScale(
      onTap: onTap,
      scale: 0.95,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected
              ? colors.brand.withValues(alpha: 0.12)
              : colors.cardMuted,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? colors.brand : Colors.transparent,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? colors.brand : colors.inkSoft,
          ),
        ),
      ),
    );
  }
}

/// 输入框（标题、说明由调用方给）。
class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.hint,
    this.maxLines = 1,
    this.maxLength,
    this.keyboardType,
  });

  final TextEditingController controller;
  final String hint;
  final int maxLines;
  final int? maxLength;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return TextField(
      controller: controller,
      maxLines: maxLines,
      maxLength: maxLength,
      keyboardType: keyboardType,
      style: const TextStyle(fontSize: 13.5),
      decoration: InputDecoration(
        hintText: hint,
        counterText: '',
        isDense: true,
        hintStyle: TextStyle(fontSize: 12.5, color: colors.inkFaint),
        filled: true,
        fillColor: colors.cardMuted,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 12,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }
}
