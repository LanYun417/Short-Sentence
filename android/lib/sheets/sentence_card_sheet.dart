/// 句签闪卡：全屏展示当天领到的句子卡片。
///
/// **视觉与网页端（client/app/components/SentenceCard.vue）保持一致**——
/// 这是标志性元素，跨端必须长得一样：浅色照片卡、句子压在配图上、
/// 琥珀色细环、白色卡脚。手机端只额外做两件事：翻开前的卡背，以及用设备姿态
/// 代替鼠标驱动 3D 视差。
///
/// 网页端结构（照抄）：
///   配图块（rounded-3xl + 琥珀环 + 投影）
///     ├─ 镭射层（彩虹带，随姿态滑动）
///     ├─ 渐隐蒙版（黑 75% → 35% → 透明，占图高 2/3）
///     ├─ 徽标行（左：白底琥珀字「今日句签 · 已获得」；右：黑底白字日期）
///     └─ 文案（中文标题 + 英文标题 + 句子 + 译文，压在图底部）
///   卡脚（白底、琥珀字、彩带图标）
library;

import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/auth_api.dart';
import '../api/models/growth.dart';
import '../state/tilt.dart';
import '../theme/motion.dart';

/* ------------------------------ 色板（与网页端一致） ------------------------------ */

const Color _amber600 = Color(0xFFD97706);
const Color _amber200 = Color(0xFFFDE68A);
const Color _slate100 = Color(0xFFF1F5F9);
const Color _slate400 = Color(0xFF94A3B8);
const Color _slate500 = Color(0xFF64748B);
const Color _slate800 = Color(0xFF1E293B);

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

/// 寄语兜底（老卡片没有寄语内容）。
const String _fallbackBlessing = '愿你今天，也有一句刚好合心意的话。';

String _blessingOf(SentenceCard card) =>
    card.blessing.trim().isEmpty ? _fallbackBlessing : card.blessing.trim();

/// 网页端把 bizDate 显示成「10月25日」，这里保持一致。
String _dateLabel(String bizDate) {
  final parts = bizDate.split('-');
  if (parts.length < 3) {
    return bizDate;
  }
  final month = int.tryParse(parts[1]);
  final day = int.tryParse(parts[2]);
  if (month == null || day == null) {
    return bizDate;
  }
  return '$month月$day日';
}

class _CardPoster extends StatefulWidget {
  const _CardPoster({required this.card});

  final SentenceCard card;

  @override
  State<_CardPoster> createState() => _CardPosterState();
}

class _CardPosterState extends State<_CardPoster>
    with TickerProviderStateMixin {
  /// 翻面：0 = 卡背，1 = 正面（句子），2 与 0 视觉等价（整圈）。
  ///
  /// 上界放到 2 是「单向翻转」的关键：翻回来是 `animateTo(2)`（继续转下半圈），
  /// 要是用默认上界 1，目标值会被钳成 1，翻回去时控制器动也不动。
  late final AnimationController _flip = AnimationController(
    vsync: this,
    duration: Motion.flip,
    lowerBound: 0,
    upperBound: 2,
  );

  /// 落定后的扫光。单独一条控制器：它只跑一次，不受翻面进度影响。
  late final AnimationController _sheen = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );

  /// 目标面（用于无障碍语义）。
  bool _revealed = false;

  /// 翻面「忙」锁：翻面与扫光这段时间里忽略再次点击。
  ///
  /// 两个理由：一是转一半时目标值就乱了，翻回来会倒着转（正是要避免的）；
  /// 二是框架偶尔会把同一次点击的 up 重复投递，第二次落在动画落定之后，
  /// 实测没有这把锁，点一下会翻回去（测试框架里必现，真机上也偶发）。
  bool _busy = false;

  /// 解锁用的定时器：留着引用，弹窗关掉时要取消，
  /// 否则「Timer is still pending」会让 Widget 测试直接失败。
  Timer? _unlock;

  /// 锁定时长：翻到正面是「翻面 520 + 扫光 900」；翻回封面只转 520。
  static const Duration _settleFront = Duration(milliseconds: 1500);
  static const Duration _settleBack = Duration(milliseconds: 600);

  bool _reduceMotion = false;

  @override
  void initState() {
    super.initState();
    _flip.addStatusListener((status) {
      if (status != AnimationStatus.completed) {
        return;
      }
      // 落定后归位：2π 与 0 视觉等价，不归位的话下一次 animateTo(1) 会倒着转
      if (_flip.value >= 2) {
        _flip.value = _flip.value - 2;
      }
      // 只在「翻到正面并停稳」时扫光；翻回去不扫（避免来回闪）
      if (_revealed && !_reduceMotion) {
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
    _unlock?.cancel();
    _flip.dispose();
    _sheen.dispose();
    super.dispose();
  }

  void _toggle() {
    if (_busy) {
      return;
    }
    HapticFeedback.selectionClick();
    final revealing = !_revealed;
    setState(() {
      _revealed = revealing;
      // 减弱动效是瞬间的，不给用户上锁；有动画才锁，锁到扫光放完
      _busy = !_reduceMotion;
    });
    if (_reduceMotion) {
      _sheen.stop();
      _sheen.value = 0;
      _flip.value = revealing ? 1 : 0;
      return;
    }
    if (!revealing) {
      _sheen.stop();
      _sheen.value = 0;
    }
    // 始终往同一个方向转：翻回来是「继续转完下半圈」，不是倒着转回去。
    // 控制器值只在 0（封面）/ 1（正面）两个稳态，落定后由 _onFlipEnd 归位。
    _flip.animateTo(revealing ? 1 : 2);
    // Timer 跟着测试的假时钟走：用例 pump 过这段时间就自动解锁，
    // 不需要真的等待；帧时间戳在手势回调（帧外）里会直接断言「没有帧」。
    _unlock?.cancel();
    _unlock = Timer(revealing ? _settleFront : _settleBack, () {
      if (mounted) {
        setState(() => _busy = false);
      }
    });
  }

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
        // 翻面用对称曲线：起手与收尾一样缓，像真的把卡片推过去。
        // 曲线按「半圈」分段喂：控制器值域是 0~2，而 Curve.transform 只接受 0~1，
        // 直接把 1.38 喂进去会断言崩溃（实测翻回时必现）。
        final v = _flip.value;
        final t = v <= 1
            ? Curves.easeInOutCubic.transform(v)
            : 1 + Curves.easeInOutCubic.transform(v - 1);
        // 单向翻转时可见面按进度判断：第一圈过半（0.5~1.5）露出正面，
        // 第二圈过半再翻回封面。稳态只有 0（封面）与 1（正面）。
        final showFront = v >= 0.5 && v < 1.5;
        return Transform(
          // 显式按中心旋转：不设 alignment 时默认绕左上角转，观感是「卡片歪着」
          alignment: Alignment.center,
          transform: Matrix4.rotationY(t * math.pi),
          // 测试按这个 key 找翻转矩阵（树里还有若干 translateZ 的 Transform）
          key: const ValueKey<String>('sentence-card-flip'),
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
                      sheen: _sheen,
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
      label: '每日句签 ${card.bizDate}，轻触翻开',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onFlip,
        // ClipRRect 不能省：_Glow 是负偏移的径向渐变圆，
        // 不裁的话左下/右上会各冒出一个角（用户实测截图指出的就是这个）
        child: ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(28),
              color: Colors.white,
              border: Border.all(color: _amber200.withValues(alpha: 0.6)),
              boxShadow: const <BoxShadow>[
                BoxShadow(
                  color: Color(0x1A0F172A),
                  blurRadius: 28,
                  offset: Offset(0, 14),
                ),
              ],
            ),
            child: Stack(
              children: <Widget>[
                // 柔光用径向渐变而不是 blur 滤镜：滤镜在倾斜时每帧重绘整层
                const Positioned(top: -70, right: -60, child: _Glow(size: 240)),
                const Positioned(
                  bottom: -90,
                  left: -70,
                  child: _Glow(size: 220, gold: true),
                ),
                // 内嵌细线框：整块白面板没有边界感，加一道内框才像一张卡
                Positioned.fill(
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: _slate800.withValues(alpha: 0.06),
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
                              color: _slate800.withValues(alpha: 0.05),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              _dateLabel(card.bizDate),
                              style: const TextStyle(
                                color: _slate500,
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
                              color: _amber600.withValues(alpha: 0.9),
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 2.4,
                            ),
                          ),
                        ],
                      ),
                      const Spacer(),
                      const Center(child: _Seal()),
                      const SizedBox(height: 26),
                      // 寄语：这张卡独有的一句（取代泛用的揭晓文案）
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        child: Text(
                          _blessingOf(card),
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: _slate800,
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            height: 1.6,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      const Center(
                        child: Text(
                          '轻触翻开',
                          style: TextStyle(
                            color: _slate400,
                            fontSize: 11.5,
                            letterSpacing: 1.6,
                          ),
                        ),
                      ),
                      const Spacer(),
                      const Center(
                        child: Text(
                          '短句 · 每天一句，慢慢变好',
                          style: TextStyle(
                            color: _slate400,
                            fontSize: 10.5,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
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
    final color = gold ? _amber200 : const Color(0xFF93C5FD);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: <Color>[
            color.withValues(alpha: 0.45),
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
          BoxShadow(color: Color(0x33F59E0B), blurRadius: 28, spreadRadius: 2),
        ],
      ),
      child: Container(
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white,
        ),
        child: const Icon(
          Icons.auto_awesome_rounded,
          size: 34,
          color: Color(0xFFF59E0B),
        ),
      ),
    );
  }
}

/* ------------------------------ 正面（与网页端一致） ------------------------------ */

class _CardFront extends StatelessWidget {
  const _CardFront({
    required this.card,
    required this.onFlip,
    required this.sheen,
  });

  final SentenceCard card;
  final VoidCallback onFlip;
  final Animation<double> sheen;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '轻触翻回卡背',
      child: GestureDetector(
        key: const ValueKey<String>('card-front-tap'),
        behavior: HitTestBehavior.opaque,
        onTap: onFlip,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _CardPhoto(card: card, sheen: sheen),
            const SizedBox(height: 8),
            const _CardFooter(),
          ],
        ),
      ),
    );
  }
}

/// 配图块：配图 + 镭射 + 渐隐蒙版 + 徽标 + 文案。
class _CardPhoto extends StatelessWidget {
  const _CardPhoto({required this.card, required this.sheen});

  final SentenceCard card;
  final Animation<double> sheen;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        boxShadow: const <BoxShadow>[
          BoxShadow(
            color: Color(0x1A0F172A),
            blurRadius: 28,
            offset: Offset(0, 14),
          ),
        ],
      ),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: _amber200.withValues(alpha: 0.6)),
          color: _slate100,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(27),
          child: Stack(
            children: <Widget>[
              AspectRatio(
                aspectRatio: 16 / 9,
                // 镭射必须包在配图外面：混合模式混的是「同一层里的内容」，
                // 单独盖一层只会得到一块半透明色片，不会有彩虹质感
                child: _Holo(child: _image()),
              ),
              // 渐隐蒙版：让文字在任何配图上都清晰（压在镭射之上）
              Positioned.fill(
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: <Color>[
                          Colors.black.withValues(alpha: 0),
                          Colors.black.withValues(alpha: 0.35),
                          Colors.black.withValues(alpha: 0.75),
                        ],
                        // 0 → 1/3 → 1：等价于网页端「占图高 2/3 的蒙版」
                        stops: const <double>[0, 1 / 3, 1],
                      ),
                    ),
                  ),
                ),
              ),
              // 徽标行
              Positioned(
                left: 12,
                right: 12,
                top: 12,
                child: Row(
                  children: <Widget>[
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.85),
                        borderRadius: BorderRadius.circular(999),
                        boxShadow: const <BoxShadow>[
                          BoxShadow(
                            color: Color(0x140F172A),
                            blurRadius: 6,
                            offset: Offset(0, 1),
                          ),
                        ],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          Icon(
                            Icons.auto_awesome_rounded,
                            size: 14,
                            color: _amber600,
                          ),
                          SizedBox(width: 4),
                          Text(
                            '今日句签 · 已获得',
                            style: TextStyle(
                              color: _amber600,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.4),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        _dateLabel(card.bizDate),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              // 文案（最前）
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: <Widget>[
                          Flexible(
                            child: Text(
                              card.titleZh.isEmpty ? card.title : card.titleZh,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                height: 1.2,
                              ),
                            ),
                          ),
                          if (card.title.isNotEmpty) ...<Widget>[
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                card.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.7),
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        card.sentenceEn,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        card.translationZh,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.8),
                          fontSize: 14,
                          height: 1.45,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              // 扫光与高光：只覆盖配图（网页端的高光层也只在配图块上）
              Positioned.fill(
                child: IgnorePointer(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(27),
                    child: _Sheen(animation: sheen),
                  ),
                ),
              ),
              Positioned.fill(child: IgnorePointer(child: _Glare())),
            ],
          ),
        ),
      ),
    );
  }

  Widget _image() {
    if (card.imageUrl == null || card.imageUrl!.isEmpty) {
      return const ColoredBox(color: _slate100);
    }
    return CachedNetworkImage(
      imageUrl: staticUrl(card.imageUrl),
      fit: BoxFit.cover,
      // 卡片最宽 420dp，按 3 倍屏解码即可，别按原图 1280px 解
      memCacheWidth: 1260,
      fadeInDuration: Motion.slow,
      placeholder: (context, _) => const ColoredBox(color: Color(0xFFE2E8F0)),
      errorWidget: (context, _, _) => const ColoredBox(
        color: _slate100,
        child: Center(
          child: Icon(Icons.image_not_supported_outlined, color: _slate400),
        ),
      ),
    );
  }
}

/// 卡脚：白底、琥珀字、彩带图标——与网页端同一句话。
class _CardFooter extends StatelessWidget {
  const _CardFooter();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _amber200.withValues(alpha: 0.6)),
        boxShadow: const <BoxShadow>[
          BoxShadow(
            color: Color(0x140F172A),
            blurRadius: 10,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(Icons.celebration_rounded, size: 16, color: _amber600),
          SizedBox(width: 6),
          Text(
            '完成今日目标，收下这张属于你的闪卡',
            style: TextStyle(
              color: _amber600,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------ 镭射 ------------------------------ */

/// 镭射（holo）：一道彩虹带压在配图上，`screen` 混合出彩虹质感。
///
/// 网页端（`client/assets/css/main.css` 的 `.ss-holo`）是
/// `linear-gradient(115deg, …)` + `mix-blend-mode: overlay` + `background-size: 260%`。
/// 手机端把 `overlay` 换成 `screen`：`overlay` 在亮调插画上几乎推不动
/// （实测平均每个通道只差 1/255，等于没有），`screen` 在暗部着色明显、
/// 亮部只是提亮，不会把画面搞脏。
///
/// 两个关键点：
/// 1. **必须包在配图外面**，不能单独盖一层——混合模式混的是同一层里的内容，
///    单独盖一层只会得到一块半透明色片，没有彩虹质感；
/// 2. **渐变块要比配图大**（这里是 2.6 倍）：位移量按比例限制在「图块仍能盖满配图」
///    的范围内。盖不满会让图块边缘的实色露出来，画面上会切出一道硬边
///    （网页端 2026-10-24 的真实缺陷：指针移到中上方时，一块矩形渐变从顶部滑进来）。
class _Holo extends StatelessWidget {
  const _Holo({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final tracker = DeviceTiltScope.of(context);
    final reduce = Motion.reduced(context);
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: tracker,
        // 配图只建一次：每帧变的只是 shader
        child: child,
        builder: (context, child) => ShaderMask(
          blendMode: BlendMode.screen,
          shaderCallback: (rect) => _holoShader(rect, tracker.value, reduce),
          child: child,
        ),
      ),
    );
  }
}

/// 彩虹带的整体不透明度：静止时常驻一层（卡片有材质感），跟手时加深。
///
/// 上限 0.48 与网页端的最大有效值对齐（网页端色标 alpha 0.55 × opacity 0.85）。
/// 再高，右侧那棵树的 magenta 会重到发艳。
double _holoStrength(Offset offset) =>
    0.28 + 0.20 * math.min(1.0, offset.distance * 2.6);

Shader _holoShader(Rect rect, Offset offset, bool reduce) {
  final strength = reduce ? 0.20 : _holoStrength(offset);

  // 图块比配图大 2.6 倍，位移限制在 ±0.8 倍配图尺寸内：图块永远盖得满
  final big = Rect.fromLTWH(
    rect.left - rect.width * 0.8 + (reduce ? 0 : offset.dx * rect.width * 0.8),
    rect.top - rect.height * 0.8 + (reduce ? 0 : offset.dy * rect.height * 0.8),
    rect.width * 2.6,
    rect.height * 2.6,
  );

  Color band(int argb) => Color(argb).withValues(alpha: strength);

  // 色标与网页端一致（粉 → 黄 → 青 → 蓝 → 紫），角度近似 115°
  return LinearGradient(
    begin: const Alignment(-0.92, -0.40),
    end: const Alignment(0.92, 0.40),
    colors: <Color>[
      band(0x00FFFFFF),
      band(0xFFFF3CA0),
      band(0xFFFFD60A),
      band(0xFF3CFFBE),
      band(0xFF3CA0FF),
      band(0xFFB45AFF),
      band(0x00FFFFFF),
    ],
    stops: const <double>[0.20, 0.30, 0.38, 0.46, 0.54, 0.62, 0.72],
  ).createShader(big);
}

/* ------------------------------ 跟手高光 ------------------------------ */

/// 跟手高光：网页端是「圆心跟随鼠标」，这里跟随姿态偏移。
///
/// 强度随偏移量增长，静止时为 0——常亮的话，糊在句子上的一团白斑只会让字更难读。
class _Glare extends StatelessWidget {
  const _Glare();

  @override
  Widget build(BuildContext context) {
    final tracker = DeviceTiltScope.of(context);
    return AnimatedBuilder(
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
                  Colors.white.withValues(alpha: 0.34),
                  Colors.white.withValues(alpha: 0),
                ],
                stops: const <double>[0, 0.72],
              ),
            ),
          ),
        );
      },
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
