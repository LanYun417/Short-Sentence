/**
 * 支付二维码生成。
 *
 * 为什么在服务端生成而不是各端引库：Native 支付的 `code_url` 需要渲染成二维码，
 * Web / Android 两端各自引一个二维码库会平白增加两份前端依赖；服务端用零依赖的
 * `qr-image` 生成 PNG，转成 data URL 随下单结果返回，两端都能直接 `<img>` 渲染。
 *
 * 尺寸取舍：每模块 6px、白边 1 模块 → 约 300px 见方、3~6KB，扫码识别与流量都合适。
 */
import qrImage from 'qr-image';

/** 生成的二维码边长（模块尺寸，非像素）。 */
const QR_MODULE_SIZE = 6;

/** 白边（模块数）：至少 1，留太多会浪费弹窗空间。 */
const QR_MARGIN = 1;

/**
 * 文本 → PNG data URL（可直接作为 `<img src>`）。
 * @param text 二维码内容（Native 支付的 code_url）
 */
export function toQrDataUrl(text: string): string {
  const png = qrImage.imageSync(text, {
    type: 'png',
    size: QR_MODULE_SIZE,
    margin: QR_MARGIN,
    ec_level: 'M',
  });
  return `data:image/png;base64,${png.toString('base64')}`;
}
