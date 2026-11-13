/// 编辑资料弹窗：昵称 / 性别 / 生日 / 签名。
///
/// 生日用「点击字段 → 底部弹层内三个中文下拉」而不是 `showDatePicker`：
/// 后者在本工程未接本地化代理时会显示英文月份（`October`），在一个全中文的
/// 界面里很突兀；自己拼中文下拉既保持语言一致，也不用为此引入
/// `flutter_localizations` 与 `intl`（零新增依赖）。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/models/user.dart';
import '../state/auth_controller.dart';
import '../theme/palette.dart';
import '../widgets/segmented.dart';

/// 打开编辑资料弹窗。
Future<void> showEditProfileSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => const _EditProfileSheet(),
  );
}

class _EditProfileSheet extends ConsumerStatefulWidget {
  const _EditProfileSheet();

  @override
  ConsumerState<_EditProfileSheet> createState() => _EditProfileSheetState();
}

class _EditProfileSheetState extends ConsumerState<_EditProfileSheet> {
  late final UserProfile? _user = ref.read(authControllerProvider).user;
  late final TextEditingController _nickname =
      TextEditingController(text: _user?.nickname ?? '');
  late final TextEditingController _signature =
      TextEditingController(text: _user?.signature ?? '');

  late String _gender = _user?.gender ?? 'secret';

  /// 每日邮件提醒：跟随当前用户设置（1 = 开）。
  late bool _emailReminder = _user?.emailReminder == 1;

  /// 生日的年 / 月 / 日。
  ///
  /// ⚠️ 这里**不能**写成 `late int?`：`late` 的读前必赋值与「可空」无关，
  /// 用户没填生日时 [initState] 里那个 if 不成立，字段就永远没被赋值，
  /// 一读就抛 `LateInitializationError` —— 真机上整页被 release 的灰色
  /// ErrorWidget 顶掉，表现就是「打开编辑资料是一片空白」。
  int? _year;
  int? _month;
  int? _day;

  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final birthday = _user?.birthday;
    if (birthday != null && birthday.length >= 10) {
      final parts = birthday.split('-');
      if (parts.length == 3) {
        _year = int.tryParse(parts[0]);
        _month = int.tryParse(parts[1]);
        _day = int.tryParse(parts[2]);
      }
    }
  }

  @override
  void dispose() {
    _nickname.dispose();
    _signature.dispose();
    super.dispose();
  }

  int get _daysInMonth {
    if (_year == null || _month == null) {
      return 31;
    }
    return DateTime(_year!, _month! + 1, 0).day;
  }

  Future<void> _save() async {
    if (_saving) {
      return;
    }
    final nickname = _nickname.text.trim();
    if (nickname.isEmpty) {
      setState(() => _error = '昵称不能为空');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });

    String? birthday;
    if (_year != null && _month != null && _day != null) {
      final month = _month!.toString().padLeft(2, '0');
      final day = _day!.clamp(1, _daysInMonth).toString().padLeft(2, '0');
      birthday = '$_year-$month-$day';
    }

    final error = await ref.read(authControllerProvider.notifier).updateProfile(
          nickname: nickname,
          gender: _gender,
          signature: _signature.text.trim(),
          // 未选全就不提交生日：后端「未传即不更新」，传半个日期只会得到 400
          birthday: birthday,
          // 提醒开关：0/1 直接透传；后端未传即不更新，不影响其它字段
          emailReminder: _emailReminder ? 1 : 0,
        );
    if (!mounted) {
      return;
    }
    if (error != null) {
      setState(() {
        _saving = false;
        _error = error;
      });
      return;
    }
    Navigator.of(context).pop();
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
              Text('编辑资料', style: theme.textTheme.titleLarge),
              const SizedBox(height: 4),
              Text(
                '资料只用于你自己的首页展示',
                style: theme.textTheme.labelSmall?.copyWith(color: colors.inkFaint),
              ),
              const SizedBox(height: 20),
              _Label(text: '昵称'),
              const SizedBox(height: 8),
              TextField(
                controller: _nickname,
                maxLength: 20,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  hintText: '给自己起个名字',
                  counterText: '',
                ),
              ),
              const SizedBox(height: 18),
              _Label(text: '性别'),
              const SizedBox(height: 8),
              SegmentedControl<String>(
                value: _gender,
                height: 40,
                onChanged: (value) => setState(() => _gender = value),
                segments: const <Segment<String>>[
                  Segment<String>(value: 'male', label: '男'),
                  Segment<String>(value: 'female', label: '女'),
                  Segment<String>(value: 'secret', label: '保密'),
                ],
              ),
              const SizedBox(height: 18),
              _Label(text: '生日'),
              const SizedBox(height: 8),
              _BirthdayField(
                year: _year,
                month: _month,
                day: _day,
                onChanged: (y, m, d) => setState(() {
                  _year = y;
                  _month = m;
                  _day = d;
                }),
              ),
              const SizedBox(height: 18),
              _Label(text: '个性签名'),
              const SizedBox(height: 8),
              TextField(
                controller: _signature,
                maxLength: 60,
                maxLines: 3,
                minLines: 2,
                decoration: const InputDecoration(
                  hintText: '写一句想对自己说的话',
                ),
              ),
              const SizedBox(height: 18),
              _Label(text: '每日邮件提醒'),
              const SizedBox(height: 8),
              Container(
                height: 58,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: colors.cardMuted,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: colors.line),
                ),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            '完成目标后提醒我',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: colors.ink,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '当天没达标时，傍晚发一封邮件提醒',
                            style: TextStyle(fontSize: 11, color: colors.inkFaint),
                          ),
                        ],
                      ),
                    ),
                    Switch(
                      activeThumbColor: colors.brand,
                      activeTrackColor: colors.brand.withValues(alpha: 0.5),
                      value: _emailReminder,
                      onChanged: (value) => setState(() => _emailReminder = value),
                    ),
                  ],
                ),
              ),
              if (_error != null) ...<Widget>[
                const SizedBox(height: 4),
                Text(
                  _error!,
                  style: TextStyle(color: colors.danger, fontSize: 13),
                ),
              ],
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('保存'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.labelMedium?.copyWith(
            fontWeight: FontWeight.w600,
            color: context.colors.inkSoft,
          ),
    );
  }
}

/// 表单下拉（去掉下划线与多余内边距，观感与输入框一致）。
class _Dropdown<T> extends StatelessWidget {
  const _Dropdown({
    required this.value,
    required this.hint,
    required this.items,
    required this.labelOf,
    required this.onChanged,
  });

  final T? value;
  final String hint;
  final List<T> items;
  final String Function(T value) labelOf;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: colors.cardMuted,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.line),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isExpanded: true,
          borderRadius: BorderRadius.circular(16),
          hint: Text(hint, style: TextStyle(fontSize: 14, color: colors.inkFaint)),
          icon: Icon(Icons.expand_more_rounded, size: 18, color: colors.inkFaint),
          style: TextStyle(fontSize: 14, color: colors.ink, fontWeight: FontWeight.w600),
          items: <DropdownMenuItem<T>>[
            for (final item in items)
              DropdownMenuItem<T>(
                value: item,
                child: Text(labelOf(item)),
              ),
          ],
          onChanged: onChanged,
        ),
      ),
    );
  }
}

/// 生日选择字段：表单里只露一颗「输入框」，点击展开底部弹层做选择，
/// 比三颗下拉直接铺在表单里更整洁，也更像「日期选择器」。
class _BirthdayField extends StatelessWidget {
  const _BirthdayField({
    required this.year,
    required this.month,
    required this.day,
    required this.onChanged,
  });

  final int? year;
  final int? month;
  final int? day;
  final void Function(int? year, int? month, int? day) onChanged;

  String get _text {
    if (year == null || month == null || day == null) {
      return '请选择生日';
    }
    final m = month!.toString().padLeft(2, '0');
    final d = day!.toString().padLeft(2, '0');
    return '$year-$m-$d';
  }

  bool get _selected => year != null && month != null && day != null;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () async {
          await showModalBottomSheet<void>(
            context: context,
            isScrollControlled: true,
            useSafeArea: true,
            builder: (_) => _BirthdaySheet(
              year: year,
              month: month,
              day: day,
              onChanged: onChanged,
            ),
          );
        },
        child: Container(
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: colors.cardMuted,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: colors.line),
          ),
          child: Row(
            children: <Widget>[
              Icon(Icons.calendar_today_rounded, size: 18, color: colors.inkFaint),
              const SizedBox(width: 10),
              Text(
                _text,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: _selected ? colors.ink : colors.inkFaint,
                ),
              ),
              const Spacer(),
              Icon(Icons.chevron_right_rounded, size: 18, color: colors.inkFaint),
            ],
          ),
        ),
      ),
    );
  }
}

/// 生日底部弹层：年 / 月 / 日 三列中文下拉，确认后回写父组件。
class _BirthdaySheet extends StatefulWidget {
  const _BirthdaySheet({
    required this.year,
    required this.month,
    required this.day,
    required this.onChanged,
  });

  final int? year;
  final int? month;
  final int? day;
  final void Function(int? year, int? month, int? day) onChanged;

  @override
  State<_BirthdaySheet> createState() => _BirthdaySheetState();
}

class _BirthdaySheetState extends State<_BirthdaySheet> {
  late int? _y = widget.year;
  late int? _m = widget.month;
  late int? _d = widget.day;

  int get _daysInMonth {
    if (_y == null || _m == null) {
      return 31;
    }
    return DateTime(_y!, _m! + 1, 0).day;
  }

  void _commit() {
    widget.onChanged(_y, _m, _d);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final years = <int>[for (var y = DateTime.now().year - 6; y >= 1940; y--) y];
    final months = List<int>.generate(12, (index) => index + 1);
    final days = List<int>.generate(_daysInMonth, (index) => index + 1);

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Text('选择生日', style: theme.textTheme.titleMedium),
                  TextButton(onPressed: _commit, child: const Text('确定')),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: <Widget>[
                  Expanded(
                    flex: 4,
                    child: _Dropdown<int>(
                      value: _y,
                      hint: '年',
                      items: years,
                      labelOf: (value) => '$value',
                      onChanged: (value) => setState(() {
                        _y = value;
                        _d = _d?.clamp(1, _daysInMonth);
                      }),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 3,
                    child: _Dropdown<int>(
                      value: _m,
                      hint: '月',
                      items: months,
                      labelOf: (value) => '$value',
                      onChanged: (value) => setState(() {
                        _m = value;
                        _d = _d?.clamp(1, _daysInMonth);
                      }),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 3,
                    child: _Dropdown<int>(
                      value: _d,
                      hint: '日',
                      items: days,
                      labelOf: (value) => '$value',
                      onChanged: (value) => setState(() => _d = value),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
