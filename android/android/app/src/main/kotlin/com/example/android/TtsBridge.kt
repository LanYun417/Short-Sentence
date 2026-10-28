package com.example.android

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.util.Locale

/**
 * 文本朗读桥：把 Flutter 侧的朗读请求转到 **Android SDK 自带的 TextToSpeech**。
 *
 * 为什么不用第三方插件：项目对安卓端有「零新增运行时依赖」硬约束，而 `TextToSpeech`
 * 是框架类，不算第三方包——同时满足「零依赖」与「零用量成本」（设备本地合成，不过云、不计费）。
 *
 * 通道：
 * - MethodChannel `short_sentence/tts`：isSupported / isLanguageAvailable / speak / stop
 * - EventChannel `short_sentence/tts_events`：朗读完成的 'done' / 'error'，供 Dart 复位按钮
 */
class TtsBridge(flutterEngine: FlutterEngine, context: Context) : MethodChannel.MethodCallHandler {

    companion object {
        const val METHOD_CHANNEL = "short_sentence/tts"
        const val EVENT_CHANNEL = "short_sentence/tts_events"
        private const val UTTERANCE_ID = "ss-utterance"
    }

    private val methodChannel: MethodChannel =
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, METHOD_CHANNEL)
    private val eventChannel: EventChannel =
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, EVENT_CHANNEL)

    private var tts: TextToSpeech? = null
    private var ready = false
    private var eventSink: EventChannel.EventSink? = null

    init {
        methodChannel.setMethodCallHandler(this)
        eventChannel.setStreamHandler(
            object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    eventSink = events
                }

                override fun onCancel(arguments: Any?) {
                    eventSink = null
                }
            },
        )

        // 引擎初始化是异步的：onInit 回调里才能确定是否可用
        tts = TextToSpeech(context.applicationContext) { status ->
            ready = status == TextToSpeech.SUCCESS
            if (ready) {
                // 本项目朗读对象是英文短句，预载美式英语嗓音
                tts?.setLanguage(Locale.US)
            }
        }
        tts?.setOnUtteranceProgressListener(
            object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) = Unit

                override fun onDone(utteranceId: String?) {
                    eventSink?.success("done")
                }

                @Suppress("DEPRECATION")
                override fun onError(utteranceId: String?) {
                    eventSink?.success("error")
                }
            },
        )
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "isSupported" -> result.success(tts != null && ready)
            "isLanguageAvailable" -> {
                val lang = call.argument<String>("lang") ?: "en-US"
                result.success(isLanguageAvailable(lang))
            }
            "speak" -> {
                val text = call.argument<String>("text") ?: ""
                val lang = call.argument<String>("lang") ?: "en-US"
                result.success(speak(text, lang))
            }
            "stop" -> {
                tts?.stop()
                result.success(null)
            }
            else -> result.notImplemented()
        }
    }

    private fun isLanguageAvailable(lang: String): Boolean {
        val engine = tts ?: return false
        if (!ready) return false
        val code = engine.isLanguageAvailable(parseLocale(lang))
        // 只有「数据缺失 / 不支持」两种负值是真不可用；其余（语言可用 / 国家可用 / 变体可用）都算可用
        return code != TextToSpeech.LANG_MISSING_DATA && code != TextToSpeech.LANG_NOT_SUPPORTED
    }

    private fun speak(text: String, lang: String): Boolean {
        val engine = tts ?: return false
        if (!ready) return false
        engine.language = parseLocale(lang)
        val code = engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, UTTERANCE_ID)
        return code == TextToSpeech.SUCCESS
    }

    private fun parseLocale(lang: String): Locale {
        val parts = lang.split("-")
        return if (parts.size >= 2) Locale(parts[0], parts[1]) else Locale(parts[0])
    }

    fun dispose() {
        methodChannel.setMethodCallHandler(null)
        tts?.setOnUtteranceProgressListener(null)
        tts?.shutdown()
        tts = null
        ready = false
        eventSink = null
    }
}
