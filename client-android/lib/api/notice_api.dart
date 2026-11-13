/// 客户端公告接口（消息中心）。
///
/// 路径对应后端 `@Controller('client/notices')`（见 api 的
/// `modules/client/notice/client-notice.controller.ts`）。
/// 后台发布侧在 Web 后台「短句管理 → 客户端通知」。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/library_item.dart';
import 'models/notice.dart';

/// 公告 API。
class NoticeApi {
  const NoticeApi(this._dio);

  final Dio _dio;

  /// 已发布公告列表（置顶优先，其次按发布时间倒序）。
  Future<PageResult<ClientNoticeItem>> list({
    int page = 1,
    int pageSize = 50,
  }) async {
    try {
      final response = await _dio.get<dynamic>(
        '/client/notices',
        queryParameters: <String, dynamic>{'page': page, 'pageSize': pageSize},
      );
      final data = _data(response);
      final list = data['list'];
      return PageResult<ClientNoticeItem>(
        list: list is List
            ? list
                .whereType<Map<String, dynamic>>()
                .map(ClientNoticeItem.fromJson)
                .toList()
            : const <ClientNoticeItem>[],
        total: (data['total'] as num?)?.toInt() ?? 0,
      );
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 未读数（红点）。口径由服务端给（已发布总数 − 我已读数），不按当前页推算。
  Future<int> unreadCount() async {
    try {
      final response = await _dio.get<dynamic>('/client/notices/unread-count');
      return (_data(response)['count'] as num?)?.toInt() ?? 0;
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 标记单条已读（幂等，重复调不报错）。
  Future<void> markRead(int id) async {
    try {
      await _dio.post<dynamic>('/client/notices/$id/read');
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 全部标记已读。
  Future<void> markAllRead() async {
    try {
      await _dio.post<dynamic>('/client/notices/read-all');
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

/// 公告 API Provider。
final noticeApiProvider = Provider<NoticeApi>((ref) {
  return NoticeApi(ref.watch(dioProvider));
});

/// 未读数（「我的」页红点）。
///
/// autoDispose：每次进入「我的」重新取——红点必须反映「刚发的公告」，
/// 缓存住会让新公告一直不亮（Web 端也是每次进入重取）。
final noticeUnreadProvider = FutureProvider.autoDispose<int>((ref) {
  return ref.watch(noticeApiProvider).unreadCount();
});
