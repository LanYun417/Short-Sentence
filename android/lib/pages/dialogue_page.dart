/// AI 对话闯关页（路由 /stages/:id）：和 1~3 个 AI 角色围绕目标对话。
///
/// 与 Web 端 `stages/[id].vue` 对齐：用户发言在右、NPC 在左带 emoji 头像；
/// 翻译开关关掉可拿 +50% 经验（服务端按全程是否开启判定）；聊够 minTurns 且
/// 达成目标即通关；结束或通关后给中文复盘（summary + highlights/improvements）。
///
/// 不引入 SSE：模型返回结构化 JSON，整段一次性渲染。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/api_exception.dart';
import '../api/models/stage.dart';
import '../api/stage_api.dart';
import '../theme.dart';
import '../widgets/app_card.dart';
import '../widgets/press_scale.dart';

/// 模型没给候选短句时的兜底提示（点一下填入输入框）。
const List<StageDialogueHint> _fallbackHints = <StageDialogueHint>[
  StageDialogueHint(en: 'Could you tell me more about this?', zh: '你能多讲讲这个吗？'),
  StageDialogueHint(en: "What do you think we should do?", zh: '你觉得我们该怎么做？'),
  StageDialogueHint(en: "Let's practice this together.", zh: '我们一起练吧。'),
];

class DialoguePage extends ConsumerStatefulWidget {
  const DialoguePage({required this.id, this.scriptId, super.key});

  final int id;

  /// 所属剧本 id（从剧本页跳入时带上，用于返回时刷新剧本页的领奖状态）。
  /// 从地图页直接深链进入时为空。
  final int? scriptId;

  @override
  ConsumerState<DialoguePage> createState() => _DialoguePageState();
}

class _DialoguePageState extends ConsumerState<DialoguePage> {
  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();

  StageDialogue? _dialogue;
  List<StageDialogueMessage> _messages = <StageDialogueMessage>[];
  bool _loading = true;
  bool _sending = false;
  bool _ending = false;
  bool _showTranslation = true;
  bool _claimed = false;
  String? _error;

  /// nameEn → emoji，给 NPC 消息找头像。
  Map<String, String> get _roleEmoji {
    final map = <String, String>{};
    for (final role in _dialogue?.roles ?? const <StageRole>[]) {
      map[role.nameEn] = role.emoji;
    }
    return map;
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(stageApiProvider);
      final existing = await api.dialogue(widget.id);
      final dialogue = existing ?? await api.startDialogue(widget.id);
      if (!mounted) return;
      setState(() {
        _dialogue = dialogue;
        _messages = List<StageDialogueMessage>.from(dialogue.messages);
        _showTranslation = dialogue.showTranslation;
        _claimed = dialogue.cleared && dialogue.status == 'cleared';
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _restart() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(stageApiProvider);
      final dialogue = await api.startDialogue(widget.id, restart: true);
      if (!mounted) return;
      setState(() {
        _dialogue = dialogue;
        _messages = List<StageDialogueMessage>.from(dialogue.messages);
        _showTranslation = dialogue.showTranslation;
        _claimed = dialogue.cleared;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending || _ended) {
      return;
    }
    _input.clear();
    final userMsg = StageDialogueMessage(
      id: -1,
      role: 'user',
      speaker: null,
      contentEn: text,
      contentZh: null,
      createdAt: DateTime.now(),
    );
    setState(() {
      _sending = true;
      _messages.add(userMsg);
    });
    _scrollToEnd();
    try {
      final api = ref.read(stageApiProvider);
      final result = await api.sendMessage(widget.id, text, showTranslation: _showTranslation);
      if (!mounted) return;
      final replies = result.replies
          .map(
            (reply) => StageDialogueMessage(
              id: -1,
              role: 'npc',
              speaker: reply.speaker,
              contentEn: reply.contentEn,
              contentZh: reply.contentZh,
              createdAt: DateTime.now(),
            ),
          )
          .toList();
      setState(() {
        _messages.addAll(replies);
        _sending = false;
        _dialogue = _dialogue?.copyWith(
          turnCount: result.turnCount,
          hints: result.hints,
        );
      });
      _scrollToEnd();

      if (result.ended || result.cleared) {
        await _finish();
      }
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        // 撤回刚才那句用户发言，避免卡在半截
        _messages.removeLast();
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  /// 主动结束或模型判定结束时，拉最终复盘。
  Future<void> _finish() async {
    if (_ending) {
      return;
    }
    setState(() => _ending = true);
    try {
      final api = ref.read(stageApiProvider);
      final finalD = await api.endDialogue(widget.id);
      if (!mounted) return;
      setState(() {
        _dialogue = finalD;
        _messages = List<StageDialogueMessage>.from(finalD.messages);
        _ending = false;
      });
      _scrollToEnd();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _ending = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _toggleTranslation(bool value) async {
    setState(() => _showTranslation = value);
    try {
      final api = ref.read(stageApiProvider);
      final next = await api.setTranslation(widget.id, value);
      if (!mounted) return;
      setState(() => _showTranslation = next);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _showTranslation = !value);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _claim() async {
    try {
      final api = ref.read(stageApiProvider);
      final result = await api.claim(widget.id);
      ref.invalidate(stageOverviewProvider);
      if (!mounted) return;
      setState(() => _claimed = true);
      final gained = result.rewardXp + result.bonusXp;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.alreadyClaimed ? '奖励已领取' : '领取成功 +$gained 经验')),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  bool get _ended =>
      _dialogue?.status == 'ended' ||
      _dialogue?.status == 'cleared' ||
      (_dialogue?.feedback != null);

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeOut,
        );
      }
    });
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
        title: Text(_dialogue?.title ?? '情景对话'),
        centerTitle: true,
        actions: <Widget>[
          Row(
            children: <Widget>[
              Icon(Icons.translate_rounded, size: 18, color: colors.inkSoft),
              Switch(
                value: _showTranslation,
                activeColor: colors.brand,
                onChanged: _ended ? null : _toggleTranslation,
              ),
            ],
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: SafeArea(
        bottom: false,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Padding(
                    padding: const EdgeInsets.all(16),
                    child: AppCard(
                      child: Text('加载失败：$_error', style: TextStyle(color: colors.danger)),
                    ),
                  )
                : _buildBody(colors),
      ),
    );
  }

  Widget _buildBody(AppColors colors) {
    final dialogue = _dialogue!;
    final hints = dialogue.hints.isNotEmpty ? dialogue.hints : _fallbackHints;

    return Column(
      children: <Widget>[
        Expanded(
          child: ListView(
            controller: _scroll,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            children: <Widget>[
              // 目标卡
              AppCard(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                radius: 18,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Icon(Icons.flag_rounded, size: 16, color: colors.brand),
                        const SizedBox(width: 6),
                        const Text(
                          '本关目标',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: colors.cardMuted,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '${dialogue.turnCount} / ${dialogue.minTurns} 轮起',
                            style: TextStyle(fontSize: 10.5, color: colors.inkSoft),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      dialogue.goal,
                      style: TextStyle(fontSize: 12.5, height: 1.5, color: colors.inkSoft),
                    ),
                    const SizedBox(height: 8),
                    if (dialogue.roles.isNotEmpty)
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: <Widget>[
                          for (final role in dialogue.roles)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                              decoration: BoxDecoration(
                                color: colors.brand.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: <Widget>[
                                  Text(role.emoji, style: const TextStyle(fontSize: 14)),
                                  const SizedBox(width: 4),
                                  Text(
                                    role.name,
                                    style: TextStyle(fontSize: 11, color: colors.brand),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              if (_messages.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Center(
                    child: Text(
                      dialogue.intro.isNotEmpty ? dialogue.intro : '开始你的第一句吧！',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, height: 1.6, color: colors.inkSoft),
                    ),
                  ),
                )
              else
                for (final message in _messages)
                  _Bubble(
                    message: message,
                    colors: colors,
                    emoji: message.role == 'user' ? null : (_roleEmoji[message.speaker] ?? '🤖'),
                  ),
              if (_ended) _Recap(dialogue: dialogue, claimed: _claimed, onClaim: _claim),
              const SizedBox(height: 8),
            ],
          ),
        ),

        // 复盘前：候选短句 + 输入区
        if (!_ended) ...<Widget>[
          if (hints.isNotEmpty)
            SizedBox(
              height: 34,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: hints.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final hint = hints[index];
                  return PressScale(
                    onTap: _sending ? null : () => _input.text = hint.en,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                      decoration: BoxDecoration(
                        color: colors.cardMuted,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        hint.en,
                        style: TextStyle(fontSize: 11.5, color: colors.inkSoft),
                      ),
                    ),
                  );
                },
              ),
            ),
          if (!_showTranslation)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
              child: Row(
                children: <Widget>[
                  Icon(Icons.bolt_rounded, size: 14, color: colors.gold),
                  const SizedBox(width: 4),
                  Text(
                    '已关闭翻译，通关经验 +50%',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: colors.gold),
                  ),
                ],
              ),
            ),
          Container(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            decoration: BoxDecoration(
              color: colors.card,
              border: Border(top: BorderSide(color: colors.line)),
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: _input,
                      minLines: 1,
                      maxLines: 3,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _send(),
                      style: TextStyle(fontSize: 14, color: colors.ink),
                      decoration: InputDecoration(
                        hintText: '用英语说点什么…',
                        hintStyle: TextStyle(fontSize: 14, color: colors.inkFaint),
                        filled: true,
                        fillColor: colors.cardMuted,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  PressScale(
                    onTap: _sending ? null : _send,
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: <Color>[Color(0xFF0EA5E9), Color(0xFF6366F1)],
                        ),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: _sending
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ] else ...<Widget>[
          // 复盘后：再聊一次 / 返回地图
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            decoration: BoxDecoration(
              color: colors.card,
              border: Border(top: BorderSide(color: colors.line)),
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _restart,
                      child: const Text('再聊一次'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: () {
                        if (widget.scriptId != null) {
                          ref.invalidate(stageScriptProvider(widget.scriptId!));
                        }
                        ref.invalidate(stageOverviewProvider);
                        context.pop();
                      },
                      child: const Text('返回地图'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// 单条对话气泡。
class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.colors, this.emoji});

  final StageDialogueMessage message;
  final AppColors colors;
  final String? emoji;

  @override
  Widget build(BuildContext context) {
    final bool isUser = message.role == 'user';

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          if (!isUser) ...<Widget>[
            Container(
              width: 34,
              height: 34,
              margin: const EdgeInsets.only(right: 8, top: 2),
              decoration: BoxDecoration(
                color: colors.brand.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  emoji ?? '🤖',
                  style: const TextStyle(fontSize: 18),
                ),
              ),
            ),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: <Widget>[
                if (!isUser && message.speaker != null && message.speaker!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(left: 4, bottom: 3),
                    child: Text(
                      message.speaker!,
                      style: TextStyle(fontSize: 11, color: colors.inkFaint),
                    ),
                  ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
                  decoration: BoxDecoration(
                    color: isUser ? colors.brand : colors.card,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(isUser ? 16 : 4),
                      bottomRight: Radius.circular(isUser ? 4 : 16),
                    ),
                    boxShadow: isUser
                        ? null
                        : <BoxShadow>[
                            BoxShadow(
                              color: colors.shadow.withValues(alpha: 0.05),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                  ),
                  child: Text(
                    message.contentEn,
                    style: TextStyle(
                      fontSize: 13.5,
                      height: 1.5,
                      color: isUser ? Colors.white : colors.ink,
                    ),
                  ),
                ),
                if (!isUser && message.contentZh != null && message.contentZh!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(left: 4, top: 4),
                    child: Text(
                      message.contentZh!,
                      style: TextStyle(fontSize: 11.5, color: colors.inkFaint, height: 1.4),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 复盘面板：通关/结束后的中文总结 + 亮点 + 改进 + 领奖。
class _Recap extends StatelessWidget {
  const _Recap({
    required this.dialogue,
    required this.claimed,
    required this.onClaim,
  });

  final StageDialogue dialogue;
  final bool claimed;
  final VoidCallback onClaim;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final cleared = dialogue.cleared || dialogue.status == 'cleared';
    final feedback = dialogue.feedback;

    return AppCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      radius: 20,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(
                cleared ? Icons.emoji_events_rounded : Icons.menu_book_rounded,
                size: 20,
                color: cleared ? colors.gold : colors.brand,
              ),
              const SizedBox(width: 8),
              Text(
                cleared ? '通关啦！' : '本轮结束',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: cleared ? colors.gold : colors.ink,
                ),
              ),
            ],
          ),
          if (dialogue.summary != null && dialogue.summary!.isNotEmpty) ...<Widget>[
            const SizedBox(height: 10),
            Text(
              dialogue.summary!,
              style: TextStyle(fontSize: 13, height: 1.6, color: colors.inkSoft),
            ),
          ],
          if (feedback != null) ...<Widget>[
            if (feedback.highlights.isNotEmpty) ...<Widget>[
              const SizedBox(height: 12),
              _FeedbackList(
                icon: Icons.thumb_up_rounded,
                color: colors.success,
                title: '亮点',
                items: feedback.highlights,
              ),
            ],
            if (feedback.improvements.isNotEmpty) ...<Widget>[
              const SizedBox(height: 10),
              _FeedbackList(
                icon: Icons.tips_and_updates_rounded,
                color: colors.brand,
                title: '可以更好',
                items: feedback.improvements,
              ),
            ],
          ],
          if (cleared && !claimed) ...<Widget>[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: FilledButton(
                onPressed: onClaim,
                style: FilledButton.styleFrom(
                  backgroundColor: colors.gold,
                  foregroundColor: Colors.white,
                ),
                child: const Text('领取奖励'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _FeedbackList extends StatelessWidget {
  const _FeedbackList({
    required this.icon,
    required this.color,
    required this.title,
    required this.items,
  });

  final IconData icon;
  final Color color;
  final String title;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Icon(icon, size: 15, color: color),
            const SizedBox(width: 6),
            Text(
              title,
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: color),
            ),
          ],
        ),
        const SizedBox(height: 6),
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text('· ', style: TextStyle(fontSize: 13, color: colors.inkSoft)),
                Expanded(
                  child: Text(
                    item,
                    style: TextStyle(fontSize: 12.5, height: 1.5, color: colors.inkSoft),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
