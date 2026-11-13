/// AI 拓展弹窗：场景造句 / 词根拆解（流式）。
///
/// 为什么不单独做一页：这两个能力都是「针对当前这句」的补充说明，
/// 离开题目去另一个页面、再回来找这道题，是很别扭的路径。
/// 弹窗盖在卡片上，关掉就回到原题。
///
/// 流式呈现：先逐字显示模型输出（带光标），收到 done 后再换成结构化卡片——
/// 结构化卡片更好读，但等待期间只有空白会让人以为卡住了。
library;

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/ai_api.dart';
import '../api/ai_result.dart';
import '../theme/motion.dart';
import '../theme/palette.dart';
import '../widgets/app_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/gradient_button.dart';
import '../widgets/segmented.dart';

/// 打开 AI 拓展。
Future<void> showAiSheet(
  BuildContext context, {
  required String chinese,
  required String word,
  int? sentenceId,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _AiSheet(chinese: chinese, word: word, sentenceId: sentenceId),
  );
}

enum _AiTab { expand, wordRoot }

class _AiSheet extends ConsumerStatefulWidget {
  const _AiSheet({required this.chinese, required this.word, this.sentenceId});

  final String chinese;
  final String word;
  final int? sentenceId;

  @override
  ConsumerState<_AiSheet> createState() => _AiSheetState();
}

class _AiSheetState extends ConsumerState<_AiSheet> {
  late final TextEditingController _input = TextEditingController(text: widget.chinese);
  _AiTab _tab = _AiTab.expand;

  bool _streaming = false;
  bool _finished = false;
  String _buffer = '';
  String? _error;
  ExpandResult? _expand;
  WordRootResult? _root;

  StreamSubscription<AiStreamResult>? _subscription;
  CancelToken? _cancelToken;

  @override
  void initState() {
    super.initState();
    // 先拉一次额度，让「还剩几次」在动手前就可见
    ref.read(aiQuotaProvider);
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _cancelToken?.cancel();
    _input.dispose();
    super.dispose();
  }

  void _switchTab(_AiTab tab) {
    if (_tab == tab || _streaming) {
      return;
    }
    setState(() {
      _tab = tab;
      _input.text = tab == _AiTab.expand ? widget.chinese : widget.word;
      _buffer = '';
      _error = null;
      _expand = null;
      _root = null;
      _finished = false;
    });
  }

  void _finish() {
    if (!mounted || _finished) {
      return;
    }
    _finished = true;
    setState(() {
      _streaming = false;
      if (_buffer.isNotEmpty) {
        if (_tab == _AiTab.expand) {
          _expand = ExpandResult.tryParse(_buffer);
        } else {
          _root = WordRootResult.tryParse(_buffer);
        }
        // 解析失败且内容不像 JSON（模型偶发退化输出，例如整段 "!"）：
        // 直接报失败，不要把那坨东西糊在用户脸上
        final hasShape = _buffer.contains('{') && _buffer.contains('}');
        if (_expand == null && _root == null && !hasShape) {
          _error = 'AI 这次没给出可用结果，请重试';
        }
      }
    });
    // 消耗了一次额度，刷一次剩余次数
    ref.invalidate(aiQuotaProvider);
  }

  Future<void> _start() async {
    if (_streaming) {
      return;
    }
    final input = _input.text.trim();
    if (input.isEmpty) {
      setState(() => _error = _tab == _AiTab.expand ? '请先写下想表达的中文' : '请先输入一个英文单词');
      return;
    }
    setState(() {
      _streaming = true;
      _finished = false;
      _buffer = '';
      _error = null;
      _expand = null;
      _root = null;
    });

    _cancelToken = CancelToken();
    final api = ref.read(aiApiProvider);
    final stream = _tab == _AiTab.expand
        ? api.expand(input, sentenceId: widget.sentenceId, cancelToken: _cancelToken)
        : api.wordRoot(input, sentenceId: widget.sentenceId, cancelToken: _cancelToken);

    _subscription = stream.listen(
      (event) {
        if (!mounted) {
          return;
        }
        setState(() {
          _buffer = event.text;
          if (event.error != null) {
            _error = event.error;
          }
        });
        if (event.done || event.error != null) {
          _finish();
        }
      },
      onError: (Object error) {
        if (!mounted) {
          return;
        }
        setState(() {
          _error = error is DioException ? '生成中断，请重试' : '生成失败，请重试';
          _streaming = false;
        });
      },
      onDone: _finish,
    );
  }

  void _cancel() {
    _cancelToken?.cancel();
    _subscription?.cancel();
    if (mounted) {
      setState(() {
        _streaming = false;
        _finished = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final theme = Theme.of(context);
    final quota = ref.watch(aiQuotaProvider);
    final remaining = quota.valueOrNull?.remaining;
    final exhausted = remaining != null && remaining <= 0;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.86),
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 2, 20, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(11),
                        gradient: const LinearGradient(
                          colors: <Color>[Color(0xFF0EA5E9), Color(0xFF8B5CF6)],
                        ),
                      ),
                      child: const Icon(Icons.auto_awesome_rounded, size: 18, color: Colors.white),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Text('AI 拓展', style: theme.textTheme.titleLarge)),
                    if (remaining != null)
                      Pill(
                        label: exhausted ? '今日额度已用完' : '今日剩余 $remaining 次',
                        background: (exhausted ? colors.danger : colors.brand).withValues(alpha: 0.1),
                        foreground: exhausted ? colors.danger : colors.brand,
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                SegmentedControl<_AiTab>(
                  value: _tab,
                  onChanged: _switchTab,
                  segments: const <Segment<_AiTab>>[
                    Segment<_AiTab>(
                      value: _AiTab.expand,
                      label: '场景造句',
                      icon: Icons.chat_bubble_outline_rounded,
                    ),
                    Segment<_AiTab>(
                      value: _AiTab.wordRoot,
                      label: '词根拆解',
                      icon: Icons.account_tree_outlined,
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _input,
                  enabled: !_streaming,
                  maxLines: 2,
                  minLines: 1,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _start(),
                  decoration: InputDecoration(
                    hintText: _tab == _AiTab.expand ? '写下你想表达的中文' : '输入一个英文单词，如 unavoidable',
                    fillColor: colors.cardMuted,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: GradientButton(
                        label: _streaming ? '生成中…' : '生成',
                        icon: _streaming ? null : Icons.auto_awesome_rounded,
                        loading: _streaming,
                        height: 46,
                        onPressed: exhausted || _streaming ? null : _start,
                      ),
                    ),
                    if (_streaming) ...<Widget>[
                      const SizedBox(width: 10),
                      TextButton(onPressed: _cancel, child: const Text('取消')),
                    ],
                  ],
                ),
                const SizedBox(height: 18),
                AnimatedSize(
                  duration: Motion.reduced(context) ? Duration.zero : Motion.normal,
                  curve: Motion.standard,
                  alignment: Alignment.topCenter,
                  child: _buildOutput(context),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOutput(BuildContext context) {
    final colors = context.colors;

    if (_error != null && !_streaming) {
      return EmptyState(
        compact: true,
        title: '这次没生成出来',
        message: _error,
        icon: Icons.cloud_off_rounded,
        tone: EmptyTone.error,
        actionLabel: '重试',
        onAction: _start,
      );
    }

    if (_streaming) {
      return AppCard(
        color: colors.cardMuted,
        elevated: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                SizedBox(
                  width: 12,
                  height: 12,
                  child: CircularProgressIndicator(strokeWidth: 1.8, color: colors.brand),
                ),
                const SizedBox(width: 8),
                Text(
                  '正在生成',
                  style: TextStyle(fontSize: 11.5, color: colors.inkFaint),
                ),
              ],
            ),
            const SizedBox(height: 10),
            _StreamingText(text: _buffer),
          ],
        ),
      );
    }

    if (_expand != null) {
      return _ExpandCard(result: _expand!);
    }
    if (_root != null) {
      return _WordRootCard(result: _root!);
    }
    if (_buffer.isNotEmpty) {
      // 结构化解析失败但确实是 JSON：保留原文（截断），方便用户看到内容
      final preview = _buffer.length > 600 ? '${_buffer.substring(0, 600)}…' : _buffer;
      return AppCard(
        color: colors.cardMuted,
        elevated: false,
        child: Text(preview, style: const TextStyle(height: 1.6, fontSize: 14)),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 22),
      decoration: BoxDecoration(
        color: colors.cardMuted.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: <Widget>[
          Icon(Icons.lightbulb_outline_rounded, size: 20, color: colors.inkFaint),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              _tab == _AiTab.expand
                  ? '写下中文，AI 给你一句更地道的说法，并说明适用场景'
                  : '任意单词都能拆：前缀、词根、后缀与同根词',
              style: TextStyle(fontSize: 12.5, height: 1.5, color: colors.inkSoft),
            ),
          ),
        ],
      ),
    );
  }
}

/// 流式文本 + 闪烁光标。
class _StreamingText extends StatefulWidget {
  const _StreamingText({required this.text});

  final String text;

  @override
  State<_StreamingText> createState() => _StreamingTextState();
}

class _StreamingTextState extends State<_StreamingText>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final cursor = Motion.reduced(context)
        ? const SizedBox(width: 7, height: 15)
        : FadeTransition(
            opacity: _controller,
            child: Container(width: 7, height: 15, color: colors.brand),
          );
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: <Widget>[
        Expanded(
          child: Text(
            widget.text.isEmpty ? '…' : widget.text,
            style: const TextStyle(fontSize: 13.5, height: 1.6, fontFamily: 'monospace'),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 3, left: 2),
          child: cursor,
        ),
      ],
    );
  }
}

/* ------------------------------ 结构化结果 ------------------------------ */

class _ExpandCard extends StatelessWidget {
  const _ExpandCard({required this.result});

  final ExpandResult result;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final theme = Theme.of(context);
    return AppCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            result.sentence,
            style: theme.textTheme.titleMedium?.copyWith(
              fontSize: 18,
              height: 1.45,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (result.phonetic.isNotEmpty) ...<Widget>[
            const SizedBox(height: 6),
            Text(
              result.phonetic,
              style: TextStyle(
                fontSize: 12.5,
                color: colors.brand,
                fontFamily: 'monospace',
              ),
            ),
          ],
          if (result.note.isNotEmpty) ...<Widget>[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: colors.cardMuted,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Icon(Icons.info_outline_rounded, size: 15, color: colors.inkFaint),
                  const SizedBox(width: 7),
                  Expanded(
                    child: Text(
                      result.note,
                      style: TextStyle(fontSize: 12.5, height: 1.55, color: colors.inkSoft),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _WordRootCard extends StatelessWidget {
  const _WordRootCard({required this.result});

  final WordRootResult result;

  Color _tone(String type, AppColors colors) => switch (type) {
        'prefix' => colors.brand,
        'suffix' => colors.gold,
        _ => colors.success,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final theme = Theme.of(context);
    return AppCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: <Widget>[
              Expanded(
                child: Text(
                  result.meaning,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (result.phonetic.isNotEmpty)
                Text(
                  result.phonetic,
                  style: TextStyle(
                    fontSize: 12,
                    color: colors.brand,
                    fontFamily: 'monospace',
                  ),
                ),
            ],
          ),
          if (result.parts.isNotEmpty) ...<Widget>[
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: <Widget>[
                for (var i = 0; i < result.parts.length; i++) ...<Widget>[
                  if (i > 0)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text('+', style: TextStyle(color: colors.inkFaint, fontSize: 12)),
                    ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                    decoration: BoxDecoration(
                      color: _tone(result.parts[i].type, colors).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          result.parts[i].text,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: _tone(result.parts[i].type, colors),
                          ),
                        ),
                        if (result.parts[i].meaning.isNotEmpty)
                          Text(
                            result.parts[i].meaning,
                            style: TextStyle(fontSize: 10.5, color: colors.inkSoft),
                          ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ],
          if (result.explanation.isNotEmpty) ...<Widget>[
            const SizedBox(height: 14),
            Text(
              result.explanation,
              style: TextStyle(fontSize: 12.5, height: 1.6, color: colors.inkSoft),
            ),
          ],
          if (result.related.isNotEmpty) ...<Widget>[
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: <Widget>[
                for (final word in result.related) Pill(label: word),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
