package com.example.android

import android.content.Intent
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
        // 反馈截图选择：系统 SAF 文件选择器桥（零新增依赖）
        imagePickBridge = ImagePickBridge(this)
        imagePickBridge?.attach(flutterEngine.dartExecutor.binaryMessenger)
        // 句签海报分享：系统分享 / 存相册桥（零新增依赖）
        shareBridge = ShareBridge(this)
        shareBridge?.attach(flutterEngine.dartExecutor.binaryMessenger)
        // 版本更新跳下载：系统浏览器桥（零新增依赖）
        urlLauncherBridge = UrlLauncherBridge(this)
        urlLauncherBridge?.attach(flutterEngine.dartExecutor.binaryMessenger)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        // 图片选择结果由 ImagePickBridge 消费（返回 true = 已处理）
        if (imagePickBridge?.handleActivityResult(requestCode, resultCode, data) == true) {
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onDestroy() {
        // Activity 销毁后 FlutterJNI 已 detach：继续上报传感器事件只会刷
        // "Could not send ... FlutterJNI was detached" 并白耗电，必须主动注销。
        tiltHandler?.dispose()
        gyroHandler?.dispose()
        ttsBridge?.dispose()
        imagePickBridge?.dispose()
        shareBridge?.dispose()
        urlLauncherBridge = null
        super.onDestroy()
    }

    private companion object {
        const val TILT_CHANNEL = "short_sentence/tilt"
        const val GYRO_CHANNEL = "short_sentence/gyro"
    }

    private var ttsBridge: TtsBridge? = null
    private var tiltHandler: TiltStreamHandler? = null
    private var gyroHandler: GyroStreamHandler? = null
    private var imagePickBridge: ImagePickBridge? = null
    private var shareBridge: ShareBridge? = null
    private var urlLauncherBridge: UrlLauncherBridge? = null
}

