/// 图形验证码输入（登录 / 注册共用）。
///
/// 图片本身就是「刷新」按钮——用户看不清时的第一反应就是点图，
/// 与 Web 端 `CaptchaField.vue` 的处理一致。
library;

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class CaptchaField extends StatelessWidget {
  const CaptchaField({
    required this.image,
    required this.controller,
    required this.onRefresh,
    super.key,
  });

  /// `data:image/png;base64,...`
  final String image;

  final TextEditingController controller;

  /// 点击图片刷新。
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: TextFormField(
            controller: controller,
            textInputAction: TextInputAction.done,
            textCapitalization: TextCapitalization.characters,
            inputFormatters: [
              LengthLimitingTextInputFormatter(10),
              FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]')),
            ],
            decoration: const InputDecoration(
              labelText: '验证码',
              prefixIcon: Icon(Icons.shield_outlined),
              hintText: '输入图片中的字符',
            ),
            validator: (value) {
              if ((value ?? '').trim().isEmpty) {
                return '请输入验证码';
              }
              return null;
            },
          ),
        ),
        const SizedBox(width: 12),
        // 图片即刷新按钮；固定尺寸避免键盘弹出时布局跳动
        SizedBox(
          width: 116,
          height: 52,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onRefresh,
                child: Image.memory(
                  _decodeBase64(image),
                  fit: BoxFit.cover,
                  gaplessPlayback: true,
                  errorBuilder: (context, error, stack) => const ColoredBox(
                    color: Color(0xFFE2E8F0),
                    child: Center(child: Icon(Icons.refresh, size: 20)),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// 从 data URI 中解出 PNG 字节。
Uint8List _decodeBase64(String dataUri) {
  final comma = dataUri.indexOf(',');
  final payload = comma >= 0 ? dataUri.substring(comma + 1) : dataUri;
  return base64Decode(payload);
}
