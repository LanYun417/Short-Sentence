/// 站点公开配置（备案号）。
///
/// 对应后端 `@Controller('client/site')` 的 `SitePublicConfig`，
/// 与 Web 端 `useSiteConfig` 的 `SiteConfig` 同构。
library;

/// 站点公开配置。
class SiteConfig {
  const SiteConfig({required this.icp, required this.policeIcp});

  /// 网站备案号（ICP），空串 = 未设置
  final String icp;

  /// 公安备案号，空串 = 未设置
  final String policeIcp;

  factory SiteConfig.fromJson(Map<String, dynamic> json) {
    return SiteConfig(
      icp: (json['icp'] as String?) ?? '',
      policeIcp: (json['policeIcp'] as String?) ?? '',
    );
  }
}
