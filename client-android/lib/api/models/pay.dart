/// 会员支付模型（与后端 `common/pay` 的视图同构）。
library;

/// 会员套餐。
class PaySku {
  const PaySku({
    required this.code,
    required this.name,
    required this.price,
    required this.durationDays,
    required this.benefits,
  });

  final String code;
  final String name;

  /// 价格（分）
  final int price;

  /// 有效天数（0 = 终身）
  final int durationDays;

  final List<String> benefits;

  factory PaySku.fromJson(Map<String, dynamic> json) {
    final rawBenefits = json['benefits'];
    return PaySku(
      code: (json['code'] as String?) ?? '',
      name: (json['name'] as String?) ?? '',
      price: (json['price'] as num?)?.toInt() ?? 0,
      durationDays: (json['durationDays'] as num?)?.toInt() ?? 0,
      benefits: rawBenefits is List ? rawBenefits.whereType<String>().toList() : const <String>[],
    );
  }

  /// 价格文案（分 → 元，整数省掉小数）
  String get priceText => (price / 100).toStringAsFixed(2).replaceAll(RegExp(r'\.00$'), '');

  /// 副标题（月均价 / 天数 / 终身）
  String get subtitle {
    if (durationDays == 0) {
      return '一次买断，永久有效';
    }
    if (durationDays >= 365) {
      return '约 ¥${(price / 12 / 100).toStringAsFixed(1)} / 月';
    }
    return '$durationDays 天';
  }
}

/// 会员状态。
class VipStatus {
  const VipStatus({
    required this.vip,
    required this.lifetime,
    required this.expiresAt,
    required this.skuCode,
  });

  final bool vip;
  final bool lifetime;
  final String? expiresAt;
  final String? skuCode;

  /// 空状态（未开通）。
  static const VipStatus none = VipStatus(vip: false, lifetime: false, expiresAt: null, skuCode: null);

  factory VipStatus.fromJson(Map<String, dynamic> json) {
    return VipStatus(
      vip: json['vip'] == true,
      lifetime: json['lifetime'] == true,
      expiresAt: json['expiresAt'] as String?,
      skuCode: json['skuCode'] as String?,
    );
  }

  /// 展示文案
  String get text {
    if (!vip) {
      return '尚未开通会员';
    }
    if (lifetime) {
      return '终身会员 · 永久有效';
    }
    final date = (expiresAt ?? '').length >= 10 ? expiresAt!.substring(0, 10).replaceAll('-', '/') : '-';
    return '会员有效期至 $date';
  }
}

/// 套餐列表 + 当前会员状态。
class VipSkuList {
  const VipSkuList({required this.enabled, required this.skus, required this.vip});

  final bool enabled;
  final List<PaySku> skus;
  final VipStatus vip;

  factory VipSkuList.fromJson(Map<String, dynamic> json) {
    final rawSkus = json['skus'];
    return VipSkuList(
      enabled: json['enabled'] == true,
      skus: rawSkus is List
          ? rawSkus.whereType<Map<String, dynamic>>().map(PaySku.fromJson).toList()
          : const <PaySku>[],
      vip: json['vip'] is Map<String, dynamic>
          ? VipStatus.fromJson(json['vip'] as Map<String, dynamic>)
          : VipStatus.none,
    );
  }
}

/// 下单结果（安卓走 Native：二维码 PNG data URL）。
class PayOrderCreated {
  const PayOrderCreated({
    required this.orderNo,
    required this.amount,
    required this.channel,
    required this.expiresAt,
    required this.codeUrl,
    required this.qrDataUrl,
  });

  final String orderNo;

  /// 分
  final int amount;
  final String channel;
  final String expiresAt;

  /// 二维码内容（排障用）
  final String? codeUrl;

  /// 二维码 PNG data URL（直接 Image.memory 渲染）
  final String? qrDataUrl;

  factory PayOrderCreated.fromJson(Map<String, dynamic> json) {
    return PayOrderCreated(
      orderNo: (json['orderNo'] as String?) ?? '',
      amount: (json['amount'] as num?)?.toInt() ?? 0,
      channel: (json['channel'] as String?) ?? '',
      expiresAt: (json['expiresAt'] as String?) ?? '',
      codeUrl: json['codeUrl'] as String?,
      qrDataUrl: json['qrDataUrl'] as String?,
    );
  }

  /// 价格文案
  String get amountText => (amount / 100).toStringAsFixed(2);
}

/// 订单状态。
class PayOrderStatus {
  const PayOrderStatus({
    required this.orderNo,
    required this.status,
    required this.amount,
    required this.paidAt,
    required this.vip,
  });

  final String orderNo;
  final String status;
  final int amount;
  final String? paidAt;
  final VipStatus vip;

  factory PayOrderStatus.fromJson(Map<String, dynamic> json) {
    return PayOrderStatus(
      orderNo: (json['orderNo'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'pending',
      amount: (json['amount'] as num?)?.toInt() ?? 0,
      paidAt: json['paidAt'] as String?,
      vip: json['vip'] is Map<String, dynamic>
          ? VipStatus.fromJson(json['vip'] as Map<String, dynamic>)
          : VipStatus.none,
    );
  }
}