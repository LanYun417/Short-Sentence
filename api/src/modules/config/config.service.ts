/**
 * 系统参数服务。
 * 模块职责：参数分页查询、CRUD、按键取值（唯一操作 SysConfig 的层）。
 *
 * 关键约定：
 * - `configKey` 即业务引用键，创建后不可修改（编辑 DTO 不含该字段）；
 * - `systemFlag=1` 的内置参数禁止删除（防止误删导致依赖方退化为默认行为），但值可改；
 * - 参数不参与鉴权缓存，变更无需清理鉴权缓存（与角色/菜单不同）。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { buildPageResult, parsePagination, readString } from '../../common/utils/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PageResult } from '../../common/types.js';
import { recordAfter, recordBefore } from '../../common/log/operation-snapshot.js';
import { AI_CONFIG_KEYS } from '../../common/ai/ai.constants.js';
import type { CreateConfigDto, UpdateConfigDto } from './dto/config.dto.js';

/**
 * 由专属页面管理的参数键，不在通用「参数管理」列表出现。
 * `ai.models` 是 AI 模型列表的 JSON 整体（后台「AI 设置」页维护），
 * 在通用列表里既看不懂也没法安全编辑，故隐藏；其余系统参数不受影响。
 */
const DEDICATED_PAGE_KEYS: readonly string[] = [AI_CONFIG_KEYS.models];

/**
 * 由专属页面管理、且**值里含密钥**的参数前缀（安全红线）。
 *
 * 为什么必须单独拦：`GET /configs/data/:configKey` 只校验登录、没有权限码，
 * 列表页也只按 `system:config:*` 授权。若不拦，任何登录后台的账号（哪怕只是个
 * 只读角色）都能按 key 读到微信支付商户私钥、APIv3 密钥与邮件 SES 密钥。
 *
 * 这些键只能通过各自专属接口读写：`/pay/settings`（pay:settings:*）、`/mail-settings`。
 */
const SECRET_CONFIG_PREFIXES: readonly string[] = ['pay.wechat.', 'mail.ses.'];

/** 是否为「专属页面 / 含密钥」参数键（命中即禁止走通用参数接口）。 */
export function isDedicatedConfigKey(configKey: string): boolean {
  return (
    DEDICATED_PAGE_KEYS.includes(configKey) || SECRET_CONFIG_PREFIXES.some((prefix) => configKey.startsWith(prefix))
  );
}

/** 通用列表的过滤条件（精确键 + 密钥前缀用 NOT 逐个排除）。 */
function buildListWhere(configName: string | undefined, configKey: string | undefined): Record<string, unknown> {
  return {
    ...(configName ? { configName: { contains: configName } } : {}),
    configKey: {
      ...(configKey ? { contains: configKey } : {}),
      notIn: [...DEDICATED_PAGE_KEYS],
    },
    AND: SECRET_CONFIG_PREFIXES.map((prefix) => ({ NOT: { configKey: { startsWith: prefix } } })),
  };
}

/** 参数（对外 DTO）。 */
export interface SysConfigBrief {
  id: number;
  configName: string;
  configKey: string;
  configValue: string;
  systemFlag: number;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 业务侧按值取数（精简）。 */
export interface ConfigData {
  configKey: string;
  configValue: string;
}

@Injectable()
export class ConfigService {
  /** 参数变更监听器（业务侧据此热更新，如定时任务按新时间重排）。 */
  private readonly changeListeners = new Set<(configKey: string) => void>();

  constructor(private readonly prisma: PrismaService) {}

  /** Prisma 参数记录 → SysConfigBrief DTO。 */
  private toSysConfigBrief(row: {
    id: bigint;
    configName: string;
    configKey: string;
    configValue: string;
    systemFlag: number;
    remark: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SysConfigBrief {
    return {
      id: Number(row.id),
      configName: row.configName,
      configKey: row.configKey,
      configValue: row.configValue,
      systemFlag: Number(row.systemFlag),
      remark: row.remark,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * 分页查询参数。
   * @param query 查询参数（page/pageSize/configName/configKey）
   */
  async listConfigs(query: Record<string, unknown>): Promise<PageResult<SysConfigBrief>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const configName = readString(query.configName);
    const configKey = readString(query.configKey);

    const rows = await this.prisma.sysConfig.findMany({
      where: buildListWhere(configName, configKey),
      orderBy: { id: 'asc' },
      skip: offset,
      take: limit,
    });
    const count = await this.prisma.sysConfig.count({
      where: buildListWhere(configName, configKey),
    });

    return buildPageResult(
      rows.map((row) => this.toSysConfigBrief(row)),
      count,
      page,
      pageSize,
    );
  }

  /** 参数详情。 */
  async getConfigDetail(id: number): Promise<SysConfigBrief> {
    const row = await this.prisma.sysConfig.findUnique({ where: { id: BigInt(id) } });
    if (!row) {
      throw AppException.notFound('参数不存在');
    }
    // 密钥类参数只能通过专属页面读取（README 的「密钥只回掩码」口径）
    if (isDedicatedConfigKey(row.configKey)) {
      throw AppException.forbidden('该参数由专属设置页管理，请从对应页面查看');
    }
    return this.toSysConfigBrief(row);
  }

  /**
   * 按键取参数值（业务取数，仅需登录）。
   * @param configKey 参数键名
   * @returns 键值对；键不存在或属于密钥类参数时返回 null（不泄露存在性）
   */
  async getConfigData(configKey: string): Promise<ConfigData | null> {
    // 安全红线：该端点只校验登录、没有权限码，绝不能返回密钥类参数
    if (isDedicatedConfigKey(configKey)) {
      return null;
    }
    const row = await this.prisma.sysConfig.findUnique({ where: { configKey } });
    if (!row) {
      return null;
    }
    return { configKey: row.configKey, configValue: row.configValue };
  }

  /**
   * 订阅参数变更（返回取消订阅函数）。
   * 监听方异常不影响参数保存：值已落库，热更新失败最多是旧值继续生效。
   */
  onConfigChanged(listener: (configKey: string) => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  /** 通知参数变更（逐个 try，避免一个监听方抛错影响其它监听方）。 */
  private emitConfigChanged(configKey: string): void {
    for (const listener of this.changeListeners) {
      try {
        listener(configKey);
      } catch {
        // 忽略：热更新失败不影响参数保存
      }
    }
  }

  /** 新增参数。 */
  async createConfig(input: CreateConfigDto): Promise<SysConfigBrief> {
    // 禁止通过通用接口创建密钥类参数（否则「隐藏」形同虚设）
    if (isDedicatedConfigKey(input.configKey)) {
      throw AppException.forbidden('该参数键由专属设置页管理，不能在此新增');
    }
    const exists = await this.prisma.sysConfig.findUnique({ where: { configKey: input.configKey } });
    if (exists) {
      throw AppException.conflict('参数键名已存在');
    }
    const row = await this.prisma.sysConfig.create({
      data: {
        configName: input.configName,
        configKey: input.configKey,
        configValue: input.configValue ?? '',
        systemFlag: 0,
        remark: input.remark || null,
      },
    });
    const brief = this.toSysConfigBrief(row);
    this.emitConfigChanged(brief.configKey);
    return brief;
  }

  /** 编辑参数（键名不可改，内置参数仅可改值与名称/备注）。 */
  async updateConfig(id: number, input: UpdateConfigDto): Promise<SysConfigBrief> {
    const existing = await this.prisma.sysConfig.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('参数不存在');
    }
    if (isDedicatedConfigKey(existing.configKey)) {
      throw AppException.forbidden('该参数由专属设置页管理，请从对应页面修改');
    }
    // 变更留痕：系统参数直接影响运行行为，改动前值必须留档
    recordBefore({
      configKey: existing.configKey,
      configName: existing.configName,
      configValue: existing.configValue,
      remark: existing.remark,
    });
    const row = await this.prisma.sysConfig.update({
      where: { id: BigInt(id) },
      data: {
        configName: input.configName,
        configValue: input.configValue ?? '',
        remark: input.remark || null,
      },
    });
    recordAfter({
      configKey: row.configKey,
      configName: row.configName,
      configValue: row.configValue,
      remark: row.remark,
    });
    // 通知业务侧热更新（如提醒时间改动后重排定时任务）
    this.emitConfigChanged(row.configKey);
    return this.toSysConfigBrief(row);
  }

  /** 删除参数（内置参数不可删除）。 */
  async deleteConfig(id: number): Promise<void> {
    const existing = await this.prisma.sysConfig.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('参数不存在');
    }
    if (Number(existing.systemFlag) === 1) {
      throw AppException.conflict('内置参数不可删除');
    }
    if (isDedicatedConfigKey(existing.configKey)) {
      throw AppException.forbidden('该参数由专属设置页管理，不能在此删除');
    }
    await this.prisma.sysConfig.delete({ where: { id: BigInt(id) } });
  }
}
