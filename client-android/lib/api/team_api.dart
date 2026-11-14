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

  /// 自建队伍（生成组队码，创建者为队长）。
  Future<TeamView> create(String name) async {
    try {
      final response = await _dio.post<dynamic>('/client/team/create', data: <String, dynamic>{'name': name});
      return TeamView.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 凭组队码加入小队。
  Future<TeamView> join(String code) async {
    try {
      final response = await _dio.post<dynamic>('/client/team/join', data: <String, dynamic>{'code': code});
      return TeamView.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 修改小队名。
  Future<TeamView> rename(String name) async {
    try {
      final response = await _dio.patch<dynamic>('/client/team/name', data: <String, dynamic>{'name': name});
      return TeamView.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 群聊消息（游标分页，最近 30 天）。
  Future<TeamMessagePage> messages({int? before, int limit = 30}) async {
    try {
      final response = await _dio.get<dynamic>(
        '/client/team/messages',
        queryParameters: <String, dynamic>{
          'limit': limit,
          if (before != null) 'before': before,
        },
      );
      return TeamMessagePage.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 发送群聊消息（可引用某条）。
  Future<TeamMessage> sendMessage(String content, {int? quoteId}) async {
    try {
      final response = await _dio.post<dynamic>(
        '/client/team/messages',
        data: <String, dynamic>{
          'content': content,
          if (quoteId != null) 'quoteId': quoteId,
        },
      );
      return TeamMessage.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 撤回自己的消息（2 分钟内）。
  Future<TeamMessage> recall(int messageId) async {
    try {
      final response = await _dio.post<dynamic>('/client/team/messages/$messageId/recall');
      return TeamMessage.fromJson(_data(response));
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

/// 小队 API Provider。
final teamApiProvider = Provider<TeamApi>((ref) {
  return TeamApi(ref.watch(dioProvider));
});
