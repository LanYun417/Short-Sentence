import { describe, expect, it } from 'vitest';
import { buildTaskRegistry, renderTaskDescription } from '../src/modules/task/task.registry.js';
import { DEFAULT_ADVANCED, resolveModel, type AiModelConfig } from '../src/common/ai/ai-protocol.js';

/**
 * 任务说明里的模型名不写死（占位符 + 运行时渲染）。
 *
 * 模型列表是可增删的，说明里写死任何模型名都会和实际跑的模型对不上；
 * 占位符在 TaskService.listTasks 返回时用当前生效的用途模型渲染。
 */
describe('buildTaskRegistry 任务说明', () => {
  const registry = buildTaskRegistry();

  it('涉及 AI 的任务说明使用占位符，不含写死的模型名', () => {
    const aiTasks = registry.filter(
      (item) => item.description.includes('{textModel}') || item.description.includes('{imageModel}'),
    );
    // sentence-gen、daily-sentence-card、chain-topic-weekly、stage-cover 四个任务都应走占位符
    expect(aiTasks.map((item) => item.name).sort()).toEqual([
      'chain-topic-weekly',
      'daily-sentence-card',
      'sentence-gen',
      'stage-cover',
    ]);
    for (const item of registry) {
      expect(item.description).not.toContain('Agnes 2.5 Flash');
    }
  });

  it('renderTaskDescription 把占位符替换为当前实际模型', () => {
    const item = registry.find((i) => i.name === 'sentence-gen');
    expect(item).toBeDefined();
    const rendered = renderTaskDescription(item!.description, {
      textModel: 'deepseek-v4-flash',
      imageModel: 'agnes-image-v1',
    });
    expect(rendered).toContain('AI 生文（deepseek-v4-flash）→ 场景配图（agnes-image-v1）');
    expect(rendered).not.toContain('{textModel}');
    expect(rendered).not.toContain('{imageModel}');
  });
});

describe('resolveModel 决定说明里的模型（按用途取第一个启用的模型）', () => {
  const model = (
    over: Partial<AiModelConfig> & { id: string; purpose: 'text' | 'image'; modelId: string },
  ): AiModelConfig => ({
    enabled: true,
    format: 'openai_chat',
    fullUrl: false,
    baseUrl: 'https://a.example/v1',
    modelLabel: '',
    apiKey: 'k',
    advanced: { ...DEFAULT_ADVANCED },
    ...over,
  });

  it('按用途分别取文本/生图模型', () => {
    const models = [
      model({ id: 't1', purpose: 'text', modelId: 'text-a' }),
      model({ id: 'i1', purpose: 'image', modelId: 'image-a' }),
    ];
    const text = resolveModel(models, 'text');
    const image = resolveModel(models, 'image');
    expect(text?.modelId).toBe('text-a');
    expect(image?.modelId).toBe('image-a');
  });

  it('禁用的模型被跳过；没有可用模型返回 null', () => {
    const models = [
      model({ id: 't1', purpose: 'text', modelId: 'text-a', enabled: false }),
      model({ id: 't2', purpose: 'text', modelId: 'text-b' }),
    ];
    expect(resolveModel(models, 'text')?.modelId).toBe('text-b');
    expect(resolveModel([], 'text')).toBeNull();
    expect(resolveModel(models, 'image')).toBeNull();
  });
});
