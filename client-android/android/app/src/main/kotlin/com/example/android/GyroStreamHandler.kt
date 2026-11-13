package com.example.android

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import io.flutter.plugin.common.EventChannel

/**
 * 陀螺仪角速度桥：给「液态流体」背景提供摇动输入。
 *
 * 与 [TiltStreamHandler] 的区别：后者输出**姿态四元数**（卡片视差用，关心朝向），
 * 这里输出**角速度**（rad/s，关心"摇得多快"），Dart 侧积分成带惯性的位移。
 * 陀螺仪不需要任何权限，也不产生费用。
 *
 * 通道：`short_sentence/gyro`，事件为 `[x, y, z]`（绕设备三轴的角速度）。
 */
class GyroStreamHandler(context: Context) :
    EventChannel.StreamHandler,
    SensorEventListener {

    private val sensorManager =
        context.applicationContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager

    private val sensor: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

    private var sink: EventChannel.EventSink? = null

    override fun onListen(arguments: Any?, events: EventChannel.EventSink) {
        val target = sensor
        if (target == null) {
            // 没有陀螺仪：直接告终，Dart 侧保持静止（不是错误态）
            events.error("no_sensor", "设备没有陀螺仪", null)
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
        if (v.size < 3) {
            return
        }
        out.success(
            listOf(v[0].toDouble(), v[1].toDouble(), v[2].toDouble()),
        )
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    fun dispose() {
        sensorManager.unregisterListener(this)
        sink = null
    }
}
