import 'package:flutter_test/flutter_test.dart';
import 'package:short_sentence/state/gyro.dart';

void main() {
  test('摇动会积累位移，停止后回落', () {
    final gyro = GyroTilt(enabled: false);
    addTearDown(gyro.dispose);

    // 持续绕 Y 轴摇：位移应明显偏离中心
    for (var i = 0; i < 30; i++) {
      gyro.handleReading(0, 4);
    }
    expect(gyro.value.dx, greaterThan(0.2));

    final peak = gyro.value.dx;

    // 松手：速度与位移逐帧衰减，最终回中
    for (var i = 0; i < 240; i++) {
      gyro.handleReading(0, 0);
    }
    expect(gyro.value.dx, lessThan(peak));
    expect(gyro.value.dx.abs(), lessThan(0.01));
  });

  test('占位实例不订阅平台通道', () {
    final gyro = GyroTilt(enabled: false);
    addTearDown(gyro.dispose);

    // 宿主上没有平台通道；enabled=false 时 start 必须直接返回、不抛异常
    gyro.start();
    expect(gyro.value, Offset.zero);
  });
}
