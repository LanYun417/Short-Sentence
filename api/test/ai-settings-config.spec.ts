import { describe, expect, it } from 'vitest';
import { AI_CONFIG_KEYS, LEGACY_AI_CONFIG_KEYS } from '../src/common/ai/ai.constants.js';
import { loadAiSettings } from '../src/common/ai/ai.config.js';
import { config } from '../src/common/config/config.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

/** 只实现 sysConfig.findMany 的假 Prisma（本函数只读这一张表）。 */
function fakePrisma(rows: Array<{ configKey: string; configValue: string }>): PrismaService {
  return { sysConfig: { findMany: async () => rows } } as unknown as PrismaService;
}

/**
 * AI 配置读取（模型列表：`ai.models` JSON 为事实源，老库旧键自动迁移）。
 *
 * 重点验证：迁移不能把老配置弄丢（老库里 Agarth/NIM 两套要合成模型列表），
 * 以及新格式（`ai.models`）到达时直接解析、不再走迁移。
 */
describe('loadAiSettings', () => {
  it('ai.models 存在时直接解析模型列表', async () => {
    const models = [
      { id: 'm1', purpose: 'text', baseUrl: 'https://a.example/v1', modelId: 'gpt-5', apiKey: 'k1' },
      { id: 'm2', purpose: 'image', baseUrl: 'https://a.example/v1', modelId: 'img-1', apiKey: 'k2' },
    ];
    const settings = await loadAiSettings(
      fakePrisma([{ configKey: AI_CONFIG_KEYS.models, configValue: JSON.stringify(models) }]),
    );
    expect(settings.models).toHaveLength(2);
    expect(settings.models[0].modelId).toBe('gpt-5');
    expect(settings.models[0].purpose).toBe('text');
    expect(settings.models[0].advanced.modelSeries).toBe('');
    expect(settings.models[1].purpose).toBe('image');
    // 生图用途的格式被强制为 openai_chat
    expect(settings.models[1].format).toBe('openai_chat');
    expect(settings.migrated).toBeFalsy();
  });

  it('ai.models 为空串 / 非法 JSON 时按旧配置迁移', async () => {
    const blank = await loadAiSettings(fakePrisma([{ configKey: AI_CONFIG_KEYS.models, configValue: '   ' }]));
    expect(blank.migrated).toBe(true);
    const broken = await loadAiSettings(fakePrisma([{ configKey: AI_CONFIG_KEYS.models, configValue: 'not-json' }]));
    expect(broken.migrated).toBe(true);
  });

  it('迁移：默认取 Agnes 生文模型 + 生图模型（空库回落环境变量）', async () => {
    const settings = await loadAiSettings(fakePrisma([]));
    const text = settings.models.find((m) => m.purpose === 'text');
    const image = settings.models.find((m) => m.purpose === 'image');
    expect(text?.modelId).toBe(config.ai.legacy.textModel);
    expect(text?.baseUrl).toBe(config.ai.legacy.baseUrl.replace(/\/+$/, ''));
    expect(image?.modelId).toBe(config.ai.legacy.imageModel);
    expect(text?.enabled).toBe(true);
  });

  it('迁移：genChannel=nim 且有 NIM 模型时，文本模型优先取 NIM，Agnes 置为备用（禁用）', async () => {
    const settings = await loadAiSettings(
      fakePrisma([
        { configKey: LEGACY_AI_CONFIG_KEYS.genChannel, configValue: 'nim' },
        { configKey: LEGACY_AI_CONFIG_KEYS.nimBaseUrl, configValue: 'https://nim.example.com/v1' },
        { configKey: LEGACY_AI_CONFIG_KEYS.nimModel, configValue: 'nim-model' },
        { configKey: LEGACY_AI_CONFIG_KEYS.nimApiKey, configValue: 'nim-key' },
        { configKey: LEGACY_AI_CONFIG_KEYS.textModel, configValue: 'agnes-text' },
      ]),
    );
    const texts = settings.models.filter((m) => m.purpose === 'text');
    expect(texts[0].modelId).toBe('nim-model');
    expect(texts[0].baseUrl).toBe('https://nim.example.com/v1');
    expect(texts[0].enabled).toBe(true);
    expect(texts[1].modelId).toBe('agnes-text');
    expect(texts[1].enabled).toBe(false); // 同用途第二个 = 备用，不自动启用
  });

  it('迁移：baseUrl 去掉末尾斜杠，避免拼出 //chat/completions', async () => {
    const settings = await loadAiSettings(
      fakePrisma([{ configKey: LEGACY_AI_CONFIG_KEYS.baseUrl, configValue: 'https://example.com/v1///' }]),
    );
    expect(settings.models.find((m) => m.purpose === 'text')?.baseUrl).toBe('https://example.com/v1');
  });

  it('迁移：非法 genChannel 回落 agnes（不会误启用 NIM）', async () => {
    const settings = await loadAiSettings(
      fakePrisma([
        { configKey: LEGACY_AI_CONFIG_KEYS.genChannel, configValue: 'xxx' },
        { configKey: LEGACY_AI_CONFIG_KEYS.nimModel, configValue: 'nim-model' },
      ]),
    );
    const texts = settings.models.filter((m) => m.purpose === 'text');
    expect(texts).toHaveLength(1);
    expect(texts[0].modelId).toBe(config.ai.legacy.textModel);
  });

  it('模型项脏数据被剔除 / 缺字段回落默认', async () => {
    const settings = await loadAiSettings(
      fakePrisma([
        {
          configKey: AI_CONFIG_KEYS.models,
          configValue: JSON.stringify([
            null,
            'bad',
            {
              id: 'ok',
              purpose: 'text',
              baseUrl: 'https://a/v1/',
              modelId: 'm',
              format: 'weird',
              advanced: { temperature: 0.5 },
            },
          ]),
        },
      ]),
    );
    expect(settings.models).toHaveLength(1);
    expect(settings.models[0].format).toBe('openai_chat'); // 非法格式回落
    expect(settings.models[0].baseUrl).toBe('https://a/v1'); // 末尾斜杠去掉
    expect(settings.models[0].advanced.temperature).toBe(0.5);
  });
});
