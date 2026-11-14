/// 接口异常归一化测试。
///
/// 重点验证：**优先用服务端的中文 message**（例如「验证码错误或已过期」），
/// 而不是笼统的「请求失败」——用户在登录页看到什么，全凭这里。
library;

import 'dart:io' show HandshakeException;

import 'package:dio/dio.dart' show DioExceptionType;
import 'package:flutter_test/flutter_test.dart';
import 'package:client_android/api/api_exception.dart';

void main() {
  group('ApiException.fromResponse', () {
    test('取服务端 message 与业务码', () {
      final exception = ApiException.fromResponse(400, <String, dynamic>{
        'code': 400,
        'message': '验证码错误或已过期',
        'data': null,
      });

      expect(exception.message, '验证码错误或已过期');
      expect(exception.code, 400);
      expect(exception.statusCode, 400);
    });

    test('响应体缺 message 时按状态码给兜底', () {
      final exception = ApiException.fromResponse(500, <String, dynamic>{
        'code': 500,
        'data': null,
      });

      expect(exception.message, '请求失败，请稍后重试');
      expect(exception.statusCode, 500);
    });

    test('响应体不是 Map 时不崩', () {
      final exception = ApiException.fromResponse(404, 'plain text');
      expect(exception.message, '请求失败，请稍后重试');
    });

    test('401 判为令牌失效', () {
      final exception = ApiException.fromResponse(401, <String, dynamic>{
        'code': 401,
        'message': '登录已过期',
      });
      expect(exception.isUnauthorized, isTrue);
    });
  });

  group('ApiException.network', () {
    test('超时给超时文案', () {
      final exception = ApiException.network(
        Exception('TimeoutException after 15000ms'),
      );
      expect(exception.message, contains('超时'));
      expect(exception.statusCode, -1);
    });

    test('其他网络异常给网络文案', () {
      final exception = ApiException.network(Exception('SocketException'));
      expect(exception.message, contains('网络'));
    });

    test('Dio 超时类别优先判为超时（底层 error 为 null 也准）', () {
      // 超时的 error.error 常为 null，只靠异常文本判不出；Dio 的类别是更可靠的判据
      final exception = ApiException.network(null, DioExceptionType.receiveTimeout);
      expect(exception.message, contains('超时'));
    });

    test('Dio 连接超时类别同样判为超时', () {
      final exception = ApiException.network(null, DioExceptionType.connectionTimeout);
      expect(exception.message, contains('超时'));
    });

    test('TLS 握手失败单独给安全连接文案', () {
      // 证书/握手问题与断网方向完全不同：前者多半是系统时间或代理
      final exception = ApiException.network(
        const HandshakeException('handshake error'),
      );
      expect(exception.message, contains('安全连接'));
      expect(exception.message, isNot(contains('超时')));
    });
  });
}
