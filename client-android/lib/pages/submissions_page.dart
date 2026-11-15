/// 句子投稿页（路由 /submissions）。
///
/// 表单 + 两个列表（投稿精选 / 我的投稿）。投稿**不进刷题池**：
/// 刷题题必须过 AI 生成与配图审核，精选是展示位，两者解耦。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/submission_api.dart';
import '../api/models/submission.dart';
import '../theme/palette.dart';
import '../widgets/app_card.dart';
import '../widgets/page_header.dart';
import '../widgets/press_scale.dart';
import '../widgets/segmented.dart';
import '../widgets/tts_button.dart';

class SubmissionsPage extends ConsumerStatefulWidget {
  const SubmissionsPage({super.key});

  @override
  ConsumerState<SubmissionsPage> createState() => _SubmissionsPageState();
}

enum _Tab { featured, mine }

class _SubmissionsPageState extends ConsumerState<SubmissionsPage> {
  final TextEditingController _sentence = TextEditingController();
  final TextEditingController _translation = TextEditingController();
  final TextEditingController _note = TextEditingController();

  _Tab _tab = _Tab.featured;
  bool _submitting = false;
  String? _formMessage;
  String? _formError;

  final List<FeaturedSubmission> _featured = <FeaturedSubmission>[];
  final List<SubmissionItem> _mine = <SubmissionItem>[];
  int _featuredTotal = 0;
  int _mineTotal = 0;
  int _featuredPage = 1;
  int _minePage = 1;
  bool _listLoading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _reload());
  }

  @override
  void dispose() {
    _sentence.dispose();
    _translation.dispose();
    _note.dispose();
    super.dispose();
  }

  SubmissionApi get _api => ref.read(submissionApiProvider);

  Future<void> _reload() async {
    setState(() {
      _listLoading = true;
      _featuredPage = 1;
      _minePage = 1;
    });
    try {
      final featured = await _api.featured(page: 1);
      final mine = await _api.mine(page: 1);
      if (!mounted) {
        return;
      }
      setState(() {
        _featured
          ..clear()
          ..addAll(featured.list);
        _featuredTotal = featured.total;
        _mine
          ..clear()
          ..addAll(mine.list);
        _mineTotal = mine.total;
      });
    } catch (_) {
      // 列表失败不打断投稿表单：静默留空，用户可下拉重试（下方按钮）
    } finally {
      if (mounted) {
        setState(() => _listLoading = false);
      }
    }
  }

  Future<void> _loadMore() async {
    if (_listLoading) {
      return;
    }
    setState(() => _listLoading = true);
    try {
      if (_tab == _Tab.featured) {
        final next = await _api.featured(page: _featuredPage + 1);
        if (!mounted) {
          return;
        }
        setState(() {
          _featuredPage += 1;
          _featured.addAll(next.list);
          _featuredTotal = next.total;
        });
      } else {
        final next = await _api.mine(page: _minePage + 1);
        if (!mounted) {
          return;
        }
        setState(() {
          _minePage += 1;
          _mine.addAll(next.list);
          _mineTotal = next.total;
        });
      }
    } catch (_) {
      // 加载更多失败：保持现有列表，用户可再点
    } finally {
      if (mounted) {
        setState(() => _listLoading = false);
      }
    }
  }

  Future<void> _submit() async {
    final sentence = _sentence.text.trim();
    final translation = _translation.text.trim();
    if (sentence.length < 3 || translation.isEmpty || _submitting) {
      return;
    }
    setState(() {
      _submitting = true;
      _formError = null;
      _formMessage = null;
    });
    try {
      await _api.create(
        sentenceEn: sentence,
        translationZh: translation,
        note: _note.text,
      );
      if (!mounted) {
        return;
      }
      _sentence.clear();
      _translation.clear();
      _note.clear();
      FocusScope.of(context).unfocus();
      setState(() {
        _formMessage = '投稿已提交，审核通过后会出现在精选里';
        _tab = _Tab.mine;
      });
      await _reload();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _formError = error.toString());
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final theme = Theme.of(context);
    final hasMore = _tab == _Tab.featured ? _featured.length < _featuredTotal : _mine.length < _mineTotal;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
          children: <Widget>[
            PageHeader(
              title: '句子投稿',
              subtitle: '投一句你喜欢的句子，审核通过后进「投稿精选」',
            ),

            // 投稿表单
            AppCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  _Field(controller: _sentence, label: '英文句子', hint: 'The best time to plant a tree was 20 years ago.'),
                  const SizedBox(height: 10),
                  _Field(controller: _translation, label: '中文译文', hint: '种一棵树最好的时间是二十年前。'),
                  const SizedBox(height: 10),
                  _Field(controller: _note, label: '附言（可选）', hint: '出处 / 为什么喜欢这句', maxLines: 2),
                  const SizedBox(height: 12),
                  PressScale(
                    onTap: _submitting ? null : _submit,
                    child: Container(
                      height: 44,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: <Color>[Color(0xFF8B5CF6), Color(0xFF4F46E5)],
                        ),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Center(
                        child: _submitting
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Text('提交投稿',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                )),
                      ),
                    ),
                  ),
                  if (_formMessage != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Text(_formMessage!,
                          style: theme.textTheme.bodySmall?.copyWith(color: const Color(0xFF059669))),
                    ),
                  if (_formError != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Text(_formError!,
                          style: theme.textTheme.bodySmall?.copyWith(color: Colors.red)),
                    ),
                ],
              ),
            ),

            const SizedBox(height: 16),
            SegmentedControl<_Tab>(
              value: _tab,
              onChanged: (tab) => setState(() => _tab = tab),
              height: 38,
              segments: <Segment<_Tab>>[
                Segment<_Tab>(value: _Tab.featured, label: '投稿精选', badge: _featuredTotal),
                Segment<_Tab>(value: _Tab.mine, label: '我的投稿', badge: _mineTotal),
              ],
            ),
            const SizedBox(height: 12),

            if (_tab == _Tab.featured)
              ..._featured.map(_featuredCard)
            else
              ..._mine.map(_mineCard),

            if (_listLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 18),
                child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
              )
            else if (hasMore)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: OutlinedButton(onPressed: _loadMore, child: const Text('加载更多')),
              )
            else if ((_tab == _Tab.featured ? _featured : _mine).isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 28),
                child: Text(
                  _tab == _Tab.featured ? '还没有精选投稿，来投第一条吧' : '你还没投过稿，写下第一句吧',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodySmall?.copyWith(color: colors.inkSoft),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _featuredCard(FeaturedSubmission item) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: Text(item.sentenceEn,
                      style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600, height: 1.4)),
                ),
                const SizedBox(width: 6),
                SentenceTtsButton(text: item.sentenceEn, lang: 'en-US'),
              ],
            ),
            const SizedBox(height: 4),
            Text(item.translationZh,
                style: theme.textTheme.bodySmall?.copyWith(color: context.colors.inkSoft)),
            if (item.note != null && item.note!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text('「${item.note}」',
                    style: theme.textTheme.labelSmall?.copyWith(color: context.colors.inkFaint)),
              ),
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(item.author,
                  style: theme.textTheme.labelSmall?.copyWith(color: context.colors.inkFaint)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _mineCard(SubmissionItem item) {
    final theme = Theme.of(context);
    final meta = switch (item.status) {
      'approved' => (label: '已通过', color: const Color(0xFF059669)),
      'rejected' => (label: '已驳回', color: const Color(0xFFE11D48)),
      _ => (label: '待审核', color: const Color(0xFFD97706)),
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: Text(item.sentenceEn,
                      style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600, height: 1.4)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: meta.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(meta.label,
                      style: TextStyle(color: meta.color, fontSize: 10, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(item.translationZh,
                style: theme.textTheme.bodySmall?.copyWith(color: context.colors.inkSoft)),
            if (item.status == 'rejected' && item.reviewNote != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text('驳回原因：${item.reviewNote}',
                    style: theme.textTheme.labelSmall?.copyWith(color: const Color(0xFFE11D48))),
              ),
          ],
        ),
      ),
    );
  }
}

/// 表单输入框（带标签）。
class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.hint,
    this.maxLines = 1,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label,
            style: theme.textTheme.labelSmall?.copyWith(
              color: context.colors.inkSoft,
              fontWeight: FontWeight.w600,
            )),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          maxLines: maxLines,
          maxLength: 300,
          decoration: InputDecoration(
            hintText: hint,
            counterText: '',
            isDense: true,
            border: const OutlineInputBorder(),
          ),
        ),
      ],
    );
  }
}