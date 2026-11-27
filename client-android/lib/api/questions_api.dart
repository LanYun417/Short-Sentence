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
import 'models/memory_stats.dart';
import 'models/review_plan.dart';
import 'models/weakness.dart';
import 'models/boss.dart';

/// 抽题查询参数。
///
/// 词块现随题**恒定下发**，故不再携带作答模式——切换模式沿用当前题即可（与 Web 端一致）。
class NextQuestionQuery {
  const NextQuestionQuery({this.difficulty, this.festival, this.categoryId, this.source});

  /// 目标难度（1/2/3；不传则不限）
  final int? difficulty;

  /// 节日题库名（传了则只从该节日的当前题库抽题）
  final String? festival;

  /// 场景分类 id（传了则只从该场景的题库抽题；与 festival 互斥，festival 优先）
  final int? categoryId;

  /// 抽题来源：review 只抽到期复习题（复习要成串）/ new 只抽新题；不传走日常混抽。
  final String? source;

  Map<String, dynamic> toQuery() => <String, dynamic>{
        if (difficulty != null) 'difficulty': difficulty,
        if (festival != null) 'festival': festival,
        if (categoryId != null) 'categoryId': categoryId,
        if (source != null) 'source': source,
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

  /// 可选的节日题库列表（只含有就绪题目的节日）。
  Future<List<FestivalBank>> listFestivals() async {
    try {
      final response = await _dio.get<dynamic>('/client/questions/festivals');
      final body = response.data;
      if (body is Map<String, dynamic>) {
        final data = body['data'];
        if (data is List) {
          return data
              .whereType<Map<String, dynamic>>()
              .map(FestivalBank.fromJson)
              .where((item) => item.name.isNotEmpty)
              .toList();
        }
      }
      return const <FestivalBank>[];
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 场景题库列表（题库页「按场景刷」入口；不含节日分类，附可刷题数）。
  Future<List<CategoryBank>> listCategories() async {
    try {
      final response = await _dio.get<dynamic>('/client/categories');
      final body = response.data;
      if (body is Map<String, dynamic>) {
        final data = body['data'];
        if (data is List) {
          return data
              .whereType<Map<String, dynamic>>()
              .map(CategoryBank.fromJson)
              .where((item) => item.name.isNotEmpty && item.id > 0)
              .toList();
        }
      }
      return const <CategoryBank>[];
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

  /// 今日 Boss：当天固定一道挑战题 + 是否已通关（服务端按日期确定性选取）。
  Future<BossToday> boss() async {
    try {
      final response = await _dio.get<dynamic>('/client/questions/boss');
      return BossToday.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 提交 Boss 答案（判分复用刷题口径，服务端额外发通关经验，按日期幂等）。
  Future<BossAnswerResult> answerBoss(int sentenceId, String userAnswer) async {
    try {
      final response = await _dio.post<dynamic>(
        '/client/questions/boss/answer',
        data: <String, dynamic>{'sentenceId': sentenceId, 'userAnswer': userAnswer},
      );
      return BossAnswerResult.fromJson(_data(response));
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

  /// 记忆健康概览（遗忘曲线 / 待复习分布）。
  Future<MemoryStats> getMemoryStats() async {
    try {
      final response = await _dio.get<dynamic>('/client/questions/memory-stats');
      return MemoryStats.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 今日复习计划（到期题按逾期优先，与 next(source=review) 同口径）。
  Future<ReviewPlan> reviewPlan() async {
    try {
      final response = await _dio.get<dynamic>(
        '/client/questions/review-plan',
        queryParameters: <String, dynamic>{'limit': 10},
      );
      return ReviewPlan.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 弱点词根：近 30 天错题按词自动归类。
  Future<WeaknessReport> weakness() async {
    try {
      final response = await _dio.get<dynamic>(
        '/client/questions/weakness',
        queryParameters: <String, dynamic>{'limit': 30},
      );
      return WeaknessReport.fromJson(_data(response));
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

/// 刷题 API Provider。
final questionsApiProvider = Provider<QuestionsApi>((ref) {
  return QuestionsApi(ref.watch(dioProvider));
});
