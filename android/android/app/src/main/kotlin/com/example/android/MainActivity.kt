package com.example.android

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // 设备姿态 → 卡片 3D 视差（句签闪卡用；没有传感器时返回错误，卡片保持静止）
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, TILT_CHANNEL)
            .setStreamHandler(TiltStreamHandler(this))
        // 文本朗读：原生 TextToSpeech 桥（零新增依赖）
        ttsBridge = TtsBridge(flutterEngine, this)
    }

    private companion object {
        const val TILT_CHANNEL = "short_sentence/tilt"
    }

    private var ttsBridge: TtsBridge? = null
}
