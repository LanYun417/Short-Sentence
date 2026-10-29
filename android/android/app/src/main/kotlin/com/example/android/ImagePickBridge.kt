package com.example.android

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodChannel
import java.io.IOException

/**
 * 图片选择桥：系统 SAF 文件选择器（ACTION_OPEN_DOCUMENT，无需存储权限）。
 *
 * 为什么不用第三方 image_picker：项目「零新增运行时依赖」硬约束；SAF 是 API 19+
 * 的系统组件，`EXTRA_ALLOW_MULTIPLE` 可多选，够用。
 *
 * 返回 `[{name, mimeType, bytes}]`：原生侧直接读出字节经通道传回（StandardMethodCodec
 * 支持 Uint8List，截图量级几 MB 无压力），Dart 侧组 FormData 上传。
 * 单张读取失败只跳过该张，不影响其余；用户取消返回空列表。
 */
class ImagePickBridge(private val activity: Activity) : MethodChannel.MethodCallHandler {
    private var pendingResult: MethodChannel.Result? = null

    fun attach(messenger: BinaryMessenger) {
        MethodChannel(messenger, CHANNEL).setMethodCallHandler(this)
    }

    fun dispose() {
        pendingResult = null
    }

    override fun onMethodCall(call: MethodChannel.MethodCall, result: MethodChannel.Result) {
        if (call.method != "pickImages") {
            result.notImplemented()
            return
        }
        if (pendingResult != null) {
            // 上一次选择还没回来（用户没关系统选择器），避免结果串台
            result.error("busy", "已有图片选择任务进行中", null)
            return
        }
        pendingResult = result
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "image/*"
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }
        activity.startActivityForResult(intent, REQUEST_CODE)
    }

    /** Activity 的 onActivityResult 转发进来；返回 true 表示本桥已消费该事件。 */
    fun handleActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != REQUEST_CODE) {
            return false
        }
        val result = pendingResult
        pendingResult = null
        if (result == null) {
            return true
        }
        if (resultCode != Activity.RESULT_OK || data == null) {
            result.success(ArrayList<Map<String, Any>>())
            return true
        }
        val uris = ArrayList<Uri>()
        data.clipData?.let { clip ->
            for (i in 0 until clip.itemCount) {
                clip.getItemAt(i).uri?.let { uris.add(it) }
            }
        } ?: data.data?.let { uris.add(it) }

        val out = ArrayList<Map<String, Any>>()
        for (uri in uris) {
            try {
                val bytes = activity.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: continue
                val mime = activity.contentResolver.getType(uri) ?: "image/jpeg"
                out.add(
                    mapOf<String, Any>(
                        "name" to displayName(uri, mime),
                        "mimeType" to mime,
                        "bytes" to bytes,
                    ),
                )
            } catch (_: IOException) {
                // 单张读取失败就跳过，不让一张坏图毁掉整批
            }
        }
        result.success(out)
        return true
    }

    /** SAF 的 URI 只有 content://，显示名要查 ContentResolver；查不到就按 MIME 造一个。 */
    private fun displayName(uri: Uri, mime: String): String {
        var name: String? = null
        activity.contentResolver
            .query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { cursor ->
                if (cursor.moveToFirst()) {
                    name = cursor.getString(0)
                }
            }
        if (!name.isNullOrBlank()) {
            return name as String
        }
        val ext = when (mime) {
            "image/png" -> "png"
            "image/webp" -> "webp"
            "image/gif" -> "gif"
            "image/bmp" -> "bmp"
            else -> "jpg"
        }
        return "image_${System.currentTimeMillis()}.$ext"
    }

    private companion object {
        const val CHANNEL = "short_sentence/image_pick"
        const val REQUEST_CODE = 4701
    }
}
