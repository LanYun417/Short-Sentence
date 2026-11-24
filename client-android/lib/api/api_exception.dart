/// 统一的接口异常。
///
/// 后端（NestJS）的业务错误都走 `{ code, message, data }` 响应体，
/// [ApiException.fromCode] 把 HTTP 状态码/业务码映射为**面向用户的中文提示**；
/// 网络层错误（超时、断网）单独归一，避免把 `SocketException` 直接抛到 UI。
library;

import 'dart:async' show TimeoutException;
import 'dart:io' show HandshakeException;

import 'package:dio/dio.dart' show DioExceptionType;

/// 接口异常（含可直接展示给用户的中文 message）。
class ApiException implements Exception {
  const ApiException({required this.message, this.code = 0, this.statusCode = 0});

  /// 从后端响应体构造。
  ///
  /// 优先用服务端的 `message`（它已经是对用户友好的中文，例如
  /// 「验证码错误或已过期」「今日 AI 次数已用完（每天 10 次）…」），
  /// 取不到时才回退到按状态码推断的兜底文案。
  factory ApiException.fromResponse(int? statusCode, dynamic body) {
    String message = '请求失败，请稍后重试';
    var code = 0;

    if (body is Map<String, dynamic>) {
      final rawCode = body['code'];
      if (rawCode is num) {
        code = rawCode.toInt();
      }
      final rawMessage = body['message'];
      if (rawMessage is String && rawMessage.trim().isNotEmpty) {
        message = rawMessage;
      }
    }

    return ApiException(message: message, code: code, statusCode: statusCode ?? 0);
  }

  /// 网络层异常归一（超时 / 断网 / 连接失败）。
  ///
  /// **按类型分级文案**，而不是一律「网络异常」：用户看到「超时」会想再点一次，
  /// 看到「网络异常」会去查 Wi-Fi；同一句文案会把两类人都带向错误动作。
  /// [type] 是 Dio 的错误类别（优先判据：有些超时的底层 error 为 null）；
  /// 调用方不传时回落到按底层异常类型判断。
  factory ApiException.network([Object? error, DioExceptionType? type]) {
    final isTimeout =
        type == DioExceptionType.connectionTimeout ||
        type == DioExceptionType.sendTimeout ||
        type == DioExceptionType.receiveTimeout ||
        error is TimeoutException ||
        error.toString().contains('TimeoutException');
    if (isTimeout) {
      return const ApiException(message: '网络超时，请检查连接后重试', statusCode: -1);
    }
    // 证书/握手失败：多数是系统时间不准或代理/防火墙劫持，提示方向完全不同
    final isTls = error is HandshakeException || error.toString().contains('HandshakeException');
    if (isTls) {
      return const ApiException(message: '安全连接失败，请检查系统时间或网络环境', statusCode: -1);
    }
    return const ApiException(message: '网络异常，请检查网络连接', statusCode: -1);
  }

  /// 可直接展示的中文提示。
  final String message;

  /// 后端业务码（0 = 非业务错误）。
  final int code;

  /// HTTP 状态码（-1 = 网络层错误）。
  final int statusCode;

  /// 是否令牌失效（需要重新登录）。
  ///
  /// 401 已由拦截器尝试过刷新；走到这里说明刷新也失败，
  /// 令牌确认真失效，UI 应清状态并跳登录页。
  bool get isUnauthorized => statusCode == 401 || code == 401;

  @override
  String toString() => 'ApiException($statusCode/$code): $message';
}
