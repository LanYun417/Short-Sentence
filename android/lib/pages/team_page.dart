/// 学习小队页（路由 /team）：随机匹配 / 自建队伍 / 组队码加入 + 小队群聊。
///
/// 与 Web 端 `pages/team.vue` 同源同契约：
/// - 三种组队方式：随机匹配、自建队伍（生成组队码）、凭组队码加入；
/// - 群聊：游标分页、引用、本人 2 分钟内撤回；记录仅保留最近 30 天；
/// - 队伍上限 10 人，页面 5 秒轮询拉新消息（仅当前页可见时）。
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../api/models/team.dart';
import '../api/team_api.dart';
import '../theme.dart';
import '../widgets/app_card.dart';
import '../widgets/page_header.dart';
import '../widgets/press_scale.dart';

class TeamPage extends ConsumerStatefulWidget {
  const TeamPage({super.key});

  @override
  ConsumerState<TeamPage> createState() => _TeamPageState();
}

class _TeamPageState extends ConsumerState<TeamPage> {
  final TextEditingController _createName = TextEditingController();
  final TextEditingController _joinCode = TextEditingController();
  final TextEditingController _draft = TextEditingController();
  final ScrollController _chatScroll = ScrollController();

  TeamView? _team;
  List<TeamMessage> _messages = <TeamMessage>[];
  TeamMessage? _quote;
  bool _loading = true;
  bool _busy = false;
  bool _sending = false;
  bool _loadingOlder = false;
  bool _hasMore = false;
  String? _error;
  String? _flash;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _poll?.cancel();
    _createName.dispose();
    _joinCode.dispose();
    _draft.dispose();
    _chatScroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final TeamView? team = await ref.read(teamApiProvider).my();
      if (!mounted) return;
      setState(() {
        _team = team;
        _loading = false;
      });
      if (team != null) {
        await _loadMessages();
        _startPolling();
      }
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  void _startPolling() {
    _poll?.cancel();
    _poll = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted || _team == null) return;
      _loadLatest();
    });
  }

  void _applyTeam(TeamView? team) {
    setState(() {
      _team = team;
      if (team == null) {
        _messages = <TeamMessage>[];
        _quote = null;
        _draft.clear();
        _hasMore = false;
        _poll?.cancel();
      }
    });
    if (team != null) {
      _loadMessages();
      _startPolling();
    }
  }

  Future<void> _match() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final team = await ref.read(teamApiProvider).match();
      _applyTeam(team);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _create() async {
    final name = _createName.text.trim();
    if (_busy) return;
    if (name.isEmpty) {
      setState(() => _error = '请输入小队名（2~20 字）');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final team = await ref.read(teamApiProvider).create(name);
      _createName.clear();
      _applyTeam(team);
      if (mounted) setState(() => _flash = '小队已创建，把组队码发给队友吧');
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _join() async {
    final code = _joinCode.text.trim().toUpperCase();
    if (_busy) return;
    if (code.isEmpty) {
      setState(() => _error = '请输入组队码');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final team = await ref.read(teamApiProvider).join(code);
      _joinCode.clear();
      _applyTeam(team);
      if (mounted) setState(() => _flash = '已加入小队');
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _leave() async {
    final bool? ok = await _confirm('退出小队', '退出后当前小队与聊天记录会看不到了，之后可以重新组队。');
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await ref.read(teamApiProvider).leave();
      _applyTeam(null);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _rematch() async {
    final bool? ok = await _confirm('换一批队友', '会退出当前小队并重新随机匹配，连续天数清零。');
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      final api = ref.read(teamApiProvider);
      await api.leave();
      _applyTeam(await api.match());
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _rename() async {
    final team = _team;
    if (team == null) return;
    final controller = TextEditingController(text: team.name);
    final String? next = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('修改小队名'),
        content: TextField(
          controller: controller,
          maxLength: 20,
          autofocus: true,
          decoration: const InputDecoration(hintText: '小队名 2~20 字'),
        ),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('取消')),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('保存'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (next == null || next.isEmpty) return;
    try {
      final updated = await ref.read(teamApiProvider).rename(next);
      if (!mounted) return;
      setState(() => _team = updated);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    }
  }

  Future<bool?> _confirm(String title, String message) {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: context.colors.danger),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('确定'),
          ),
        ],
      ),
    );
  }

  /* ------------------------------ 群聊 ------------------------------ */

  Future<void> _loadMessages() async {
    try {
      final page = await ref.read(teamApiProvider).messages(limit: 30);
      if (!mounted) return;
      setState(() {
        _messages = page.list.reversed.toList();
        _hasMore = page.hasMore;
      });
      _scrollToBottom();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    }
  }

  /// 轮询最新一页，按 id 合并（撤回/隐藏状态以服务端为准）。
  Future<void> _loadLatest() async {
    try {
      final page = await ref.read(teamApiProvider).messages(limit: 30);
      if (!mounted) return;
      final Map<int, TeamMessage> map = <int, TeamMessage>{for (final m in _messages) m.id: m};
      bool appended = false;
      for (final m in page.list) {
        if (!map.containsKey(m.id)) appended = true;
        map[m.id] = m;
      }
      final merged = map.values.toList()..sort((a, b) => a.id.compareTo(b.id));
      setState(() => _messages = merged);
      if (appended) _scrollToBottom();
    } on ApiException {
      // 轮询失败静默，不打断阅读
    }
  }

  Future<void> _loadOlder() async {
    if (_loadingOlder || _messages.isEmpty) return;
    setState(() => _loadingOlder = true);
    try {
      final page = await ref.read(teamApiProvider).messages(before: _messages.first.id, limit: 30);
      if (!mounted) return;
      setState(() {
        _messages = <TeamMessage>[...page.list.reversed, ..._messages];
        _hasMore = page.hasMore;
      });
    } on ApiException {
      // 加载更早失败不打断当前阅读
    } finally {
      if (mounted) setState(() => _loadingOlder = false);
    }
  }

  Future<void> _send() async {
    final content = _draft.text.trim();
    if (content.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final created = await ref
          .read(teamApiProvider)
          .sendMessage(content, quoteId: _quote?.id);
      if (!mounted) return;
      final TeamMessage message = TeamMessage(
        id: created.id,
        userId: created.userId,
        nickname: created.nickname,
        avatarFileId: created.avatarFileId,
        isMe: true,
        content: created.content,
        status: created.status,
        canRecall: created.canRecall,
        quote: _quote == null
            ? null
            : TeamMessageQuote(
                id: _quote!.id,
                nickname: _quote!.nickname,
                content: _quote!.content,
                status: _quote!.status,
              ),
        createdAt: created.createdAt,
      );
      setState(() {
        _messages = <TeamMessage>[..._messages, message];
        _draft.clear();
        _quote = null;
      });
      _scrollToBottom();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _recall(TeamMessage msg) async {
    try {
      final updated = await ref.read(teamApiProvider).recall(msg.id);
      if (!mounted) return;
      setState(() {
        _messages = _messages
            .map((m) => m.id == msg.id ? m.copyWith(content: '', status: updated.status, canRecall: false) : m)
            .toList();
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    }
  }

  Future<void> _copyCode(String code) async {
    if (code.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: code));
    if (!mounted) return;
    setState(() => _flash = '组队码已复制');
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_chatScroll.hasClients) {
        _chatScroll.animateTo(
          _chatScroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOut,
        );
      }
    });
  }

  String _timeOf(DateTime date) {
    return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  /* ------------------------------ UI ------------------------------ */

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        bottom: false,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _team == null
                ? _buildNoTeam(colors)
                : _buildTeam(colors, _team!),
      ),
    );
  }

  Widget _buildNoTeam(AppColors colors) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
      children: <Widget>[
        const PageHeader(
          title: '学习小队',
          subtitle: '随机匹配或组队码加入，最多 10 人，一起打卡群聊。',
        ),
        if (_flash != null) _Flash(text: _flash!),
        if (_error != null) _Flash(text: _error!, danger: true),

        // 随机匹配
        AppCard(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          radius: 20,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _SectionTitle(icon: Icons.shuffle_rounded, color: colors.brand, title: '随机匹配'),
              const SizedBox(height: 6),
              Text(
                '按近 7 天练习节奏，匹配节奏相近的陌生人，一起把每天坚持下来。',
                style: TextStyle(fontSize: 12, height: 1.5, color: colors.inkSoft),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 40,
                child: FilledButton(
                  onPressed: _busy ? null : _match,
                  child: Text(_busy ? '处理中…' : '开始匹配'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // 自建队伍
        AppCard(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          radius: 20,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _SectionTitle(icon: Icons.flag_rounded, color: colors.brand, title: '自建队伍'),
              const SizedBox(height: 6),
              Text(
                '自己起个队名，建好后会生成组队码，发给朋友就能加入。',
                style: TextStyle(fontSize: 12, height: 1.5, color: colors.inkSoft),
              ),
              const SizedBox(height: 10),
              Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: _createName,
                      maxLength: 20,
                      style: TextStyle(fontSize: 14, color: colors.ink),
                      decoration: InputDecoration(
                        hintText: '小队名 2~20 字',
                        counterText: '',
                        isDense: true,
                        filled: true,
                        fillColor: colors.cardMuted,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 44,
                    child: FilledButton(onPressed: _busy ? null : _create, child: const Text('创建')),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // 组队码加入
        AppCard(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          radius: 20,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _SectionTitle(icon: Icons.vpn_key_rounded, color: colors.success, title: '输入组队码加入'),
              const SizedBox(height: 6),
              Text(
                '朋友给了你组队码？输入即可加入对方的小队。',
                style: TextStyle(fontSize: 12, height: 1.5, color: colors.inkSoft),
              ),
              const SizedBox(height: 10),
              Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: _joinCode,
                      maxLength: 8,
                      textCapitalization: TextCapitalization.characters,
                      style: TextStyle(fontSize: 14, letterSpacing: 3, color: colors.ink),
                      decoration: InputDecoration(
                        hintText: '6 位组队码',
                        counterText: '',
                        isDense: true,
                        filled: true,
                        fillColor: colors.cardMuted,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 44,
                    child: FilledButton(onPressed: _busy ? null : _join, child: const Text('加入')),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTeam(AppColors colors, TeamView team) {
    return Column(
      children: <Widget>[
        Expanded(
          child: ListView(
            controller: _chatScroll,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            children: <Widget>[
              const PageHeader(title: '学习小队', subtitle: '和队友一起打卡，随时聊两句。'),
              if (_flash != null) _Flash(text: _flash!),
              if (_error != null) _Flash(text: _error!, danger: true),

              // 队伍信息
              AppCard(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                radius: 20,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: PressScale(
                            onTap: _rename,
                            child: Row(
                              children: <Widget>[
                                Flexible(
                                  child: Text(
                                    team.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w800,
                                      color: colors.ink,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Icon(Icons.edit_rounded, size: 13, color: colors.inkFaint),
                              ],
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                          decoration: BoxDecoration(
                            color: colors.gold.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '连续 ${team.streak} 天',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: colors.gold),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: <Widget>[
                        _Pill(
                          text: team.source == 'create' ? '自建队伍' : '随机匹配',
                          color: colors.inkSoft,
                          bg: colors.cardMuted,
                        ),
                        _Pill(
                          text: '${team.memberCount} / ${team.maxMembers} 人',
                          color: colors.inkSoft,
                          bg: colors.cardMuted,
                        ),
                        PressScale(
                          onTap: () => _copyCode(team.code),
                          child: _Pill(
                            text: team.code.isEmpty ? '组队码生成中' : '${team.code}  · 复制',
                            color: colors.success,
                            bg: colors.success.withValues(alpha: 0.14),
                            icon: Icons.vpn_key_rounded,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                      decoration: BoxDecoration(
                        color: _toneBg(colors, team.hintTone),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: <Widget>[
                          Icon(
                            team.hintTone == 'success'
                                ? Icons.check_circle_rounded
                                : team.hintTone == 'urge'
                                    ? Icons.notifications_active_rounded
                                    : Icons.info_rounded,
                            size: 15,
                            color: _toneFg(colors, team.hintTone),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              team.hint,
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w600,
                                color: _toneFg(colors, team.hintTone),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                    GridView.count(
                      crossAxisCount: 2,
                      mainAxisSpacing: 8,
                      crossAxisSpacing: 8,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      childAspectRatio: 3.1,
                      children: <Widget>[
                        for (final member in team.members) _MemberTile(colors: colors, member: member),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // 群聊标题
              Row(
                children: <Widget>[
                  Icon(Icons.forum_rounded, size: 16, color: colors.brand),
                  const SizedBox(width: 6),
                  Text(
                    '小队群聊',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.ink),
                  ),
                  const Spacer(),
                  Text('仅保留最近 30 天', style: TextStyle(fontSize: 10.5, color: colors.inkFaint)),
                ],
              ),
              const SizedBox(height: 8),

              if (_hasMore)
                Center(
                  child: TextButton(
                    onPressed: _loadingOlder ? null : _loadOlder,
                    child: Text(_loadingOlder ? '加载中…' : '加载更早的消息'),
                  ),
                ),

              if (_messages.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 32),
                  child: Center(
                    child: Text('还没有消息，先跟队友打个招呼吧。', style: TextStyle(fontSize: 12, color: colors.inkFaint)),
                  ),
                )
              else
                for (final msg in _messages)
                  _MessageRow(
                    colors: colors,
                    message: msg,
                    time: _timeOf(msg.createdAt),
                    onQuote: () => setState(() => _quote = msg),
                    onRecall: () => _recall(msg),
                  ),

              const SizedBox(height: 8),
            ],
          ),
        ),

        // 危险动作 + 输入区
        Container(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
          decoration: BoxDecoration(
            color: colors.card,
            border: Border(top: BorderSide(color: colors.line)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                if (_quote != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: colors.cardMuted,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: <Widget>[
                        Icon(Icons.format_quote_rounded, size: 14, color: colors.inkFaint),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            '引用 ${_quote!.nickname}：${_quote!.content.isEmpty ? '原消息已撤回' : _quote!.content}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 11, color: colors.inkSoft),
                          ),
                        ),
                        PressScale(
                          onTap: () => setState(() => _quote = null),
                          child: Icon(Icons.close_rounded, size: 15, color: colors.inkFaint),
                        ),
                      ],
                    ),
                  ),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: TextField(
                        controller: _draft,
                        minLines: 1,
                        maxLines: 3,
                        maxLength: 500,
                        style: TextStyle(fontSize: 14, color: colors.ink),
                        decoration: InputDecoration(
                          hintText: '说点什么…',
                          counterText: '',
                          isDense: true,
                          filled: true,
                          fillColor: colors.cardMuted,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    PressScale(
                      onTap: _sending ? null : _send,
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          gradient: brandGradient,
                          borderRadius: BorderRadius.circular(13),
                        ),
                        child: _sending
                            ? const Padding(
                                padding: EdgeInsets.all(11),
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.send_rounded, size: 19, color: Colors.white),
                      ),
                    ),
                  ],
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: <Widget>[
                    TextButton(
                      onPressed: _busy ? null : _rematch,
                      child: Text('换一批队友', style: TextStyle(fontSize: 11, color: colors.inkFaint)),
                    ),
                    TextButton(
                      onPressed: _busy ? null : _leave,
                      child: Text('退出小队', style: TextStyle(fontSize: 11, color: colors.danger)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Color _toneBg(AppColors colors, String tone) {
    switch (tone) {
      case 'urge':
        return const Color(0xFFFFF3E0);
      case 'success':
        return colors.success.withValues(alpha: 0.12);
      default:
        return colors.brand.withValues(alpha: 0.1);
    }
  }

  Color _toneFg(AppColors colors, String tone) {
    switch (tone) {
      case 'urge':
        return const Color(0xFFB45309);
      case 'success':
        return colors.success;
      default:
        return colors.brand;
    }
  }
}

/// 分区小标题。
class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.icon, required this.color, required this.title});

  final IconData icon;
  final Color color;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Icon(icon, size: 17, color: color),
        const SizedBox(width: 7),
        Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
      ],
    );
  }
}

/// 轻量标签。
class _Pill extends StatelessWidget {
  const _Pill({required this.text, required this.color, required this.bg, this.icon});

  final String text;
  final Color color;
  final Color bg;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (icon != null) ...<Widget>[
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
          ],
          Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
        ],
      ),
    );
  }
}

/// 队员格。
class _MemberTile extends StatelessWidget {
  const _MemberTile({required this.colors, required this.member});

  final AppColors colors;
  final TeamMemberView member;

  @override
  Widget build(BuildContext context) {
    final bool done = member.checkedIn;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: done ? colors.success.withValues(alpha: 0.08) : colors.cardMuted,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: done ? colors.success.withValues(alpha: 0.25) : colors.line),
      ),
      child: Row(
        children: <Widget>[
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              color: member.isMe ? colors.brand : const Color(0xFF818CF8),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                member.nickname.isEmpty ? '队' : member.nickname.substring(0, 1),
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white),
              ),
            ),
          ),
          const SizedBox(width: 7),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Text(
                  member.isMe ? '${member.nickname}（我）' : member.nickname,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: colors.ink),
                ),
                Text(
                  done ? '今日已打卡' : '待打卡',
                  style: TextStyle(fontSize: 9.5, color: done ? colors.success : colors.inkFaint),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 一条群聊消息。
class _MessageRow extends StatelessWidget {
  const _MessageRow({
    required this.colors,
    required this.message,
    required this.time,
    required this.onQuote,
    required this.onRecall,
  });

  final AppColors colors;
  final TeamMessage message;
  final String time;
  final VoidCallback onQuote;
  final VoidCallback onRecall;

  @override
  Widget build(BuildContext context) {
    final bool me = message.isMe;
    final Widget avatar = Container(
      width: 28,
      height: 28,
      margin: const EdgeInsets.only(top: 2),
      decoration: BoxDecoration(
        color: me ? colors.brand : const Color(0xFF818CF8),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          message.nickname.isEmpty ? '队' : message.nickname.substring(0, 1),
          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white),
        ),
      ),
    );

    final Widget body = Column(
      crossAxisAlignment: me ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(message.nickname, style: TextStyle(fontSize: 10, color: colors.inkFaint)),
            const SizedBox(width: 6),
            Text(time, style: TextStyle(fontSize: 9.5, color: colors.inkFaint)),
          ],
        ),
        const SizedBox(height: 3),
        if (message.quote != null)
          Container(
            margin: const EdgeInsets.only(bottom: 4),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
            decoration: BoxDecoration(
              color: colors.cardMuted,
              borderRadius: BorderRadius.circular(8),
              border: Border(left: BorderSide(color: colors.inkFaint, width: 2)),
            ),
            child: Text(
              '${message.quote!.nickname}：'
              '${message.quote!.status == 'normal' ? message.quote!.content : '原消息已撤回'}',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 10.5, color: colors.inkSoft),
            ),
          ),
        if (message.status == 'normal')
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
            constraints: const BoxConstraints(maxWidth: 260),
            decoration: BoxDecoration(
              color: me ? colors.brand : colors.card,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(14),
                topRight: const Radius.circular(14),
                bottomLeft: Radius.circular(me ? 14 : 4),
                bottomRight: Radius.circular(me ? 4 : 14),
              ),
              border: me ? null : Border.all(color: colors.line),
            ),
            child: Text(
              message.content,
              style: TextStyle(
                fontSize: 13,
                height: 1.45,
                color: me ? Colors.white : colors.ink,
              ),
            ),
          )
        else
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
            decoration: BoxDecoration(
              color: colors.cardMuted,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              message.status == 'recalled' ? '你撤回了一条消息' : '该消息已被隐藏',
              style: TextStyle(fontSize: 10.5, fontStyle: FontStyle.italic, color: colors.inkFaint),
            ),
          ),
        const SizedBox(height: 2),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            if (message.status == 'normal')
              PressScale(
                onTap: onQuote,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  child: Text('引用', style: TextStyle(fontSize: 10, color: colors.inkFaint)),
                ),
              ),
            if (message.canRecall)
              PressScale(
                onTap: onRecall,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  child: Text('撤回', style: TextStyle(fontSize: 10, color: colors.inkFaint)),
                ),
              ),
          ],
        ),
      ],
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: me ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: me
            ? <Widget>[
                Flexible(child: body),
                const SizedBox(width: 8),
                avatar,
              ]
            : <Widget>[
                avatar,
                const SizedBox(width: 8),
                Flexible(child: body),
              ],
      ),
    );
  }
}

/// 顶部提示条。
class _Flash extends StatelessWidget {
  const _Flash({required this.text, this.danger = false});

  final String text;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final Color fg = danger ? colors.danger : colors.brand;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: fg.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(text, style: TextStyle(fontSize: 11.5, color: fg)),
    );
  }
}
