/**
 * App 版本管理服务。
 *
 * 两类消费方：
 * - 管理端：上传安装包、维护版本与更新说明、上下架、看下载量；
 * - 用户端（Web「下载 App」入口）：读最新上架版本 + 走专用下载接口。
 *
 * 下载为什么走 api 而不是 `/static` 直链：`/static` 有防盗链（Referer 白名单），
 * 用户从浏览器直接点链接（无 Referer）会被 403；专用接口还能统计下载次数。
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { buildPageResult, parsePagination, readNumber, readString } from '../../common/utils/utils.js';
import { resolveStoredPath } from '../../common/file/storage-layout.js';
import { FileService } from '../../common/file/file.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PageResult } from '../../common/types.js';
import type { SaveAppVersionDto } from './app-versions.dto.js';

/** 管理端列表项。 */
export interface AppVersionItem {
  id: number;
  platform: string;
  version: string;
  versionCode: number;
  fileId: number;
  /** 安装包下载地址（相对 /static；后台预览/复制用） */
  fileUrl: string | null;
  /** 原始文件名 */
  fileName: string | null;
  fileSize: number;
  changelog: string;
  forceUpdate: boolean;
  status: number;
  downloadCount: number;
  publishedAt: string;
  createdAt: string;
}

/** 用户端「最新版本」下发结构（不含后台字段）。 */
export interface LatestAppVersion {
  id: number;
  version: string;
  versionCode: number;
  fileSize: number;
  changelog: string;
  forceUpdate: boolean;
  publishedAt: string;
}

@Injectable()
export class AppVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  /** 管理端分页列表（筛选 platform / status / keyword）。 */
  async list(query: Record<string, unknown>): Promise<PageResult<AppVersionItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const platform = readString(query.platform);
    const keyword = readString(query.keyword);
    const status = readNumber(query.status);

    const where = {
      ...(platform ? { platform } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(keyword ? { OR: [{ version: { contains: keyword } }, { changelog: { contains: keyword } }] } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.appVersion.findMany({
        where,
        // 版本号大的在前：运营最关心最新包
        orderBy: [{ versionCode: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.appVersion.count({ where }),
    ]);

    // 文件信息按 fileId 批量取（不建外键，避免删文件被引用卡住）
    const fileIds = [...new Set(rows.map((row) => row.fileId))];
    const files = fileIds.length
      ? await this.prisma.file.findMany({
          where: { id: { in: fileIds } },
          select: { id: true, fileUrl: true, originName: true },
        })
      : [];
    const fileMap = new Map(files.map((file) => [Number(file.id), file]));

    return buildPageResult(
      rows.map((row) => {
        const file = fileMap.get(Number(row.fileId));
        return {
          id: Number(row.id),
          platform: row.platform,
          version: row.version,
          versionCode: row.versionCode,
          fileId: Number(row.fileId),
          fileUrl: file?.fileUrl ?? null,
          fileName: file?.originName ?? null,
          fileSize: Number(row.fileSize),
          changelog: row.changelog,
          forceUpdate: row.forceUpdate === 1,
          status: row.status,
          downloadCount: row.downloadCount,
          publishedAt: row.publishedAt.toISOString(),
          createdAt: row.createdAt.toISOString(),
        };
      }),
      total,
      page,
      pageSize,
    );
  }

  /** 新增版本（版本名唯一，重复即 409）。 */
  async create(dto: SaveAppVersionDto): Promise<{ id: number }> {
    const platform = dto.platform ?? 'android';
    const version = dto.version.trim();
    const duplicate = await this.prisma.appVersion.findUnique({
      where: { platform_version: { platform, version } },
      select: { id: true },
    });
    if (duplicate) {
      throw AppException.conflict(`版本 ${version} 已存在`);
    }
    // 文件必须真实存在，否则下载时才发现「包丢了」
    const file = await this.prisma.file.findUnique({ where: { id: BigInt(dto.fileId) }, select: { size: true } });
    if (!file) {
      throw AppException.badRequest('安装包文件不存在，请重新上传');
    }
    const row = await this.prisma.appVersion.create({
      data: {
        platform,
        version,
        versionCode: dto.versionCode,
        fileId: BigInt(dto.fileId),
        fileSize: BigInt(dto.fileSize ?? Number(file.size)),
        changelog: (dto.changelog ?? '').trim().slice(0, 1000),
        forceUpdate: dto.forceUpdate ?? 0,
        status: dto.status ?? 1,
      },
      select: { id: true },
    });
    return { id: Number(row.id) };
  }

  /** 编辑版本（platform 不允许改；version 可改但要保证同平台唯一）。 */
  async update(id: number, dto: SaveAppVersionDto): Promise<void> {
    const existing = await this.prisma.appVersion.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, platform: true },
    });
    if (!existing) {
      throw AppException.notFound('版本不存在');
    }
    const version = dto.version.trim();
    // 唯一键冲突若留给数据库，报的是 500 —— 这里提前给出可读的 409
    const duplicate = await this.prisma.appVersion.findFirst({
      where: { platform: existing.platform, version, id: { not: existing.id } },
      select: { id: true },
    });
    if (duplicate) {
      throw AppException.conflict(`版本 ${version} 已存在`);
    }
    const file = await this.prisma.file.findUnique({ where: { id: BigInt(dto.fileId) }, select: { size: true } });
    if (!file) {
      throw AppException.badRequest('安装包文件不存在，请重新上传');
    }
    await this.prisma.appVersion.update({
      where: { id: existing.id },
      data: {
        version: dto.version.trim(),
        versionCode: dto.versionCode,
        fileId: BigInt(dto.fileId),
        fileSize: BigInt(dto.fileSize ?? Number(file.size)),
        changelog: (dto.changelog ?? '').trim().slice(0, 1000),
        forceUpdate: dto.forceUpdate ?? 0,
        status: dto.status ?? undefined,
      },
    });
  }

  /** 上下架。 */
  async setStatus(id: number, status: number): Promise<void> {
    const existing = await this.prisma.appVersion.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!existing) {
      throw AppException.notFound('版本不存在');
    }
    await this.prisma.appVersion.update({ where: { id: existing.id }, data: { status } });
  }

  /**
   * 删除版本记录。
   *
   * 只删记录、不删物理安装包：文件由「文件管理」统一管理（同一条 file 可能被多处引用）。
   * 真要省磁盘去文件管理删——那里有引用计数保护。
   */
  async remove(id: number): Promise<void> {
    const existing = await this.prisma.appVersion.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!existing) {
      throw AppException.notFound('版本不存在');
    }
    await this.prisma.appVersion.delete({ where: { id: existing.id } });
  }

  /** 用户端：最新上架版本（无则 null，前端显示「暂未发布」）。 */
  async latest(platform = 'android'): Promise<LatestAppVersion | null> {
    const row = await this.prisma.appVersion.findFirst({
      where: { platform, status: 1 },
      orderBy: [{ versionCode: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        version: true,
        versionCode: true,
        fileSize: true,
        changelog: true,
        forceUpdate: true,
        publishedAt: true,
      },
    });
    if (!row) {
      return null;
    }
    return {
      id: Number(row.id),
      version: row.version,
      versionCode: row.versionCode,
      fileSize: Number(row.fileSize),
      changelog: row.changelog,
      forceUpdate: row.forceUpdate === 1,
      publishedAt: row.publishedAt.toISOString(),
    };
  }

  /**
   * 取安装包做下载（不存在 / 已下架 / 文件丢失都抛 404）。
   * 下载计数在这里累加——调用方只在真正开始传输后调用，避免「预览页」也计数。
   */
  async getApkForDownload(id: number): Promise<{ absolutePath: string; downloadName: string }> {
    const row = await this.prisma.appVersion.findFirst({
      where: { id: BigInt(id), status: 1 },
      select: { version: true, fileId: true },
    });
    if (!row) {
      throw AppException.notFound('安装包不存在或已下架');
    }
    const file = await this.prisma.file.findUnique({
      where: { id: row.fileId },
      select: { fileName: true },
    });
    if (!file) {
      throw AppException.notFound('安装包文件记录缺失');
    }
    const absolutePath = resolveStoredPath(file.fileName);
    if (absolutePath === null || !existsSync(absolutePath)) {
      throw AppException.notFound('安装包文件已丢失，请联系管理员重新上传');
    }
    // 计数失败不影响下载（统计是附加价值，不能挡住用户拿包）
    await this.prisma.appVersion
      .update({ where: { id: BigInt(id) }, data: { downloadCount: { increment: 1 } } })
      .catch(() => undefined);
    // 下载文件名固定成「产品名-版本.apk」，中文名在部分浏览器会乱码，这里全英文
    return { absolutePath, downloadName: `short-sentence-${row.version}.apk` };
  }

  /**
   * 上传安装包：交给全局 FileService（哈希秒传 + 统一落盘）。
   * MIME 强制归一为 apk 标准值——浏览器对 .apk 常报 `application/octet-stream`，
   * 直接透传会被白名单拒掉（扩展名已在 multer 层限定为 .apk）。
   */
  async saveApk(
    file: Express.Multer.File,
    uploaderId: number,
  ): Promise<{ fileId: number; fileUrl: string; size: number }> {
    const saved = await this.fileService.save(
      path.basename(file.originalname),
      'application/vnd.android.package-archive',
      file.buffer,
      uploaderId,
    );
    return { fileId: saved.file.id, fileUrl: saved.file.fileUrl, size: saved.file.size };
  }
}
