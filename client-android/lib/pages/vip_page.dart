/// 会员中心（路由 `/vip`）。
///
/// 支付方式：Native 扫码——下单返回二维码 PNG（data URL），页内直接渲染；
/// 轮询订单状态直到到账（回调丢失时后端会主动向微信补单）。
/// 与 Web / 小程序同口径：只卖会员（月/年/终身），不做自动续费。
library;

import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../api/models/pay.dart';
import '../api/pay_api.dart';
import '../theme.dart';
import '../widgets/app_card.dart';
import '../widgets/page_header.dart';
import '../widgets/press_scale.dart';
import '../widgets/staggered.dart';

class VipPage extends ConsumerStatefulWidget {
  const VipPage({super.key});

  @override
  ConsumerState<VipPage> createState() => _VipPageState();
}

class _VipPageState extends ConsumerState<VipPage> {
  bool _loading = true;
  bool _paying = false;
  bool _enabled = false;
  String? _error;
  List<PaySku> _skus = const <PaySku>[];
  VipStatus _vip = VipStatus.none;
  String _selected = 'vip_year';

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ref.read(payApiProvider).skus();
      if (!mounted) {
        return;
      }
      setState(() {
        _enabled = data.enabled;
        _skus = data.skus;
        _vip = data.vip;
        if (!_skus.any((item) => item.code == _selected) && _skus.isNotEmpty) {
          _selected = _skus.first.code;
        }
      });
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error.message);
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  /// 下单 → 弹出二维码 → 轮询到账。
  Future<void> _buy() async {
    if (_paying || _skus.isEmpty) {
      return;
    }
    setState(() => _paying = true);
    try {
      final order = await ref.read(payApiProvider).create(_selected);
      if (!mounted) {
        return;
      }
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => _PayQrSheet(
          order: order,
          onPaid: (vip) {
            if (mounted) {
              setState(() => _vip = vip);
            }
            unawaited(_load());
          },
        ),
      );
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) {
        setState(() => _paying = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            children: <Widget>[
              const PageHeader(title: '会员中心', subtitle: '更强的 AI 私教 · 一次购买不自动续费'),
              StaggeredEntrance(
                index: 0,
                offset: const Offset(0, 12),
                child: _HeroCard(vip: _vip),
              ),
              const SizedBox(height: 16),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (!_enabled)
                const AppCard(
                  child: Text(
                    '会员购买暂未开放，支付通道还在接入中，请稍后再来。',
                    style: TextStyle(fontSize: 13.5, height: 1.6),
                  ),
                )
              else ...<Widget>[
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 8, 4, 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: <Widget>[
                      Text('选择套餐', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: colors.ink)),
                      Text('到期不自动续费', style: TextStyle(fontSize: 11.5, color: colors.inkFaint)),
                    ],
                  ),
                ),
                for (var i = 0; i < _skus.length; i++)
                  StaggeredEntrance(
                    index: i + 1,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _PlanCard(
                        sku: _skus[i],
                        selected: _skus[i].code == _selected,
                        onTap: () => setState(() => _selected = _skus[i].code),
                      ),
                    ),
                  ),
                const SizedBox(height: 8),
                PressScale(
                  onTap: _buy,
                  child: Container(
                    height: 52,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: <Color>[Color(0xFFF59E0B), Color(0xFFF97316)]),
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: <BoxShadow>[
                        BoxShadow(color: const Color(0xFFF97316).withValues(alpha: 0.28), blurRadius: 18, offset: const Offset(0, 8)),
                      ],
                    ),
                    child: _paying
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text(
                            '微信扫码支付',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white),
                          ),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  '下单后在本页扫码完成支付，到账后自动刷新。如需退款请联系客服。',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11.5, height: 1.6, color: colors.inkFaint),
                ),
              ],
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: Text(_error!, textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, color: colors.danger)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 顶部会员状态卡（金色渐变）。
class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.vip});

  final VipStatus vip;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(22, 24, 22, 20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: <Color>[Color(0xFFF59E0B), Color(0xFFF97316), Color(0xFFEF4444)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: <BoxShadow>[
          BoxShadow(color: const Color(0xFFF97316).withValues(alpha: 0.3), blurRadius: 24, offset: const Offset(0, 12)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Text('短句会员', style: TextStyle(fontSize: 11, letterSpacing: 1.5, color: Colors.white70)),
                    const SizedBox(height: 6),
                    Text(
                      vip.vip ? '会员已生效' : '解锁更强的 AI 私教',
                      style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w700, color: Colors.white),
                    ),
                    const SizedBox(height: 6),
                    Text(vip.text, style: const TextStyle(fontSize: 12.5, color: Colors.white)),
                  ],
                ),
              ),
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.22), borderRadius: BorderRadius.circular(14)),
                child: const Text('VIP', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              for (final label in <String>['AI 私教 200 次 / 日', '弱项画像', '深度点评'])
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.22), borderRadius: BorderRadius.circular(999)),
                  child: Text(label, style: const TextStyle(fontSize: 10.5, color: Colors.white)),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// 套餐卡（选中金边 + 角标）。
class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.sku, required this.selected, required this.onTap});

  final PaySku sku;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return PressScale(
      onTap: onTap,
      scale: 0.985,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? const Color(0xFFF59E0B) : colors.line, width: selected ? 1.6 : 1),
          boxShadow: selected
              ? <BoxShadow>[
                  BoxShadow(color: const Color(0xFFF59E0B).withValues(alpha: 0.18), blurRadius: 18, offset: const Offset(0, 8)),
                ]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Text(sku.name, style: TextStyle(fontSize: 13, color: colors.inkSoft)),
                const SizedBox(width: 8),
                if (sku.code == 'vip_year')
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFFF97316), borderRadius: BorderRadius.circular(999)),
                    child: const Text('最划算', style: TextStyle(fontSize: 9.5, color: Colors.white)),
                  ),
                const Spacer(),
                if (selected)
                  const Icon(Icons.check_circle_rounded, size: 18, color: Color(0xFFF59E0B)),
              ],
            ),
            const SizedBox(height: 4),
            Text.rich(
              TextSpan(
                children: <InlineSpan>[
                  const TextSpan(text: '¥', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  TextSpan(text: sku.priceText, style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w700)),
                ],
              ),
              style: TextStyle(color: colors.ink),
            ),
            Text(sku.subtitle, style: TextStyle(fontSize: 11.5, color: colors.inkFaint)),
            for (final benefit in sku.benefits.take(3))
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text('· $benefit', style: TextStyle(fontSize: 11.5, height: 1.5, color: colors.inkSoft)),
              ),
          ],
        ),
      ),
    );
  }
}

/// 支付二维码弹层：2.5 秒轮询一次，直到支付成功。
class _PayQrSheet extends ConsumerStatefulWidget {
  const _PayQrSheet({required this.order, required this.onPaid});

  final PayOrderCreated order;
  final void Function(VipStatus vip) onPaid;

  @override
  ConsumerState<_PayQrSheet> createState() => _PayQrSheetState();
}

class _PayQrSheetState extends ConsumerState<_PayQrSheet> {
  Timer? _timer;
  Timer? _ticker;
  bool _paid = false;
  String? _message;
  int _remaining = 0;

  @override
  void initState() {
    super.initState();
    _remaining = _secondsLeft();
    _timer = Timer.periodic(const Duration(milliseconds: 2500), (_) => _poll());
    // 倒计时用独立 Timer：与轮询分开，UI 更平滑
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    _poll();
  }

  void _tick() {
    if (!mounted || _paid) {
      _ticker?.cancel();
      return;
    }
    setState(() => _remaining = _secondsLeft());
    if (_remaining <= 0) {
      _ticker?.cancel();
      setState(() => _message = '二维码已过期，请关闭后重新下单');
    }
  }

  int _secondsLeft() {
    final expires = DateTime.tryParse(widget.order.expiresAt);
    if (expires == null) {
      return 0;
    }
    return expires.difference(DateTime.now().toUtc()).inSeconds.clamp(0, 3600);
  }

  Future<void> _poll() async {
    if (_paid || !mounted) {
      return;
    }
    try {
      final status = await ref.read(payApiProvider).status(widget.order.orderNo);
      if (!mounted || _paid) {
        return;
      }
      if (status.status == 'paid') {
        setState(() {
          _paid = true;
          _message = null;
        });
        _timer?.cancel();
        widget.onPaid(status.vip);
      } else if (status.status == 'closed') {
        setState(() => _message = '订单已关闭，请关闭后重新下单');
      }
    } on ApiException {
      // 网络抖动：下一轮再试
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final dataUrl = widget.order.qrDataUrl ?? '';
    final base64Text = dataUrl.contains(',') ? dataUrl.split(',').last : '';
    final minutes = (_remaining ~/ 60).toString().padLeft(2, '0');
    final seconds = (_remaining % 60).toString().padLeft(2, '0');

    return Container(
      padding: EdgeInsets.fromLTRB(24, 24, 24, 20 + MediaQuery.of(context).padding.bottom),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Container(width: 36, height: 4, decoration: BoxDecoration(color: colors.line, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 18),
          if (_paid) ...<Widget>[
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(color: colors.success.withValues(alpha: 0.12), shape: BoxShape.circle),
              child: Icon(Icons.check_rounded, size: 34, color: colors.success),
            ),
            const SizedBox(height: 14),
            Text('支付成功', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: colors.ink)),
            const SizedBox(height: 6),
            Text('会员权益已到账', style: TextStyle(fontSize: 12.5, color: colors.inkSoft)),
            const SizedBox(height: 18),
            PressScale(
              onTap: () => Navigator.of(context).pop(),
              child: Container(
                height: 46,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: colors.brand, borderRadius: BorderRadius.circular(999)),
                child: const Center(child: Text('开始使用', style: TextStyle(fontSize: 14.5, color: Colors.white, fontWeight: FontWeight.w600))),
              ),
            ),
          ] else ...<Widget>[
            Text('微信扫码支付', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: colors.ink)),
            const SizedBox(height: 4),
            Text(
              '应付 ¥${widget.order.amountText} · 二维码 $minutes:$seconds 后失效',
              style: TextStyle(fontSize: 12.5, color: colors.inkSoft),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: colors.line)),
              child: base64Text.isEmpty
                  ? SizedBox(width: 208, height: 208, child: Center(child: Text('二维码生成中…', style: TextStyle(color: colors.inkFaint, fontSize: 12))))
                  : Image.memory(base64Decode(base64Text), width: 208, height: 208, gaplessPlayback: true),
            ),
            const SizedBox(height: 14),
            Text(
              '打开微信 → 扫一扫 → 确认支付\n支付完成后本页会自动刷新，请勿关闭',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11.5, height: 1.7, color: colors.inkFaint),
            ),
            if (_message != null) ...<Widget>[
              const SizedBox(height: 8),
              Text(_message!, style: TextStyle(fontSize: 12, color: colors.danger)),
            ],
            const SizedBox(height: 14),
            PressScale(
              onTap: () => Navigator.of(context).pop(),
              child: Container(
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: colors.canvasTint, borderRadius: BorderRadius.circular(999)),
                child: Center(child: Text('稍后支付', style: TextStyle(fontSize: 14, color: colors.inkSoft))),
              ),
            ),
          ],
        ],
      ),
    );
  }
}