/// 姿态数据的换算：四元数 → 相对旋转矢量 → 归一化 → 平滑。
///
/// 为什么值得单测：**欧拉角在这里是错的**。`SensorManager.getOrientation` 的 ZYX
/// 分解在俯仰 ±90° 处奇异，而人举着手机看屏幕时俯仰角正好在 -90° 附近，
/// 偏航与滚转会被耦合到一起，卡片会乱跳——这是「换个姿势才复现」的坑，
/// 必须用合同锁住。这里守的是「走轴角、不走欧拉角」。
library;

import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:client_android/state/tilt.dart';

/// 绕 Y 轴（竖直方向左右转）转 [angle] 弧度对应的四元数。
///
/// ⚠️ 四元数的角度是整角的一半：手写 sin(整角) 会让实际转角翻倍，
/// 这个坑已经在第一版测试里踩过一次了。
double _halfSin(double angle) => math.sin(angle / 2);

double _halfCos(double angle) => math.cos(angle / 2);

void main() {
  test('姿态不变时偏移为 0', () {
    final tracker = TiltTracker(maxAngle: 0.30, follow: 0.16);
    for (var i = 0; i < 60; i++) {
      tracker.handleReading(0.32, -0.63, -0.22, 0.67);
    }
    expect(tracker.value, Offset.zero);
  });

  test('绕竖直轴转 0.30 rad 归一化后到满偏，方向为负（卡片留在原地，是你在绕它看）', () {
    final tracker = TiltTracker(maxAngle: 0.30, follow: 1);

    // 第一帧读数当基准
    tracker.handleReading(0, 0, 0, 1);
    expect(tracker.value, Offset.zero);

    final s = math.sin(0.15);
    tracker.handleReading(0, s, 0, math.cos(0.15));

    expect(tracker.value.dx, closeTo(-1, 1e-9));
    expect(tracker.value.dy, 0);
  });

  test('手机顶边下压映射到 rotateX 的输入', () {
    final tracker = TiltTracker(maxAngle: 0.30, follow: 1);
    tracker.handleReading(0, 0, 0, 1);

    final s = _halfSin(-0.10);
    tracker.handleReading(s, 0, 0, _halfCos(-0.10));

    expect(tracker.value.dy, closeTo(-0.10 / 0.30, 1e-9));
    expect(tracker.value.dx, 0);
  });

  test('不足满偏时按比例缩小，且逐帧追赶而不是瞬移', () {
    final tracker = TiltTracker(maxAngle: 0.30, follow: 0.5);
    tracker.handleReading(0, 0, 0, 1);

    final s = _halfSin(0.15);
    final c = _halfCos(0.15);
    tracker.handleReading(0, s, 0, c);

    // 目标 -0.15/0.30 = -0.5，只追一半 → -0.25：卡片是「跟上来」，不是硬切
    expect(tracker.value.dx, closeTo(-0.25, 1e-9));

    for (var i = 0; i < 40; i++) {
      tracker.handleReading(0, s, 0, c);
    }
    expect(tracker.value.dx, closeTo(-0.5, 1e-3));
  });

  test('超过满偏的读数被钳制在 ±1', () {
    final tracker = TiltTracker(maxAngle: 0.30, follow: 1);
    tracker.handleReading(0, 0, 0, 1);

    final s = _halfSin(1.2);
    tracker.handleReading(0, s, 0, _halfCos(1.2));

    expect(tracker.value.dx, -1);
  });

  test('转回来时偏移回到 0（基准不漂移）', () {
    final tracker = TiltTracker(maxAngle: 0.30, follow: 1);
    tracker.handleReading(0, 0, 0, 1);

    var s = _halfSin(0.20);
    tracker.handleReading(0, s, 0, _halfCos(0.20));
    expect(tracker.value.dx, closeTo(-0.20 / 0.30, 1e-9));

    tracker.handleReading(0, 0, 0, 1);
    expect(tracker.value, Offset.zero);
  });

  test('小于死区（约 0.2°）的手抖被忽略', () {
    final tracker = TiltTracker(maxAngle: 0.30, follow: 1);
    tracker.handleReading(0, 0, 0, 1);

    // 0.1° ≈ 0.0017 rad，小于死区
    final s = _halfSin(0.00085);
    tracker.handleReading(0, s, 0, _halfCos(0.00085));

    expect(tracker.value, Offset.zero);
  });

  test('占位实例永远不动，start 也不会抛', () {
    final tracker = TiltTracker.none;
    tracker.start();
    expect(tracker.value, Offset.zero);
  });
}
