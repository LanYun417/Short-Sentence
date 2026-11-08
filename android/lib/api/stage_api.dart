/// 情景闯关接口：查关卡地图 / 领取通关奖励。
///
/// 路径对应后端 `@Controller('client/stages')`。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/stage.dart';

class StageApi {
  const StageApi(this._dio);

  final Dio _dio;

  /// 闯关地图（章节 + 关卡 + 我的进度）。
  Future<StageOverview> overview() async {
    try {
      final response = await _dio.get<dynamic>('/client/stages');
      return StageOverview.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 领取某关通关奖励（服务端幂等，重复调用不会重复发放）。
  Future<StageClaimResult> claim(int categoryId) async {
    try {
      final response = await _dio.post<dynamic>('/client/stages/$categoryId/claim');
      return StageClaimResult.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  Map<String, dynamic> _data(Response<dynamic> response) {
    final body = response.data;
    if (body is Map<String, dynamic>) {
      final data = body['data'];
      if (data is Map<String, dynamic>) {
        return data;
      }
    }
    throw const ApiException(message: '服务端返回格式异常');
  }

  ApiException _wrap(DioException error) {
    final response = error.response;
    if (response == null) {
      return ApiException.network(error.error);
    }
    return ApiException.fromResponse(response.statusCode, response.data);
  }
}

/// 关卡 API Provider。
final stageApiProvider = Provider<StageApi>((ref) {
  return StageApi(ref.watch(dioProvider));
});

/// 闯关地图数据（进入页面 / 领奖后刷新）。
final stageOverviewProvider = FutureProvider<StageOverview>((ref) async {
  return ref.watch(stageApiProvider).overview();
});
