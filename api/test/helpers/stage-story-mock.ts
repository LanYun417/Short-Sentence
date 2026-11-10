/**
 * stage_story 表的内存 mock：默认从代码种子 STAGE_STORIES 派生 15 行，
 * 行为与「故事写死在代码里」的旧版一致，业务代码迁到库表后测试不用改。
 *
 * 支持 findMany / findUnique(category 或 id) / createMany / create / update /
 * delete / aggregate，rows 暴露出来方便断言与造脏数据。
 */
import { vi } from 'vitest';
import { STAGE_STORIES } from '../../src/modules/client/stage/stage-stories.js';

export interface StageStoryRow {
  id: bigint;
  chapterKey: string;
  category: string;
  title: string;
  intro: string;
  outro: string;
  userRole: string;
  setting: string;
  goal: string;
  minTurns: number;
  maxTurns: number;
  target: number;
  rewardXp: number;
  roles: unknown;
  opening: unknown;
  starterHints: unknown;
  sort: number;
  status: number;
  createdAt: Date;
  updatedAt: Date;
}

export function seedRows(): StageStoryRow[] {
  return STAGE_STORIES.map((item, index) => ({
    id: BigInt(index + 1),
    chapterKey: item.chapter,
    category: item.category,
    title: item.title,
    intro: item.intro,
    outro: item.outro,
    userRole: item.userRole,
    setting: item.setting,
    goal: item.goal,
    minTurns: item.minTurns,
    maxTurns: item.maxTurns,
    target: item.target,
    rewardXp: item.rewardXp,
    roles: item.roles,
    opening: item.opening,
    starterHints: item.starterHints,
    sort: index + 1,
    status: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

export function makeStageStoryMock(initial?: StageStoryRow[]) {
  const rows = initial ?? seedRows();
  let seq = BigInt(rows.length + 1);

  const matches = (row: StageStoryRow, where: Record<string, any> | undefined): boolean => {
    if (!where) return true;
    if (where.id !== undefined) {
      if (typeof where.id === 'object' && where.id?.in) {
        if (!where.id.in.includes(row.id)) return false;
      } else if (row.id !== where.id) return false;
    }
    if (where.category !== undefined) {
      if (typeof where.category === 'object' && where.category?.in) {
        if (!where.category.in.includes(row.category)) return false;
      } else if (row.category !== where.category) return false;
    }
    if (where.status !== undefined && row.status !== where.status) return false;
    if (where.chapterKey !== undefined && row.chapterKey !== where.chapterKey) return false;
    return true;
  };

  return {
    rows,
    findMany: vi.fn(async (args?: { where?: Record<string, unknown> }) =>
      rows.filter((row) => matches(row, args?.where)),
    ),
    findUnique: vi.fn(async (args: { where: { id?: bigint; category?: string } }) => {
      if (args.where.category !== undefined) return rows.find((row) => row.category === args.where.category) ?? null;
      return rows.find((row) => row.id === args.where.id) ?? null;
    }),
    findFirst: vi.fn(
      async (args?: { where?: Record<string, unknown> }) => rows.find((row) => matches(row, args?.where)) ?? null,
    ),
    createMany: vi.fn(async ({ data }: { data: Array<Partial<StageStoryRow>> }) => {
      for (const item of data) {
        rows.push({
          id: seq++,
          createdAt: new Date(),
          updatedAt: new Date(),
          sort: 0,
          status: 1,
          ...item,
        } as StageStoryRow);
      }
      return { count: data.length };
    }),
    create: vi.fn(async ({ data }: { data: Partial<StageStoryRow> }) => {
      const row = {
        id: seq++,
        createdAt: new Date(),
        updatedAt: new Date(),
        sort: 0,
        status: 1,
        ...data,
      } as StageStoryRow;
      rows.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => {
      const row = rows.find((item) => item.id === where.id);
      if (!row) throw new Error('record not found');
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    }),
    delete: vi.fn(async ({ where }: { where: { id: bigint } }) => {
      const index = rows.findIndex((item) => item.id === where.id);
      if (index < 0) throw new Error('record not found');
      const [row] = rows.splice(index, 1);
      return row;
    }),
    aggregate: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
      const hit = rows.filter((row) => matches(row, where));
      return { _max: { sort: hit.length > 0 ? Math.max(...hit.map((row) => row.sort)) : null } };
    }),
    count: vi.fn(
      async ({ where }: { where?: Record<string, unknown> }) => rows.filter((row) => matches(row, where)).length,
    ),
  };
}

export type StageStoryMock = ReturnType<typeof makeStageStoryMock>;
