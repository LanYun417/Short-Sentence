/**
 * 情景闯关「章节封面」配置（仅客户端展示用）。
 *
 * 章节的权威定义在 api 的 `stage-stories.ts`（名称 / 导语 / 关卡都在那里，随剧情走），
 * 这里只补封面视觉：渐变、大图标。**新增章节必须同步加一条**，否则走兜底样式。
 * key 与 sentence_category 无关，对应 STAGE_CHAPTERS 的 `key`。
 */
export interface StageChapterCover {
  /** 封面渐变（浅色） */
  gradient: string;
  /** 封面渐变（暗色下压暗，保证白字/白图标可读） */
  gradientDark: string;
  /** 封面大图标（emoji，与角色头像同思路：不引入图片资源） */
  emoji: string;
}

/** 章节封面表。 */
export const STAGE_CHAPTER_COVERS: Record<string, StageChapterCover> = {
  // 落脚：行李箱、租来的房
  arrive: {
    gradient: 'bg-linear-to-br from-amber-400 to-orange-600',
    gradientDark: 'dark:from-amber-600 dark:to-orange-800',
    emoji: '🧳',
  },
  // 谋生：工位、邮件
  work: {
    gradient: 'bg-linear-to-br from-sky-500 to-indigo-600',
    gradientDark: 'dark:from-sky-700 dark:to-indigo-900',
    emoji: '💼',
  },
  // 相逢：屋顶、茶饮、第一次开口
  meet: {
    gradient: 'bg-linear-to-br from-rose-400 to-pink-600',
    gradientDark: 'dark:from-rose-600 dark:to-pink-800',
    emoji: '🫖',
  },
  // 远行：机场、雪、候机厅的日出
  wander: {
    gradient: 'bg-linear-to-br from-emerald-400 to-teal-600',
    gradientDark: 'dark:from-emerald-600 dark:to-teal-800',
    emoji: '✈️',
  },
};

/** 兜底封面（章节漏配时用，避免封面变纯白块）。 */
const FALLBACK_COVER: StageChapterCover = {
  gradient: 'bg-linear-to-br from-slate-400 to-slate-600',
  gradientDark: 'dark:from-slate-600 dark:to-slate-800',
  emoji: '🗺️',
};

/** 按章节 key 取封面（未配置走兜底）。 */
export function chapterCoverOf(key: string): StageChapterCover {
  return STAGE_CHAPTER_COVERS[key] ?? FALLBACK_COVER;
}
