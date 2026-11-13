/// 消息中心底部弹窗：运营公告列表。
///
/// 与 Web 端 `/notices` 同源同契约（GET /client/notices）。
/// 交互约定：
/// - 未读用小红点表达，**点开即已读**；
/// - 顶部「全部已读」一次清红点；
/// - 公告带 `link` 时只做已读标记（App 端不解析 Web 路由，避免跳到不存在的页面）。
///
/// 已读是「按人」的状态：服务端返回的 `isRead` 是快照，界面用 `_justRead`
/// 做乐观标记，避免为一次点击重拉整个列表。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/models/notice.dart';
import '../api/notice_api.dart';
import '../theme/motion.dart';
import '../theme/palette.dart';

/// 打开消息中心。
Future<void> showNoticeSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => const _NoticeSheet(),
  );
}

class _NoticeSheet extends ConsumerStatefulWidget {
  const _NoticeSheet();

  @override
  ConsumerState<_NoticeSheet> createState() => _NoticeSheetState();
}

class _NoticeSheetState extends ConsumerState<_NoticeSheet> {
  bool _loading = true;
  String? _error;
  List<ClientNoticeItem> _items = const <ClientNoticeItem>[];
  /// 本次打开期间点开过的公告（乐观已读，不回写服务端返回的模型）
  final Set<int> _justRead = <int>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await ref.read(noticeApiProvider).list();
      if (!mounted) {
        return;
      }
      setState(() {
        _items = result.list;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error is Exception ? error.toString().replaceFirst('Exception: ', '') : '加载失败，请稍后重试';
        _loading = false;
      });
    }
  }

  /// 本地已读判定：服务端快照 + 本次乐观标记。
  bool _isRead(ClientNoticeItem item) => item.isRead || _justRead.contains(item.id);

  /// 未读数：按当前列表推算即可（与 Web 端展示口径一致，服务端口径用于红点）。
  int get _unreadCount => _items.where((item) => !_isRead(item)).length;

  /// 点开一条：标记已读（失败静默，下次进来还是未读）。
  Future<void> _open(ClientNoticeItem item) async {
    if (_isRead(item)) {
      return;
    }
    setState(() => _justRead.add(item.id));
    try {
      await ref.read(noticeApiProvider).markRead(item.id);
      ref.invalidate(noticeUnreadProvider);
    } catch (_) {
      // 标记失败不影响阅读体验
    }
  }

  /// 全部已读。
  Future<void> _markAll() async {
    if (_unreadCount == 0) {
      return;
    }
    setState(() => _loading = true);
    try {
      await ref.read(noticeApiProvider).markAllRead();
      ref.invalidate(noticeUnreadProvider);
      await _load();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error is Exception ? '$error' : '操作失败，请稍后重试')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.72,
      child: Column(
        children: <Widget>[
          _header(colors),
          Divider(height: 1, color: colors.line.withValues(alpha: 0.7)),
          Expanded(child: _body(colors)),
        ],
      ),
    );
  }

  Widget _header(AppColors colors) {
    final unread = _unreadCount;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 12, 12),
      child: Row(
        children: <Widget>[
          Icon(Icons.campaign_rounded, size: 20, color: colors.brand),
          const SizedBox(width: 8),
          Text('消息中心', style: Theme.of(context).textTheme.titleMedium),
          if (unread > 0) ...<Widget>[
            const SizedBox(width: 8),
            Text(
              '$unread 条未读',
              style: TextStyle(fontSize: 12, color: colors.brand),
            ),
          ],
          const Spacer(),
          if (unread > 0)
            TextButton(
              onPressed: _loading ? null : _markAll,
              child: const Text('全部已读'),
            ),
        ],
      ),
    );
  }

  Widget _body(AppColors colors) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(Icons.cloud_off_rounded, size: 32, color: colors.inkFaint),
              const SizedBox(height: 12),
              Text(_error!, textAlign: TextAlign.center, style: TextStyle(color: colors.inkSoft)),
              const SizedBox(height: 12),
              TextButton(onPressed: _load, child: const Text('重试')),
            ],
          ),
        ),
      );
    }
    if (_items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(Icons.notifications_off_rounded, size: 32, color: colors.inkFaint),
            const SizedBox(height: 12),
            Text('暂时没有消息', style: TextStyle(color: colors.inkSoft)),
            const SizedBox(height: 4),
            Text(
              '新场景上线、活动通知都会出现在这里',
              style: TextStyle(fontSize: 12, color: colors.inkFaint),
            ),
          ],
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      itemCount: _items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) => _NoticeTile(
        item: _items[index],
        read: _isRead(_items[index]),
        onTap: () => _open(_items[index]),
      ),
    );
  }
}

/// 单条公告。
class _NoticeTile extends StatelessWidget {
  const _NoticeTile({required this.item, required this.read, required this.onTap});

  final ClientNoticeItem item;
  final bool read;
  final VoidCallback onTap;

  /// 类型文案与配色（1 系统 / 2 公告 / 3 活动）。
  (String, Color) get _typeMeta => switch (item.noticeType) {
        1 => ('系统', const Color(0xFF64748B)),
        3 => ('活动', const Color(0xFFF59E0B)),
        _ => ('公告', const Color(0xFF0EA5E9)),
      };

  /// 相对时间（今天 / 昨天 / 日期），列表里比完整时间戳更好读。
  String get _timeText {
    final at = item.publishedAt;
    if (at == null) {
      return '';
    }
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final hh = at.hour.toString().padLeft(2, '0');
    final mm = at.minute.toString().padLeft(2, '0');
    final dayDiff = today.difference(DateTime(at.year, at.month, at.day)).inDays;
    if (dayDiff <= 0) {
      return '今天 $hh:$mm';
    }
    if (dayDiff == 1) {
      return '昨天 $hh:$mm';
    }
    return '${at.year}-${at.month.toString().padLeft(2, '0')}-${at.day.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final (label, color) = _typeMeta;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: Motion.reduced(context) ? Duration.zero : Motion.fast,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: read ? colors.line.withValues(alpha: 0.7) : colors.brand.withValues(alpha: 0.35),
            width: 1.2,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                if (!read) ...<Widget>[
                  Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(color: colors.brand, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 6),
                ],
                if (item.pinned) ...<Widget>[
                  _pill(context, '置顶', colors.gold),
                  const SizedBox(width: 6),
                ],
                _pill(context, label, color),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    item.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: read ? FontWeight.w500 : FontWeight.w700,
                        ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              item.content,
              style: TextStyle(fontSize: 13, height: 1.55, color: colors.inkSoft),
            ),
            const SizedBox(height: 8),
            Text(
              _timeText,
              style: TextStyle(fontSize: 11, color: colors.inkFaint),
            ),
          ],
        ),
      ),
    );
  }

  Widget _pill(BuildContext context, String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }
}
