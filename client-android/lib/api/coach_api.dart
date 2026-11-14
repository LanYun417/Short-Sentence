/// AI 私教接口：薄弱点画像 / 可选 AI 点评。
///
/// 路径对应后端 `@Controller('client/ai/coach')`。
/// 与 SSE 的 /client/ai/* 不同，这两个都是普通 JSON 信封，一次请求即可拿到结果。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/coach.dart';

class CoachApi {
  const CoachApi(this._dio);

  final Dio _dio;

  /// 薄弱点画像 + 今日复习计划（纯计算、始终可用、不消耗 AI 额度）。
  Future<CoachProfile> profile() async {
    try {
      final response = await _dio.get<dynamic>('/client/ai/coach/profile');
      return CoachProfile.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// AI 点评（不可用时后端自动降级，永远返回 200）。
  Future<CoachAdvice> advice() async {
    try {
      final response = await _dio.post<dynamic>('/client/ai/coach/advice');
      return CoachAdvice.fromJson(_data(response));
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
      return ApiException.network(error.error, error.type);
    }
    return ApiException.fromResponse(response.statusCode, response.data);
  }
}

/// 私教 API Provider。
final coachApiProvider = Provider<CoachApi>((ref) {
  return CoachApi(ref.watch(dioProvider));
});
