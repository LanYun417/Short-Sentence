/// 站点公开配置接口（备案号）。
///
/// 路径对应后端 `@Controller('client/site')`（`api` 的
/// `modules/client/site/site.controller.ts`），@Public，未登录也可取。
/// 后台在「系统管理 → 参数管理」维护 site.icp / site.policeIcp。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/site.dart';

/// 站点公开配置 API。
class SiteApi {
  const SiteApi(this._dio);

  final Dio _dio;

  /// 读取站点公开配置（备案号；值为空串表示未设置）。
  Future<SiteConfig> config() async {
    try {
      final response = await _dio.get<dynamic>('/client/site');
      final body = response.data;
      if (body is Map<String, dynamic> && body['data'] is Map<String, dynamic>) {
        return SiteConfig.fromJson(body['data'] as Map<String, dynamic>);
      }
      throw const ApiException(message: '服务端返回格式异常');
    } on DioException catch (error) {
      final response = error.response;
      if (response == null) {
        throw ApiException.network(error.error, error.type);
      }
      throw ApiException.fromResponse(response.statusCode, response.data);
    }
  }
}

/// 站点配置 API Provider。
final siteApiProvider = Provider<SiteApi>((ref) {
  return SiteApi(ref.watch(dioProvider));
});

/// 站点配置（备案号）。FutureProvider 缓存，关于弹窗里直接 watch。
final siteConfigProvider = FutureProvider<SiteConfig>((ref) {
  return ref.watch(siteApiProvider).config();
});
