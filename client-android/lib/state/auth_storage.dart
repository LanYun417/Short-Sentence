/// 令牌安全存储。
///
/// 为什么不用 `shared_preferences`：accessToken / refreshToken 是**明文可用的凭证**，
/// SharedPreferences 在 Android 上是未加密的 XML（root 可直接读）、
/// iOS 是 plist。`flutter_secure_storage` 走 Keystore / Keychain，
/// 与「Web 端令牌放 localStorage」对应，但存储强度按移动端标准抬一级。
///
/// key 前缀 `ss_` 与 Web 端同构，但**不共用**：不同端登录态相互独立
/// （同一台设备上装了 App 又开 Web，互不影响）。
library;

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthStorage {
  const AuthStorage(this._storage);

  final FlutterSecureStorage _storage;

  static const String _tokenKey = 'ss_token';
  static const String _refreshTokenKey = 'ss_refresh_token';
  static const String _userKey = 'ss_user';

  /// 读写 accessToken。
  Future<String?> readToken() => _storage.read(key: _tokenKey);

  Future<void> writeToken(String value) => _storage.write(key: _tokenKey, value: value);

  /// 读写 refreshToken。
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  Future<void> writeRefreshToken(String value) =>
      _storage.write(key: _refreshTokenKey, value: value);

  /// 一次性写入双令牌（登录 / 刷新成功时）。
  Future<void> writeTokens({required String accessToken, required String refreshToken}) async {
    await Future.wait([
      _storage.write(key: _tokenKey, value: accessToken),
      _storage.write(key: _refreshTokenKey, value: refreshToken),
    ]);
  }

  /// 缓存的用户资料 JSON（首屏免请求直接渲染）。
  Future<String?> readUser() => _storage.read(key: _userKey);

  Future<void> writeUser(String value) => _storage.write(key: _userKey, value: value);

  /// 清空全部凭证（登出 / 刷新失败）。
  Future<void> clear() async {
    await Future.wait([
      _storage.delete(key: _tokenKey),
      _storage.delete(key: _refreshTokenKey),
      _storage.delete(key: _userKey),
    ]);
  }
}
