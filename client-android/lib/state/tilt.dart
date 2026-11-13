/// 设备姿态：卡片 3D 视差的数据源。
///
/// 网页端用鼠标位置驱动倾斜；手机上没有指针，就换成**转手机**——
/// 数学上是同一件事（相对视角的偏移），只是驱动源从指针换成了陀螺仪。
///
/// 三个约束：
/// 1. 只用**相对打开时刻的增量**，绝对朝向对一张卡片没有意义；
/// 2. 相对姿态不要走欧拉角：`getOrientation` 的 ZYX 分解在俯仰 ±90° 处奇异，
///    而人举着手机看屏幕时俯仰角正在 -90° 附近，偏航与滚转会被耦合在一起，
///    表现为「卡片乱跳」。这里用四元数算**相对旋转矢量**，没有奇异点；
/// 3. 没有传感器、系统开了「减弱动效」、或者跑在桌面/测试环境时，
///    一律保持静止——卡片照常能看，只是不跟着动，不是错误态。
library;

import 'dart:async';
import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../theme/motion.dart';

/// 一次原始姿态读数：设备坐标系的四元数。
class _Reading {
  const _Reading(this.x, this.y, this.z, this.w);

  final double x;
  final double y;
  final double z;
  final double w;

  /// 模长（单位四元数应为 1）。
  double get norm => math.sqrt(x * x + y * y + z * z + w * w);
}

/// 平滑后的姿态偏移，两个分量都在 `-1..1`。
class TiltTracker extends ChangeNotifier {
  TiltTracker({this.maxAngle = 0.30, this.follow = 0.16, this.enabled = true});

  /// 不跟随姿态的占位实例（没有传感器时用它，调用方不用到处判空）。
  static final TiltTracker none = TiltTracker(enabled: false);

  static const EventChannel _channel = EventChannel('short_sentence/tilt');

  /// 偏到 ±1 所需的弧度。0.30 rad ≈ 17°——再小就太灵敏，手抖都在晃；再大要转很久。
  final double maxAngle;

  /// 每个事件的追赶系数。0.16 在 50Hz 下约等于 100ms 的时间常数，
  /// 观感是「卡片轻轻跟上来」，不是硬跟手。
  final double follow;

  /// 是否允许订阅（占位实例设为 false，永远不会碰平台通道）。
  final bool enabled;

  /// 死区：小于这个角度的变化直接忽略（约 0.2°），
  /// 不然手机平放桌上也会一直唤醒上层重绘。
  static const double _deadZone = 0.0035;

  StreamSubscription<dynamic>? _sub;

  /// 打开流时的基准姿态。
  _Reading? _base;

  Offset _value = Offset.zero;
  Offset _target = Offset.zero;

  /// 当前偏移（已平滑）。
  Offset get value => _value;

  void start() {
    if (!enabled || _sub != null) {
      return;
    }
    // 只在真机/模拟器上订阅：
    // · 桌面端没有这个通道，订阅会报 MissingPluginException；
    // · Widget 测试跑在宿主上，EventChannel 会走 FlutterError.reportError，
    //   直接被测试框架判为失败（这不是产品缺陷）。
    if (kIsWeb || !Platform.isAndroid) {
      return;
    }
    _base = null;
    _sub = _channel.receiveBroadcastStream().listen(
      _onEvent,
      // 没有传感器时原生侧会返回错误：保持静止即可，不弹提示
      onError: (Object _) {},
      cancelOnError: false,
    );
  }

  void stop() {
    _sub?.cancel();
    _sub = null;
    // 归零：不归零的话，卡片在下一次打开时会「歪着醒来」
    if (_value != Offset.zero || _target != Offset.zero) {
      _value = Offset.zero;
      _target = Offset.zero;
      notifyListeners();
    }
  }

  void _onEvent(dynamic event) {
    if (event is! Map) {
      return;
    }
    handleReading(
      (event['x'] as num?)?.toDouble() ?? 0,
      (event['y'] as num?)?.toDouble() ?? 0,
      (event['z'] as num?)?.toDouble() ?? 0,
      (event['w'] as num?)?.toDouble() ?? 1,
    );
  }

  /// 处理一次原始读数（设备坐标系的四元数）。
  ///
  /// 单独拆出来是为了能在单元测试里喂值：测试跑在宿主上，
  /// 平台通道根本不存在，走不到 [_onEvent]。
  @visibleForTesting
  void handleReading(double x, double y, double z, double w) {
    final now = _Reading(x, y, z, w);
    // 上一次订阅留下的基准要丢掉：重新打开等于「重新记一次当前朝向」
    _base ??= now;

    final axis = _axisAngle(now, _base!);

    // 映射到卡片的两根轴：
    // · 绕竖直轴左右转 → 卡片 rotateY。取负号：观感是「卡片留在原地，
    //   是你在绕着它看」，而不是卡片跟着屏幕一起转（那样等于没有视差）；
    // · 手机顶边下压 → 卡片 rotateX。
    var dx = -axis[1];
    var dy = axis[0];

    // 归一化前先过死区
    if (dx.abs() < _deadZone) dx = 0;
    if (dy.abs() < _deadZone) dy = 0;

    _target = Offset(
      (dx / maxAngle).clamp(-1.0, 1.0),
      (dy / maxAngle).clamp(-1.0, 1.0),
    );

    // 逐事件做指数平滑：设备静止时传感器仍在发，靠死区挡掉；
    // 平滑只追目标，所以不需要额外的 ticker。
    final next = Offset(
      _value.dx + (_target.dx - _value.dx) * follow,
      _value.dy + (_target.dy - _value.dy) * follow,
    );
    if (next == _value) {
      return;
    }
    _value = next;
    notifyListeners();
  }

  /// 相对旋转矢量：`qRel = qBase⁻¹ · qNow`，再转成轴角（长度是角度，弧度）。
  ///
  /// 用相对量而不是绝对朝向：绝对朝向对一张卡片没有意义，
  /// 用户关心的是「相对于刚打开时，我转了多少」。
  static List<double> _axisAngle(_Reading now, _Reading base) {
    // 共轭 = 逆（单位四元数）
    final bx = -base.x;
    final by = -base.y;
    final bz = -base.z;
    final bw = base.w;

    final nx = now.x;
    final ny = now.y;
    final nz = now.z;
    final nw = now.w;

    // Hamilton 乘积 qBase⁻¹ · qNow
    final w = bw * nw - bx * nx - by * ny - bz * nz;
    final x = bw * nx + bx * nw + by * nz - bz * ny;
    final y = bw * ny - bx * nz + by * nw + bz * nx;
    final z = bw * nz + bx * ny - by * nx + bz * nw;

    final wc = w.clamp(-1.0, 1.0);
    var angle = 2 * math.acos(wc);
    // 取最短弧：超过 180° 时走另一边，避免绕远路
    if (angle > math.pi) {
      angle -= 2 * math.pi;
    }
    final sinHalf = math.sqrt(1 - wc * wc);
    if (sinHalf < 1e-5) {
      return const <double>[0, 0, 0];
    }
    final scale = angle / sinHalf;
    return <double>[x * scale, y * scale, z * scale];
  }

  @override
  void dispose() {
    stop();
    super.dispose();
  }
}

/// 提供姿态数据的子树。离开时自动取消订阅（传感器不会在弹窗关掉后继续跑）。
class DeviceTiltScope extends StatefulWidget {
  const DeviceTiltScope({super.key, required this.child});

  final Widget child;

  /// 子树里最近的一个姿态源；没有就返回 [TiltTracker.none]。
  static TiltTracker of(BuildContext context) =>
      context.getInheritedWidgetOfExactType<_DeviceTilt>()?.tracker ??
      TiltTracker.none;

  @override
  State<DeviceTiltScope> createState() => _DeviceTiltScopeState();
}

class _DeviceTiltScopeState extends State<DeviceTiltScope>
    with WidgetsBindingObserver {
  final TiltTracker _tracker = TiltTracker();
  bool _started = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // 「减弱动效」时干脆不订阅：省电，也避免用户被跟着动的卡片晃到。
    // 用户在系统设置里开关这个选项时，MediaQuery 变化会重新走到这里。
    if (Motion.reduced(context)) {
      _started = false;
      _tracker.stop();
    } else if (!_started) {
      _started = true;
      _tracker.start();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState lifecycleState) {
    // 切到后台就停：传感器不该在看不见的界面上继续跑
    if (lifecycleState == AppLifecycleState.resumed) {
      if (!_started && !Motion.reduced(context)) {
        _started = true;
        _tracker.start();
      }
    } else {
      _started = false;
      _tracker.stop();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _tracker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      _DeviceTilt(tracker: _tracker, child: widget.child);
}

class _DeviceTilt extends InheritedWidget {
  const _DeviceTilt({required this.tracker, required super.child});

  final TiltTracker tracker;

  @override
  bool updateShouldNotify(_DeviceTilt oldWidget) =>
      oldWidget.tracker != tracker;
}
