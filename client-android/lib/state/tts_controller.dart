/// 文本朗读控制器：封装原生 MethodChannel。
///
/// 走设备自带的 TTS 引擎，**零新增依赖、零用量成本**（不过云、不计费、不碰服务端）。
/// 原生不支持或指定语言不可用时，按钮侧会直接隐藏，不暴露空操作。
///
/// 用全局单例而非 Riverpod Provider：句签卡在测试中直接以 `MaterialApp` 渲染、
/// 没有 `ProviderScope`，单例可同时适配真实 App 与测试，不引入额外依赖。
library;

import 'package:flutter/services.dart';

const String _ttsMethodChannel = 'short_sentence/tts';
const String _ttsEventChannel = 'short_sentence/tts_events';

/// 全局单例：原生 TTS 桥。
final TtsController ttsController = TtsController();

class TtsController {
  TtsController() : _methods = const MethodChannel(_ttsMethodChannel);

  final MethodChannel _methods;

  /// 引擎是否就绪（设备具备 TTS 且初始化成功）。
  Future<bool> get isSupported async =>
      (await _methods.invokeMethod<bool>('isSupported')) ?? false;

  /// 指定语言是否可用（如 'en-US'）。
  Future<bool> isLanguageAvailable(String lang) async =>
      (await _methods.invokeMethod<bool>('isLanguageAvailable', {'lang': lang})) ??
      false;

  /// 朗读文本；成功返回 true。
  Future<bool> speak(String text, {String lang = 'en-US'}) async {
    final ok =
        await _methods.invokeMethod<bool>('speak', {'text': text, 'lang': lang});
    return ok ?? false;
  }

  /// 停止朗读。
  Future<void> stop() async {
    await _methods.invokeMethod<void>('stop');
  }

  /// 原生回传的朗读完成事件（'done' / 'error'），用于把按钮从「停止」复位。
  Stream<String> get events =>
      EventChannel(_ttsEventChannel).receiveBroadcastStream().cast<String>();
}
