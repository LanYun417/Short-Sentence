/// 成长/游戏化 API（客户端）。
///
/// 只读聚合接口：周学习报告。写入类动作（答题、打卡）在各自主接口里，
/// 这里不重复定义。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/weekly_report.dart';

class GamifyApi {
  const GamifyApi(this._dio);

  final Dio _dio;

  /// 周学习报告（本周答题/正确率/活跃天数/经验/成就/连续打卡 + 每日明细 + 上周对比）。
  Future<WeeklyReport> weeklyReport() async {
    try {
      final response = await _dio.get<dynamic>('/client/gamify/weekly-report');
      final body = response.data;
      final data = body is Map<String, dynamic> ? body['data'] : null;
      if (data is! Map<String, dynamic>) {
        throw const ApiException(message: '周报数据格式异常');
      }
      return WeeklyReport.fromJson(data);
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  ApiException _wrap(DioException error) {
    final response = error.response;
    if (response == null) {
      return ApiException.network(error.error, error.type);
    }
    return ApiException.fromResponse(response.statusCode ?? 0, response.data);
  }
}

/// 成长 API Provider。
final gamifyApiProvider = Provider<GamifyApi>((ref) {
  return GamifyApi(ref.watch(dioProvider));
});
