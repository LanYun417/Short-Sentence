/// 句子接龙页（路由 /chains）：一句开头，谁都可以往下接。
///
/// 产品取向与 Web 一致：**不做公开社交**——没有关注、没有评论、没有头像，
/// 作者是服务端按 userId + topicId 派生的稳定化名。内容安全在服务端：
/// 入库前挡链接/联系方式/非英文，每人每天 3 条，举报满 3 次自动隐藏。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../api/chain_api.dart';
import '../api/models/chain.dart';
import '../theme.dart';
import '../widgets/app_card.dart';
import '../widgets/page_header.dart';

class ChainPage extends ConsumerStatefulWidget {
  const ChainPage({super.key});

  @override
  ConsumerState<ChainPage> createState() => _ChainPageState();
}

class _ChainPageState extends ConsumerState<ChainPage> {
  int? _activeId;
  final TextEditingController _en = TextEditingController();
  final TextEditingController _zh = TextEditingController();
  bool _submitting = false;
  String? _flash;

  @override
  void dispose() {
    _en.dispose();
    _zh.dispose();
    super.dispose();
  }

  Future<void> _submit(int topicId) async {
    if (_submitting || _en.text.trim().length < 6) return;
    setState(() => _submitting = true);
    try {
      await ref.read(chainApiProvider).create(topicId, _en.text.trim(), _zh.text.trim());
      _en.clear();
      _zh.clear();
      ref.invalidate(chainDetailProvider(topicId));
      if (!mounted) return;
      setState(() => _flash = '接上了。看看别人怎么往下写。');
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _flash = error.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _toggleLike(int topicId, ChainEntry entry) async {
    try {
      final (bool liked, int count) = await ref.read(chainApiProvider).toggleLike(entry.id);
      // 就地更新，避免整页重排把用户正在读的那条冲走
      ref.invalidate(chainDetailProvider(topicId));
      if (!mounted) return;
      setState(() => _flash = liked ? '已点赞（$count）' : null);
    } on ApiException {
      // 点赞失败不打断阅读
    }
  }

  Future<void> _report(ChainEntry entry) async {
    try {
      await ref.read(chainApiProvider).report(entry.id);
      if (!mounted) return;
      setState(() => _flash = '已收到，我们会尽快核查。');
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _flash = error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final int? activeId = _activeId;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        bottom: false,
        child: activeId == null ? _buildTopics(colors) : _buildDetail(colors, activeId),
      ),
    );
  }

  Widget _buildTopics(AppColors colors) {
    final AsyncValue<List<ChainTopic>> topicsAsync = ref.watch(chainTopicsProvider);

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(chainTopicsProvider),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
        children: <Widget>[
          const PageHeader(
            title: '句子接龙',
            subtitle: '一句开头，谁都可以往下接。全部匿名，只留文字。',
          ),
          if (_flash != null) _Flash(text: _flash!),
          topicsAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (Object error, _) => AppCard(
              child: Text('加载失败：$error', style: TextStyle(color: colors.danger)),
            ),
            data: (List<ChainTopic> topics) {
              if (topics.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 48),
                  child: Center(
                    child: Text('还没有接龙主题…', style: TextStyle(color: colors.inkFaint)),
                  ),
                );
              }
              return Column(
                children: <Widget>[
                  for (final ChainTopic topic in topics) ...<Widget>[
                    AppCard(
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                      radius: 20,
                      onTap: () => setState(() {
                        _activeId = topic.id;
                        _flash = null;
                      }),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Row(
                            children: <Widget>[
                              Expanded(
                                child: Text(
                                  topic.title,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: colors.ink,
                                  ),
                                ),
                              ),
                              Text(
                                '${topic.entryCount} 句',
                                style: TextStyle(fontSize: 11, color: colors.inkFaint),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            topic.starterEn,
                            style: TextStyle(
                              fontSize: 12,
                              height: 1.5,
                              fontStyle: FontStyle.italic,
                              color: colors.inkSoft,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: <Widget>[
                              Expanded(
                                child: Text(
                                  topic.promptZh,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 11, color: colors.inkFaint),
                                ),
                              ),
                              if (topic.myEntryCount > 0)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: colors.success.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    '我接过 ${topic.myEntryCount} 句',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                      color: colors.success,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildDetail(AppColors colors, int topicId) {
    final AsyncValue<ChainTopicDetail> detailAsync = ref.watch(chainDetailProvider(topicId));
    final ChainTopicDetail? detail = detailAsync.valueOrNull;
    final bool canSubmit = _en.text.trim().length >= 6 && (detail?.remainingToday ?? 0) > 0 && !_submitting;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(0, 8, 0, 8),
          child: InkWell(
            onTap: () => setState(() {
              _activeId = null;
              _flash = null;
            }),
            borderRadius: BorderRadius.circular(8),
            child: Row(
              children: <Widget>[
                Icon(Icons.chevron_left_rounded, size: 18, color: colors.inkSoft),
                Text('全部主题', style: TextStyle(fontSize: 12, color: colors.inkSoft)),
              ],
            ),
          ),
        ),
        if (detail != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: <Color>[
                  colors.brand.withValues(alpha: 0.1),
                  colors.brand.withValues(alpha: 0.04),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  detail.topic.title,
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: colors.ink),
                ),
                const SizedBox(height: 8),
                Text(
                  '“${detail.topic.starterEn}”',
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.6,
                    fontStyle: FontStyle.italic,
                    color: colors.inkSoft,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  detail.topic.promptZh,
                  style: TextStyle(fontSize: 11.5, color: colors.inkFaint),
                ),
              ],
            ),
          ),
        if (_flash != null) _Flash(text: _flash!),
        const SizedBox(height: 12),
        detailAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 48),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (Object error, _) => AppCard(
            child: Text('加载失败：$error', style: TextStyle(color: colors.danger)),
          ),
          data: (ChainTopicDetail data) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              // 提交
              AppCard(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                radius: 18,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    TextField(
                      controller: _en,
                      maxLength: 200,
                      maxLines: 2,
                      minLines: 1,
                      style: TextStyle(fontSize: 13, color: colors.ink),
                      decoration: InputDecoration(
                        hintText: '用一句英文接下去…',
                        hintStyle: TextStyle(fontSize: 13, color: colors.inkFaint),
                        counterText: '',
                        filled: true,
                        fillColor: colors.cardMuted,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _zh,
                      maxLength: 120,
                      style: TextStyle(fontSize: 12, color: colors.inkSoft),
                      decoration: InputDecoration(
                        hintText: '中文翻译（可选）',
                        hintStyle: TextStyle(fontSize: 12, color: colors.inkFaint),
                        counterText: '',
                        filled: true,
                        fillColor: colors.cardMuted,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: <Widget>[
                        Text(
                          '今天还能写 ${data.remainingToday} / ${data.dailyLimit} 句',
                          style: TextStyle(fontSize: 11, color: colors.inkFaint),
                        ),
                        const Spacer(),
                        FilledButton(
                          onPressed: canSubmit ? () => _submit(topicId) : null,
                          style: FilledButton.styleFrom(
                            backgroundColor: colors.brand,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                          child: _submitting
                              ? const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Text('接上一句'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              if (data.entries.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 32),
                  child: Center(
                    child: Text(
                      '还没有人接第一句，你来开个头。',
                      style: TextStyle(fontSize: 12, color: colors.inkFaint),
                    ),
                  ),
                )
              else
                for (final ChainEntry entry in data.entries) ...<Widget>[
                  AppCard(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
                    radius: 18,
                    bordered: true,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Row(
                          children: <Widget>[
                            Text(
                              entry.alias,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: colors.inkSoft,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              entry.createdAt.length >= 10 ? entry.createdAt.substring(5, 10) : '',
                              style: TextStyle(fontSize: 10, color: colors.inkFaint),
                            ),
                            if (entry.mine) ...<Widget>[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                decoration: BoxDecoration(
                                  color: colors.brand.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  '我',
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w600,
                                    color: colors.brand,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 5),
                        Text(
                          entry.contentEn,
                          style: TextStyle(fontSize: 13.5, height: 1.5, color: colors.ink),
                        ),
                        if (entry.contentZh != null && entry.contentZh!.isNotEmpty) ...<Widget>[
                          const SizedBox(height: 4),
                          Text(
                            entry.contentZh!,
                            style: TextStyle(fontSize: 11.5, color: colors.inkFaint),
                          ),
                        ],
                        const SizedBox(height: 6),
                        Row(
                          children: <Widget>[
                            InkWell(
                              onTap: () => _toggleLike(topicId, entry),
                              borderRadius: BorderRadius.circular(20),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                                child: Row(
                                  children: <Widget>[
                                    Icon(
                                      Icons.favorite_rounded,
                                      size: 14,
                                      color: entry.liked ? colors.danger : colors.inkFaint,
                                    ),
                                    const SizedBox(width: 3),
                                    Text(
                                      '${entry.likeCount}',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: entry.liked ? colors.danger : colors.inkFaint,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            if (!entry.mine) ...<Widget>[
                              const SizedBox(width: 12),
                              InkWell(
                                onTap: () => _report(entry),
                                borderRadius: BorderRadius.circular(20),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                                  child: Row(
                                    children: <Widget>[
                                      Icon(Icons.flag_outlined, size: 13, color: colors.inkFaint),
                                      const SizedBox(width: 3),
                                      Text(
                                        '举报',
                                        style: TextStyle(fontSize: 10.5, color: colors.inkFaint),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
            ],
          ),
        ),
      ],
    );
  }
}

class _Flash extends StatelessWidget {
  const _Flash({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: colors.brand.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(text, style: TextStyle(fontSize: 11.5, color: colors.brand)),
      ),
    );
  }
}
