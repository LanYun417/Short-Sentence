/// 音标学习接口。
///
/// 路径对应后端 `@Controller('client/ipa')`（见 api 的
/// `modules/client/ipa/ipa.controller.ts`）。
///
/// 设计口径：**发奖只在服务端**。客户端只上报「学会了」真实操作，
/// 服务端按幂等 event_key 决定是否发 XP，客户端不直接说"我学会了"。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/ipa.dart';

/// 音标 API。
class IpaApi {
  const IpaApi(this._dio);

  final Dio _dio;

  /// 音标库（分组分发，公开参考数据）。
  Future<IpaPhonemePackage> phonemes() async {
    try {
      final response = await _dio.get<dynamic>('/client/ipa/phonemes');
      return IpaPhonemePackage.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 我的进度（已学会数）。
  Future<IpaProgress> progress() async {
    try {
      final response = await _dio.get<dynamic>('/client/ipa/progress');
      return IpaProgress.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 标记某个音标「学会了」（首次发 XP，幂等）。
  Future<IpaLearnedResult> markLearned(String symbol) async {
    try {
      final response = await _dio.post<dynamic>(
        '/client/ipa/learned',
        data: <String, dynamic>{'symbol': symbol},
      );
      return IpaLearnedResult.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  static Map<String, dynamic> _data(Response<dynamic> response) {
    final body = response.data;
    if (body is Map<String, dynamic>) {
      final data = body['data'];
      if (data is Map<String, dynamic>) {
        return data;
      }
    }
    return <String, dynamic>{};
  }

  static ApiException _wrap(DioException error) {
    final data = error.response?.data;
    if (data is Map && data['message'] is String) {
      return ApiException(message: data['message'] as String);
    }
    return ApiException(message: '网络异常，请稍后重试');
  }
}

/// 音标库返回体。
class IpaPhonemePackage {
  const IpaPhonemePackage({required this.groups, required this.total});

  final List<IpaPhonemeGroup> groups;

  /// 音标总数（48）。
  final int total;

  /// 全部音标（分组拍平）。
  List<IpaPhoneme> get all => groups.expand((g) => g.items).toList();

  factory IpaPhonemePackage.fromJson(Map<String, dynamic> json) {
    return IpaPhonemePackage(
      groups: (json['groups'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(IpaPhonemeGroup.fromJson)
          .toList(),
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}

/// 我的进度返回体。
class IpaProgress {
  const IpaProgress({required this.learnedCount, required this.total, required this.items});

  final int learnedCount;
  final int total;
  final List<IpaProgressItem> items;

  factory IpaProgress.fromJson(Map<String, dynamic> json) {
    return IpaProgress(
      learnedCount: (json['learnedCount'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toInt() ?? 0,
      items: (json['items'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(IpaProgressItem.fromJson)
          .toList(),
    );
  }
}

/// api provider（与其他 api 同一注入风格）。
final ipaApiProvider = Provider<IpaApi>((ref) => IpaApi(ref.watch(dioProvider)));
