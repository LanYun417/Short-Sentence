/**
 * 会员 SKU 服务。
 *
 * 职责：启动时把默认 SKU 幂等写入 `pay_sku`（**只补不更新**——运营改过价后重启不会被种子覆盖，
 * 与成就种子同一口径），并提供前台/后台读取。
 *
 * 价格是**服务端唯一定价来源**：客户端只传 `skuCode`，金额永远由这里查库得到。
 */
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppException } from '../exception/app.exception.js';

/** SKU 视图（对外输出；金额单位分）。 */
export interface PaySkuView {
  code: string;
  name: string;
  kind: string;
  price: number;
  durationDays: number;
  benefits: string[];
}

/** 默认 SKU 种子（与 docs/pay-付费功能设计.md 的定价表一致）。 */
const SKU_SEEDS: Array<{
  code: string;
  name: string;
  kind: string;
  price: number;
  durationDays: number;
  benefits: string[];
  sort: number;
}> = [
  {
    code: 'vip_month',
    name: '会员月卡',
    kind: 'vip',
    price: 1200,
    durationDays: 30,
    benefits: ['AI 私教每日 200 次（免费 50 次）', '弱项画像与深度点评', '后续新功能优先体验'],
    sort: 1,
  },
  {
    code: 'vip_year',
    name: '会员年卡',
    kind: 'vip',
    price: 6800,
    durationDays: 365,
    benefits: ['AI 私教每日 200 次（免费 50 次）', '弱项画像与深度点评', '折合每月约 5.7 元'],
    sort: 2,
  },
  {
    code: 'vip_lifetime',
    name: '终身会员',
    kind: 'vip',
    price: 12800,
    durationDays: 0,
    benefits: ['一次买断，永久有效', 'AI 私教每日 200 次', '后续所有会员功能'],
    sort: 3,
  },
];

@Injectable()
export class PaySkuService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PaySkuService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 启动时补齐默认 SKU（已存在的只补不改，不覆盖运营配置）。 */
  async onApplicationBootstrap(): Promise<void> {
    try {
      let created = 0;
      for (const seed of SKU_SEEDS) {
        const exists = await this.prisma.paySku.findUnique({ where: { code: seed.code }, select: { id: true } });
        if (exists) {
          continue;
        }
        await this.prisma.paySku.create({
          data: {
            code: seed.code,
            name: seed.name,
            kind: seed.kind,
            price: seed.price,
            durationDays: seed.durationDays,
            benefits: JSON.stringify(seed.benefits),
            sort: seed.sort,
            status: 1,
          },
        });
        created += 1;
      }
      if (created > 0) {
        this.logger.log(`会员 SKU 种子已补齐 ${created} 条`);
      }
    } catch (error) {
      // 建表迁移尚未执行等异常：只告警，不阻断启动（后台可看到「无 SKU」并按提示处理）
      this.logger.warn(`会员 SKU 种子写入失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** 上架中的 SKU 列表（客户端购买页 / 后台）。 */
  async listEnabled(): Promise<PaySkuView[]> {
    const rows = await this.prisma.paySku.findMany({
      where: { status: 1 },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.toView(row));
  }

  /** 按 code 取上架中的 SKU；不存在/已下架抛 400。 */
  async requireEnabled(code: string): Promise<PaySkuView & { id: bigint }> {
    const row = await this.prisma.paySku.findUnique({ where: { code } });
    if (!row || row.status !== 1) {
      throw AppException.badRequest('该会员套餐已下架，请刷新后重试');
    }
    return { ...this.toView(row), id: row.id };
  }

  /** 行 → 视图（benefits JSON 解析失败时降级为空数组，不影响购买）。 */
  private toView(row: {
    code: string;
    name: string;
    kind: string;
    price: number;
    durationDays: number;
    benefits: string | null;
  }): PaySkuView {
    let benefits: string[] = [];
    if (row.benefits) {
      try {
        const parsed: unknown = JSON.parse(row.benefits);
        if (Array.isArray(parsed)) {
          benefits = parsed.filter((item): item is string => typeof item === 'string');
        }
      } catch {
        benefits = [];
      }
    }
    return {
      code: row.code,
      name: row.name,
      kind: row.kind,
      price: row.price,
      durationDays: row.durationDays,
      benefits,
    };
  }
}
