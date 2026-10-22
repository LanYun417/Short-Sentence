/**
 * 客户端用户查询服务。
 * 模块职责：按 id / 邮箱查询 client_user（与后台 AuthUserService 对应的客户端版本），
 * 供全局鉴权守卫的 client 分支与客户端登录注册使用。
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/** 守卫用的客户端用户摘要（只含鉴权判定必需字段）。 */
export interface ClientAuthSummary {
  userId: number;
  email: string;
  nickname: string;
  status: number;
  /** 密码最后修改时间（改密后旧 Token 失效判定） */
  passwordChangedAt: Date | null;
}

@Injectable()
export class ClientAuthService {
  constructor(private readonly prisma: PrismaService) {}

  /** 按 id 查客户端用户（守卫调用；status 由守卫统一判定）。 */
  async loadClientUser(userId: number): Promise<ClientAuthSummary | null> {
    const row = await this.prisma.clientUser.findUnique({
      where: { id: BigInt(userId) },
      select: {
        id: true,
        email: true,
        nickname: true,
        status: true,
        passwordChangedAt: true,
      },
    });
    if (!row) {
      return null;
    }
    return {
      userId: Number(row.id),
      email: row.email,
      nickname: row.nickname,
      status: row.status,
      passwordChangedAt: row.passwordChangedAt,
    };
  }

  /** 按邮箱查客户端用户（登录/注册查重；不含口令字段由调用方按需 select）。 */
  async findByEmail(
    email: string,
  ): Promise<{ id: bigint; email: string; password: string; nickname: string; status: number } | null> {
    return this.prisma.clientUser.findUnique({
      where: { email },
      select: { id: true, email: true, password: true, nickname: true, status: true },
    });
  }
}
