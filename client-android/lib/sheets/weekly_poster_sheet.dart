import 'dart:ui' show ImageByteFormat;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';

import '../api/models/weekly_report.dart';
import '../theme/motion.dart';
import '../widgets/press_scale.dart';

/// 周学习报告海报：把「这一周攒下了什么」变成一张能发出去的图。
///
/// 复用句签海报的分享桥（`short_sentence/share` 的 shareImage / saveImage）：
/// 项目「零新增运行时依赖」硬约束，原生 ACTION_SEND + MediaStore 已够用，
/// 不再引 share 包。海报固定浅色（不跟随深色主题）——分享出去要的是干净，
/// 不是把 App 的深色皮肤带给别人。
Future<void> showWeeklyPoster(BuildContext context, WeeklyReport report) {
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: '关闭',
    barrierColor: const Color(0xCC050B18),
    transitionDuration: Motion.slow,
    pageBuilder: (context, _, _) => _WeeklyPosterDialog(report: report),
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

class _WeeklyPosterDialog extends StatefulWidget {
  const _WeeklyPosterDialog({required this.report});

  final WeeklyReport report;

  @override
  State<_WeeklyPosterDialog> createState() => _WeeklyPosterDialogState();
}

class _WeeklyPosterDialogState extends State<_WeeklyPosterDialog> {
  final GlobalKey _posterKey = GlobalKey();
  bool _busy = false;

  Future<void> _share({required bool save}) async {
    if (_busy) {
      return;
    }
    setState(() => _busy = true);
    try {
      // 等一帧布局完成再截图（海报是纯布局，无网络图，一帧足够）
      await WidgetsBinding.instance.endOfFrame;
      final boundary =
          _posterKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) {
        return;
      }
      final image = await boundary.toImage(pixelRatio: 3);
      final bytes =
          (await image.toByteData(format: ImageByteFormat.png))?.buffer.asUint8List();
      if (bytes == null) {
        return;
      }
      final channel = const MethodChannel('short_sentence/share');
      final fileName = 'short-sentence-weekly-${DateTime.now().millisecondsSinceEpoch}.png';
      if (save) {
        final ok = await channel.invokeMethod<bool>(
          'saveImage',
          <String, dynamic>{'bytes': bytes, 'fileName': fileName},
        );
        _toast(ok == true ? '已保存到相册' : '保存失败，可改用「分享」');
      } else {
        await channel.invokeMethod<void>(
          'shareImage',
          <String, dynamic>{'bytes': bytes, 'fileName': fileName},
        );
      }
    } catch (_) {
      _toast('操作失败，请重试');
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  void _toast(String message) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.showSnackBar(
      SnackBar(content: Text(message), duration: const Duration(seconds: 2)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            RepaintBoundary(
              key: _posterKey,
              child: _WeeklyPoster(report: widget.report),
            ),
            const SizedBox(height: 18),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                _ActionButton(
                  label: '保存到相册',
                  icon: Icons.download_outlined,
                  busy: _busy,
                  onTap: () => _share(save: true),
                ),
                const SizedBox(width: 12),
                _ActionButton(
                  label: '分享',
                  icon: Icons.ios_share_outlined,
                  busy: _busy,
                  primary: true,
                  onTap: () => _share(save: false),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              '点空白处关闭',
              style: Theme.of(context)
                  .textTheme
                  .labelSmall
                  ?.copyWith(color: const Color(0x99FFFFFF)),
            ),
          ],
        ),
      ),
    );
  }
}

/// 海报本体。固定浅色 + 品牌渐变头，尺寸按内容自然撑开（截图按 3x 输出）。
class _WeeklyPoster extends StatelessWidget {
  const _WeeklyPoster({required this.report});

  final WeeklyReport report;

  static const Color _ink = Color(0xFF0F172A);
  static const Color _inkSoft = Color(0xFF64748B);
  static const Color _inkFaint = Color(0xFF94A3B8);
  static const Color _brand = Color(0xFF0EA5E9);

  @override
  Widget build(BuildContext context) {
    final maxDaily = report.daily.fold<int>(1, (max, d) => d.answered > max ? d.answered : max);
    final accuracyPct = (report.accuracy * 100).round();

    return Container(
      width: 320,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          // 头部：品牌渐变
          Container(
            padding: const EdgeInsets.fromLTRB(22, 20, 22, 18),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: <Color>[Color(0xFF0EA5E9), Color(0xFF4F46E5)],
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    const Text(
                      '短句',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0x33FFFFFF),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        '每周一句',
                        style: TextStyle(color: Colors.white, fontSize: 9, letterSpacing: 0.5),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                const Text(
                  '本周学习报告',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  '周一 00:00 至今',
                  style: TextStyle(color: Color(0xCCFFFFFF), fontSize: 11),
                ),
              ],
            ),
          ),

          // 三主指标
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 18, 22, 0),
            child: Row(
              children: <Widget>[
                _Stat(value: '${report.answered}', label: '本周答题', color: _ink),
                _Stat(value: '$accuracyPct%', label: '正确率', color: const Color(0xFF059669)),
                _Stat(value: '${report.activeDays}/7', label: '活跃天数', color: _brand),
              ],
            ),
          ),

          // 7 天柱状
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 18, 22, 0),
            child: SizedBox(
              height: 64,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: <Widget>[
                  for (final day in report.daily)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 3),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: <Widget>[
                            Container(
                              height: day.answered == 0 ? 4 : (day.answered / maxDaily) * 44,
                              decoration: BoxDecoration(
                                color: day.answered == 0
                                    ? const Color(0xFFE2E8F0)
                                    : _brand.withValues(alpha: 0.9),
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              day.weekday.replaceFirst('周', ''),
                              style: const TextStyle(color: _inkFaint, fontSize: 9),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),

          // 次级信息
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 16, 22, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  '本周获得 ${report.xpGained} 经验'
                  '${report.newAchievements > 0 ? ' · 新解锁 ${report.newAchievements} 个成就' : ''}',
                  style: const TextStyle(color: _inkSoft, fontSize: 11.5, height: 1.7),
                ),
                if (report.streak > 0)
                  Text(
                    '连续打卡 ${report.streak} 天',
                    style: const TextStyle(color: _inkSoft, fontSize: 11.5, height: 1.7),
                  ),
                if (report.topCategory != null)
                  Text(
                    '最常练「${report.topCategory!.name}」（${report.topCategory!.count} 题）',
                    style: const TextStyle(color: _inkSoft, fontSize: 11.5, height: 1.7),
                  ),
                Text(
                  '比上周${report.deltaAnswered >= 0 ? '多' : '少'} ${report.deltaAnswered.abs()} 题',
                  style: TextStyle(
                    color: report.deltaAnswered >= 0 ? const Color(0xFF059669) : _inkSoft,
                    fontSize: 11.5,
                    height: 1.7,
                  ),
                ),
              ],
            ),
          ),

          // 页脚
          Container(
            margin: const EdgeInsets.fromLTRB(22, 18, 22, 20),
            padding: const EdgeInsets.only(top: 12),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: Color(0xFFF1F5F9))),
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: <Widget>[
                Text(
                  '每天一句话，攒成这一周',
                  style: TextStyle(color: _inkFaint, fontSize: 10),
                ),
                Text(
                  '短句',
                  style: TextStyle(
                    color: _brand,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label, required this.color});

  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: <Widget>[
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 3),
          Text(label, style: const TextStyle(color: _WeeklyPoster._inkFaint, fontSize: 9.5)),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.icon,
    required this.busy,
    required this.onTap,
    this.primary = false,
  });

  final String label;
  final IconData icon;
  final bool busy;
  final bool primary;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressScale(
      onTap: busy ? null : onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
        decoration: BoxDecoration(
          color: primary ? Colors.white : const Color(0x1FFFFFFF),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: const Color(0x33FFFFFF)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            if (busy)
              SizedBox(
                width: 13,
                height: 13,
                child: CircularProgressIndicator(
                  strokeWidth: 1.6,
                  color: primary ? _WeeklyPoster._brand : Colors.white,
                ),
              )
            else
              Icon(icon, size: 15, color: primary ? _WeeklyPoster._brand : Colors.white),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: primary ? _WeeklyPoster._ink : Colors.white,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}