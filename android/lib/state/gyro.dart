/// 陀螺仪摇动：把角速度积分成带惯性的位移（-1..1），驱动液态流体背景。
///
/// 为什么不用 [TiltTracker]：那个输出的是**姿态四元数**（相对打开时刻转了多少），
/// 用于句签 3D 视差；液态流体需要的是「摇得多快」——直接取陀螺仪角速度，
/// 做速度积分 + 阻尼回中，松手后液体会自己荡回去。
///
/// 生命周期与降级：
/// - 只有 [start] 被调用才订阅（刷题页 Hero 挂载时），离开即 [stop]，传感器不在后台空转；
/// - 测试 / 桌面 / Web 上 `Platform.isAndroid == false`，完全不碰平台通道；
/// - 没有陀螺仪时原生侧返回错误，这里吞掉，保持静止（不是错误态）。
library;

import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

class GyroTilt extends ChangeNotifier {
  GyroTilt({this.enabled = true});

  /// 占位实例：没有传感器 / 不需要跟随时用它，调用方不用判空。
  static final GyroTilt none = GyroTilt(enabled: false);

  static const EventChannel _channel = EventChannel('short_sentence/gyro');

  /// 是否允许订阅（占位实例为 false，永远不碰平台通道）。
  final bool enabled;

  StreamSubscription<dynamic>? _sub;
  Timer? _timer;

  /// 最近一次陀螺仪读数（rad/s）。
  double _gx = 0;
  double _gy = 0;

  /// 速度与位移（位移钳在 -1..1）。
  double _vx = 0;
  double _vy = 0;
  double _x = 0;
  double _y = 0;

  Offset _value = Offset.zero;

  /// 当前位移（已含惯性）。
  Offset get value => _value;

  void start() {
    if (!enabled || _sub != null) {
      return;
    }
    // 只在真机/模拟器上订阅：桌面与 Widget 测试没有这个通道。
    if (kIsWeb || !Platform.isAndroid) {
      return;
    }
    _sub = _channel.receiveBroadcastStream().listen(
      _onEvent,
      // 没有陀螺仪时原生侧会返回错误：保持静止即可，不弹提示
      onError: (Object _) {},
      cancelOnError: false,
    );
    _timer ??= Timer.periodic(const Duration(milliseconds: 16), (_) => _tick());
  }

  void stop() {
    _sub?.cancel();
    _sub = null;
    _timer?.cancel();
    _timer = null;
    _gx = 0;
    _gy = 0;
    _vx = 0;
    _vy = 0;
    _x = 0;
    _y = 0;
    if (_value != Offset.zero) {
      _value = Offset.zero;
      notifyListeners();
    }
  }

  void _onEvent(dynamic event) {
    if (event is! List || event.length < 2) {
      return;
    }
    _gx = (event[0] as num).toDouble();
    _gy = (event[1] as num).toDouble();
  }

  void _tick() {
    // 绕 Y 轴左右摇（gy）→ 横向；绕 X 轴前后压（gx）→ 纵向。
    // 速度先积分再阻尼，位移再乘一次衰减（回中）——松手后荡两下就停。
    _vx = (_vx + _gy * 0.020) * 0.90;
    _vy = (_vy + _gx * 0.020) * 0.90;
    _x = (_x + _vx).clamp(-1.0, 1.0) * 0.94;
    _y = (_y + _vy).clamp(-1.0, 1.0) * 0.94;

    final next = Offset(_x, _y);
    // 微小变化不通知：静止时不要每帧唤醒重绘
    if ((next - _value).distance < 0.002) {
      return;
    }
    _value = next;
    notifyListeners();
  }

  /// 处理一次原始角速度（测试可喂值；宿主上没有平台通道）。
  @visibleForTesting
  void handleReading(double gx, double gy) {
    _gx = gx;
    _gy = gy;
    _tick();
  }

  @override
  void dispose() {
    stop();
    super.dispose();
  }
}
