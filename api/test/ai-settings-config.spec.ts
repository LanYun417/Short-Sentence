import { describe, expect, it } from 'vitest';
import { AI_CONFIG_KEYS } from '../src/common/ai/ai.constants.js';
import { loadAiSettings } from '../src/common/ai/ai.config.js';
import { config } from '../src/common/config/config.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

/** 只实现 sysConfig.findMany 的假 Prisma（本函数只读这一张表）。 */
function fakePrisma(rows: Array<{ configKey: string; configValue: string }>): PrismaService {
  return { sysConfig: { findMany: async () => rows } } as unknown as PrismaService;
}

/**
 * AI 配置读取（DB 优先、空值回落环境变量）。
 *
 * 这条回落规则是「后台可管理」与「本地/CI 用 .env」能共存的前提：
 * 写错就会导致「后台填了 key 但线上仍用空环境变量」或「后台清空后把本地配置一起打空」。
 */
describe('loadAiSettings', () => {
  it('DB 有值时优先于环境变量', async () => {
    const settings = await loadAiSettings(
      fakePrisma([
        { configKey: AI_CONFIG_KEYS.apiKey, configValue: 'db-key' },
        { configKey: AI_CONFIG_KEYS.textModel, configValue: 'db-text-model' },
      ]),
    );
    expect(settings.apiKey).toBe('db-key');
    expect(settings.textModel).toBe('db-text-model');
  });

  it('DB 空值（含纯空白）回落环境变量，而不是变成空串', async () => {
    const settings = await loadAiSettings(
      fakePrisma([
        { configKey: AI_CONFIG_KEYS.apiKey, configValue: '   ' },
        { configKey: AI_CONFIG_KEYS.baseUrl, configValue: '' },
      ]),
    );
    expect(settings.apiKey).toBe(config.ai.agnes.apiKey);
    expect(settings.baseUrl).toBe(config.ai.agnes.baseUrl.replace(/\/+$/, ''));
  });

  it('baseUrl 去掉末尾斜杠，避免拼出 //chat/completions', async () => {
    const settings = await loadAiSettings(
      fakePrisma([{ configKey: AI_CONFIG_KEYS.baseUrl, configValue: 'https://example.com/v1///' }]),
    );
    expect(settings.baseUrl).toBe('https://example.com/v1');
  });

  it('未配置任何键时四项都取环境变量（与旧版纯 env 行为一致）', async () => {
    const settings = await loadAiSettings(fakePrisma([]));
    expect(settings.apiKey).toBe(config.ai.agnes.apiKey);
    expect(settings.textModel).toBe(config.ai.agnes.textModel);
    expect(settings.imageModel).toBe(config.ai.agnes.imageModel);
  });

  it('NIM 通道：DB 有值时优先于环境变量', async () => {
    const settings = await loadAiSettings(
      fakePrisma([
        { configKey: AI_CONFIG_KEYS.nimBaseUrl, configValue: 'https://nim.example.com/v1' },
        { configKey: AI_CONFIG_KEYS.nimModel, configValue: 'nim-model' },
      ]),
    );
    expect(settings.nimBaseUrl).toBe('https://nim.example.com/v1');
    expect(settings.nimModel).toBe('nim-model');
  });

  it('NIM 通道：DB 空值回落环境变量', async () => {
    const settings = await loadAiSettings(fakePrisma([]));
    expect(settings.nimBaseUrl).toBe(config.ai.agnes.nimBaseUrl);
    expect(settings.nimModel).toBe(config.ai.agnes.nimModel);
  });
});
