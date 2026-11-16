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
import '../config/image_pick.dart';
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
  /// 登录（账号 + 密码即可，不再需要验证码）。
  Future<AuthResult> login(String email, String password) async {
    return _postAuth('/client/auth/login', <String, dynamic>{
      'email': email.trim(),
      'password': password,
    });
  }

  /// 邮箱验证码登录（先发送 purpose=login 的验证码；仅已注册用户，不自动建号）。
  Future<AuthResult> loginByCode(String email, String emailCode) async {
    return _postAuth('/client/auth/code-login', <String, dynamic>{
      'email': email.trim(),
      'emailCode': emailCode.trim(),
    });
  }

  /// 注册（成功后直接登录；emailCode 为邮箱验证码，必填；agreed 必须为 true）。
  Future<AuthResult> register(
    String email,
    String password, {
    String? nickname,
    required String emailCode,
    required bool agreed,
  }) async {
    return _postAuth('/client/auth/register', <String, dynamic>{
      'email': email.trim(),
      'password': password,
      if (nickname != null && nickname.trim().isNotEmpty)
        'nickname': nickname.trim(),
      'emailCode': emailCode.trim(),
      'agreed': agreed,
    });
  }

  /// 发送邮箱验证码（注册 purpose=register / 改密 purpose=reset；同邮箱 60 秒一封）。
  Future<void> sendEmailCode({
    required String email,
    required String purpose,
  }) async {
    try {
      await _dio.post<dynamic>(
        '/client/auth/email-code',
        data: <String, dynamic>{'email': email.trim(), 'purpose': purpose},
      );
    } on DioException catch (error) {
      throw _toApiException(error);
    }
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
      final response = await _dio.get<dynamic>('/client/auth/captcha');
      final data = _unwrap(response);
      return Captcha.fromJson(data);
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  /// 我的资料。
  Future<UserProfile> me() async {
    try {
      final response = await _dio.get<dynamic>('/client/auth/me');
      return UserProfile.fromJson(_unwrap(response));
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  /// 修改资料（昵称 / 生日 / 性别 / 签名）。
  ///
  /// 只传要改的字段：后端按「未传即不更新」处理，
  /// 全量提交会把并发修改（例如另一端改了昵称）覆盖掉。
  Future<UserProfile> updateProfile({
    String? nickname,
    String? birthday,
    String? gender,
    String? signature,
    int? emailReminder,
  }) async {
    try {
      final response = await _dio.put<dynamic>(
        '/client/auth/me',
        data: <String, dynamic>{
          if (nickname != null) 'nickname': nickname.trim(),
          'birthday': ?birthday,
          'gender': ?gender,
          if (signature != null) 'signature': signature.trim(),
          'emailReminder': ?emailReminder,
        },
      );
      return UserProfile.fromJson(_unwrap(response));
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  /// 修改密码（成功后服务端会吊销旧令牌，需重新登录）。
  Future<void> changePassword({
    required String oldPassword,
    required String newPassword,
    required String emailCode,
  }) async {
    try {
      await _dio.put<dynamic>(
        '/client/auth/password',
        data: <String, dynamic>{
          'oldPassword': oldPassword,
          'newPassword': newPassword,
          'emailCode': emailCode.trim(),
        },
      );
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  /// 发送注销验证码（服务端只发给**本人**邮箱，与公开的 email-code 分开）。
  Future<void> sendDeletionCode() async {
    try {
      await _dio.post<dynamic>('/client/auth/deletion-code');
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  /// 注销账号（不可逆）。
  ///
  /// 后端要求**二次身份校验**：邮箱账号传 [emailCode]；微信建号的账号传 wechatCode。
  /// Android 端的用户都是邮箱注册（微信账号只能在微信里登录），所以这里只走验证码。
  /// 原因可选——不选也能注销，不能拿问卷卡住用户的注销权利。
  Future<void> deleteAccount({
    required String emailCode,
    String? reasonType,
    String? reasonDetail,
  }) async {
    try {
      await _dio.delete<dynamic>(
        '/client/auth/me',
        data: <String, dynamic>{
          'emailCode': emailCode.trim(),
          if (reasonType != null && reasonType.isNotEmpty)
            'reasonType': reasonType,
          if (reasonDetail != null && reasonDetail.trim().isNotEmpty)
            'reasonDetail': reasonDetail.trim(),
        },
      );
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  /// 上传头像（multipart 字段 `file`）。
  ///
  /// 返回更新后的完整资料（含新的 avatarUrl）；调用方据此回写本地缓存。
  Future<UserProfile> uploadAvatar(PickedImage image) async {
    try {
      final form = FormData.fromMap(<String, dynamic>{
        'file': MultipartFile.fromBytes(
          image.bytes,
          filename: image.name,
          contentType: DioMediaType.parse(image.mimeType),
        ),
      });
      final response = await _dio.post<dynamic>(
        '/client/auth/avatar',
        data: form,
      );
      return UserProfile.fromJson(_unwrap(response));
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  /// 设置个人主页背景句签（cardId = 0 恢复默认渐变）。
  ///
  /// 返回更新后的完整资料（含 bgCardId / bgCardTitle / bgImageUrl）。
  Future<UserProfile> setBackground(int cardId) async {
    try {
      final response = await _dio.put<dynamic>(
        '/client/auth/me/background',
        data: <String, dynamic>{'cardId': cardId},
      );
      return UserProfile.fromJson(_unwrap(response));
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  /// 退出登录。
  Future<void> logout() async {
    try {
      await _dio.post<dynamic>('/client/auth/logout');
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
      return ApiException.network(error.error, error.type);
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
