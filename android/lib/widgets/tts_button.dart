/// 朗读按钮：点击朗读传入文本，再点停止。
///
/// 基于原生 TTS 桥（[ttsController]），零新增依赖。两种降级：
/// 1. 原生引擎不支持 / 指定语言不可用 → 整体不渲染（不留空按钮）；
/// 2. 引擎初始化是异步的，首帧可能还没 ready，故可用性探测失败后会再等一会重试一次。
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../state/tts_controller.dart';

class SentenceTtsButton extends StatefulWidget {
  const SentenceTtsButton({
    required this.text,
    this.lang = 'en-US',
    this.compact = false,
    super.key,
  });

  /// 要朗读的文本。
  final String text;

  /// 朗读语言（BPC 47，默认美式英语）。
  final String lang;

  /// true 时用紧凑图标按钮（列表项场景）；false 用带文字的药丸按钮（卡片场景）。
  final bool compact;

  @override
  State<SentenceTtsButton> createState() => _SentenceTtsButtonState();
}

class _SentenceTtsButtonState extends State<SentenceTtsButton> {
  bool _available = false;
  bool _checked = false;
  bool _speaking = false;
  StreamSubscription<String>? _sub;

  @override
  void initState() {
    super.initState();
    // 监听原生回传的完成事件，朗读结束后把按钮复位。
    // onError 容错：测试环境没有平台 handler 时忽略，不崩测试。
    _sub = ttsController.events.listen(
      (event) {
        if (event == 'done' || event == 'error') {
          if (mounted) setState(() => _speaking = false);
        }
      },
      onError: (_) {},
    );
    _checkAvailability();
  }

  Future<void> _checkAvailability() async {
    try {
      var ok = await ttsController.isLanguageAvailable(widget.lang);
      // 首帧引擎可能还没初始化完成，稍等再探一次
      if (!ok) {
        await Future<void>.delayed(const Duration(milliseconds: 600));
        ok = await ttsController.isLanguageAvailable(widget.lang);
      }
      if (mounted) {
        setState(() {
          _available = ok;
          _checked = true;
        });
      }
    } catch (_) {
      // 通道不可用（无 TTS 引擎 / 测试环境）→ 标记已探测但不可用，整体隐藏
      if (mounted) setState(() => _checked = true);
    }
  }

  Future<void> _toggle() async {
    try {
      if (_speaking) {
        await ttsController.stop();
        if (mounted) setState(() => _speaking = false);
        return;
      }
      final ok = await ttsController.speak(widget.text, lang: widget.lang);
      if (mounted) setState(() => _speaking = ok);
    } catch (_) {
      if (mounted) setState(() => _speaking = false);
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // 未探测完 / 不可用：不渲染
    if (!_checked || !_available) {
      return const SizedBox.shrink();
    }

    if (widget.compact) {
      return IconButton(
        onPressed: _toggle,
        icon: Icon(
          _speaking ? Icons.stop_circle_rounded : Icons.volume_up_rounded,
        ),
        tooltip: _speaking ? '停止朗读' : '朗读',
        visualDensity: VisualDensity.compact,
      );
    }

    // 药丸按钮：与句签卡脚同一套「白底 + 琥珀字 + 细环」
    return GestureDetector(
      onTap: _toggle,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: _speaking ? const Color(0xFFFEF3C7) : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: const Color(0xFFFDE68A).withValues(alpha: 0.6),
          ),
          boxShadow: const <BoxShadow>[
            BoxShadow(
              color: Color(0x140F172A),
              blurRadius: 10,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              _speaking ? Icons.stop_circle_rounded : Icons.volume_up_rounded,
              size: 14,
              color: const Color(0xFFD97706),
            ),
            const SizedBox(width: 4),
            Text(
              _speaking ? '停止' : '朗读',
              style: const TextStyle(
                color: Color(0xFFD97706),
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
