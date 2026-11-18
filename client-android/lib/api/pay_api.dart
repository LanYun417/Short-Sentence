/// 会员支付接口（`/client/pay`）。
///
/// 安卓走 Native 扫码：下单返回二维码 PNG data URL，本端直接渲染，无需二维码库；
/// 支付结果以轮询订单状态为准（后端回调丢失时会主动向微信补单）。
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exception.dart';
import 'dio_client.dart';
import 'models/pay.dart';

/// 会员支付 API。
class PayApi {
  const PayApi(this._dio);

  final Dio _dio;

  /// 套餐列表 + 当前会员状态。
  Future<VipSkuList> skus() async {
    try {
      final response = await _dio.get<dynamic>('/client/pay/skus');
      return VipSkuList.fromJson(_unwrap(response));
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  /// 创建订单（安卓渠道 → Native 二维码）。
  Future<PayOrderCreated> create(String skuCode) async {
    try {
      final response = await _dio.post<dynamic>(
        '/client/pay/create',
        data: <String, dynamic>{'skuCode': skuCode, 'channel': 'android'},
      );
      return PayOrderCreated.fromJson(_unwrap(response));
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  /// 查询订单状态（轮询）。
  Future<PayOrderStatus> status(String orderNo) async {
    try {
      final response = await _dio.get<dynamic>('/client/pay/status/$orderNo');
      return PayOrderStatus.fromJson(_unwrap(response));
    } on DioException catch (error) {
      throw _toApiException(error);
    }
  }

  Map<String, dynamic> _unwrap(Response<dynamic> response) {
    final body = response.data;
    if (body is Map<String, dynamic>) {
      final data = body['data'];
      if (data is Map<String, dynamic>) {
        return data;
      }
    }
    throw const ApiException(message: '服务端返回格式异常');
  }

  ApiException _toApiException(DioException error) {
    final response = error.response;
    if (response == null) {
      return ApiException.network(error.error, error.type);
    }
    return ApiException.fromResponse(response.statusCode, response.data);
  }
}

/// 支付 API Provider。
final payApiProvider = Provider<PayApi>((ref) {
  return PayApi(ref.watch(dioProvider));
});
