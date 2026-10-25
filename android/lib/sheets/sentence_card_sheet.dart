/// 句签海报：全屏展示当天领到的句子卡片。
///
/// 交互按「闪卡」做：打开先看到**卡背**（日期 + 封蜡 + 轻触揭晓），
/// 点一下才翻到正面看到句子与配图，落定时扫过一道光；再点可以翻回去。
///
/// 为什么不直接怼出答案：句签是「今天挣到的奖励」，不是详情页。
/// 少了「开启」这一下，它只是一张带图的句子；有了翻面，它才像一张卡。
///
/// 设计取向：深色衬底把配图和句子衬出来，卡片有纸张的层次（大圆角、
/// 极淡描边、外发光），四周留出呼吸边距。
library;

import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/auth_api.dart';
import '../api/models/growth.dart';
import '../state/tilt.dart';
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

class _CardPoster extends StatefulWidget {
  const _CardPoster({required this.card});

  final SentenceCard card;

  @override
  State<_CardPoster> createState() => _CardPosterState();
}

class _CardPosterState extends State<_CardPoster>
    with TickerProviderStateMixin {
  /// 翻面：0 = 卡背，1 = 正面（句子）。
  late final AnimationController _flip = AnimationController(
    vsync: this,
    duration: Motion.flip,
  );

  /// 落定后的扫光。单独一条控制器：它只跑一次，不受翻面进度影响。
  late final AnimationController _sheen = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );

  /// 目标面（用于无障碍语义与按钮文案）。
  bool _revealed = false;

  /// 系统是否要求减弱动效（翻面直接出结果，不转）。
  bool _reduceMotion = false;

  @override
  void initState() {
    super.initState();
    _flip.addStatusListener((status) {
      // 只在「翻到正面并停稳」时扫光；翻回去不扫（避免来回闪）
      if (status == AnimationStatus.completed && !_reduceMotion) {
        _sheen.forward(from: 0);
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduceMotion = Motion.reduced(context);
  }

  @override
  void dispose() {
    _flip.dispose();
    _sheen.dispose();
    super.dispose();
  }

  void _toggle() {
    HapticFeedback.selectionClick();
    setState(() => _revealed = !_revealed);
    if (_reduceMotion) {
      _flip.value = _revealed ? 1 : 0;
      return;
    }
    if (_revealed) {
      _flip.forward();
    } else {
      _sheen.stop();
      _sheen.value = 0;
      _flip.reverse();
    }
  }

  void _close() => Navigator.of(context).pop();

  /// 最大倾角：与网页端一致（`MAX_TILT * 2` 且 offset 取 ±0.5 → ±8°）。
  static const double _maxTilt = 8 * math.pi / 180;

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
            constraints: BoxConstraints(
              maxWidth: 420,
              maxHeight: size.height * 0.86,
            ),
            child: DeviceTiltScope(
              child: Builder(
                builder: (context) {
                  final tracker = DeviceTiltScope.of(context);
                  return AnimatedBuilder(
                    animation: tracker,
                    // 内容做成重绘边界：姿态 50Hz 刷新时只重算矩阵、重新合成，
                    // 不会每帧重画配图与文字
                    child: RepaintBoundary(child: _buildFlip()),
                    builder: (context, child) {
                      final tilt = tracker.value;
                      return Transform(
                        alignment: Alignment.center,
                        transform: Matrix4.identity()
                          // 透视焦距 ≈ 900px（网页端是 1000px）；再小边缘会被拉变形
                          ..setEntry(3, 2, 0.0011)
                          ..rotateX(-tilt.dy * _maxTilt)
                          ..rotateY(tilt.dx * _maxTilt),
                        child: child,
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// 卡片本体（含翻面）。倾斜矩阵只包在外面，这里与姿态无关。
  Widget _buildFlip() {
    return AnimatedBuilder(
      animation: _flip,
      builder: (context, _) {
        // 翻面用对称曲线：起手与收尾一样缓，像真的把卡片推过去
        final t = Curves.easeInOutCubic.transform(_flip.value);
        final showFront = _flip.value >= 0.5;
        return Transform(
          // 显式按中心旋转：不设 alignment 时默认绕左上角转，观感是「卡片歪着」
          alignment: Alignment.center,
          transform: Matrix4.rotationY(t * math.pi),
          child: Stack(
            alignment: Alignment.center,
            children: <Widget>[
              // 正面同时参与布局：两面高度不同，若只构建当前面，
              // 卡片会在翻到一半（侧对屏幕那一帧）突然「跳高」。
              Transform(
                alignment: Alignment.center,
                // 预旋转 180°：翻过去才是正的，否则背面是镜像文字
                transform: Matrix4.rotationY(math.pi),
                child: Opacity(
                  opacity: showFront ? 1 : 0,
                  child: IgnorePointer(
                    ignoring: !showFront,
                    child: _CardFront(
                      card: widget.card,
                      onFlip: _toggle,
                      onClose: _close,
                    ),
                  ),
                ),
              ),
              Positioned.fill(
                child: Opacity(
                  opacity: showFront ? 0 : 1,
                  child: IgnorePointer(
                    ignoring: showFront,
                    child: _CardBack(card: widget.card, onFlip: _toggle),
                  ),
                ),
              ),
              // 扫光在最上层，跟着卡片一起转
              Positioned.fill(
                child: IgnorePointer(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(30),
                    child: _Sheen(animation: _sheen),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/* ------------------------------ 卡背 ------------------------------ */

/// 卡背：还没翻开时的样子。只给日期与仪式感，不泄露句子。
class _CardBack extends StatelessWidget {
  const _CardBack({required this.card, required this.onFlip});

  final SentenceCard card;
  final VoidCallback onFlip;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '每日句签 ${card.bizDate}，轻触揭晓',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onFlip,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: <Color>[Color(0xFF1A2544), Color(0xFF0B1224)],
            ),
            boxShadow: const <BoxShadow>[
              BoxShadow(
                color: Color(0x664F46E5),
                blurRadius: 48,
                offset: Offset(0, 20),
              ),
            ],
          ),
          child: Stack(
            children: <Widget>[
              // 柔光用径向渐变而不是 blur 滤镜：滤镜在翻面时每帧重绘整层
              const Positioned(top: -70, right: -60, child: _Glow(size: 240)),
              const Positioned(
                bottom: -90,
                left: -70,
                child: _Glow(size: 220, gold: true),
              ),
              // 内嵌细线框：整块深色面板没有边界感，加一道内框才像一张卡
              Positioned.fill(
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.07),
                      ),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(26, 26, 26, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.26),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.16),
                            ),
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
                        const Spacer(),
                        Text(
                          '每日句签',
                          style: TextStyle(
                            color: const Color(0xFFFBBF24)
                                .withValues(alpha: 0.9),
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 2.4,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    Center(child: _raised(26, const _Seal())),
                    const SizedBox(height: 26),
                    const Center(
                      child: Text(
                        '轻触揭晓',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 3,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Center(
                      child: Text(
                        '今天的句子，等你翻开',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.42),
                          fontSize: 11.5,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ),
                    const Spacer(),
                    Center(
                      child: Text(
                        '短句 · 每天一句，慢慢变好',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.28),
                          fontSize: 10.5,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Positioned.fill(
                // 自成一层：姿态 50Hz 刷新只重绘这块高光，
                // 不会把配图与文字一起重新栅格化
                child: RepaintBoundary(child: _Glare()),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 柔光斑：径向渐变到透明。
class _Glow extends StatelessWidget {
  const _Glow({required this.size, this.gold = false});

  final double size;
  final bool gold;

  @override
  Widget build(BuildContext context) {
    final color = gold ? const Color(0xFFF59E0B) : const Color(0xFF6366F1);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: <Color>[
            color.withValues(alpha: 0.26),
            color.withValues(alpha: 0),
          ],
        ),
      ),
    );
  }
}

/// 封蜡：金色圆环 + 星芒。
class _Seal extends StatelessWidget {
  const _Seal();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 96,
      height: 96,
      padding: const EdgeInsets.all(1.5),
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[Color(0xFFFBBF24), Color(0xFFF97316)],
        ),
        boxShadow: <BoxShadow>[
          BoxShadow(color: Color(0x55F59E0B), blurRadius: 28, spreadRadius: 2),
        ],
      ),
      child: Container(
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: Color(0xFF0B1224),
        ),
        child: const Icon(
          Icons.auto_awesome_rounded,
          size: 34,
          color: Color(0xFFFBBF24),
        ),
      ),
    );
  }
}

/* ------------------------------ 正面 ------------------------------ */

/// 正面：配图 + 标题 + 句子 + 译文 + 页脚。
class _CardFront extends StatelessWidget {
  const _CardFront({
    required this.card,
    required this.onFlip,
    required this.onClose,
  });

  final SentenceCard card;
  final VoidCallback onFlip;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '轻触翻回卡背',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onFlip,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
            color: const Color(0xFF0B1224),
            boxShadow: const <BoxShadow>[
              BoxShadow(
                color: Color(0x664F46E5),
                blurRadius: 48,
                offset: Offset(0, 20),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(29),
            child: Stack(
              children: <Widget>[
                Column(
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
                                      colors: <Color>[
                                        Color(0xFF1E293B),
                                        Color(0xFF0B1224),
                                      ],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                  ),
                                )
                              : CachedNetworkImage(
                                  imageUrl: staticUrl(card.imageUrl),
                                  fit: BoxFit.cover,
                                  // 卡片最宽 420dp，按 3 倍屏解码即可，别按原图 1280px 解
                                  memCacheWidth: 1260,
                                  fadeInDuration: Motion.slow,
                                  placeholder: (context, _) => const ColoredBox(
                                    color: Color(0xFF141C30),
                                  ),
                                  errorWidget: (context, _, _) =>
                                      const ColoredBox(
                                        color: Color(0xFF141C30),
                                        child: Center(
                                          child: Icon(
                                            Icons.image_not_supported_outlined,
                                            color: Colors.white38,
                                          ),
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
                          // 抬起一层：倾斜时它会相对配图错开，纵深就出来了
                          child: _raised(
                            18,
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.28),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.18),
                                ),
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
                        ),
                      ],
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(22, 18, 22, 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Row(
                            children: <Widget>[
                              const Icon(
                                Icons.auto_awesome_rounded,
                                size: 13,
                                color: Color(0xFFFBBF24),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  card.titleZh.isEmpty
                                      ? card.title
                                      : card.titleZh,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Color(0xFFFBBF24),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 1.2,
                                  ),
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
                          const SizedBox(height: 20),
                          Row(
                            children: <Widget>[
                              Container(
                                width: 22,
                                height: 22,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(7),
                                  gradient: const LinearGradient(
                                    colors: <Color>[
                                      Color(0xFF0EA5E9),
                                      Color(0xFF8B5CF6),
                                    ],
                                  ),
                                ),
                                child: const Icon(
                                  Icons.chat_bubble_rounded,
                                  size: 12,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  '短句 · 每日一句',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.4),
                                    fontSize: 11,
                                    letterSpacing: 0.6,
                                  ),
                                ),
                              ),
                              _FootAction(label: '翻面', onTap: onFlip),
                              _FootAction(label: '收起', onTap: onClose),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                // 跟手高光压在最上层：白色很淡，压在句子上也读得清
                Positioned.fill(
                  // 自成一层：姿态 50Hz 刷新只重绘这块高光，
                  // 不会把配图与文字一起重新栅格化
                  child: RepaintBoundary(child: _Glare()),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 页脚小按钮：文字按钮天然带内边距，两个并排也不挤。
class _FootAction extends StatelessWidget {
  const _FootAction({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onTap,
      style: TextButton.styleFrom(
        foregroundColor: Colors.white.withValues(alpha: 0.8),
        padding: const EdgeInsets.symmetric(horizontal: 10),
        minimumSize: const Size(0, 40),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
      ),
      child: Text(label),
    );
  }
}

/* ------------------------------ 扫光 ------------------------------ */

/// 翻面落定时扫过的一道斜光。
///
/// 做法是「整卡一层渐变，渐变轴横移」，而不是「一条旋转的亮带平移」：
/// 后者在旋转矩形被裁掉的地方会留下一条硬边框，看着像贴了块半透明色块。
/// 渐变轴本身只有两端的 0 透明度，任何位置被裁都不会出现硬边。
class _Sheen extends StatelessWidget {
  const _Sheen({required this.animation});

  final Animation<double> animation;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        if (animation.value <= 0 || animation.value >= 1) {
          return const SizedBox.shrink();
        }
        final t = Curves.easeInOut.transform(animation.value);
        // 光带中心从左外侧扫到右外侧（Alignment 允许超出 ±1）
        final center = -1.3 + 2.6 * t;
        return IgnorePointer(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment(center - 0.34, -0.5),
                end: Alignment(center + 0.34, 0.5),
                colors: <Color>[
                  Colors.white.withValues(alpha: 0),
                  Colors.white.withValues(alpha: 0.16),
                  Colors.white.withValues(alpha: 0),
                ],
                // 中间一段才是亮带，两端留出纯粹的透明区，
                // 这样它是一道光，而不是给整张卡蒙一层渐变的雾
                stops: const <double>[0.25, 0.5, 0.75],
              ),
            ),
          ),
        );
      },
    );
  }
}

/// 沿 Z 轴抬起一层。透视由外层提供，所以静止时只是略微放大，
/// 倾斜时才会相对卡面错开——纵深靠的是「错开」，不是「放大」。
Widget _raised(double z, Widget child) =>
    Transform(transform: Matrix4.translationValues(0, 0, z), child: child);

/// 跟手高光：网页端是「圆心跟随鼠标」，这里跟随姿态偏移。
///
/// 强度随偏移量增长，静止时为 0——常亮的话，糊在句子上的白斑只会让字更难读。
class _Glare extends StatelessWidget {
  const _Glare();

  @override
  Widget build(BuildContext context) {
    final tracker = DeviceTiltScope.of(context);
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: tracker,
        builder: (context, _) {
          final offset = tracker.value;
          final strength = math.min(1.0, offset.distance * 2.6);
          if (strength < 0.02) {
            return const SizedBox.shrink();
          }
          return Opacity(
            opacity: strength,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(offset.dx * 0.85, offset.dy * 0.85),
                  radius: 0.9,
                  colors: <Color>[
                    Colors.white.withValues(alpha: 0.16),
                    Colors.white.withValues(alpha: 0),
                  ],
                  stops: const <double>[0, 0.72],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
