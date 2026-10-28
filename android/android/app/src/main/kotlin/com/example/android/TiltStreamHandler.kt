package com.example.android

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import io.flutter.plugin.common.EventChannel

/**
 * 设备姿态流：把旋转矢量（四元数）原样送到 Dart。
 *
 * 为什么不用加速度计：加速度计只能感知「重力方向」，手机像转方向盘那样左右转时
 * 重力在设备坐标系里完全不变，读数是死的；而这些转法恰恰是看卡片最自然的动作。
 *
 * 这里**不做任何加工**（不变换、不过滤、不取欧拉角）：欧拉角在俯仰 ±90° 处奇异，
 * 而人举着手机看屏幕时俯仰角正在 -90° 附近，偏航与滚转会被耦合在一起，卡片会乱跳。
 * 相对姿态与轴角全在 Dart 侧算（`state/tilt.dart`），那边是纯函数、能跑单测。
 *
 * 选 GAME_ROTATION_VECTOR 而不是 ROTATION_VECTOR：前者不依赖磁力计，
 * 在没有磁力计的设备上也能用，也不会被桌上的磁铁/金属带跑。
 */
class TiltStreamHandler(context: Context) :
    EventChannel.StreamHandler,
    SensorEventListener {

    private val sensorManager =
        context.applicationContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager

    private val sensor: Sensor? =
        sensorManager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
            ?: sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)

    private var sink: EventChannel.EventSink? = null

    override fun onListen(arguments: Any?, events: EventChannel.EventSink) {
        val target = sensor
        if (target == null) {
            // 没有姿态传感器：直接告终，Dart 侧会保持卡片静止（不是错误态）
            events.error("no_sensor", "设备没有姿态传感器", null)
            return
        }
        sink = events
        sensorManager.registerListener(this, target, SensorManager.SENSOR_DELAY_GAME)
    }

    override fun onCancel(arguments: Any?) {
        sensorManager.unregisterListener(this)
        sink = null
    }

    override fun onSensorChanged(event: SensorEvent) {
        val out = sink ?: return
        val v = event.values
        // 旋转矢量传感器给 3 个（向量）或 4 个（四元数 + 精度）；只要四元数
        if (v.size < 4) {
            return
        }
        out.success(
            mapOf(
                "x" to v[0].toDouble(),
                "y" to v[1].toDouble(),
                "z" to v[2].toDouble(),
                "w" to v[3].toDouble(),
            ),
        )
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    fun dispose() {
        sensorManager.unregisterListener(this)
        sink = null
    }
}
