/// 版本更新弹窗：启动时（及手动「检查更新」）发现新版本就弹出。
///
/// - `forceUpdate` 为 true 时不可关闭（barrierDismissible=false，没有「暂不」按钮），
///   强更版本不更新就没法用；
/// - 「立即更新」不直接下 APK：跳系统浏览器打开下载接口（带下载计数、绕过防盗链），
///   浏览器里完成下载后由系统安装器接管。
library;

import 'package:flutter/material.dart';

import '../api/models/app_version.dart';
import '../config/app_config.dart';
import '../services/url_launcher.dart';
import '../theme.dart';

/// 弹出更新弹窗。返回 true 表示用户点了「立即更新」（已跳浏览器）。
Future<bool> showUpdateDialog(BuildContext context, LatestAppVersion latest) {
  return showGeneralDialog<bool>(
    context: context,
    barrierDismissible: !latest.forceUpdate,
    barrierLabel: '关闭',
    barrierColor: const Color(0xCC050B18),
    transitionDuration: Motion.slow,
    pageBuilder: (context, _, _) => _UpdateDialog(latest: latest),
    transitionBuilder: (context, animation, secondary, child) {
      final curved = CurvedAnimation(parent: animation, curve: Motion.decelerate, reverseCurve: Motion.accelerate);
      return FadeTransition(
        opacity: curved,
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.92, end: 1).animate(curved),
          child: child,
        ),
      );
    },
  ).then((value) => value ?? false);
}

class _UpdateDialog extends StatelessWidget {
  const _UpdateDialog({required this.latest});

  final LatestAppVersion latest;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final sizeMb = (latest.fileSize / 1024 / 1024).toStringAsFixed(1);

    return Material(
      type: MaterialType.transparency,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 320),
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 24),
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(22),
              boxShadow: <BoxShadow>[
                BoxShadow(color: colors.shadow.withValues(alpha: 0.18), blurRadius: 24, offset: const Offset(0, 10)),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Icon(Icons.system_update_alt_rounded, size: 20, color: colors.brand),
                    const SizedBox(width: 8),
                    Text(
                      latest.forceUpdate ? '重要更新' : '发现新版本',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: colors.ink),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: colors.brand.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        'v${latest.version}',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: colors.brand),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                if (latest.changelog.trim().isNotEmpty)
                  Text(
                    latest.changelog.trim(),
                    style: TextStyle(fontSize: 13, height: 1.6, color: colors.inkSoft),
                  )
                else
                  Text('新版本已就绪，建议立即更新。', style: TextStyle(fontSize: 13, height: 1.6, color: colors.inkSoft)),
                const SizedBox(height: 6),
                Text(
                  '安装包约 $sizeMb MB，下载完成后由系统安装器接管。',
                  style: TextStyle(fontSize: 11, color: colors.inkFaint),
                ),
                const SizedBox(height: 16),
                Row(
                  children: <Widget>[
                    if (!latest.forceUpdate)
                      Expanded(
                        child: TextButton(
                          onPressed: () => Navigator.of(context).pop(false),
                          child: Text('暂不更新', style: TextStyle(color: colors.inkSoft)),
                        ),
                      ),
                    if (!latest.forceUpdate) const SizedBox(width: 8),
                    Expanded(
                      child: FilledButton(
                        onPressed: () async {
                          final url = latest.downloadUrl(AppConfig.staticBaseUrl);
                          final ok = await UrlLauncher.open(url);
                          if (context.mounted) {
                            // 点开浏览器即算操作成功；打不开则留在弹窗里提示
                            Navigator.of(context).pop(ok);
                            if (!ok) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('打不开浏览器，请复制链接手动下载')),
                              );
                            }
                          }
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: colors.brand,
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                        child: const Text('立即更新', style: TextStyle(fontWeight: FontWeight.w600)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
