/// 品牌头（品牌标 + 字标），登录/注册页共用。
///
/// 图形用的是 `assets/brand/logo.png`——由 Web 端 `client/public/favicon.svg`
/// 渲染而来（对话泡笑脸）。**不要**退回 Material 的通用图标
/// （Icons.auto_awesome 之类）：与品牌无关，看着像没做完的占位符。
///
/// 与 Web 端 `AuthShell.vue` 的取向一致：图标 + 渐变字标，居中排布。
library;

import 'package:flutter/material.dart';

import '../theme.dart';


class BrandHeader extends StatelessWidget {
  const BrandHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // 品牌标直接用 Web 端 favicon.svg 渲染出的 PNG（见 assets/brand/logo.png），
        // 不再用 Material 的通用图标——那个 sparkles 与品牌无关，看着像占位符。
        ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Image.asset(
            'assets/brand/logo.png',
            width: 56,
            height: 56,
            fit: BoxFit.cover,
          ),
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
