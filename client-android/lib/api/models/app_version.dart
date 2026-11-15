/// 最新上架版本（GET /client/app/latest?platform=android，游客可访问）。
///
/// 与后端 `AppVersionsService.LatestAppVersion` 同构。
class LatestAppVersion {
  const LatestAppVersion({
    required this.id,
    required this.version,
    required this.versionCode,
    required this.fileSize,
    required this.changelog,
    required this.forceUpdate,
    required this.publishedAt,
  });

  final int id;
  final String version;
  final int versionCode;
  final int fileSize;
  final String changelog;
  final bool forceUpdate;
  final String publishedAt;

  factory LatestAppVersion.fromJson(Map<String, dynamic> json) {
    return LatestAppVersion(
      id: json['id'] as int? ?? 0,
      version: json['version'] as String? ?? '',
      versionCode: json['versionCode'] as int? ?? 0,
      fileSize: json['fileSize'] as int? ?? 0,
      changelog: json['changelog'] as String? ?? '',
      forceUpdate: json['forceUpdate'] as bool? ?? false,
      publishedAt: json['publishedAt'] as String? ?? '',
    );
  }

  /// APK 下载地址（走 /client/app/download/:id：绕过 /static 防盗链并计下载量）。
  String downloadUrl(String origin) => '$origin/api/client/app/download/$id';
}
