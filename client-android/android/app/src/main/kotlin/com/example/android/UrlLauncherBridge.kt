package com.example.android

import android.app.Activity
import android.content.Intent
import android.net.Uri
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * 打开外部链接桥：用系统浏览器拉起 APK 下载地址（ACTION_VIEW）。
 *
 * 为什么不用 url_launcher 这类第三方包：项目「零新增运行时依赖」硬约束，
 * 而这个桥只服务「版本更新跳下载」一个动作，系统 Intent 是 API 1 就有的能力。
 */
class UrlLauncherBridge(private val activity: Activity) : MethodChannel.MethodCallHandler {
    fun attach(messenger: BinaryMessenger) {
        MethodChannel(messenger, CHANNEL).setMethodCallHandler(this)
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        if (call.method == "open") {
            val url = call.argument<String>("url")
            if (url.isNullOrBlank()) {
                result.success(false)
                return
            }
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                activity.startActivity(intent)
                result.success(true)
            } catch (_: Exception) {
                // 无浏览器可处理该 scheme 等场景：返回 false，由 Dart 侧降级提示
                result.success(false)
            }
            return
        }
        result.notImplemented()
    }

    companion object {
        const val CHANNEL = "short_sentence/url_launcher"
    }
}
