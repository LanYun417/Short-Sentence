/// AI 能力接口：场景延展造句 / 词根词缀拆解（均为 SSE 流式）。
///
/// 路径对应后端 `@Controller('client/ai')` 的 `POST expand` / `POST word-root`。
///
/// **为什么自己解析 SSE 而不用 EventSource**：
/// 后端的 SSE 是 **POST**（NestJS 的 @Sse 只支持 GET，服务端注释里写明了原因），
/// 而浏览器的 EventSource 只发 GET——Flutter 侧同理，必须自己发 POST
/// 再逐行解析 `event:` / `data:` 帧。dio 的 `responseType: stream` 正好够用。
///
/// 帧格式（后端 writeSse）：
/// ```
/// event: done
/// data: [DONE]
/// ```
/// 普通增量帧只有 `data:`，`event` 缺省。
library;

import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';

/// 一次流式产出的结果。
class AiStreamResult {
  const AiStreamResult({required this.text, required this.done, this.error});

  /// 累积至今的完整文本。
  final String text;

  /// 是否已正常结束（收到 done 帧）。
  final bool done;

  /// 错误信息（收到 error 帧时非空）。
  final String? error;
}

/// AI 能力 API。
class AiApi {
  const AiApi(this._dio);

  final Dio _dio;

  /// 场景延展造句（流式）。
  ///
  /// [onChunk] 每收到一个增量片段回调一次（参数是**累积全文**，方便直接渲染）。
  Stream<AiStreamResult> expand(
    String chinese, {
    int? sentenceId,
    CancelToken? cancelToken,
  }) {
    return _stream(
      '/client/ai/expand',
      <String, dynamic>{
        'chinese': chinese.trim(),
        'sentenceId': ?sentenceId,
      },
      cancelToken: cancelToken,
    );
  }

  /// 词根词缀拆解（流式）。
  Stream<AiStreamResult> wordRoot(
    String word, {
    int? sentenceId,
    CancelToken? cancelToken,
  }) {
    return _stream(
      '/client/ai/word-root',
      <String, dynamic>{
        'word': word.trim(),
        'sentenceId': ?sentenceId,
      },
      cancelToken: cancelToken,
    );
  }

  /// 通用 SSE 读取。
  ///
  /// 用 `CancelToken` 让调用方能中止（用户离开页面时）。
  Stream<AiStreamResult> _stream(
    String path,
    Map<String, dynamic> body, {
    CancelToken? cancelToken,
  }) async* {
    final buffer = StringBuffer();
    var finished = false;
    String? errorMessage;

    try {
      final response = await _dio.post<ResponseBody>(
        path,
        data: body,
        cancelToken: cancelToken,
        options: Options(
          responseType: ResponseType.stream,
          // SSE 不能有接收超时：长句生成可能超过 60s
          receiveTimeout: const Duration(minutes: 5),
        ),
      );

      final stream = response.data?.stream;
      if (stream == null) {
        yield const AiStreamResult(text: '', done: true, error: '服务端未返回数据流');
        return;
      }

      // 逐字节转字符串，按行切分（SSE 以 \n 分帧，空行结束一帧）
      final lines = stream
          // dio 给的是 Stream<Uint8List>，Utf8Decoder 要 Stream<List<int>>：
          // 先统一成 List<int> 再解码，否则泛型不匹配（编译期报错）
          .map<List<int>>((chunk) => chunk)
          .transform(utf8.decoder)
          .transform(const LineSplitter());

      await for (final line in lines) {
        if (line.isEmpty) {
          continue; // 帧间空行
        }
        if (line.startsWith('event:')) {
          final event = line.substring(6).trim();
          if (event == 'error') {
            errorMessage = 'AI 服务开小差了，请稍后再试';
            finished = true;
          }
          continue;
        }
        if (line.startsWith('data:')) {
          // 只剥掉 SSE 规范里 `data:` 后的**一个**空格，不能 trim：
          // 分片常常以空格开头（"...already" + " got"），trim 会把词粘在一起，
          // 甚至把只含空格的片段吞掉，导致 JSON 结构被破坏。
          var chunk = line.substring(5);
          if (chunk.startsWith(' ')) {
            chunk = chunk.substring(1);
          }
          if (chunk == '[DONE]') {
            finished = true;
            continue;
          }
          buffer.write(chunk);
          yield AiStreamResult(text: buffer.toString(), done: false);
        }
      }
    } on DioException catch (error) {
      // 429 = 今日 AI 次数用完（后端在写 SSE 头前扣额度，所以是正常 JSON 错误）
      if (error.response?.statusCode == 429) {
        errorMessage = _wrap(error).message;
      } else if (error.type == DioExceptionType.cancel) {
        errorMessage = null; // 用户主动取消，不算错误
      } else {
        errorMessage = _wrap(error).message;
      }
    } catch (error) {
      errorMessage = 'AI 响应解析失败';
    }

    yield AiStreamResult(
      text: buffer.toString(),
      done: finished,
      error: errorMessage,
    );
  }

  ApiException _wrap(DioException error) {
    final response = error.response;
    if (response == null) {
      return ApiException.network(error.error);
    }
    return ApiException.fromResponse(response.statusCode, response.data);
  }
}

/// AI API Provider。
final aiApiProvider = Provider<AiApi>((ref) {
  return AiApi(ref.watch(dioProvider));
});

/// 今日 AI 额度（与后台排查页同源）。
class AiQuota {
  const AiQuota({required this.used, required this.limit, required this.remaining});

  final int used;
  final int limit;
  final int remaining;

  factory AiQuota.fromJson(Map<String, dynamic> json) {
    return AiQuota(
      used: (json['used'] as num?)?.toInt() ?? 0,
      limit: (json['limit'] as num?)?.toInt() ?? 0,
      remaining: (json['remaining'] as num?)?.toInt() ?? 0,
    );
  }
}

/// 今日 AI 额度查询。
final aiQuotaProvider = FutureProvider<AiQuota>((ref) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get<dynamic>('/client/ai/quota');
  final body = response.data;
  if (body is Map<String, dynamic> && body['data'] is Map<String, dynamic>) {
    return AiQuota.fromJson(body['data'] as Map<String, dynamic>);
  }
  throw const ApiException(message: '服务端返回格式异常');
});
