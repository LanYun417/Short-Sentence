/// 句子接龙接口：主题列表 / 主题详情 / 提交 / 点赞 / 举报。
///
/// 路径对应后端 `@Controller('client/chains')`。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/chain.dart';

class ChainApi {
  const ChainApi(this._dio);

  final Dio _dio;

  /// 主题列表。
  Future<List<ChainTopic>> topics() async {
    try {
      final response = await _dio.get<dynamic>('/client/chains');
      final body = response.data;
      if (body is Map<String, dynamic>) {
        final data = body['data'];
        if (data is List) {
          return data
              .whereType<Map<String, dynamic>>()
              .map(ChainTopic.fromJson)
              .toList(growable: false);
        }
      }
      throw const ApiException(message: '服务端返回格式异常');
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 主题详情（含接龙内容与今日剩余额度）。
  Future<ChainTopicDetail> detail(int topicId) async {
    try {
      final response = await _dio.get<dynamic>('/client/chains/$topicId');
      return ChainTopicDetail.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 提交一句续写。
  Future<ChainEntry> create(int topicId, String contentEn, String? contentZh) async {
    try {
      final response = await _dio.post<dynamic>(
        '/client/chains/$topicId/entries',
        data: <String, dynamic>{
          'contentEn': contentEn,
          if (contentZh != null && contentZh.isNotEmpty) 'contentZh': contentZh,
        },
      );
      return ChainEntry.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 点赞 / 取消（同一入口，服务端幂等）。
  Future<(bool, int)> toggleLike(int entryId) async {
    try {
      final response = await _dio.post<dynamic>('/client/chains/entries/$entryId/like');
      final data = _data(response);
      return (data['liked'] as bool? ?? false, data['likeCount'] as int? ?? 0);
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 举报（一人一次，满 3 次服务端自动隐藏）。
  Future<void> report(int entryId) async {
    try {
      await _dio.post<dynamic>(
        '/client/chains/entries/$entryId/report',
        data: <String, dynamic>{'reason': 'inappropriate'},
      );
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

/// 接龙 API Provider。
final chainApiProvider = Provider<ChainApi>((ref) {
  return ChainApi(ref.watch(dioProvider));
});

/// 接龙主题列表。
final chainTopicsProvider = FutureProvider<List<ChainTopic>>((ref) async {
  return ref.watch(chainApiProvider).topics();
});

/// 某主题详情（family：每个主题一份，提交/点赞后 ref.invalidate 自己那份）。
final chainDetailProvider = FutureProvider.family<ChainTopicDetail, int>((ref, topicId) async {
  return ref.watch(chainApiProvider).detail(topicId);
});
