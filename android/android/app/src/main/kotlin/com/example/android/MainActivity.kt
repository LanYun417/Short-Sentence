package com.example.android

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // 设备姿态 → 卡片 3D 视差（句签闪卡用；没有传感器时返回错误，卡片保持静止）
        tiltHandler = TiltStreamHandler(this)
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, TILT_CHANNEL)
            .setStreamHandler(tiltHandler)
        // 陀螺仪角速度 → 液态流体背景的摇动响应（没有陀螺仪时返回错误，背景保持静止）
        gyroHandler = GyroStreamHandler(this)
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, GYRO_CHANNEL)
            .setStreamHandler(gyroHandler)
        // 文本朗读：原生 TextToSpeech 桥（零新增依赖）
        ttsBridge = TtsBridge(flutterEngine, this)
    }

    override fun onDestroy() {
        // Activity 销毁后 FlutterJNI 已 detach：继续上报传感器事件只会刷
        // "Could not send ... FlutterJNI was detached" 并白耗电，必须主动注销。
        tiltHandler?.dispose()
        gyroHandler?.dispose()
        ttsBridge?.dispose()
        super.onDestroy()
    }

    private companion object {
        const val TILT_CHANNEL = "short_sentence/tilt"
        const val GYRO_CHANNEL = "short_sentence/gyro"
    }

    private var ttsBridge: TtsBridge? = null
    private var tiltHandler: TiltStreamHandler? = null
    private var gyroHandler: GyroStreamHandler? = null
}
