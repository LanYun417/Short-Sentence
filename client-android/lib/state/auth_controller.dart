/// 认证状态控制器（对应 Web 端 `stores/auth.ts`）。
///
/// 职责边界：
/// - 持有「当前用户 + 登录态」，登录/注册/登出改变它；
/// - 启动时从安全存储**恢复**令牌与缓存的资料（对应 Web 端 `hydrate()`）；
/// - 令牌失效（刷新也失败）时清空并跳登录——由 [handleUnauthorized] 承担，
///   由 main.dart 在创建 Dio 时把该回调注册进去。
library;

import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../api/dio_client.dart';
import '../api/auth_api.dart';
import '../api/models/user.dart';
import '../config/image_pick.dart';
import 'auth_storage.dart';

/// 认证状态。
class AuthState {
  const AuthState({
    this.user,
    this.initialized = false,
    this.submitting = false,
    this.error,
  });

  /// 当前用户（null = 未登录/未恢复）。
  final UserProfile? user;

  /// 是否已完成启动恢复（首屏Loading用）。
  final bool initialized;

  /// 是否正在提交登录/注册（按钮Loading用）。
  final bool submitting;

  /// 最近一次错误提示（登录页展示）。
  final String? error;

  bool get isLoggedIn => user != null;

  AuthState copyWith({
    UserProfile? user,
    bool? initialized,
    bool? submitting,
    String? error,
    bool clearUser = false,
  }) {
    return AuthState(
      user: clearUser ? null : (user ?? this.user),
      initialized: initialized ?? this.initialized,
      submitting: submitting ?? this.submitting,
      error: error,
    );
  }
}

/// 认证控制器。
class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() => const AuthState();

  AuthStorage get _storage => ref.read(authStorageProvider);
  AuthApi get _api => ref.read(authApiProvider);

  /// 启动恢复：读缓存资料 → 后台用令牌刷新一次 `/me`（失败不打扰用户）。
  Future<void> initialize() async {
    final cached = await _storage.readUser();
    if (cached != null && cached.isNotEmpty) {
      try {
        state = state.copyWith(user: UserProfile.fromJson(_decode(cached)), initialized: true);
      } catch (_) {
        // 缓存损坏：当未登录处理
        await _storage.clear();
        state = state.copyWith(initialized: true);
      }
    } else {
      state = state.copyWith(initialized: true);
    }

    // 有令牌才拉最新资料；后台做，不阻塞首屏
    final token = await _storage.readToken();
    if (token == null || token.isEmpty) {
      return;
    }
    try {
      final profile = await _api.me();
      await _storage.writeUser(encodeProfile(profile));
      state = state.copyWith(user: profile);
    } catch (_) {
      // /me 失败：401 已由 Dio 拦截器处理（刷新或跳登录），
      // 这里不再抛出，保持已有缓存用户可用。
    }
  }

  /// 登录。
  Future<bool> login(String email, String password) async {
    state = state.copyWith(submitting: true, error: null);
    try {
      final result = await _api.login(email, password);
      await _persist(result);
      state = state.copyWith(user: result.user, submitting: false, error: null);
      return true;
    } catch (error) {
      state = state.copyWith(submitting: false, error: _message(error));
      return false;
    }
  }

  /// 注册（成功后直接登录；agreed 必须为 true——服务端同样强校验）。
  Future<bool> register(
    String email,
    String password, {
    String? nickname,
    required String emailCode,
    required bool agreed,
  }) async {
    state = state.copyWith(submitting: true, error: null);
    try {
      final result = await _api.register(
        email,
        password,
        nickname: nickname,
        emailCode: emailCode,
        agreed: agreed,
      );
      await _persist(result);
      state = state.copyWith(user: result.user, submitting: false, error: null);
      return true;
    } catch (error) {
      state = state.copyWith(submitting: false, error: _message(error));
      return false;
    }
  }

  /// 登出（本地清理 + 尽力通知服务端）。
  Future<void> logout() async {
    try {
      await _api.logout();
    } catch (_) {
      // 同上：本地清理优先
    }
    await _storage.clear();
    state = const AuthState(initialized: true);
  }

  /// 修改资料：成功返回 null，失败返回可展示的错误文案。
  ///
  /// 成功后**立刻回写本地缓存**：下次冷启动时 `initialize()` 先用缓存渲染，
  /// 不回写会短暂显示旧昵称/旧头像。
  Future<String?> updateProfile({
    String? nickname,
    String? birthday,
    String? gender,
    String? signature,
    int? emailReminder,
  }) async {
    try {
      final profile = await _api.updateProfile(
        nickname: nickname,
        birthday: birthday,
        gender: gender,
        signature: signature,
        emailReminder: emailReminder,
      );
      await _storage.writeUser(encodeProfile(profile));
      state = state.copyWith(user: profile);
      return null;
    } catch (error) {
      return _message(error);
    }
  }

  /// 修改密码：成功返回 null，失败返回可展示的错误文案。
  /// 发送邮箱验证码（注册/改密）。成功返回 null，失败返回可展示的错误文案。
  Future<String?> sendEmailCode({required String email, required String purpose}) async {
    try {
      await _api.sendEmailCode(email: email, purpose: purpose);
      return null;
    } catch (error) {
      return _message(error);
    }
  }

  Future<String?> changePassword({
    required String oldPassword,
    required String newPassword,
    required String emailCode,
  }) async {
    try {
      await _api.changePassword(
        oldPassword: oldPassword,
        newPassword: newPassword,
        emailCode: emailCode,
      );
      return null;
    } catch (error) {
      return _message(error);
    }
  }

  /// 上传头像：成功返回 null，失败返回可展示的错误文案。
  ///
  /// 成功后**立刻回写本地缓存与状态**，否则身份卡头像会短暂显示旧图。
  Future<String?> uploadAvatar(PickedImage image) async {
    try {
      final profile = await _api.uploadAvatar(image);
      await _storage.writeUser(encodeProfile(profile));
      state = state.copyWith(user: profile);
      return null;
    } catch (error) {
      return _message(error);
    }
  }

  /// 设置个人主页背景句签（cardId = 0 恢复默认渐变）。
  ///
  /// 成功后回写本地缓存与状态（bgCardId / bgCardTitle / bgImageUrl）。
  Future<String?> setBackground(int cardId) async {
    try {
      final profile = await _api.setBackground(cardId);
      await _storage.writeUser(encodeProfile(profile));
      state = state.copyWith(user: profile);
      return null;
    } catch (error) {
      return _message(error);
    }
  }

  /// 令牌被后端判失效时由 Dio 回调触发：静默清理并回到未登录态。
  void handleUnauthorized() {
    // 不清 initialized：App 已在运行中，直接回登录页即可
    state = const AuthState(initialized: true, error: '登录已过期，请重新登录');
  }

  Future<void> _persist(AuthResult result) async {
    await _storage.writeTokens(
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    );
    await _storage.writeUser(encodeProfile(result.user));
  }

  /// 提取用户可读的错误文案。
  static String _message(Object error) {
    if (error is ApiException) {
      return error.message;
    }
    return '操作失败，请稍后重试';
  }
}

/// 用户资料 ↔ JSON 字符串（缓存到安全存储用）。
String encodeProfile(UserProfile profile) => jsonEncode(profile.toJson());

Map<String, dynamic> _decode(String raw) {
  final decoded = jsonDecode(raw);
  return decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
}

/// 认证控制器 Provider。
final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);
