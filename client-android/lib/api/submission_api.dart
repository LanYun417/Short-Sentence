/// 用户投稿接口（UGC）：提交 / 我的投稿 / 精选。
///
/// 路径对应后端 `@Controller('client/submissions')`。
/// 投稿**不进刷题池**：刷题题必须过 AI 生成与配图审核，精选是展示位，两者解耦。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/library_item.dart' show PageResult;
import 'models/submission.dart';

class SubmissionApi {
  const SubmissionApi(this._dio);

  final Dio _dio;

  /// 提交一条投稿，返回新投稿 id。
  Future<int> create({
    required String sentenceEn,
    required String translationZh,
    String? note,
  }) async {
    try {
      final response = await _dio.post<dynamic>(
        '/client/submissions',
        data: <String, dynamic>{
          'sentenceEn': sentenceEn,
          'translationZh': translationZh,
          if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
          'platform': 'android',
        },
      );
      final data = _data(response);
      return (data['id'] as num?)?.toInt() ?? 0;
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 我的投稿（含状态与驳回原因）。
  Future<PageResult<SubmissionItem>> mine({int page = 1, int pageSize = 20}) async {
    try {
      final response = await _dio.get<dynamic>(
        '/client/submissions/mine',
        queryParameters: <String, dynamic>{'page': page, 'pageSize': pageSize},
      );
      return _paged(response, SubmissionItem.fromJson);
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 投稿精选（只含审核通过的）。
  Future<PageResult<FeaturedSubmission>> featured({int page = 1, int pageSize = 20}) async {
    try {
      final response = await _dio.get<dynamic>(
        '/client/submissions/featured',
        queryParameters: <String, dynamic>{'page': page, 'pageSize': pageSize},
      );
      return _paged(response, FeaturedSubmission.fromJson);
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  Map<String, dynamic> _data(Response<dynamic> response) {
    final body = response.data;
    if (body is Map && body['data'] is Map) {
      return (body['data'] as Map).map((key, value) => MapEntry(key.toString(), value));
    }
    if (body is Map) {
      return body.map((key, value) => MapEntry(key.toString(), value));
    }
    return <String, dynamic>{};
  }

  PageResult<T> _paged<T>(Response<dynamic> response, T Function(Map<String, dynamic>) parse) {
    final data = _data(response);
    final raw = data['list'];
    final list = raw is List
        ? raw
            .whereType<Map>()
            .map((item) => parse(item.map((key, value) => MapEntry(key.toString(), value))))
            .toList()
        : <T>[];
    return PageResult<T>(list: list, total: (data['total'] as num?)?.toInt() ?? list.length);
  }

  ApiException _wrap(DioException error) {
    final response = error.response;
    if (response == null) {
      return ApiException.network(error.error, error.type);
    }
    return ApiException.fromResponse(response.statusCode, response.data);
  }
}

/// 投稿 API Provider。
final submissionApiProvider = Provider<SubmissionApi>((ref) {
  return SubmissionApi(ref.watch(dioProvider));
});