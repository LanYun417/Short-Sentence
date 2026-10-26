/// 编辑资料弹窗构建测试。
///
/// 回归点：弹窗里 `SingleChildScrollView` 直接作为 bottom sheet 的根，
/// 会拿到**无界高度**（`RenderBox was not laid out` / 纵向 viewport 断言），
/// 真机上表现为「打开编辑资料是一片灰」（release 的 ErrorWidget 灰块）。
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:short_sentence/api/models/user.dart';
import 'package:short_sentence/sheets/edit_profile_sheet.dart';
import 'package:short_sentence/state/auth_controller.dart';
import 'package:short_sentence/theme/motion.dart';

void main() {
  setUp(() => Motion.loopAnimations = false);
  tearDown(() => Motion.loopAnimations = true);

  Future<void> pumpAndOpen(WidgetTester tester, ProviderContainer container) async {
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () => showEditProfileSheet(context),
                  child: const Text('open'),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
  }

  testWidgets('弹窗能正常构建：标题 / 昵称 / 性别 / 生日 / 签名都在', (tester) async {
    final container = ProviderContainer();
    container.read(authControllerProvider.notifier).state = AuthState(
      initialized: true,
      user: UserProfile.fromJson(const <String, dynamic>{
        'id': 21,
        'email': 'a@b.com',
        'nickname': '小林',
        'gender': 'secret',
        'signature': '',
      }),
    );

    await pumpAndOpen(tester, container);

    // 构建期不应抛异常（旧实现在这里灰屏）
    expect(tester.takeException(), isNull);
    expect(find.text('编辑资料'), findsOneWidget);
    expect(find.text('昵称'), findsOneWidget);
    expect(find.text('性别'), findsOneWidget);
    expect(find.text('生日'), findsOneWidget);
    expect(find.text('个性签名'), findsOneWidget);
    expect(find.text('保存'), findsOneWidget);
    container.dispose();
  });
}
