/**
 * 情景闯关「封面兜底视觉」配置（仅客户端展示用）。
 *
 * 2026-11-10 起层级是 场景 → 剧本 → 关卡；场景 = sentence_category（后台「场景分类」管理），
 * 剧本/关卡都带 AI 生成的封面（后端接口下发 URL）。这里只兜底：封面没生成/加载失败时，
 * 按场景分类 id 轮换一套渐变和大图标，避免封面变纯白块。
 */
export interface StageCover {
  /** 封面渐变（浅色） */
  gradient: string;
  /** 封面渐变（暗色下压暗，保证白字/白图标可读） */
  gradientDark: string;
  /** 封面大图标（emoji，与角色头像同思路：不引入图片资源） */
  emoji: string;
}

/** 按场景 id 轮换的兜底封面（顺序即配色顺序）。 */
const SCENE_COVERS: StageCover[] = [
  {
    gradient: 'bg-linear-to-br from-amber-400 to-orange-600',
    gradientDark: 'dark:from-amber-600 dark:to-orange-800',
    emoji: '🧳',
  },
  {
    gradient: 'bg-linear-to-br from-sky-500 to-indigo-600',
    gradientDark: 'dark:from-sky-700 dark:to-indigo-900',
    emoji: '💼',
  },
  {
    gradient: 'bg-linear-to-br from-rose-400 to-pink-600',
    gradientDark: 'dark:from-rose-600 dark:to-pink-800',
    emoji: '🫖',
  },
  {
    gradient: 'bg-linear-to-br from-emerald-400 to-teal-600',
    gradientDark: 'dark:from-emerald-600 dark:to-teal-800',
    emoji: '✈️',
  },
];

/** 兜底封面（极端情况：分类 id 异常等）。 */
const FALLBACK_COVER: StageCover = {
  gradient: 'bg-linear-to-br from-slate-400 to-slate-600',
  gradientDark: 'dark:from-slate-600 dark:to-slate-800',
  emoji: '🗺️',
};

/** 按场景分类 id 取兜底封面（未命中走兜底）。 */
export function sceneCoverOf(categoryId: number): StageCover {
  if (!Number.isFinite(categoryId) || categoryId <= 0) return FALLBACK_COVER;
  return SCENE_COVERS[(categoryId - 1) % SCENE_COVERS.length] ?? FALLBACK_COVER;
}
