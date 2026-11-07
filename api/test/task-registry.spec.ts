import { describe, expect, it } from 'vitest';
import { buildTaskRegistry, renderTaskDescription } from '../src/modules/task/task.registry.js';
import { resolveTextChannel, type AiSettings } from '../src/common/ai/ai.config.js';

/**
 * 任务说明里的模型名不写死（占位符 + 运行时渲染）。
 *
 * 后台把生题通道切到英伟达 NIM 后，文本模型就变了；若说明里写死 "Agnes 2.5 Flash"，
 * 运维在定时任务页看到的说明会和实际跑的模型对不上。
 */
describe('buildTaskRegistry 任务说明', () => {
  const registry = buildTaskRegistry();

  it('涉及 AI 的任务说明使用占位符，不含写死的模型名', () => {
    const aiTasks = registry.filter(
      (item) => item.description.includes('{textModel}') || item.description.includes('{imageModel}'),
    );
    // sentence-gen 与 daily-sentence-card 两个任务都应走占位符
    expect(aiTasks.map((item) => item.name).sort()).toEqual(['daily-sentence-card', 'sentence-gen']);
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

describe('resolveTextChannel 决定说明里的文本模型', () => {
  const base: AiSettings = {
    apiKey: 'k',
    baseUrl: 'https://agnes.example.com/v1',
    textModel: 'agnes-2.5-flash',
    imageModel: 'agnes-image-v1',
    nimBaseUrl: 'https://integrate.api.nvidia.com/v1',
    nimApiKey: 'nv-key',
    nimModel: 'deepseek-v4-flash',
    genChannel: 'agnes',
  };

  it('默认 Agnes 通道时文本模型为 textModel', () => {
    const channel = resolveTextChannel(base);
    expect(channel.model).toBe('agnes-2.5-flash');
    expect(channel.channel).toBe('agnes');
  });

  it('切到 NIM 通道时文本模型为 nimModel', () => {
    const channel = resolveTextChannel({ ...base, genChannel: 'nim' });
    expect(channel.model).toBe('deepseek-v4-flash');
    expect(channel.channel).toBe('nim');
  });
});
