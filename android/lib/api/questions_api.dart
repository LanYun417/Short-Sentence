/// 刷题接口：抽题 / 提交答案 / 收藏。
///
/// 路径对应后端 `@Controller('client/questions')`，
/// 字段与 Web 端 `composables/useApi.ts` 的调用同构。
///
/// ⚠️ **判分权威在后端**：前端只做输入期预校验提示，
/// 任何一端单独放宽判分口径都会造成「前端对、后端错」
/// （后端 QuestionsService.normalizeAnswer 是唯一标准）。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/question.dart';

/// 抽题查询参数。
class NextQuestionQuery {
  const NextQuestionQuery({this.difficulty, this.mode = AnswerMode.input});

  /// 目标难度（1/2/3；不传则不限）
  final int? difficulty;

  /// 作答模式（影响是否下发词块）
  final AnswerMode mode;

  Map<String, dynamic> toQuery() => <String, dynamic>{
        if (difficulty != null) 'difficulty': difficulty,
        'mode': mode.value,
      };
}

/// 刷题 API。
class QuestionsApi {
  const QuestionsApi(this._dio);

  final Dio _dio;

  /// 抽下一题。
  Future<Question> next([NextQuestionQuery query = const NextQuestionQuery()]) async {
    try {
      final response = await _dio.get<dynamic>(
        '/client/questions/next',
        queryParameters: query.toQuery(),
      );
      return Question.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 提交答案。
  ///
  /// [elapsedMs] 前端计时（服务端按上限截断，作弊性由服务端管）。
  Future<AnswerResult> answer(
    int sentenceId,
    String userAnswer, {
    int? elapsedMs,
    AnswerMode mode = AnswerMode.input,
  }) async {
    try {
      final response = await _dio.post<dynamic>(
        '/client/questions/$sentenceId/answer',
        data: <String, dynamic>{
          'userAnswer': userAnswer,
          // 这里不用 `if (?elapsedMs)`（null-aware 元素）：该语法要求 Dart 3.9+，
          // 当前 SDK ^3.13 的 analyzer 虽然认识（于是给出这条 info），
          // 但实际编译会报 missing_identifier。宁要 ignore 也不要编译失败。
          // ignore: use_null_aware_elements
          if (elapsedMs != null) 'elapsedMs': elapsedMs,
          'mode': mode.value,
        },
      );
      return AnswerResult.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 收藏 / 取消收藏（服务端是同一个 toggle 接口）。
  Future<bool> toggleFavorite(int sentenceId) async {
    try {
      final response = await _dio.post<dynamic>('/client/questions/$sentenceId/favorite');
      final data = _data(response);
      return data['favorited'] as bool? ?? false;
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

/// 刷题 API Provider。
final questionsApiProvider = Provider<QuestionsApi>((ref) {
  return QuestionsApi(ref.watch(dioProvider));
});
