/// 统一的接口异常。
///
/// 后端（NestJS）的业务错误都走 `{ code, message, data }` 响应体，
/// [ApiException.fromCode] 把 HTTP 状态码/业务码映射为**面向用户的中文提示**；
/// 网络层错误（超时、断网）单独归一，避免把 `SocketException` 直接抛到 UI。
library;

/// 接口异常（含可直接展示给用户的中文 message）。
class ApiException implements Exception {
  const ApiException({required this.message, this.code = 0, this.statusCode = 0});

  /// 从后端响应体构造。
  ///
  /// 优先用服务端的 `message`（它已经是对用户友好的中文，例如
  /// 「验证码错误或已过期」「今日 AI 次数已用完（每天 50 次）…」），
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
  factory ApiException.network([Object? error]) {
    final text = error?.toString() ?? '';
    if (text.contains('TimeoutException') || text.toLowerCase().contains('timeout')) {
      return const ApiException(message: '网络超时，请检查连接后重试', statusCode: -1);
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
