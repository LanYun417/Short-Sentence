/// 题目反馈弹窗（对应后端 `/client/report`）。
///
/// 四个原因对应后端枚举（wrong / inappropriate / image / other），
/// **不要在前端自造第五个**：DTO 用 `@IsIn` 校验，多一个就会被 400 拒掉。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../api/library_api.dart';
import '../theme/palette.dart';
import '../widgets/gradient_button.dart';

/// 打开反馈弹窗；返回 true 表示已提交。
Future<bool> showReportSheet(BuildContext context, {required int sentenceId}) async {
  final submitted = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _ReportSheet(sentenceId: sentenceId),
  );
  return submitted ?? false;
}

const List<({String value, String label, IconData icon})> _reasons =
    <({String value, String label, IconData icon})>[
  (value: 'wrong', label: '翻译或英文有误', icon: Icons.translate_rounded),
  (value: 'image', label: '配图与句子不符', icon: Icons.image_not_supported_outlined),
  (value: 'inappropriate', label: '内容不适当', icon: Icons.shield_outlined),
  (value: 'other', label: '其他问题', icon: Icons.more_horiz_rounded),
];

class _ReportSheet extends ConsumerStatefulWidget {
  const _ReportSheet({required this.sentenceId});

  final int sentenceId;

  @override
  ConsumerState<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends ConsumerState<_ReportSheet> {
  final TextEditingController _description = TextEditingController();
  String _reason = 'wrong';
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) {
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(libraryApiProvider).report(
            sentenceId: widget.sentenceId,
            reason: _reason,
            description: _description.text,
          );
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _submitting = false;
        _error = error is ApiException ? error.message : '提交失败，请稍后重试';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final theme = Theme.of(context);

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 2, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text('反馈这道题', style: theme.textTheme.titleLarge),
              const SizedBox(height: 4),
              Text(
                '我们会人工复核，你的反馈会进入题库整改',
                style: theme.textTheme.labelSmall?.copyWith(color: colors.inkFaint),
              ),
              const SizedBox(height: 16),
              for (final reason in _reasons) ...<Widget>[
                _ReasonRow(
                  label: reason.label,
                  icon: reason.icon,
                  selected: _reason == reason.value,
                  onTap: () => setState(() => _reason = reason.value),
                ),
                const SizedBox(height: 8),
              ],
              const SizedBox(height: 6),
              TextField(
                controller: _description,
                maxLines: 3,
                maxLength: 200,
                decoration: const InputDecoration(
                  hintText: '补充说明（选填）',
                ),
              ),
              if (_error != null) ...<Widget>[
                Text(_error!, style: TextStyle(color: colors.danger, fontSize: 13)),
                const SizedBox(height: 8),
              ],
              GradientButton(
                label: '提交反馈',
                loading: _submitting,
                height: 48,
                onPressed: _submitting ? null : _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReasonRow extends StatelessWidget {
  const _ReasonRow({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          color: selected ? colors.brand.withValues(alpha: 0.08) : colors.cardMuted,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? colors.brand.withValues(alpha: 0.5) : colors.line,
            width: selected ? 1.4 : 1,
          ),
        ),
        child: Row(
          children: <Widget>[
            Icon(icon, size: 18, color: selected ? colors.brand : colors.inkFaint),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  color: selected ? colors.ink : colors.inkSoft,
                ),
              ),
            ),
            AnimatedScale(
              scale: selected ? 1 : 0.7,
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOutBack,
              child: Icon(
                selected ? Icons.check_circle_rounded : Icons.circle_outlined,
                size: 18,
                color: selected ? colors.brand : colors.inkFaint.withValues(alpha: 0.6),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
