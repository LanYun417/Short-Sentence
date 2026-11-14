/// 学习库接口：收藏夹 / 复习池 / 历史记录 / 打卡 / 成长 / 句签 / 举报。
///
/// 路径对应后端 `@Controller('client')` 与各子控制器
/// （favorites / review / history / checkin / gamify / sentence-card / report）。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/growth.dart';
import 'models/library_item.dart';

/// 学习库 API（收藏 / 复习 / 历史 / 打卡 / 成长 / 句签 / 举报）。
class LibraryApi {
  const LibraryApi(this._dio);

  final Dio _dio;

  /// 收藏夹（分页）。
  Future<PageResult<SentenceLibraryItem>> favorites({
    int page = 1,
    int pageSize = 20,
  }) {
    return _paged('/client/favorites', page, pageSize);
  }

  /// 复习池（答错且到期的题）。
  Future<PageResult<SentenceLibraryItem>> review({
    int page = 1,
    int pageSize = 20,
  }) {
    return _paged('/client/review', page, pageSize);
  }

  /// 历史记录。
  Future<PageResult<SentenceLibraryItem>> history({
    int page = 1,
    int pageSize = 20,
  }) {
    return _paged('/client/history', page, pageSize);
  }

  Future<PageResult<SentenceLibraryItem>> _paged(
    String path,
    int page,
    int pageSize,
  ) async {
    try {
      final response = await _dio.get<dynamic>(
        path,
        queryParameters: <String, dynamic>{'page': page, 'pageSize': pageSize},
      );
      final data = _data(response);
      final list = data['list'];
      return PageResult<SentenceLibraryItem>(
        list: list is List
            ? list
                .whereType<Map<String, dynamic>>()
                .map(SentenceLibraryItem.fromJson)
                .toList()
            : const <SentenceLibraryItem>[],
        total: (data['total'] as num?)?.toInt() ?? 0,
      );
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 今日打卡状态（未打卡返回 null）。
  Future<CheckinToday?> checkinToday() async {
    try {
      final response = await _dio.get<dynamic>('/client/checkin/today');
      final data = _dataOrNull(response);
      return data == null ? null : CheckinToday.fromJson(data);
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 打卡。
  Future<CheckinToday> checkin() async {
    try {
      final response = await _dio.post<dynamic>('/client/checkin');
      return CheckinToday.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 成长概览（XP / 等级 / 成就 / 场景地图）。
  Future<GamifyOverview> gamify() async {
    try {
      final response = await _dio.get<dynamic>('/client/gamify/overview');
      return GamifyOverview.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 我的句签列表。
  Future<List<SentenceCard>> myCards() async {
    try {
      final response = await _dio.get<dynamic>('/client/sentence-card/mine');
      final data = _dataList(response);
      return data.map(SentenceCard.fromJson).toList();
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 今日句签状态（是否已领取；不返回卡片内容）。
  Future<TodayCardStatus> todayCardStatus() async {
    try {
      final response = await _dio.get<dynamic>('/client/sentence-card/today');
      final data = _dataOrNull(response);
      return data == null
          ? const TodayCardStatus(obtained: false, bizDate: '')
          : TodayCardStatus.fromJson(data);
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 领取今日句签（未达标 / 未就绪返回 null）。
  Future<SentenceCard?> claimCard() async {
    try {
      final response = await _dio.post<dynamic>('/client/sentence-card/claim');
      final data = _dataOrNull(response);
      return data == null ? null : SentenceCard.fromJson(data);
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 未拥有的句签（最近的若干张 + 总数）。
  Future<MissingSentenceCards> missing() async {
    try {
      final response = await _dio.get<dynamic>('/client/sentence-card/missing');
      return MissingSentenceCards.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 举报 / 反馈题目。
  Future<void> report({
    required int sentenceId,
    required String reason,
    String? description,
  }) async {
    try {
      await _dio.post<dynamic>(
        '/client/report',
        data: <String, dynamic>{
          'sentenceId': sentenceId,
          'reason': reason,
          if (description != null && description.trim().isNotEmpty)
            'description': description.trim(),
        },
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

  Map<String, dynamic>? _dataOrNull(Response<dynamic> response) {
    final body = response.data;
    if (body is Map<String, dynamic>) {
      final data = body['data'];
      if (data is Map<String, dynamic>) {
        return data;
      }
    }
    return null;
  }

  List<Map<String, dynamic>> _dataList(Response<dynamic> response) {
    final body = response.data;
    if (body is Map<String, dynamic>) {
      final data = body['data'];
      if (data is List) {
        return data.whereType<Map<String, dynamic>>().toList();
      }
    }
    return const <Map<String, dynamic>>[];
  }

  ApiException _wrap(DioException error) {
    final response = error.response;
    if (response == null) {
      return ApiException.network(error.error, error.type);
    }
    return ApiException.fromResponse(response.statusCode, response.data);
  }
}

/// 学习库 API Provider。
final libraryApiProvider = Provider<LibraryApi>((ref) {
  return LibraryApi(ref.watch(dioProvider));
});
