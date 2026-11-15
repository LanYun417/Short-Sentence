/// App 版本接口：最新上架版本（游客可访问，启动时检查更新用）。
///
/// 路径对应后端 `@Controller('client/app')` 的 `GET /client/app/latest`。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/app_version.dart';

class AppVersionApi {
  const AppVersionApi(this._dio);

  final Dio _dio;

  /// 最新上架的 Android 版本（null = 后台还没发布过）。 */
  Future<LatestAppVersion?> latest() async {
    try {
      final response = await _dio.get<dynamic>('/client/app/latest', queryParameters: <String, dynamic>{
        'platform': 'android',
      });
      final body = response.data;
      if (body is Map<String, dynamic>) {
        final data = body['data'];
        if (data == null) return null;
        if (data is Map<String, dynamic>) return LatestAppVersion.fromJson(data);
      }
      throw const ApiException(message: '服务端返回格式异常');
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  ApiException _wrap(DioException error) {
    final response = error.response;
    if (response == null) {
      return ApiException.network(error.error);
    }
    return ApiException.fromResponse(response.statusCode, response.data);
  }
}

/// App 版本 API Provider。
final appVersionApiProvider = Provider<AppVersionApi>((ref) {
  return AppVersionApi(ref.watch(dioProvider));
});

/// 最新上架版本。autoDispose：每次进前台重新拉，版本检查不拿旧缓存。
final latestAppVersionProvider = FutureProvider.autoDispose<LatestAppVersion?>((ref) async {
  return ref.watch(appVersionApiProvider).latest();
});
