/// 认证接口：登录 / 注册 / 刷新 / 登出 / 我的资料。
///
/// 路径与后端 `@Controller('client/auth')` 对应（见 api 的
/// `client-auth.controller.ts`），字段与 Web 端 `composables/useApi.ts`
/// 的调用方式同构。
///
/// **登录为什么必须带验证码**：后端 `CAPTCHA_ENABLED` 默认开启，
/// 不带 captchaId / captchaCode 的登录/注册请求会直接被拒
/// （「验证码错误或已过期」）。调用方需先 [fetchCaptcha] 拿图。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import 'dio_client.dart';
import 'api_exception.dart';
import 'models/user.dart';

/// 登录/注册结果（后端 `__raw` 包装的 data 部分）。
class AuthResult {
  const AuthResult({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  final String accessToken;
  final String refreshToken;
  final UserProfile user;

  factory AuthResult.fromJson(Map<String, dynamic> json) {
    final user = json['user'];
    return AuthResult(
      accessToken: json['accessToken'] as String? ?? '',
      refreshToken: json['refreshToken'] as String? ?? '',
      user: user is Map<String, dynamic>
          ? UserProfile.fromJson(user)
          : UserProfile.fromJson(const <String, dynamic>{}),
    );
  }
}

/// 图形验证码。
class Captcha {
  const Captcha({required this.enabled, this.captchaId, this.image});

  /// 服务端是否开启验证码（false 时调用方不应渲染输入框）。
  final bool enabled;

  /// 验证码 id（提交登录/注册时回传）。
  final String? captchaId;

  /// 图片（`data:image/png;base64,...`）。
  final String? image;

  factory Captcha.fromJson(Map<String, dynamic> json) {
    return Captcha(
      enabled: json['enabled'] as bool? ?? false,
      captchaId: json['captchaId'] as String?,
      image: json['image'] as String?,
    );
  }
}

/// 认证 API。
class AuthApi {
  const AuthApi(this._dio);

  final Dio _dio;

  /// 登录。
  ///
  /// [captchaId] / [captchaCode] 在服务端开启验证码时必填。
  Future<AuthResult> login(
    String email,
    String password, {
    String? captchaId,
    String? captchaCode,
  }) async {
    return _postAuth('/auth/login', <String, dynamic>{
      'email': email.trim(),
      'password': password,
      if (captchaId != null && captchaCode != null) ...{
        'captchaId': captchaId,
        'captchaCode': captchaCode.trim(),
      },
    });
  }

  /// 注册（成功后直接登录）。
  Future<AuthResult> register(
    String email,
    String password, {
    String? nickname,
    String? captchaId,
    String? captchaCode,
  }) async {
    return _postAuth('/auth/register', <String, dynamic>{
      'email': email.trim(),
      'password': password,
      if (nickname != null && nickname.trim().isNotEmpty) 'nickname': nickname.trim(),
      if (captchaId != null && captchaCode != null) ...{
        'captchaId': captchaId,
        'captchaCode': captchaCode.trim(),
      },
    });
  }

  Future<AuthResult> _postAuth(String path, Map<String, dynamic> body) async {
    try {
      final response = await _dio.post<dynamic>(path, data: body);
      final data = _unwrap(response);
      return AuthResult.fromJson(data);
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  /// 拉取图形验证码。
  Future<Captcha> fetchCaptcha() async {
    try {
      final response = await _dio.get<dynamic>('/auth/captcha');
      final data = _unwrap(response);
      return Captcha.fromJson(data);
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  /// 我的资料。
  Future<UserProfile> me() async {
    try {
      final response = await _dio.get<dynamic>('/auth/me');
      return UserProfile.fromJson(_unwrap(response));
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  /// 退出登录。
  Future<void> logout() async {
    try {
      await _dio.post<dynamic>('/auth/logout');
    } on DioException catch (error) {
      // 登出失败不阻断本地清理：令牌该失效的已经失效，
      // 网络问题导致的失败由本地状态保证用户体验一致。
      if (error.response?.statusCode == 401) {
        return;
      }
      throw _toApiException(error);
    }
  }

  /// 解包后端统一响应体 `{ code, message, data }`。
  Map<String, dynamic> _unwrap(Response<dynamic> response) {
    final body = response.data;
    if (body is Map<String, dynamic>) {
      final data = body['data'];
      if (data is Map<String, dynamic>) {
        return data;
      }
    }
    throw const ApiException(message: '服务端返回格式异常');
  }

  ApiException _toApiException(DioException error) {
    final response = error.response;
    if (response == null) {
      return ApiException.network(error.error);
    }
    return ApiException.fromResponse(response.statusCode, response.data);
  }
}

/// 认证 API Provider。
final authApiProvider = Provider<AuthApi>((ref) {
  return AuthApi(ref.watch(dioProvider));
});

/// 静态资源完整 URL（配图等）。
///
/// 后端 DB 里存的是 `static/xxx.webp` 这样的相对路径，
/// 需要拼上 host。绝对路径（http 开头）则原样返回。
String staticUrl(String? path) {
  if (path == null || path.isEmpty) {
    return '';
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  final base = AppConfig.staticBaseUrl;
  final suffix = path.startsWith('/') ? path : '/$path';
  return '$base$suffix';
}
