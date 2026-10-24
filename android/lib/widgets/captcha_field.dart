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
        // 图片即刷新按钮。
        //
        // 尺寸按后端原图比例（120×40 = 3:1）给，**不要写死高度**：
        // 后端 `CaptchaService.buildSvg` 生成的就是 120×40，容器一旦比它「高」，
        // BoxFit.cover 会按短边缩放并把长边裁掉——字符被切头去尾，
        // 用户自然输不对（曾经的 bug：容器 116×52 把图上下各裁了一截）。
        SizedBox(
          width: 120,
          child: AspectRatio(
            aspectRatio: 3,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: onRefresh,
                  child: Image.memory(
                    _decodeBase64(image),
                    fit: BoxFit.fill,
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
