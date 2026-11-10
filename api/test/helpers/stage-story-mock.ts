/**
 * 情景闯关（场景 → 剧本 → 关卡）的内存 mock：
 * - stage_script：每个代码种子里的场景分类建一个「默认剧本」；
 * - stage_story：STAGE_STORIES 的 14 关挂到各自分类的默认剧本下；
 * - 行为与库表一致（findMany/findUnique/create/update/delete/aggregate/count），
 *   rows 暴露出来方便断言与造脏数据。
 */
import { vi } from 'vitest';
import { STAGE_STORIES } from '../../src/modules/client/stage/stage-stories.js';

export interface StageScriptRow {
  id: bigint;
  categoryId: bigint;
  name: string;
  blurb: string;
  coverFileId: bigint;
  sort: number;
  status: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StageStoryRow {
  id: bigint;
  scriptId: bigint;
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

/** 代码种子里出现过的场景分类（按出现顺序去重）。 */
export function seedCategoryNames(): string[] {
  return [...new Set(STAGE_STORIES.map((item) => item.category))];
}

export function seedScriptRows(): StageScriptRow[] {
  return seedCategoryNames().map((name, index) => ({
    id: BigInt(index + 1),
    categoryId: BigInt(index + 1),
    name: `${name} · 默认剧本`,
    blurb: '测试用默认剧本',
    coverFileId: 0n,
    sort: 0,
    status: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

export function seedStoryRows(scripts?: StageScriptRow[]): StageStoryRow[] {
  const list = scripts ?? seedScriptRows();
  const names = seedCategoryNames();
  const scriptIdByCategory = new Map(list.map((row, index) => [names[index], row.id]));
  return STAGE_STORIES.map((item, index) => ({
    id: BigInt(index + 1),
    scriptId: scriptIdByCategory.get(item.category) ?? 1n,
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

function matches(row: Record<string, any>, where: Record<string, any> | undefined): boolean {
  if (!where) return true;
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (key === 'NOT') {
      if (matches(row, value as Record<string, any>)) return false;
      continue;
    }
    if (value !== null && typeof value === 'object') {
      const filter = value as Record<string, any>;
      if (filter.in && !filter.in.includes(row[key])) return false;
      if (filter.not !== undefined) {
        if (filter.not === null) {
          if (row[key] === null) return false;
        } else if (row[key] === filter.not) return false;
      }
      if (filter.gt !== undefined && !(row[key] > filter.gt)) return false;
      continue;
    }
    if (value === null) {
      if (row[key] !== null) return false;
      continue;
    }
    if (row[key] !== value) return false;
  }
  return true;
}

/** 通用内存表 mock（stage_script / stage_story 共用）。 */
function makeTableMock<T extends { id: bigint; sort: number }>(rows: T[], seqStart: bigint) {
  let seq = seqStart;
  return {
    rows,
    findMany: vi.fn(async (args?: { where?: Record<string, any> }) =>
      rows.filter((row) => matches(row as Record<string, any>, args?.where)),
    ),
    findUnique: vi.fn(
      async (args: { where: { id?: bigint } }) =>
        rows.find((row) => (args.where.id !== undefined ? row.id === args.where.id : false)) ?? null,
    ),
    findFirst: vi.fn(
      async (args?: { where?: Record<string, any> }) =>
        rows.find((row) => matches(row as Record<string, any>, args?.where)) ?? null,
    ),
    create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
      const row = {
        id: seq++,
        createdAt: new Date(),
        updatedAt: new Date(),
        sort: 0,
        status: 1,
        ...data,
      } as unknown as T;
      rows.push(row);
      return row;
    }),
    createMany: vi.fn(async ({ data }: { data: Array<Record<string, any>> }) => {
      for (const item of data) {
        rows.push({
          id: seq++,
          createdAt: new Date(),
          updatedAt: new Date(),
          sort: 0,
          status: 1,
          ...item,
        } as unknown as T);
      }
      return { count: data.length };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: bigint }; data: Record<string, any> }) => {
      const row = rows.find((item) => item.id === where.id);
      if (!row) throw new Error('record not found');
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
      const hit = rows.filter((row) => matches(row as Record<string, any>, where));
      for (const row of hit) Object.assign(row, data);
      return { count: hit.length };
    }),
    delete: vi.fn(async ({ where }: { where: { id: bigint } }) => {
      const index = rows.findIndex((item) => item.id === where.id);
      if (index < 0) throw new Error('record not found');
      const [row] = rows.splice(index, 1);
      return row;
    }),
    deleteMany: vi.fn(async ({ where }: { where?: Record<string, any> }) => {
      const hit = rows.filter((row) => matches(row as Record<string, any>, where));
      for (const row of [...hit]) rows.splice(rows.indexOf(row), 1);
      return { count: hit.length };
    }),
    aggregate: vi.fn(async ({ where }: { where?: Record<string, any> }) => {
      const hit = rows.filter((row) => matches(row as Record<string, any>, where));
      return { _max: { sort: hit.length > 0 ? Math.max(...hit.map((row) => row.sort)) : null } };
    }),
    count: vi.fn(
      async ({ where }: { where?: Record<string, any> } = {}) =>
        rows.filter((row) => matches(row as Record<string, any>, where)).length,
    ),
  };
}

export function makeStageScriptMock(initial?: StageScriptRow[]) {
  return makeTableMock(initial ?? seedScriptRows(), BigInt((initial?.length ?? seedCategoryNames().length) + 1));
}

export function makeStageStoryMock(initial?: StageStoryRow[], scripts?: StageScriptRow[]) {
  const rows = initial ?? seedStoryRows(scripts);
  return makeTableMock(rows, BigInt(rows.length + 1));
}

export type StageScriptMock = ReturnType<typeof makeStageScriptMock>;
export type StageStoryMock = ReturnType<typeof makeStageStoryMock>;
