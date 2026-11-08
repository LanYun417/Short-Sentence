/**
 * 情景闯关剧情定义（关卡 = 场景分类）。
 *
 * **为什么剧情写在代码里而不入库**：文案是随版本走的创作内容，改一次要跟一次
 * 内容审核与缓存，放表里只会让运营改错字也得发迁移。关卡与分类的挂钩用
 * `category`（= `sentence_category.name`）而不是 id：分类种子是按 name 幂等写入的，
 * 而 id 会随库重建变化，用 id 会在新环境里整条剧情错位。
 *
 * 关卡顺序 = 本文件数组顺序；**每章第一关默认解锁**，章内顺序解锁。
 * 四章是平行入口（安顿 / 谋生 / 相逢 / 远行），不会逼用户从头顺着刷。
 */

/** 章节定义。 */
export interface StageChapter {
  key: string;
  /** 章节名（含序号，直接展示） */
  name: string;
  /** 章节导语：一句话交代这一幕的处境 */
  subtitle: string;
}

/** 关卡定义（一个场景一关）。 */
export interface StageStory {
  /** 对应 sentence_category.name */
  category: string;
  /** 所属章节 key */
  chapter: string;
  /** 关卡标题（剧情化的场景名） */
  title: string;
  /** 进入关卡的剧情引入 */
  intro: string;
  /** 通关后的剧情收束 */
  outro: string;
  /** 通关所需「该场景累计答对」题数 */
  target: number;
  /** 通关奖励经验 */
  rewardXp: number;
}

export const STAGE_CHAPTERS: StageChapter[] = [
  {
    key: 'arrive',
    name: '第一章 · 落脚',
    subtitle: '一只行李箱，一间租来的房。先把日子过起来。',
  },
  {
    key: 'work',
    name: '第二章 · 谋生',
    subtitle: '从第一封邮件开始，你在城市里有了位置。',
  },
  {
    key: 'meet',
    name: '第三章 · 相逢',
    subtitle: '语言真正活起来的时刻，是有人回应你。',
  },
  {
    key: 'wander',
    name: '第四章 · 远行',
    subtitle: '熟悉之后，城市开始向外延伸。',
  },
];

export const STAGE_STORIES: StageStory[] = [
  // ---- 第一章 · 落脚 ----
  {
    category: '日常生活',
    chapter: 'arrive',
    title: '便利店的清晨',
    intro: '清晨六点半，你站在便利店门口，玻璃上还挂着夜里的水汽。店员抬头看你，等你开口。',
    outro: '你拎着热咖啡走出来，天已经亮了。这座城市第一次回应了你。',
    target: 5,
    rewardXp: 30,
  },
  {
    category: '居家生活',
    chapter: 'arrive',
    title: '空房间的第一晚',
    intro: '房间只有一张床和一盏灯。房东在门口交代水电和垃圾分类，语速快得像另一门语言。',
    outro: '你把最后一箱书放上书架。灯亮着，这里终于像家了。',
    target: 5,
    rewardXp: 30,
  },
  {
    category: '购物消费',
    chapter: 'arrive',
    title: '退货的那张小票',
    intro: '买回来的台灯不亮。你捏着小票站在柜台前，第一次需要为一件小事把话说清楚。',
    outro: '新的台灯亮起来，店员说了句「祝你今天顺利」。你忽然不那么怕麻烦了。',
    target: 6,
    rewardXp: 35,
  },

  // ---- 第二章 · 谋生 ----
  {
    category: '职场办公',
    chapter: 'work',
    title: '第一封英文邮件',
    intro: '入职第三天，收件箱里躺着一封没有中文的邮件。抄送给你，等你回。',
    outro: '你按下发送。第二天，对方回了三个字：Well put.',
    target: 6,
    rewardXp: 40,
  },
  {
    category: '学习成长',
    chapter: 'work',
    title: '下班后的那盏灯',
    intro: '同事在茶水间聊起一门夜课。你记下教室号，晚上真的去了。',
    outro: '你在笔记本最后一页写下：说得慢没关系，说清楚就行。',
    target: 8,
    rewardXp: 45,
  },
  {
    category: '科技数码',
    chapter: 'work',
    title: '当众演示的十分钟',
    intro: '会议室的投影连不上，所有人看向你。你得一边修，一边解释。',
    outro: '投影亮起，掌声很轻但真实。你发现自己已经能用英语处理意外。',
    target: 8,
    rewardXp: 45,
  },

  // ---- 第三章 · 相逢 ----
  {
    category: '社交闲聊',
    chapter: 'meet',
    title: '屋顶上的陌生人',
    intro: '朋友的朋友在屋顶吹风，递给你一罐汽水，问了一个很简单的问题。',
    outro: '你们聊到很晚。原来闲聊不需要准备，只需要愿意开口。',
    target: 8,
    rewardXp: 50,
  },
  {
    category: '餐饮美食',
    chapter: 'meet',
    title: '两个人的晚餐',
    intro: '你订了靠窗的位置，比对方早到二十分钟。菜单上没有图片。',
    outro: '走出餐厅时在下小雨。你们共用一把伞，谁也没提回家。',
    target: 8,
    rewardXp: 50,
  },
  {
    category: '情感沟通',
    chapter: 'meet',
    title: '说不出口的那句',
    intro: '有些话在心里排了很多遍，一开口却全乱了。今晚你决定说完。',
    outro: '对方安静了很久，然后说：我也是。语言第一次替你承担了重量。',
    target: 10,
    rewardXp: 55,
  },
  {
    category: '娱乐休闲',
    chapter: 'meet',
    title: '周末的一场电影',
    intro: '没有字幕的场次。你买了最后一排，打算听不懂就当看画面。',
    outro: '你笑了三次，都在该笑的地方。原来你已经听得懂玩笑了。',
    target: 10,
    rewardXp: 55,
  },

  // ---- 第四章 · 远行 ----
  {
    category: '旅行出行',
    chapter: 'wander',
    title: '误机的那天',
    intro: '登机口改了，广播说了两遍你还是没听清。手机显示还有四十分钟。',
    outro: '你重新订了航班，坐在候机厅看日出。处理麻烦本身，也是一种抵达。',
    target: 10,
    rewardXp: 60,
  },
  {
    category: '健康医疗',
    chapter: 'wander',
    title: '诊所里的一百个词',
    intro: '喉咙痛了三天。挂号单上一半的词你不认识，医生问得很耐心。',
    outro: '拿着药走出诊所，你把症状的英文说法记进备忘录。这次没白病。',
    target: 10,
    rewardXp: 60,
  },
  {
    category: '运动健身',
    chapter: 'wander',
    title: '第一次跟课',
    intro: '教练的口令像连珠炮，旁边的人已经开始第二组，你还在理解动作。',
    outro: '汗水滴在垫子上。下课有人拍拍你肩：下次还来吗？你说，来。',
    target: 12,
    rewardXp: 65,
  },
  {
    category: '天气与季节',
    chapter: 'wander',
    title: '入冬的第一场雪',
    intro: '窗户一夜之间白了。楼下有人喊你的名字，让你快点下来。',
    outro: '你把手伸出阳台，雪落在掌心化了。你想起刚来那天，也是这样的天。',
    target: 12,
    rewardXp: 70,
  },
];

/** 关卡总数（成就判定与前端进度条共用）。 */
export const STAGE_TOTAL = STAGE_STORIES.length;

/** 按分类名取关卡定义。 */
export function stageStoryOf(categoryName: string): StageStory | undefined {
  return STAGE_STORIES.find((item) => item.category === categoryName);
}
