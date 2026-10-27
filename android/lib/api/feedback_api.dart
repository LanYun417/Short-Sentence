/// 客户端反馈接口（提交 + 我的反馈）。
///
/// 路径对应后端 `@Controller('client/feedback')`（见 api 的
/// `modules/client/feedback/feedback.controller.ts`）。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/feedback.dart';
import 'models/library_item.dart';

/// 反馈 API。
class FeedbackApi {
  const FeedbackApi(this._dio);

  final Dio _dio;

  /// 提交一条反馈。
  Future<ClientFeedbackItem> submit({
    required String type,
    required String content,
    String? contact,
  }) async {
    try {
      final response = await _dio.post<dynamic>(
        '/client/feedback',
        data: <String, dynamic>{
          'type': type,
          'content': content,
          if (contact != null && contact.isNotEmpty) 'contact': contact,
          'platform': 'android',
        },
      );
      final body = response.data;
      final data = body is Map<String, dynamic> ? body['data'] : null;
      if (data is Map<String, dynamic>) {
        return ClientFeedbackItem.fromJson(data);
      }
      throw const ApiException(message: '服务端返回格式异常');
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 我的反馈列表（时间倒序）。
  Future<PageResult<ClientFeedbackItem>> mine({
    int page = 1,
    int pageSize = 50,
  }) async {
    try {
      final response = await _dio.get<dynamic>(
        '/client/feedback/mine',
        queryParameters: <String, dynamic>{'page': page, 'pageSize': pageSize},
      );
      final data = _data(response);
      final list = data['list'];
      return PageResult<ClientFeedbackItem>(
        list: list is List
            ? list
                .whereType<Map<String, dynamic>>()
                .map(ClientFeedbackItem.fromJson)
                .toList()
            : const <ClientFeedbackItem>[],
        total: (data['total'] as num?)?.toInt() ?? 0,
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

/// 反馈 API Provider。
final feedbackApiProvider = Provider<FeedbackApi>((ref) {
  return FeedbackApi(ref.watch(dioProvider));
});
