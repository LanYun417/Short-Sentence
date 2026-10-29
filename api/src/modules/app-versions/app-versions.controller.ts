/**
 * App 版本管理控制器（/api/app-versions，管理端）。
 * 权限口径：RBAC 权限码 system:app-version:*；写操作 @OperationLog 留痕。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { CurrentUser } from '../../common/auth/auth.guard.js';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { APK_MULTER_OPTIONS } from '../../common/file/upload.config.js';
import type { AuthUserContext } from '../../common/types.js';
import { AppVersionsService } from './app-versions.service.js';
import { AppVersionStatusDto, SaveAppVersionDto } from './app-versions.dto.js';

@Controller('app-versions')
export class AppVersionsController {
  constructor(private readonly appVersions: AppVersionsService) {}

  /** 分页列表（筛选 platform / status / keyword）。 */
  @Get()
  @RequirePermissions('system:app-version:list')
  list(@Query() query: Record<string, unknown>) {
    return this.appVersions.list(query);
  }

  /**
   * 上传安装包（.apk，≤200MB）。
   *
   * 单独一个入口而不是复用 `/files/upload`：那份配置限制 10MB、白名单是"业务附件"，
   * 安装包过不去；这里只收 .apk 且上限 200MB（配 APK_MULTER_OPTIONS）。
   */
  @Post('upload')
  @RequirePermissions('system:app-version:add')
  @OperationLog('App 版本', '上传安装包')
  @UseInterceptors(FileInterceptor('file', APK_MULTER_OPTIONS))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUserContext,
  ): Promise<ResponseEnvelope<{ fileId: number; fileUrl: string; size: number }>> {
    const result = await this.appVersions.saveApk(file, user.userId);
    return { __raw: true, data: result, message: '安装包上传成功' };
  }

  /** 新增版本。 */
  @Post()
  @RequirePermissions('system:app-version:add')
  @OperationLog('App 版本', '新增')
  async create(@Body() dto: SaveAppVersionDto): Promise<ResponseEnvelope<{ id: number }>> {
    const result = await this.appVersions.create(dto);
    return { __raw: true, data: result, message: '版本已创建' };
  }

  /** 编辑版本。 */
  @Put(':id')
  @RequirePermissions('system:app-version:edit')
  @OperationLog('App 版本', '编辑')
  async update(@Param() params: IdParamDto, @Body() dto: SaveAppVersionDto): Promise<ResponseEnvelope<null>> {
    await this.appVersions.update(params.id, dto);
    return { __raw: true, data: null, message: '已保存' };
  }

  /** 上下架。 */
  @Put(':id/status')
  @RequirePermissions('system:app-version:edit')
  @OperationLog('App 版本', '上下架')
  async setStatus(@Param() params: IdParamDto, @Body() dto: AppVersionStatusDto): Promise<ResponseEnvelope<null>> {
    await this.appVersions.setStatus(params.id, dto.status);
    return { __raw: true, data: null, message: dto.status === 1 ? '已上架' : '已下架' };
  }

  /** 删除版本记录（物理安装包由「文件管理」统一清理）。 */
  @Delete(':id')
  @RequirePermissions('system:app-version:remove')
  @OperationLog('App 版本', '删除')
  async remove(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.appVersions.remove(params.id);
    return { __raw: true, data: null, message: '已删除' };
  }
}
