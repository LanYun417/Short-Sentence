/// 意见反馈底部弹窗：提交反馈 + 我的反馈列表。
///
/// 与 Web 端 `/feedback` 同源同契约（POST /client/feedback、GET /client/feedback/mine）。
/// 交互约定：
/// - 顶部分段切换「提交反馈 / 我的反馈」；
/// - 提交后切到「我的反馈」并刷新，让用户在同一条路径里看到自己刚发的；
/// - 「我的反馈」里**只展示下发的字段**（运营回复），内部备注永远不会出现在这里。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../api/feedback_api.dart';
import '../api/models/feedback.dart';
import '../theme/palette.dart';

/// 打开意见反馈。
Future<void> showFeedbackSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => const _FeedbackSheet(),
  );
}

class _FeedbackSheet extends ConsumerStatefulWidget {
  const _FeedbackSheet();

  @override
  ConsumerState<_FeedbackSheet> createState() => _FeedbackSheetState();
}

class _FeedbackSheetState extends ConsumerState<_FeedbackSheet> {
  int _tab = 0; // 0 提交 / 1 我的

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.8,
      child: Column(
        children: <Widget>[
          _header(colors),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: SegmentedButton<int>(
              segments: const <ButtonSegment<int>>[
                ButtonSegment<int>(value: 0, label: Text('提交反馈')),
                ButtonSegment<int>(value: 1, label: Text('我的反馈')),
              ],
              selected: <int>{_tab},
              onSelectionChanged: (selection) => setState(() => _tab = selection.first),
              style: SegmentedButton.styleFrom(
                visualDensity: VisualDensity.compact,
              ),
            ),
          ),
          Divider(height: 1, color: colors.line.withValues(alpha: 0.7)),
          Expanded(
            child: _tab == 0 ? const _SubmitPane() : const _MyListPane(),
          ),
        ],
      ),
    );
  }

  Widget _header(AppColors colors) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 16, 8),
      child: Row(
        children: <Widget>[
          Icon(Icons.chat_bubble_outline_rounded, size: 20, color: colors.brand),
          const SizedBox(width: 8),
          Text('意见反馈', style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}

/// 提交反馈表单。
class _SubmitPane extends ConsumerStatefulWidget {
  const _SubmitPane();

  @override
  ConsumerState<_SubmitPane> createState() => _SubmitPaneState();
}

class _SubmitPaneState extends ConsumerState<_SubmitPane> {
  FeedbackType _type = FeedbackType.feature;
  final _content = TextEditingController();
  final _contact = TextEditingController();
  bool _submitting = false;
  String? _error;

  static const int _maxContent = 1000;

  @override
  void dispose() {
    _content.dispose();
    _contact.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final content = _content.text.trim();
    if (content.isEmpty) {
      setState(() => _error = '请先描述你的反馈');
      return;
    }
    if (content.length < 5) {
      setState(() => _error = '反馈内容至少 5 个字，方便我们理解');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(feedbackApiProvider).submit(
            type: _type.value,
            content: content,
            contact: _contact.text.trim(),
          );
      if (!mounted) {
        return;
      }
      // 切到「我的反馈」并刷新
      _content.clear();
      _contact.clear();
      final sheet = context.findAncestorStateOfType<_FeedbackSheetState>();
      sheet?.setState(() => sheet._tab = 1);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('已收到你的反馈，我们会尽快处理')),
      );
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error.message);
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _error = '提交失败，请稍后重试');
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        16,
        16,
        16,
        16 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text('反馈类型', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: FeedbackType.values.map((type) {
              final selected = type == _type;
              final (icon, color) = _typeMeta(type);
              return GestureDetector(
                onTap: () => setState(() => _type = type),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: selected ? color.withValues(alpha: 0.12) : colors.cardMuted,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: selected ? color.withValues(alpha: 0.5) : colors.line,
                      width: 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Icon(icon, size: 16, color: selected ? color : colors.inkSoft),
                      const SizedBox(width: 6),
                      Text(
                        type.label,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                          color: selected ? color : colors.inkSoft,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 18),
          Text('反馈内容', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 10),
          TextField(
            controller: _content,
            maxLines: 6,
            maxLength: _maxContent,
            decoration: InputDecoration(
              hintText: '说说你遇到的问题，或希望我们加什么功能',
              alignLabelWithHint: true,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: colors.line),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: colors.line),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text('联系方式（选填）', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 10),
          TextField(
            controller: _contact,
            maxLength: 100,
            decoration: InputDecoration(
              hintText: '邮箱或微信，方便我们回复你',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: colors.line),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: colors.line),
              ),
            ),
          ),
          const SizedBox(height: 14),
          if (_error != null) ...<Widget>[
            Text(_error!, style: TextStyle(fontSize: 12.5, color: colors.danger)),
            const SizedBox(height: 10),
          ],
          SizedBox(
            width: double.infinity,
            height: 46,
            child: FilledButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('提交反馈'),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '你的反馈会直接送达运营团队；我们只会用联系方式回复你这条反馈。',
            style: TextStyle(fontSize: 11.5, color: colors.inkFaint, height: 1.5),
          ),
        ],
      ),
    );
  }

  (IconData, Color) _typeMeta(FeedbackType type) {
    final colors = context.colors;
    return switch (type) {
      FeedbackType.bug => (Icons.bug_report_outlined, colors.danger),
      FeedbackType.question => (Icons.help_outline_rounded, const Color(0xFFF59E0B)),
      FeedbackType.feature => (Icons.lightbulb_outline_rounded, colors.brand),
      FeedbackType.experience => (Icons.sentiment_satisfied_outlined, const Color(0xFF10B981)),
    };
  }
}

/// 我的反馈列表。
class _MyListPane extends ConsumerStatefulWidget {
  const _MyListPane();

  @override
  ConsumerState<_MyListPane> createState() => _MyListPaneState();
}

class _MyListPaneState extends ConsumerState<_MyListPane> {
  bool _loading = true;
  String? _error;
  List<ClientFeedbackItem> _items = const <ClientFeedbackItem>[];

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
      final result = await ref.read(feedbackApiProvider).mine();
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
        _error = error is ApiException ? error.message : '加载失败，请稍后重试';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
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
            Icon(Icons.inbox_outlined, size: 32, color: colors.inkFaint),
            const SizedBox(height: 12),
            Text('还没有提交过反馈', style: TextStyle(color: colors.inkSoft)),
            const SizedBox(height: 4),
            Text(
              '任何想法或问题，都欢迎告诉我们',
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
      itemBuilder: (context, index) => _FeedbackTile(item: _items[index]),
    );
  }
}

/// 单条反馈。
class _FeedbackTile extends StatelessWidget {
  const _FeedbackTile({required this.item});

  final ClientFeedbackItem item;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final status = FeedbackStatus.values.firstWhere(
      (s) => s.value == item.status,
      orElse: () => FeedbackStatus.pending,
    );
    final type = FeedbackType.values.firstWhere(
      (t) => t.value == item.type,
      orElse: () => FeedbackType.feature,
    );
    final hasReply = item.reply != null && item.reply!.isNotEmpty;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.line.withValues(alpha: 0.7), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              _pill(context, type.label, colors.brand),
              const SizedBox(width: 8),
              _pill(
                context,
                status.label,
                status == FeedbackStatus.handled ? colors.success : colors.inkFaint,
              ),
              const Spacer(),
              Text(_timeText, style: TextStyle(fontSize: 11, color: colors.inkFaint)),
            ],
          ),
          const SizedBox(height: 8),
          Text(item.content, style: TextStyle(fontSize: 13.5, height: 1.55, color: colors.ink)),
          if (hasReply) ...<Widget>[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: colors.brand.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text('运营回复', style: TextStyle(fontSize: 11.5, color: colors.brand, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(item.reply!, style: TextStyle(fontSize: 13, height: 1.5, color: colors.inkSoft)),
                ],
              ),
            ),
          ],
        ],
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

  String get _timeText {
    final at = item.createdAt;
    if (at == null) {
      return '';
    }
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dayDiff = today.difference(DateTime(at.year, at.month, at.day)).inDays;
    if (dayDiff <= 0) {
      return '今天';
    }
    if (dayDiff == 1) {
      return '昨天';
    }
    return '${at.year}-${at.month.toString().padLeft(2, '0')}-${at.day.toString().padLeft(2, '0')}';
  }
}
