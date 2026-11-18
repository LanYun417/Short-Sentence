/**
 * 后台支付管理 DTO。
 */
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

/** 退款入参。 */
export class RefundPayOrderDto {
  /** 退款原因（可选；写入订单并同步给微信账单） */
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: '退款原因最多 200 字' })
  reason?: string;
}

/**
 * 支付设置入参（整表提交）。
 * 私钥支持文件路径 / 行内 PEM / `\n` 转义串；为空表示清空该项。
 */
export class SavePaySettingsDto {
  /** 微信支付 AppID */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  appId?: string;

  /** 商户号 */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  mchId?: string;

  /** 商户证书序列号 */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  serialNo?: string;

  /** 商户 API 私钥（PEM 文本或路径） */
  @IsOptional()
  @IsString()
  @Length(0, 8000)
  privateKey?: string;

  /** APIv3 密钥（32 位） */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  apiv3Key?: string;

  /** 支付回调地址 */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notifyUrl?: string;
}
