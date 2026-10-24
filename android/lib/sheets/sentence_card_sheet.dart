/// 句签海报：全屏展示当天领到的句子卡片。
///
/// 设计取向：**像一张真的卡片，而不是一个数据详情**。深色衬底把配图和句子衬出来，
/// 卡片本身有纸张的层次（大圆角、极淡描边、外发光），四周留出呼吸边距。
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../api/auth_api.dart';
import '../api/models/growth.dart';
import '../theme/motion.dart';

/// 弹出一张句签。
Future<void> showSentenceCard(BuildContext context, SentenceCard card) {
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: '关闭',
    barrierColor: const Color(0xCC050B18),
    transitionDuration: Motion.slow,
    pageBuilder: (context, _, _) => _CardPoster(card: card),
    transitionBuilder: (context, animation, secondary, child) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: Motion.decelerate,
        reverseCurve: Motion.accelerate,
      );
      return FadeTransition(
        opacity: curved,
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.92, end: 1).animate(curved),
          child: child,
        ),
      );
    },
  );
}

class _CardPoster extends StatelessWidget {
  const _CardPoster({required this.card});

  final SentenceCard card;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    // showGeneralDialog 不提供 Material：不包一层的话 Text 会落到
    // DefaultTextStyle.fallback()（黄字 + 双下划线），看起来像链接
    return Material(
      type: MaterialType.transparency,
      child: Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: 420, maxHeight: size.height * 0.86),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(30),
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFF0B1224),
                borderRadius: BorderRadius.circular(30),
                border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
                boxShadow: const <BoxShadow>[
                  BoxShadow(
                    color: Color(0x664F46E5),
                    blurRadius: 48,
                    offset: Offset(0, 20),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  // 配图（16:9），底部渐隐到卡片底色，避免生硬切边
                  Stack(
                    children: <Widget>[
                      AspectRatio(
                        aspectRatio: 16 / 9,
                        child: card.imageUrl == null || card.imageUrl!.isEmpty
                            ? const DecoratedBox(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: <Color>[Color(0xFF1E293B), Color(0xFF0B1224)],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                ),
                              )
                            : CachedNetworkImage(
                                imageUrl: staticUrl(card.imageUrl),
                                fit: BoxFit.cover,
                                fadeInDuration: Motion.slow,
                                placeholder: (context, _) => const ColoredBox(
                                  color: Color(0xFF141C30),
                                ),
                                errorWidget: (context, _, _) => const ColoredBox(
                                  color: Color(0xFF141C30),
                                  child: Center(
                                    child: Icon(Icons.image_not_supported_outlined,
                                        color: Colors.white38),
                                  ),
                                ),
                              ),
                      ),
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: 72,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: <Color>[
                                const Color(0xFF0B1224).withValues(alpha: 0),
                                const Color(0xFF0B1224),
                              ],
                            ),
                          ),
                        ),
                      ),
                      // 日期角标
                      Positioned(
                        left: 16,
                        top: 16,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.28),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
                          ),
                          child: Text(
                            card.bizDate,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 18, 22, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Row(
                          children: <Widget>[
                            const Icon(Icons.auto_awesome_rounded,
                                size: 13, color: Color(0xFFFBBF24)),
                            const SizedBox(width: 6),
                            Text(
                              card.titleZh.isEmpty ? card.title : card.titleZh,
                              style: const TextStyle(
                                color: Color(0xFFFBBF24),
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 1.2,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Text(
                          card.sentenceEn,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 21,
                            height: 1.42,
                            fontWeight: FontWeight.w600,
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          card.translationZh,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.62),
                            fontSize: 13.5,
                            height: 1.55,
                          ),
                        ),
                        const SizedBox(height: 22),
                        Row(
                          children: <Widget>[
                            Container(
                              width: 22,
                              height: 22,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(7),
                                gradient: const LinearGradient(
                                  colors: <Color>[Color(0xFF0EA5E9), Color(0xFF8B5CF6)],
                                ),
                              ),
                              child: const Icon(Icons.chat_bubble_rounded,
                                  size: 12, color: Colors.white),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '短句 · 每日一句',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.4),
                                fontSize: 11,
                                letterSpacing: 0.6,
                              ),
                            ),
                            const Spacer(),
                            TextButton(
                              onPressed: () => Navigator.of(context).pop(),
                              style: TextButton.styleFrom(
                                foregroundColor: Colors.white.withValues(alpha: 0.8),
                                padding: const EdgeInsets.symmetric(horizontal: 14),
                              ),
                              child: const Text('收起'),
                            ),
                          ],
                        ),
                      ],
                    ),
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
