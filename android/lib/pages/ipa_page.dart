/// 音标学习页（路由 /ipa）。
///
/// 与 Web 端 `pages/ipa.vue` 同源同契约：48 个音标按「单元音 / 双元音 / 清辅音 /
/// 浊辅音」分组浏览，每张卡正面大符号 + 示例词（可点朗读）+ 中文发音要点 +
/// 「学会了」标记。判分与发奖只在服务端：客户端只上报「学会了」真实操作。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/ipa_api.dart';
import '../api/models/ipa.dart';
import '../api/api_exception.dart';
import '../theme.dart';
import '../widgets/app_card.dart';
import '../widgets/tts_button.dart';

class IpaPage extends ConsumerStatefulWidget {
  const IpaPage({super.key});

  @override
  ConsumerState<IpaPage> createState() => _IpaPageState();
}

class _IpaPageState extends ConsumerState<IpaPage> {
  List<IpaPhonemeGroup> _groups = <IpaPhonemeGroup>[];
  int _total = 0;
  int _learnedCount = 0;
  final Set<String> _learned = <String>{};
  IpaPhonemeType? _activeGroup;
  bool _loading = true;
  String? _error;
  final Map<String, bool> _pending = <String, bool>{};

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
      final package = await ref.read(ipaApiProvider).phonemes();
      final progress = await ref.read(ipaApiProvider).progress();
      if (!mounted) return;
      setState(() {
        _groups = package.groups;
        _total = package.total;
        _learnedCount = progress.learnedCount;
        _learned.clear();
        for (final item in progress.items) {
          if (item.learned) _learned.add(item.symbol);
        }
        _activeGroup = _groups.isNotEmpty ? _groups.first.type : null;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = '网络异常，请稍后重试';
        _loading = false;
      });
    }
  }

  Future<void> _markLearned(IpaPhoneme phoneme) async {
    if (_learned.contains(phoneme.symbol) || _pending[phoneme.symbol] == true) return;
    setState(() {
      _pending[phoneme.symbol] = true;
    });
    // 乐观更新 + 失败回滚
    final beforeCount = _learnedCount;
    setState(() {
      _learned.add(phoneme.symbol);
      _learnedCount += 1;
    });
    try {
      final result = await ref.read(ipaApiProvider).markLearned(phoneme.symbol);
      if (!mounted) return;
      setState(() => _learnedCount = result.learnedCount);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _learned.remove(phoneme.symbol);
        _learnedCount = beforeCount;
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _learned.remove(phoneme.symbol);
        _learnedCount = beforeCount;
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('标记失败，请稍后重试')));
    } finally {
      if (mounted) setState(() => _pending.remove(phoneme.symbol));
    }
  }

  List<IpaPhoneme> get _activeItems {
    if (_activeGroup == null) return <IpaPhoneme>[];
    return _groups.firstWhere((g) => g.type == _activeGroup).items;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.chevron_left_rounded, size: 24),
          onPressed: () => context.pop(),
        ),
        title: Text(_loading ? '音标学习' : '音标学习 · 已掌握 $_learnedCount / $_total'),
        centerTitle: false,
      ),
      body: SafeArea(
        bottom: false,
        child: _buildBody(colors),
      ),
    );
  }

  Widget _buildBody(AppColors colors) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(_error!, style: TextStyle(color: colors.inkSoft)),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('重试'),
            ),
          ],
        ),
      );
    }
    if (_groups.isEmpty) {
      return Center(child: Text('音标库暂未就绪', style: TextStyle(color: colors.inkFaint)));
    }

    final items = _activeItems;
    final hint = _groups.firstWhere((g) => g.type == _activeGroup).hint;

    return CustomScrollView(
      slivers: <Widget>[
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: <Widget>[
                  for (final group in _groups)
                    _FilterChip(
                      label: group.title,
                      selected: group.type == _activeGroup,
                      onTap: () => setState(() => _activeGroup = group.type),
                    ),
                ],
              ),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
            child: Text(hint, style: TextStyle(color: colors.inkFaint, fontSize: 11.5)),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 0.92,
            ),
            delegate: SliverChildBuilderDelegate(
              (context, index) => _PhonemeCard(
                phoneme: items[index],
                learned: _learned.contains(items[index].symbol),
                pending: _pending[items[index].symbol] == true,
                onLearned: () => _markLearned(items[index]),
              ),
              childCount: items.length,
            ),
          ),
        ),
      ],
    );
  }
}

/// 分组筛选 chip（与外壳 Tab 同节奏：选中填充品牌色）。
class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          decoration: BoxDecoration(
            color: selected ? colors.brand : colors.card,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? colors.brand : colors.line,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : colors.inkSoft,
            ),
          ),
        ),
      ),
    );
  }
}

/// 单个音标卡。
class _PhonemeCard extends StatelessWidget {
  const _PhonemeCard({
    required this.phoneme,
    required this.learned,
    required this.pending,
    required this.onLearned,
  });

  final IpaPhoneme phoneme;
  final bool learned;
  final bool pending;
  final VoidCallback onLearned;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return AppCard(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            '/${phoneme.symbol}/',
            style: const TextStyle(
              fontFamily: 'monospace',
              fontSize: 24,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: <Widget>[
              for (final word in phoneme.exampleWords)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: colors.cardMuted,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Text(
                        word,
                        style: TextStyle(fontSize: 11.5, color: colors.ink),
                      ),
                      const SizedBox(width: 2),
                      SentenceTtsButton(text: word, compact: true),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Expanded(
            child: Text(
              phoneme.tips,
              style: TextStyle(fontSize: 10.5, height: 1.5, color: colors.inkSoft),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            height: 34,
            child: learned
                ? OutlinedButton(
                    onPressed: null,
                    child: const Text('已掌握', style: TextStyle(fontSize: 13)),
                  )
                : FilledButton(
                    onPressed: pending ? null : onLearned,
                    style: FilledButton.styleFrom(
                      minimumSize: Size.zero,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    child: pending
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('学会了', style: TextStyle(fontSize: 13)),
                  ),
          ),
        ],
      ),
    );
  }
}
