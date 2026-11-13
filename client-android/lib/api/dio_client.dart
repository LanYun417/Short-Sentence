/// Dio 客户端：统一基址、错误归一、令牌拦截与 401 单飞刷新。
///
/// 与 Web 端 `composables/useApi.ts` 的行为保持同构：
/// - 请求自动带 `Authorization: Bearer <accessToken>`；
/// - 遇 401 只发**一次**刷新请求（单飞），消除并发 401 各刷一次的问题；
/// - 刷新成功后用新令牌**重放**原请求一次；
/// - 刷新也失败 → 调 [setUnauthorizedHandler] 注册的回调（清状态跳登录）。
///
/// 注意：回调用进程级单例而不是 Provider 参数——Dio 的拦截器是长生命周期的，
/// 而 `UnauthorizedHandler` 需要在 main() 拿到 ProviderContainer 之后才能注册。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/app_config.dart';
import '../state/auth_storage.dart';
import 'api_exception.dart';

/// 令牌失效回调类型。
typedef UnauthorizedHandler = void Function();

/// 进程内的令牌失效回调（由 main 注册）。
UnauthorizedHandler? _onUnauthorized;

/// 注册令牌失效回调（重复调用覆盖）。
void setUnauthorizedHandler(UnauthorizedHandler handler) {
  _onUnauthorized = handler;
}

/// 安全存储 Provider（测试可覆盖为内存实现）。
final authStorageProvider = Provider<AuthStorage>((ref) {
  return const AuthStorage(FlutterSecureStorage());
});

/// 全局 Dio Provider。
final dioProvider = Provider<Dio>((ref) {
  final storage = ref.read(authStorageProvider);
  return createDio(storage);
});

/// 无需鉴权的公开接口（登录 / 注册 / 刷新 / 验证码）。
const Set<String> _publicPaths = <String>{
  '/client/auth/login',
  '/client/auth/register',
  '/client/auth/refresh',
  '/client/auth/captcha',
};

/// 单飞：保证并发 401 只触发一次刷新。
Future<String?>? _refreshing;

/// 构造配置好的 Dio。
Dio createDio(AuthStorage storage) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: AppConfig.connectTimeout,
      receiveTimeout: AppConfig.receiveTimeout,
      contentType: 'application/json; charset=utf-8',
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final path = options.path;
        final isPublic = _publicPaths.any(path.contains);
        if (!isPublic) {
          final token = await storage.readToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final response = error.response;

        // 1) 网络层错误：归一成带中文 message 的响应体后**仍然 reject**。
        //    曾经这里用 resolve 伪装成成功响应，调用方的 _unwrap 找不到 data，
        //    于是断网/超时全被报成「服务端返回格式异常」——完全误导排查方向。
        if (response == null) {
          final normalized = Response<dynamic>(
            requestOptions: error.requestOptions,
            statusCode: -1,
            data: <String, dynamic>{
              'code': -1,
              'message': ApiException.network(error.error).message,
            },
          );
          return handler.reject(
            DioException(
              requestOptions: error.requestOptions,
              response: normalized,
              type: error.type,
              error: error.error,
            ),
          );
        }

        // 2) 令牌过期：尝试刷新后重放（仅一次）
        if (response.statusCode == 401 && !_isRefreshCall(error.requestOptions.path)) {
          final newToken = await _refreshOnce(storage);
          if (newToken != null) {
            try {
              final options = error.requestOptions;
              options.headers['Authorization'] = 'Bearer $newToken';
              final retried = await dio.fetch(options);
              return handler.resolve(retried);
            } on DioException catch (retryError) {
              return handler.reject(retryError);
            }
          }
          // 刷新失败：令牌确已失效，通知上层清状态跳登录
          _onUnauthorized?.call();
        }

        handler.next(error);
      },
    ),
  );

  return dio;
}

/// 是否正在调刷新接口（避免刷新本身的 401 又触发刷新 → 死循环）。
bool _isRefreshCall(String path) => path.contains('/client/auth/refresh');

/// 单飞刷新：并发调用共享同一个 Future。
Future<String?> _refreshOnce(AuthStorage storage) {
  return _refreshing ??= _doRefresh(storage).whenComplete(() {
    _refreshing = null;
  });
}

Future<String?> _doRefresh(AuthStorage storage) async {
  final refreshToken = await storage.readRefreshToken();
  if (refreshToken == null || refreshToken.isEmpty) {
    return null;
  }
  try {
    // 用裸 Dio：避免刷新请求再走进拦截器，也避免被并发 401 互相触发
    final dio = Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl));
    final response = await dio.post<dynamic>(
      '/client/auth/refresh',
      data: <String, dynamic>{'refreshToken': refreshToken},
    );
    final body = response.data;
    if (body is Map<String, dynamic>) {
      final inner = body['data'];
      if (inner is Map<String, dynamic>) {
        final access = inner['accessToken'];
        final refresh = inner['refreshToken'];
        if (access is String && refresh is String) {
          await storage.writeTokens(accessToken: access, refreshToken: refresh);
          return access;
        }
      }
    }
    return null;
  } on DioException {
    return null;
  }
}
