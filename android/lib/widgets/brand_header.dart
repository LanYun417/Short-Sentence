/// 品牌头（Logo + 字标），登录/注册页共用。
///
/// 与 Web 端 `AuthShell.vue` 的做法一致：图标 + 渐变字标，
/// 刻意不用 logo.svg（它的 viewBox 留白大，缩放后显小且不居中）。
library;

import 'package:flutter/material.dart';

import '../theme.dart';

class BrandHeader extends StatelessWidget {
  const BrandHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            gradient: brandGradient,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: brandGradientMid.withValues(alpha: 0.25),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: const Icon(Icons.auto_awesome, color: Colors.white, size: 28),
        ),
        const SizedBox(height: 12),
        ShaderMask(
          shaderCallback: (bounds) => brandGradient.createShader(bounds),
          child: const Text(
            '短句',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              letterSpacing: 1,
            ),
          ),
        ),
      ],
    );
  }
}
