/// AI 拓展页：场景造句 / 词根拆解 / 词根词典。
///
/// 与 Web 端 `pages/ai.vue` 对齐的**三个 Tab**：
/// - 场景造句（expand）：输入中文 → 流式生成地道英文 + 音标 + 使用说明；
/// - 词根拆解（wordRoot）：输入英文单词 → 流式拆解词根词缀；
/// - 词根词典（roots）：搜索已收录词条，未命中可直接 AI 实时解析（扣额度）。
///
/// 为什么要有独立页面而不是只留弹层：弹层入口藏在「答题后翻到背面」，
/// 用户不答题就永远看不到——功能存在但不可达，等于没有。
/// 这里做成底部 Tab，与 Web 端 `/ai` 的定位一致。
///
/// 流式呈现：先逐字显示模型输出（带光标），收到 done 帧后再解析成结构化卡片。
/// 解析失败则回退原文，绝不把半截 JSON 糊在用户脸上。
library;

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/ai_api.dart';
import '../api/ai_result.dart';
import '../api/models/word_root.dart';
import '../api/word_root_api.dart';
import '../theme/palette.dart';
import '../widgets/app_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/gradient_button.dart';
import '../widgets/page_header.dart';
import '../widgets/segmented.dart';
import '../widgets/shimmer.dart';

/// AI 页的三个 Tab。
enum AiTab { expand, wordRoot, roots }

class AiPage extends ConsumerStatefulWidget {
  const AiPage({this.autoLoad = true, super.key});

  /// 词根词典面板是否在首帧自动拉取热门词。
  ///
  /// 生产恒为 true；widget 测试传 false——否则 `initState` 会发真实网络请求，
  /// 既连不上后端，也会留下悬挂定时器让用例直接失败。
  final bool autoLoad;

  @override
  ConsumerState<AiPage> createState() => _AiPageState();
}

class _AiPageState extends ConsumerState<AiPage> with AutomaticKeepAliveClientMixin {
  AiTab _tab = AiTab.expand;

  @override
  bool get wantKeepAlive => true; // 切 Tab 回来不丢生成结果

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Column(
      children: [
        PageHeader(
          title: 'AI 拓展',
          subtitle: '场景造句 · 词根拆解 · 词根词典',
          trailing: const _QuotaBadge(),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: SegmentedControl<AiTab>(
            value: _tab,
            onChanged: (value) => setState(() => _tab = value),
            segments: const <Segment<AiTab>>[
              Segment<AiTab>(
                value: AiTab.expand,
                label: '场景造句',
                icon: Icons.chat_bubble_outline_rounded,
              ),
              Segment<AiTab>(
                value: AiTab.wordRoot,
                label: '词根拆解',
                icon: Icons.account_tree_outlined,
              ),
              Segment<AiTab>(
                value: AiTab.roots,
                label: '词根词典',
                icon: Icons.menu_book_outlined,
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Expanded(
          child: switch (_tab) {
            AiTab.expand => const _ExpandPanel(),
            AiTab.wordRoot => const _WordRootPanel(),
            AiTab.roots => _RootsPanel(autoLoad: widget.autoLoad),
          },
        ),
      ],
    );
  }
}

/* ------------------------------ 额度徽标 ------------------------------ */

class _QuotaBadge extends ConsumerWidget {
  const _QuotaBadge();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quota = ref.watch(aiQuotaProvider);
    final colors = context.colors;
    return quota.when(
      data: (value) => Text(
        '今日剩余 ${value.remaining}/${value.limit}',
        style: TextStyle(fontSize: 12, color: colors.inkFaint),
      ),
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
    );
  }
}

/* ------------------------------ 场景造句 ------------------------------ */

class _ExpandPanel extends ConsumerStatefulWidget {
  const _ExpandPanel();

  @override
  ConsumerState<_ExpandPanel> createState() => _ExpandPanelState();
}

class _ExpandPanelState extends ConsumerState<_ExpandPanel> {
  final _input = TextEditingController();
  StreamSubscription<AiStreamResult>? _sub;
  CancelToken? _cancelToken;
  String _buffer = '';
  bool _running = false;
  String? _error;
  ExpandResult? _result;

  @override
  void dispose() {
    _sub?.cancel();
    _cancelToken?.cancel();
    _input.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    final chinese = _input.text.trim();
    if (chinese.isEmpty) {
      setState(() => _error = '请先写下想表达的中文');
      return;
    }
    if (_running) {
      return;
    }
    setState(() {
      _running = true;
      _buffer = '';
      _error = null;
      _result = null;
    });
    _cancelToken = CancelToken();
    _sub = ref.read(aiApiProvider).expand(chinese, cancelToken: _cancelToken).listen(
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
      onError: (Object _) {
        if (!mounted) {
          return;
        }
        setState(() {
          _error = '生成失败，请重试';
          _running = false;
        });
      },
    );
  }

  void _finish() {
    if (!mounted) {
      return;
    }
    setState(() {
      _running = false;
      if (_buffer.isNotEmpty) {
        _result = ExpandResult.tryParse(_buffer);
        final hasShape = _buffer.contains('{') && _buffer.contains('}');
        if (_result == null && !hasShape) {
          _error = 'AI 这次没给出可用结果，请重试';
        }
      }
    });
    ref.invalidate(aiQuotaProvider); // 扣了额度，刷剩余次数
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                '写下你想表达的中文',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: colors.ink,
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _input,
                enabled: !_running,
                maxLines: 3,
                minLines: 2,
                textInputAction: TextInputAction.newline,
                decoration: const InputDecoration(
                  hintText: '例如：我想说这个咖啡店很安静，适合看书',
                ),
              ),
              const SizedBox(height: 12),
              GradientButton(
                label: _running ? '生成中…' : '生成地道表达',
                icon: Icons.auto_awesome_rounded,
                loading: _running,
                onPressed: _running ? null : _start,
              ),
            ],
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          _ErrorBanner(message: _error!),
        ],
        if (_buffer.isNotEmpty) ...[
          const SizedBox(height: 14),
          if (_result != null)
            _ExpandResultCard(result: _result!)
          else
            AppCard(child: _StreamingText(text: _buffer, running: _running)),
        ],
      ],
    );
  }
}

/// 场景造句结果卡片。
class _ExpandResultCard extends StatelessWidget {
  const _ExpandResultCard({required this.result});

  final ExpandResult result;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            result.sentence,
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w700,
              height: 1.35,
              color: colors.ink,
            ),
          ),
          if (result.phonetic.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              result.phonetic,
              style: TextStyle(
                fontSize: 13,
                fontFamily: 'monospace',
                color: colors.brand,
              ),
            ),
          ],
          if (result.note.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: colors.cardMuted,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                result.note,
                style: TextStyle(fontSize: 13, height: 1.5, color: colors.inkSoft),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/* ------------------------------ 词根拆解 ------------------------------ */

class _WordRootPanel extends ConsumerStatefulWidget {
  const _WordRootPanel();

  @override
  ConsumerState<_WordRootPanel> createState() => _WordRootPanelState();
}

class _WordRootPanelState extends ConsumerState<_WordRootPanel> {
  final _input = TextEditingController();
  StreamSubscription<AiStreamResult>? _sub;
  CancelToken? _cancelToken;
  String _buffer = '';
  bool _running = false;
  String? _error;
  WordRootResult? _result;

  @override
  void dispose() {
    _sub?.cancel();
    _cancelToken?.cancel();
    _input.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    final word = _input.text.trim();
    if (word.isEmpty) {
      setState(() => _error = '请先输入一个英文单词');
      return;
    }
    if (_running) {
      return;
    }
    setState(() {
      _running = true;
      _buffer = '';
      _error = null;
      _result = null;
    });
    _cancelToken = CancelToken();
    _sub = ref.read(aiApiProvider).wordRoot(word, cancelToken: _cancelToken).listen(
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
      onError: (Object _) {
        if (!mounted) {
          return;
        }
        setState(() {
          _error = '生成失败，请重试';
          _running = false;
        });
      },
    );
  }

  void _finish() {
    if (!mounted) {
      return;
    }
    setState(() {
      _running = false;
      if (_buffer.isNotEmpty) {
        _result = WordRootResult.tryParse(_buffer);
        final hasShape = _buffer.contains('{') && _buffer.contains('}');
        if (_result == null && !hasShape) {
          _error = 'AI 这次没给出可用结果，请重试';
        }
      }
    });
    ref.invalidate(aiQuotaProvider);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                '输入英文单词，拆解词根词缀',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: colors.ink,
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _input,
                enabled: !_running,
                textInputAction: TextInputAction.done,
                autocorrect: false,
                onSubmitted: (_) => _start(),
                decoration: const InputDecoration(
                  hintText: '例如 unavoidable',
                ),
              ),
              const SizedBox(height: 12),
              GradientButton(
                label: _running ? '拆解中…' : '拆解词根',
                icon: Icons.account_tree_rounded,
                loading: _running,
                onPressed: _running ? null : _start,
              ),
            ],
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          _ErrorBanner(message: _error!),
        ],
        if (_buffer.isNotEmpty) ...[
          const SizedBox(height: 14),
          if (_result != null)
            _WordRootResultCard(word: _input.text.trim(), result: _result!)
          else
            AppCard(child: _StreamingText(text: _buffer, running: _running)),
        ],
      ],
    );
  }
}

/// 词根拆解结果卡片（与词根词典共用同一套呈现）。
class _WordRootResultCard extends StatelessWidget {
  const _WordRootResultCard({required this.word, required this.result});

  /// 被拆解的单词（WordRootResult 本身不含 word 字段——它是 AI 解析结果，
  /// 词形由调用方传入）。
  final String word;

  final WordRootResult result;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                word,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: colors.ink,
                ),
              ),
              if (result.phonetic.isNotEmpty) ...[
                const SizedBox(width: 8),
                Text(
                  result.phonetic,
                  style: TextStyle(
                    fontSize: 13,
                    fontFamily: 'monospace',
                    color: colors.brand,
                  ),
                ),
              ],
            ],
          ),
          if (result.meaning.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(result.meaning, style: TextStyle(fontSize: 14, color: colors.inkSoft)),
          ],
          if (result.parts.isNotEmpty) ...[
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final part in result.parts)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: colors.cardMuted,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          part.text,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: colors.brand,
                          ),
                        ),
                        Text(
                          part.meaning,
                          style: TextStyle(fontSize: 11, color: colors.inkFaint),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ],
          if (result.explanation.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              result.explanation,
              style: TextStyle(fontSize: 13, height: 1.55, color: colors.inkSoft),
            ),
          ],
          if (result.related.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              '同根词',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: colors.inkFaint,
              ),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                for (final word in result.related)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      border: Border.all(color: colors.line),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      word,
                      style: TextStyle(fontSize: 12, color: colors.inkSoft),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/* ------------------------------ 词根词典 ------------------------------ */

class _RootsPanel extends ConsumerStatefulWidget {
  const _RootsPanel({required this.autoLoad});

  final bool autoLoad;

  @override
  ConsumerState<_RootsPanel> createState() => _RootsPanelState();
}

class _RootsPanelState extends ConsumerState<_RootsPanel> {
  final _input = TextEditingController();
  List<WordRootItem> _items = const <WordRootItem>[];
  bool _loading = true;
  bool _looking = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.autoLoad) {
      _search();
    } else {
      _loading = false; // 测试环境：不拉数据，直接给空态
    }
  }

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await ref.read(wordRootApiProvider).search(_input.text);
      if (!mounted) {
        return;
      }
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error is Exception ? '搜索失败，请重试' : '搜索失败';
        _loading = false;
      });
    }
  }

  /// 查词：缓存未命中会实时 AI 解析（扣额度）。
  Future<void> _lookup() async {
    final word = _input.text.trim();
    if (word.isEmpty || _looking) {
      return;
    }
    setState(() {
      _looking = true;
      _error = null;
    });
    try {
      final item = await ref.read(wordRootApiProvider).lookup(word);
      if (!mounted) {
        return;
      }
      setState(() {
        _items = <WordRootItem>[item, ..._items.where((e) => e.word != item.word)];
        _looking = false;
      });
      ref.invalidate(aiQuotaProvider);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error is Exception ? '查词失败，请稍后重试' : '查词失败';
        _looking = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _input,
                  textInputAction: TextInputAction.search,
                  autocorrect: false,
                  onSubmitted: (_) => _search(),
                  decoration: const InputDecoration(
                    hintText: '搜索词根 / 单词',
                    prefixIcon: Icon(Icons.search_rounded, size: 20),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              SizedBox(
                width: 92,
                child: GradientButton(
                  label: _looking ? '解析中' : '查词',
                  height: 46,
                  loading: _looking,
                  onPressed: _looking ? null : _lookup,
                ),
              ),
            ],
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _ErrorBanner(message: _error!),
          ),
        Expanded(
          child: _loading
              ? ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  itemCount: 5,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, _) => const ShimmerBox(height: 76, radius: 16),
                )
              : _items.isEmpty
                  ? const EmptyState(
                      icon: Icons.menu_book_outlined,
                      title: '还没收录词条',
                      message: '在上方输入单词后点「查词」，AI 会实时拆解并收录',
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                      itemCount: _items.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, index) =>
                          _RootTile(item: _items[index]),
                    ),
        ),
      ],
    );
  }
}

/// 词典条目（点击展开完整拆解）。
class _RootTile extends StatelessWidget {
  const _RootTile({required this.item});

  final WordRootItem item;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return AppCard(
      padding: EdgeInsets.zero,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
          shape: const Border(),
          collapsedShape: const Border(),
          title: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                item.word,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: colors.ink,
                ),
              ),
              if (item.phonetic != null && item.phonetic!.isNotEmpty) ...[
                const SizedBox(width: 8),
                Text(
                  item.phonetic!,
                  style: TextStyle(
                    fontSize: 12,
                    fontFamily: 'monospace',
                    color: colors.brand,
                  ),
                ),
              ],
            ],
          ),
          subtitle: item.meaning == null
              ? null
              : Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    item.meaning!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12, color: colors.inkSoft),
                  ),
                ),
          children: [
            if (item.parts.isNotEmpty)
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final part in item.parts)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: colors.cardMuted,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            part.text,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: colors.brand,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            part.meaning,
                            style: TextStyle(fontSize: 11, color: colors.inkFaint),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            if (item.explanation.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                item.explanation,
                style: TextStyle(fontSize: 13, height: 1.55, color: colors.inkSoft),
              ),
            ],
            if (item.related.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  for (final word in item.related)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        border: Border.all(color: colors.line),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        word,
                        style: TextStyle(fontSize: 12, color: colors.inkSoft),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/* ------------------------------ 公共小件 ------------------------------ */

/// 流式文本（逐字显示 + 光标）。
class _StreamingText extends StatefulWidget {
  const _StreamingText({required this.text, required this.running});

  final String text;
  final bool running;

  @override
  State<_StreamingText> createState() => _StreamingTextState();
}

class _StreamingTextState extends State<_StreamingText>
    with SingleTickerProviderStateMixin {
  late final AnimationController _cursor = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 700),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _cursor.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: widget.text,
            style: TextStyle(fontSize: 14, height: 1.6, color: colors.inkSoft),
          ),
          if (widget.running)
            WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: FadeTransition(
                opacity: _cursor,
                child: Container(
                  width: 2,
                  height: 16,
                  margin: const EdgeInsets.only(left: 2),
                  color: colors.brand,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 错误条。
class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: colors.danger.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline_rounded, size: 17, color: colors.danger),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: TextStyle(fontSize: 13, color: colors.danger),
            ),
          ),
        ],
      ),
    );
  }
}
