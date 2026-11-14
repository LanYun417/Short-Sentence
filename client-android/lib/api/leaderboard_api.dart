/// 客户端排行榜接口（今日答题数 / 今日答对数 / 累计打卡天数，各前 100）。
///
/// 路径对应后端 `@Controller('client/leaderboard')`（见 api 的
/// `modules/client/leaderboard/leaderboard.controller.ts`）。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/leaderboard.dart';

/// 排行榜 API。
class LeaderboardApi {
  const LeaderboardApi(this._dio);

  final Dio _dio;

  /// 取今日榜：type=today_answered 答题数 / today_correct 答对数，前 100 + 当前用户名次。 */
  Future<LeaderboardResult> fetch(LeaderboardType type) async {
    try {
      final response = await _dio.get<dynamic>(
        '/client/leaderboard',
        queryParameters: <String, dynamic>{'type': type.apiValue},
      );
      return LeaderboardResult.fromJson(_data(response), type);
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

/// 排行榜 API Provider。
final leaderboardApiProvider = Provider<LeaderboardApi>((ref) {
  return LeaderboardApi(ref.watch(dioProvider));
});

/// 今日榜（按类型）。
///
/// autoDispose + family：每次进入排行榜页、切换榜单都重取，保证榜是「此刻最新」。
final leaderboardProvider = FutureProvider.family<LeaderboardResult, LeaderboardType>(
  (ref, type) => ref.watch(leaderboardApiProvider).fetch(type),
);
