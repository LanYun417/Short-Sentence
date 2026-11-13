/**
 * 站点公开配置（备案号）链路（e2e）：/api/client/site。
 *
 * 覆盖点：
 * - 游客（无 token）可访问，返回 { icp, policeIcp }；
 * - 后台参数管理里的 site.icp / site.policeIcp 改值后，公开接口实时反映（页脚据此展示）；
 * - 值置空则返回空串（前端据此不渲染）。
 *
 * 幂等：测试直接改 sys_config 表再还原为空串。
 * 前置条件：本地 MySQL 与 Redis 可用，且已 db push + seed（种子含 site.icp / site.policeIcp）。
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './setup-app.js';

const API = '/api';

describe('站点公开配置 /api/client/site (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // 还原为空串（幂等）
    await prisma.sysConfig.updateMany({
      where: { configKey: { in: ['site.icp', 'site.policeIcp'] } },
      data: { configValue: '' },
    });
    await app.close();
  });

  it('游客可访问，返回备案号字段（默认空串）', async () => {
    const res = await request(app.getHttpServer()).get(`${API}/client/site`).expect(200);
    const data = res.body.data as { icp: string; policeIcp: string };
    expect(typeof data.icp).toBe('string');
    expect(typeof data.policeIcp).toBe('string');
  });

  it('后台改 site.icp / site.policeIcp 后公开接口实时反映', async () => {
    await prisma.sysConfig.update({ where: { configKey: 'site.icp' }, data: { configValue: '京ICP备E2E0001号' } });
    await prisma.sysConfig.update({
      where: { configKey: 'site.policeIcp' },
      data: { configValue: '京公网安备E2E0001号' },
    });

    const res = await request(app.getHttpServer()).get(`${API}/client/site`).expect(200);
    const data = res.body.data as { icp: string; policeIcp: string };
    expect(data.icp).toBe('京ICP备E2E0001号');
    expect(data.policeIcp).toBe('京公网安备E2E0001号');
  });

  it('置空后返回空串（前端不渲染）', async () => {
    await prisma.sysConfig.update({ where: { configKey: 'site.icp' }, data: { configValue: '' } });
    const res = await request(app.getHttpServer()).get(`${API}/client/site`).expect(200);
    expect((res.body.data as { icp: string }).icp).toBe('');
  });
});
