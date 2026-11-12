/**
 * 全站生图渲染风格回归：纯粹扁平 2D 动画，禁止「2D + 半写实」混合质感。
 *
 * 钉住三件事：
 * 1. 三类生图后缀（题目配图 / 闯关封面 / 每日句签）都拼了同一条 IMAGE_2D_HARD_STYLE；
 * 2. 硬约束与视觉审核器都明确堵住半写实（写实光影 / 厚涂 / 真实材质 / 伪 3D），
 *    否则这类图既不是照片也不是 3D CGI，会从旧规则里整个漏过去；
 * 3. 三套后缀不得再出现诱导写实质感的措辞，各自的配色/主题特色词与 no text 仍在。
 */
import { describe, expect, it } from 'vitest';
import { IMAGE_2D_HARD_STYLE } from '../src/common/ai/image-style.js';
import { IMAGE_REVIEW_SYSTEM_PROMPT } from '../src/common/ai/text-chat.provider.js';
import { IMAGE_STYLE_SUFFIX } from '../src/modules/sentence/sentence-gen.service.js';
import { STAGE_COVER_STYLE_SUFFIX } from '../src/modules/client/stage/stage-stories.js';
import { SENTENCE_CARD_STYLE_SUFFIX } from '../src/modules/client/sentence-card/sentence-card.service.js';

const ALL_SUFFIXES = [IMAGE_STYLE_SUFFIX, STAGE_COVER_STYLE_SUFFIX, SENTENCE_CARD_STYLE_SUFFIX];

describe('全站生图：纯粹扁平 2D 动画', () => {
  it('三套风格后缀都拼接了同一条硬约束', () => {
    for (const suffix of ALL_SUFFIXES) {
      expect(suffix).toContain(IMAGE_2D_HARD_STYLE);
    }
  });

  it('硬约束正向定义平涂赛璐璐，并显式排除半写实与写实光影', () => {
    for (const keyword of [
      'pure flat 2D animation illustration',
      'cel-shaded flat color fills',
      'crisp clean outlines',
      'NO realistic or volumetric lighting',
      'NO cinematic lighting',
      'NO realistic textures',
      'NO painterly or thick-painted rendering',
      'NO semi-realistic / semi-realism style',
      'NO 2D-with-realistic-shading hybrid look',
      'NO pseudo-3D depth',
      'NOT a photograph',
      'NOT a 3D or CGI render',
    ]) {
      expect(IMAGE_2D_HARD_STYLE).toContain(keyword);
    }
  });

  it('视觉审核器把「2D + 半写实」列为 FAIL，且给出唯一 PASS 标准', () => {
    const prompt = IMAGE_REVIEW_SYSTEM_PROMPT;
    expect(prompt).toContain('PURE FLAT 2D ANIMATION');
    expect(prompt).toContain('semi-realistic');
    expect(prompt).toContain('cinematic lighting');
    expect(prompt).toContain('PASS only flat cel-shaded 2D illustration');
  });

  it('三套后缀各自的自定义部分不再带诱导写实质感的措辞', () => {
    for (const suffix of ALL_SUFFIXES) {
      // 硬约束里本身含 "NO cinematic lighting" 这类负向排除词，需先剥离再检查
      const own = suffix.replace(IMAGE_2D_HARD_STYLE, '');
      for (const banned of [
        'cinematic lighting',
        'high detail',
        'high quality',
        'gentle gradients',
        'warm natural light',
      ]) {
        expect(own).not.toContain(banned);
      }
    }
  });

  it('三套画风各自的特色词保持不变，且都禁文字', () => {
    expect(IMAGE_STYLE_SUFFIX).toContain('flat cartoon');
    expect(STAGE_COVER_STYLE_SUFFIX).toContain('storybook');
    expect(SENTENCE_CARD_STYLE_SUFFIX).toContain('watercolor');
    for (const suffix of ALL_SUFFIXES) {
      expect(suffix).toContain('no text');
    }
  });
});
