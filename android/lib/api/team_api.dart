/// 弱连接学习小队接口：查我的小队 / 匹配 / 退出。
///
/// 路径对应后端 `@Controller('client/team')`。
/// `my` 在未组队时返回 `data: null`，这里特意与「解包成 Map」的通用路径区分开。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/team.dart';

class TeamApi {
  const TeamApi(this._dio);

  final Dio _dio;

  /// 我的小队（无队伍返回 null）。
  Future<TeamView?> my() async {
    try {
      final response = await _dio.get<dynamic>('/client/team/my');
      final body = response.data;
      if (body is Map<String, dynamic>) {
        final data = body['data'];
        if (data == null) return null;
        if (data is Map<String, dynamic>) return TeamView.fromJson(data);
      }
      throw const ApiException(message: '服务端返回格式异常');
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 找队友（按近 7 天练习节奏匹配，或新建等待池）。
  Future<TeamView> match() async {
    try {
      final response = await _dio.post<dynamic>('/client/team/match');
      return TeamView.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 退出小队（可重新匹配）。
  Future<void> leave() async {
    try {
      await _dio.post<dynamic>('/client/team/leave');
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

/// 小队 API Provider。
final teamApiProvider = Provider<TeamApi>((ref) {
  return TeamApi(ref.watch(dioProvider));
});
