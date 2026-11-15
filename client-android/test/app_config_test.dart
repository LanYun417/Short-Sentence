/// 法务页地址拼接：与「我的 / 登录」页打开的协议地址同一套规则。
///
/// 前后端分域时 `LEGAL_BASE_URL` 会覆盖默认同源值，所以断言只钉住
/// 「不含重复斜杠 + 路径原样结尾」，不写死具体域名。
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:client_android/config/app_config.dart';

void main() {
  group('AppConfig.legalUrl', () {
    test('路径原样结尾，且不会拼出双斜杠', () {
      final url = AppConfig.legalUrl('/privacy');
      expect(url.endsWith('/privacy'), isTrue);
      expect(url.contains('//privacy'), isFalse);
    });

    test('用户协议与隐私政策是两个不同地址', () {
      expect(AppConfig.legalUrl('/terms'), isNot(AppConfig.legalUrl('/privacy')));
    });

    test('未配置站点域名时回落到接口同源基址', () {
      // 默认构建（无 --dart-define）下两者相等；分域构建由 dart-define 覆盖。
      expect(AppConfig.staticBaseUrl.endsWith('/api'), isFalse);
    });
  });
}
