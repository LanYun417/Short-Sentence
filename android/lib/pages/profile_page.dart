/// 我的：身份卡 + 数据概览 + 账号操作。
///
/// 这一页不做「成长」的重复：等级与成就都在成长页，
/// 这里只放**与账号有关**的东西（资料、密码、退出），以及三个一眼能读的数字。
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/auth_api.dart';
import '../api/models/user.dart';
import '../api/notice_api.dart';
import '../config/image_pick.dart';
import '../state/auth_controller.dart';
import '../state/growth_controller.dart';
import '../theme.dart';
import '../widgets/app_card.dart';
import '../widgets/aurora.dart';
import '../widgets/count_up.dart';
import '../widgets/page_header.dart';
import '../widgets/press_scale.dart';
import '../widgets/staggered.dart';
import '../sheets/edit_profile_sheet.dart';
import '../sheets/feedback_sheet.dart';
import '../sheets/notice_sheet.dart';
import '../sheets/password_sheet.dart';

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(growthControllerProvider.notifier).load();
    });
  }

  /// 更换头像：选图（原生 SAF 桥）→ multipart 上传 → 回写本地缓存。
  Future<void> _changeAvatar() async {
    final messenger = ScaffoldMessenger.of(context);
    final images = await pickImages(maxCount: 1);
    if (images.isEmpty || !mounted) {
      return;
    }
    final error =
        await ref.read(authControllerProvider.notifier).uploadAvatar(images.first);
    if (!mounted) {
      return;
    }
    if (error != null) {
      messenger.showSnackBar(SnackBar(content: Text(error)));
    } else {
      messenger.showSnackBar(const SnackBar(content: Text('头像已更新')));
    }
  }

  Future<void> _changePassword() async {
    final changed = await showPasswordSheet(context);
    if (!changed || !mounted) {
      return;
    }
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        icon: Icon(Icons.check_circle_rounded, color: dialogContext.colors.success, size: 34),
        title: const Text('密码已修改'),
        content: const Text('为了账号安全，请用新密码重新登录。'),
        actions: <Widget>[
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('去登录'),
          ),
        ],
      ),
    );
    if (!mounted) {
      return;
    }
    await ref.read(authControllerProvider.notifier).logout();
    if (mounted) {
      context.go('/login');
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('退出登录'),
        content: const Text('退出后收藏与进度仍会保留，下次登录继续。'),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: dialogContext.colors.danger,
              minimumSize: const Size(88, 44),
            ),
            child: const Text('退出'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      return;
    }
    await ref.read(authControllerProvider.notifier).logout();
    if (mounted) {
      context.go('/login');
    }
  }

  void _showAbout() {
    final colors = context.colors;
    showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 4, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.asset('assets/brand/logo.png', width: 56, height: 56),
            ),
            const SizedBox(height: 12),
            Text('短句', style: Theme.of(sheetContext).textTheme.titleLarge),
            const SizedBox(height: 4),
            Text(
              'v1.0.0',
              style: Theme.of(sheetContext).textTheme.labelSmall?.copyWith(
                    color: colors.inkFaint,
                  ),
            ),
            const SizedBox(height: 14),
            Text(
              '看中文，写英文。每天 20 句，间隔重复帮你记得更久。\n'
              '题目与配图由后台夜间预生成，学习时不再等待。',
              textAlign: TextAlign.center,
              style: Theme.of(sheetContext).textTheme.bodySmall?.copyWith(
                    color: colors.inkSoft,
                    height: 1.7,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final growth = ref.watch(growthControllerProvider);
    // 未读公告数（消息中心红点）：加载中/失败时按 0 处理，不显示红点也不报错
    final unreadNotices = ref.watch(noticeUnreadProvider).valueOrNull ?? 0;

    return SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 108),
        children: <Widget>[
          const PageHeader(
            title: '我的',
            subtitle: '账号与偏好',
            padding: EdgeInsets.fromLTRB(4, 8, 4, 14),
          ),
          StaggeredEntrance(
            index: 0,
            child: _IdentityCard(
              user: user,
              levelCode: growth.level?.code,
              xp: growth.xp,
              onChangeAvatar: _changeAvatar,
            ),
          ),
          const SizedBox(height: 14),
          StaggeredEntrance(
            index: 1,
            child: _StatsRow(
              done: growth.today?.doneCount ?? 0,
              streak: growth.today?.streak ?? 0,
              xp: growth.xp,
            ),
          ),
          const SizedBox(height: 14),
          StaggeredEntrance(
            index: 2,
            child: AppCard(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Column(
                children: <Widget>[
                  _MenuRow(
                    icon: Icons.emoji_events_outlined,
                    label: '排行榜',
                    hint: '今日答题 / 答对前 100',
                    onTap: () => context.push('/leaderboard'),
                  ),
                  const _MenuDivider(),
                  _MenuRow(
                    icon: Icons.map_outlined,
                    label: '情景闯关',
                    hint: '十四个场景，答对就往前走一段故事',
                    onTap: () => context.push('/stages'),
                  ),
                  const _MenuDivider(),
                  _MenuRow(
                    icon: Icons.edit_note_rounded,
                    label: '句子接龙',
                    hint: '一句开头，匿名往下接',
                    onTap: () => context.push('/chains'),
                  ),
                  const _MenuDivider(),
                  _MenuRow(
                    icon: Icons.campaign_outlined,
                    label: '消息中心',
                    hint: '运营公告与活动通知',
                    // 未读数由服务端给（autoDispose provider：每次进来重取，红点不过期）
                    badgeCount: unreadNotices,
                    onTap: () => showNoticeSheet(context),
                  ),
                  const _MenuDivider(),
                  _MenuRow(
                    icon: Icons.chat_bubble_outline_rounded,
                    label: '意见反馈',
                    hint: '想法、问题、建议',
                    onTap: () => showFeedbackSheet(context),
                  ),
                  const _MenuDivider(),
                  _MenuRow(
                    icon: Icons.person_outline_rounded,
                    label: '编辑资料',
                    hint: '昵称、性别、签名',
                    onTap: () => showEditProfileSheet(context),
                  ),
                  const _MenuDivider(),
                  _MenuRow(
                    icon: Icons.lock_outline_rounded,
                    label: '修改密码',
                    hint: '改完需重新登录',
                    onTap: _changePassword,
                  ),
                  const _MenuDivider(),
                  _MenuRow(
                    icon: Icons.info_outline_rounded,
                    label: '关于短句',
                    hint: 'v1.0.0',
                    onTap: _showAbout,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          StaggeredEntrance(
            index: 3,
            child: PressScale(
              onTap: _logout,
              child: AppCard(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    Icon(Icons.logout_rounded, size: 18, color: context.colors.danger),
                    const SizedBox(width: 8),
                    Text(
                      '退出登录',
                      style: TextStyle(
                        color: context.colors.danger,
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Center(
            child: Text(
              '短句 · 每天一句，慢慢变好',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: context.colors.inkFaint,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------ 身份卡 ------------------------------ */

class _IdentityCard extends StatelessWidget {
  const _IdentityCard({
    required this.user,
    this.levelCode,
    this.xp = 0,
    this.onChangeAvatar,
  });

  final UserProfile? user;

  /// 当前 CEFR 等级码（未加载到成长数据时为 null，不显示等级标签）。
  final String? levelCode;
  final int xp;

  /// 点击头像「更换头像」的回调（由父页注入，处理选图 + 上传）。
  final VoidCallback? onChangeAvatar;

  @override
  Widget build(BuildContext context) {
    final name = user?.nickname ?? '未登录';
    final initial = name.isEmpty ? '?' : name.characters.first;
    final hasCover = user?.bgImageUrl != null && user!.bgImageUrl!.isNotEmpty;
    final signature = user?.signature?.trim();

    return ClipRRect(
      borderRadius: BorderRadius.circular(26),
      child: Stack(
        children: <Widget>[
          if (hasCover)
            Positioned.fill(
              child: CachedNetworkImage(
                imageUrl: staticUrl(user!.bgImageUrl),
                fit: BoxFit.cover,
                memCacheWidth: 1080,
              ),
            ),
          if (hasCover)
            const Positioned.fill(child: ColoredBox(color: Color(0x99101828))),
          if (!hasCover)
            Positioned.fill(
              child: AuroraBackground(
                gradient: const LinearGradient(
                  colors: <Color>[Color(0xFF0284C7), Color(0xFF4F46E5), Color(0xFF7C3AED)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                intensity: 0.26,
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    PressScale(
                      onTap: onChangeAvatar,
                      scale: 0.95,
                      child: Stack(
                        children: <Widget>[
                          Container(
                            width: 62,
                            height: 62,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white.withValues(alpha: 0.18),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.45),
                                width: 1.5,
                              ),
                            ),
                            alignment: Alignment.center,
                            child:
                                (user?.avatarUrl != null && user!.avatarUrl!.isNotEmpty)
                                    ? ClipOval(
                                        child: CachedNetworkImage(
                                          imageUrl: staticUrl(user!.avatarUrl),
                                          width: 62,
                                          height: 62,
                                          fit: BoxFit.cover,
                                          memCacheWidth: 186,
                                        ),
                                      )
                                    : Text(
                                        initial,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 26,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                          ),
                          Positioned(
                            right: 0,
                            bottom: 0,
                            child: Container(
                              width: 22,
                              height: 22,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: const Color(0xFF0284C7),
                                  width: 2,
                                ),
                              ),
                              child: const Icon(
                                Icons.camera_alt_rounded,
                                size: 13,
                                color: Color(0xFF0284C7),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 21,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            signature != null && signature.isNotEmpty
                                ? signature
                                : '写一句想对自己说的话',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: signature == null ? 0.5 : 0.75),
                              fontSize: 12,
                              height: 1.45,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // Wrap 而不是 Row：邮箱可能很长，三个标签挤在一行会把
                // 「加入于」压没；换行比截断更易读
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: <Widget>[
                    if (levelCode != null)
                      _GlassPill(
                        icon: Icons.workspace_premium_rounded,
                        label: '$levelCode · $xp XP',
                      ),
                    _GlassPill(
                      icon: Icons.mail_outline_rounded,
                      label: user?.email ?? '',
                      maxWidth: 210,
                    ),
                    if (user != null)
                      _GlassPill(
                        icon: Icons.calendar_today_rounded,
                        label: '加入于 ${user!.createdAtLabel}',
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GlassPill extends StatelessWidget {
  const _GlassPill({required this.icon, required this.label, this.maxWidth});

  final IconData icon;
  final String label;
  final double? maxWidth;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxWidth: maxWidth ?? 260),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(icon, size: 11, color: Colors.white.withValues(alpha: 0.8)),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.85),
                fontSize: 10.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------ 数据概览 ------------------------------ */

class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.done, required this.streak, required this.xp});

  final int done;
  final int streak;
  final int xp;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: <Widget>[
          _Stat(label: '今日完成', value: done, unit: '句', color: colors.brand),
          _divider(colors),
          _Stat(label: '连续打卡', value: streak, unit: '天', color: colors.gold),
          _divider(colors),
          _Stat(label: '累计经验', value: xp, unit: 'XP', color: const Color(0xFF8B5CF6)),
        ],
      ),
    );
  }

  Widget _divider(AppColors colors) => Container(width: 1, height: 30, color: colors.line);
}

class _Stat extends StatelessWidget {
  const _Stat({
    required this.label,
    required this.value,
    required this.unit,
    required this.color,
  });

  final String label;
  final int value;
  final String unit;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Expanded(
      child: Column(
        children: <Widget>[
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: <Widget>[
              CountUpText(
                value: value,
                style: TextStyle(
                  fontSize: 21,
                  fontWeight: FontWeight.w700,
                  color: color,
                  letterSpacing: -0.5,
                  height: 1.1,
                ),
              ),
              const SizedBox(width: 2),
              Text(
                unit,
                style: TextStyle(fontSize: 10, color: colors.inkFaint),
              ),
            ],
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: TextStyle(fontSize: 11, color: colors.inkSoft),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------ 菜单 ------------------------------ */

class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.icon,
    required this.label,
    required this.hint,
    required this.onTap,
    this.badgeCount = 0,
  });

  final IconData icon;
  final String label;
  final String hint;
  final VoidCallback onTap;

  /// 右侧未读红点数值（0 = 不显示）。
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return PressScale(
      onTap: onTap,
      scale: 0.98,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: <Widget>[
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: colors.brand.withValues(alpha: 0.09),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 18, color: colors.brand),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    label,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontSize: 14.5),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    hint,
                    style: TextStyle(fontSize: 11, color: colors.inkFaint),
                  ),
                ],
              ),
            ),
            if (badgeCount > 0)
              Container(
                margin: const EdgeInsets.only(right: 6),
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                constraints: const BoxConstraints(minWidth: 20),
                decoration: BoxDecoration(
                  color: colors.danger,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  badgeCount > 99 ? '99+' : '$badgeCount',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    height: 1.3,
                  ),
                ),
              ),
            Icon(Icons.chevron_right_rounded, size: 20, color: colors.inkFaint),
          ],
        ),
      ),
    );
  }
}

class _MenuDivider extends StatelessWidget {
  const _MenuDivider();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 64),
      child: Divider(color: context.colors.line.withValues(alpha: 0.7), height: 1),
    );
  }
}
