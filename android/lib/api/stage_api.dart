/// 情景闯关接口：关卡地图（场景/剧本）/ 关卡详情 / AI 对话 / 领取奖励。
///
/// 路径对应后端 `@Controller('client/stages')`（见 api 的
/// `modules/client/stage/stage.controller.ts`），字段与 Web 端
/// `client/app/types/index.ts` 的 `Stage*` 同构——三端共用一套契约。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/stage.dart';

class StageApi {
  const StageApi(this._dio);

  final Dio _dio;

  /// 闯关地图（场景 + 剧本 + 我的进度）。
  Future<StageOverview> overview() async {
    try {
      final response = await _dio.get<dynamic>('/client/stages');
      return StageOverview.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 场景详情（场景 → 剧本列表）。
  Future<StageSceneDetail> scene(int id) async {
    try {
      final response = await _dio.get<dynamic>('/client/stages/scenes/$id');
      return StageSceneDetail.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 剧本详情（剧本 → 关卡列表）。
  Future<StageScriptDetail> script(int id) async {
    try {
      final response = await _dio.get<dynamic>('/client/stages/scripts/$id');
      return StageScriptDetail.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 获取关卡进行中的会话（无进行中返回 null）。
  Future<StageDialogue?> dialogue(int id) async {
    try {
      final response = await _dio.get<dynamic>('/client/stages/$id/dialogue');
      final data = _dataOrNull(response);
      return data == null ? null : StageDialogue.fromJson(data);
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 进入 / 重开关卡对话。
  ///
  /// [restart] 为 true 时丢弃原会话从开场白再来；不传则续聊（有进行中会话时）。
  Future<StageDialogue> startDialogue(int id, {bool restart = false}) async {
    try {
      final response = await _dio.post<dynamic>(
        '/client/stages/$id/dialogue',
        data: <String, dynamic>{'restart': restart},
      );
      return StageDialogue.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 发送一句用户发言，返回 AI 本轮回复 + 进度。
  ///
  /// [showTranslation] 跟随当前翻译开关：模型据此决定本轮是否给中文翻译，
  /// 关掉翻译通关能拿 +50% 经验（服务端按全程是否开启判定）。
  Future<StageTurnResult> sendMessage(
    int id,
    String content, {
    bool showTranslation = true,
  }) async {
    try {
      final response = await _dio.post<dynamic>(
        '/client/stages/$id/dialogue/messages',
        data: <String, dynamic>{
          'content': content,
          'showTranslation': showTranslation,
        },
      );
      return StageTurnResult.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 持久化翻译开关（PATCH，整页级开关）。
  Future<bool> setTranslation(int id, bool show) async {
    try {
      final response = await _dio.patch<dynamic>(
        '/client/stages/$id/dialogue/translation',
        data: <String, dynamic>{'show': show},
      );
      final data = _data(response);
      return data['showTranslation'] as bool? ?? show;
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 结束对话（达到上限 / 主动结束），返回最终会话状态 + 复盘。
  Future<StageDialogue> endDialogue(int id) async {
    try {
      final response = await _dio.post<dynamic>('/client/stages/$id/dialogue/end');
      return StageDialogue.fromJson(_data(response));
    } on DioException catch (error) {
      throw _wrap(error);
    }
  }

  /// 领取某关通关奖励（服务端幂等，重复调用不会重复发放）。
  Future<StageClaimResult> claim(int id) async {
    try {
      final response = await _dio.post<dynamic>('/client/stages/$id/claim');
      return StageClaimResult.fromJson(_data(response));
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

  ApiException _wrap(DioException error) {
    final response = error.response;
    if (response == null) {
      return ApiException.network(error.error);
    }
    return ApiException.fromResponse(response.statusCode, response.data);
  }
}

/// 关卡 API Provider。
final stageApiProvider = Provider<StageApi>((ref) {
  return StageApi(ref.watch(dioProvider));
});

/// 闯关地图数据（进入页面 / 领奖后刷新）。
final stageOverviewProvider = FutureProvider<StageOverview>((ref) async {
  return ref.watch(stageApiProvider).overview();
});

/// 场景详情（场景 → 剧本列表）。
final stageSceneProvider = FutureProvider.family<StageSceneDetail, int>((ref, id) async {
  return ref.watch(stageApiProvider).scene(id);
});

/// 剧本详情（剧本 → 关卡列表）。
final stageScriptProvider = FutureProvider.family<StageScriptDetail, int>((ref, id) async {
  return ref.watch(stageApiProvider).script(id);
});
