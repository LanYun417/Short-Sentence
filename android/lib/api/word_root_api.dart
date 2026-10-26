/// 词根词典接口。
///
/// 路径对应后端 `@Controller('client/word-roots')`：
/// - `GET /client/word-roots?q=` 搜索（q 为空返回热门词）
/// - `GET /client/word-roots/:word` 查词（未命中实时 AI 解析并入库，**扣 AI 额度**）
/// - `POST /client/word-roots` 收录 AI 拆解结果（幂等）
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/word_root.dart';

/// 词根词典 API。
class WordRootApi {
  const WordRootApi(this._dio);

  final Dio _dio;

  /// 搜索词根（[keyword] 为空时返回热门词）。
  Future<List<WordRootItem>> search([String keyword = '']) async {
    try {
      final response = await _dio.get<dynamic>(
        '/client/word-roots',
        queryParameters: <String, dynamic>{'q': keyword.trim()},
      );
      final body = response.data;
      if (body is Map<String, dynamic>) {
        final data = body['data'];
        if (data is List) {
          return data
              .whereType<Map<String, dynamic>>()
              .map(WordRootItem.fromJson)
              .toList();
        }
      }
      return const <WordRootItem>[];
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 查词。缓存未命中会实时 AI 解析（**消耗一次 AI 额度**）。
  Future<WordRootItem> lookup(String word) async {
    try {
      final response = await _dio.get<dynamic>('/client/word-roots/$word');
      final body = response.data;
      if (body is Map<String, dynamic>) {
        final data = body['data'];
        if (data is Map<String, dynamic>) {
          return WordRootItem.fromJson(data);
        }
      }
      throw const ApiException(message: '服务端返回格式异常');
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  ApiException _wrap(DioException error) {
    final response = error.response;
    if (response == null) {
      return ApiException.network(error.error);
    }
    return ApiException.fromResponse(response.statusCode, response.data);
  }
}

/// 词根词典 API Provider。
final wordRootApiProvider = Provider<WordRootApi>((ref) {
  return WordRootApi(ref.watch(dioProvider));
});
