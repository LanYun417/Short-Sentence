/**
 * 客户端用户重置密码 DTO 单测。
 *
 * 回归点（2026-10-28 线上反馈）：`ClientUserResetPasswordDto` 曾把字符串长度
 * 校验写成数值装饰器 `@Min(6)` / `@Max(32)`，class-validator 拿字符串做 `>= 6`
 * 比较会得到 NaN，于是「不能少于 6 位」与「不能超过 32 位」**同时**报出，
 * 任何密码都重置不了。这里钉住三点：
 * 1. 合法密码必须零错误；
 * 2. 长度不合法只报一条（且是策略文案），不能再出现两条互相矛盾的长度提示；
 * 3. 复杂度（字母 + 数字）仍生效。
 */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_LENGTH_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../src/common/auth/password-policy.js';
import { ClientUserResetPasswordDto } from '../src/modules/client-users/dto.js';

/** 跑一遍 DTO 校验，返回全部约束消息。 */
async function messagesOf(newPassword: unknown): Promise<string[]> {
  const dto = plainToInstance(ClientUserResetPasswordDto, { newPassword });
  const errors = await validate(dto);
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('ClientUserResetPasswordDto', () => {
  it('截图里的密码 Abc123987 必须通过（不再误报长度）', async () => {
    expect(await messagesOf('Abc123987')).toEqual([]);
  });

  it('恰好边界长度通过', async () => {
    const min = `a1${'x'.repeat(PASSWORD_MIN_LENGTH - 2)}`;
    const max = `a1${'x'.repeat(PASSWORD_MAX_LENGTH - 2)}`;
    expect(await messagesOf(min)).toEqual([]);
    expect(await messagesOf(max)).toEqual([]);
  });

  it('过短只报一条策略文案，不会再冒出「不能超过」', async () => {
    const messages = await messagesOf('Abc123');
    expect(messages).toEqual([PASSWORD_LENGTH_MESSAGE]);
    expect(messages.some((message) => message.includes('超过'))).toBe(false);
  });

  it('过长只报一条策略文案，不会再冒出「不能少于」', async () => {
    const messages = await messagesOf(`a1${'x'.repeat(PASSWORD_MAX_LENGTH)}`);
    expect(messages).toEqual([PASSWORD_LENGTH_MESSAGE]);
    expect(messages.some((message) => message.includes('少于'))).toBe(false);
  });

  it('缺字母或数字时提示复杂度', async () => {
    expect(await messagesOf('abcdefgh')).toEqual([PASSWORD_COMPLEXITY_MESSAGE]);
    expect(await messagesOf('12345678')).toEqual([PASSWORD_COMPLEXITY_MESSAGE]);
  });

  it('非字符串入参被拦下（不因类型错而漏掉长度校验）', async () => {
    expect((await messagesOf(12345678)).length).toBeGreaterThan(0);
  });
});
