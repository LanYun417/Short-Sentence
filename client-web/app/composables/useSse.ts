/**
 * SSE 流式消费（fetch + ReadableStream，不用 EventSource——需要 POST 与 Authorization 头）。
 *
 * 用法：
 *   const { abort } = await streamSse('/client/ai/expand', { chinese }, {
 *     onChunk: (text) => { output.value += text },
 *     onDone: () => { done.value = true },
 *     onError: (msg) => { error.value = msg },
 *   })
 *
 * 客户端断开（组件卸载/点击停止）必须调用 abort()，服务端随即中止上游请求。
 */
import { getToken } from '~/composables/useApi';

/** 流式回调。 */
export interface SseHandlers {
  onChunk?: (text: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

/**
 * 从非 2xx 响应里取服务端错误文案（统一响应体 `{ code, message }`）。
 * 读不到/解析失败时回退到兜底文案。
 */
async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const text = await response.text();
    if (!text) {
      return fallback;
    }
    const parsed = JSON.parse(text) as { message?: unknown };
    return typeof parsed.message === 'string' && parsed.message ? parsed.message : fallback;
  } catch {
    return fallback;
  }
}

/**
 * 发起 SSE 请求并逐段解析。
 * @param path 接口路径（如 `/client/ai/expand`）
 * @param body 请求体
 * @param handlers 回调
 * @returns abort 函数（终止连接）
 */
export async function streamSse(path: string, body: unknown, handlers: SseHandlers): Promise<{ abort: () => void }> {
  const config = useRuntimeConfig();
  const controller = new AbortController();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  void (async () => {
    try {
      const response = await fetch(`${config.public.apiBaseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        // 非流式错误（如 429 额度用完）：读服务端 message 透出。
        // 原来这里一律报「AI 服务暂时不可用」，用户看到的是服务挂了而不是额度用完。
        handlers.onError?.(await readErrorMessage(response, 'AI 服务暂时不可用，请稍后重试'));
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        // SSE 分帧：空行分隔；最后一段可能是半包
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const raw of events) {
          const lines = raw.split('\n');
          let eventName = 'message';
          /** 同一帧的 data 行（SSE 规范：多行以 \n 连接，用于承载带换行的内容）。 */
          const dataLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              // 不能 trim！流式 token 常以空格开头（如 " afternoon"、" Want"），
              // trim 会把词间空格吃掉，导致整句单词粘连（英文句子、IPA 都会中招）。
              // 按 SSE 规范只去掉冒号后的「单个」分隔空格：服务端写的是 `data: <内容>`，
              // 这个空格是分隔符，内容自身的首空格必须保留。
              const value = line.slice(5);
              dataLines.push(value.startsWith(' ') ? value.slice(1) : value);
            }
          }
          // SSE 规范：多条 data 行以 \n 连接（AI 解析是分点多行文本，逐行前缀、逐字还原）。
          // 单行 payload 时数组只有一个元素，行为与旧的直接拼接完全一致。
          const data = dataLines.join('\n');
          if (eventName === 'done') {
            handlers.onDone?.();
            return;
          }
          if (eventName === 'error') {
            handlers.onError?.(data || 'AI 服务暂时不可用');
            return;
          }
          if (data && eventName === 'message') {
            handlers.onChunk?.(data);
          }
        }
      }
      handlers.onDone?.();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      handlers.onError?.('AI 服务暂时不可用，请稍后重试');
    }
  })();

  return { abort: () => controller.abort() };
}
