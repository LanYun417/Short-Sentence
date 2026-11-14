/// 客户端反馈接口（提交 + 我的反馈）。
///
/// 路径对应后端 `@Controller('client/feedback')`（见 api 的
/// `modules/client/feedback/feedback.controller.ts`）。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/image_pick.dart';
import 'api_exception.dart';
import 'dio_client.dart';
import 'models/feedback.dart';
import 'models/library_item.dart';

/// 反馈 API。
class FeedbackApi {
  const FeedbackApi(this._dio);

  final Dio _dio;

  /// 提交一条反馈（可带最多 5 张截图，multipart 上传）。
  Future<ClientFeedbackItem> submit({
    required String type,
    required String content,
    String? contact,
    List<PickedImage> images = const <PickedImage>[],
  }) async {
    try {
      final form = FormData.fromMap(<String, dynamic>{
        'type': type,
        'content': content,
        if (contact != null && contact.isNotEmpty) 'contact': contact,
        'platform': 'android',
      });
      for (final image in images) {
        form.files.add(
          MapEntry<String, MultipartFile>(
            // 字段名必须与后端 FilesInterceptor('images', 5) 一致
            'images',
            MultipartFile.fromBytes(
              image.bytes,
              filename: image.name,
              // 显式带上原 MIME（不依赖 dio 对文件名的推断，后端按 MIME 前缀过滤）
              contentType: DioMediaType.parse(image.mimeType),
            ),
          ),
        );
      }
      final response = await _dio.post<dynamic>('/client/feedback', data: form);
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
      return ApiException.network(error.error, error.type);
    }
    return ApiException.fromResponse(response.statusCode, response.data);
  }
}

/// 反馈 API Provider。
final feedbackApiProvider = Provider<FeedbackApi>((ref) {
  return FeedbackApi(ref.watch(dioProvider));
});
