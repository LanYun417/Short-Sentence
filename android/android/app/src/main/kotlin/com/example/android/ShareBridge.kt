package com.example.android

import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.core.content.FileProvider
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.File

/**
 * 句签海报分享桥：把 Flutter 截好的 PNG 字节交给系统。
 *
 * 为什么不用第三方 share 包：项目「零新增运行时依赖」硬约束。系统分享
 * （ACTION_SEND + FileProvider 的 content:// URI）是 API 1 就有的能力，
 * 自己接原生更可控，也避免再引一个包。
 *
 * 两个动作：
 * - `shareImage`：写进 cacheDir，经 FileProvider 拿到受临时读权限保护的 URI，
 *   调起系统选择器（用户可挑微信 / 相册 / 任意 App，含「保存到相册」）。
 * - `saveImage`：经 MediaStore 落进 Pictures/ShortSentence（API 29+ 的
 *   分区存储不需要权限；旧系统需要 WRITE_EXTERNAL_STORAGE，我们没有，失败就返回 false，
 *   由 Dart 侧降级为「改用分享」）。
 */
class ShareBridge(private val activity: Activity) : MethodChannel.MethodCallHandler {
    private var pendingResult: MethodChannel.Result? = null

    fun attach(messenger: BinaryMessenger) {
        MethodChannel(messenger, CHANNEL).setMethodCallHandler(this)
    }

    fun dispose() {
        pendingResult = null
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "shareImage" -> {
                val bytes = call.argument<ByteArray>("bytes")
                val fileName = call.argument<String>("fileName") ?: "short-sentence.png"
                if (bytes == null) {
                    result.error("bad_args", "bytes 缺失", null)
                    return
                }
                try {
                    val uri = writeCacheFile(bytes, fileName)
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "image/png"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    activity.startActivity(Intent.createChooser(intent, "分享句签"))
                    result.success(null)
                } catch (e: Exception) {
                    result.error("share_failed", e.message ?: "unknown", null)
                }
            }
            "saveImage" -> {
                val bytes = call.argument<ByteArray>("bytes")
                val fileName = call.argument<String>("fileName") ?: "short-sentence.png"
                if (bytes == null) {
                    result.error("bad_args", "bytes 缺失", null)
                    return
                }
                try {
                    val ok = saveToGallery(bytes, fileName)
                    result.success(ok)
                } catch (e: Exception) {
                    result.error("save_failed", e.message ?: "unknown", null)
                }
            }
            else -> result.notImplemented()
        }
    }

    /** 写进 cacheDir 并拿到 FileProvider 的 content:// URI（分享用，不会被相册污染）。 */
    private fun writeCacheFile(bytes: ByteArray, fileName: String): Uri {
        val file = File(activity.cacheDir, fileName)
        file.writeBytes(bytes)
        return FileProvider.getUriForFile(
            activity,
            "${activity.packageName}.fileprovider",
            file,
        )
    }

    /** 经 MediaStore 落进 Pictures/ShortSentence，返回是否成功。 */
    private fun saveToGallery(bytes: ByteArray, fileName: String): Boolean {
        val resolver = activity.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, fileName)
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/ShortSentence")
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
        }
        val collection =
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val uri: Uri = resolver.insert(collection, values) ?: return false
        try {
            resolver.openOutputStream(uri)?.use { it.write(bytes) }
        } catch (_: Exception) {
            resolver.delete(uri, null, null)
            return false
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.clear()
            values.put(MediaStore.Images.Media.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
        }
        return true
    }

    private companion object {
        const val CHANNEL = "short_sentence/share"
    }
}
