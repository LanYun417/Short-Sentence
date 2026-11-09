/**
 * 情景闯关剧情定义（关卡 = 场景分类）。
 *
 * **为什么剧情写在代码里而不入库**：文案是随版本走的创作内容，改一次要跟一次
 * 内容审核与缓存，放表里只会让运营改错字也得发迁移。关卡与分类的挂钩用
 * `category`（= `sentence_category.name`）而不是 id：分类种子是按 name 幂等写入的，
 * 而 id 会随库重建变化，用 id 会在新环境里整条剧情错位。
 *
 * 2026-11-09 起玩法从「答对 N 句通关」改为**场景长对话**：
 * 每个关卡是一段 AI 角色扮演——用户扮演 `userRole`，与 1~3 个角色围绕 `goal`
 * 聊够 `minTurns` 轮并达成目标才算通关；`target` 仅保留给旧版答题统计。
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

/** 对话角色。 */
export interface StageRole {
  /** 英文名（模型输出 speaker 用这个；前端再映射成中文名与头像） */
  nameEn: string;
  /** 中文名（展示用） */
  name: string;
  /** 人设（喂给模型，不直接展示） */
  persona: string;
  /** 头像 emoji（展示用，避免依赖图片资源） */
  emoji: string;
}

/** 一句台词（开场白用）。 */
export interface StageLine {
  /** 说话角色 nameEn */
  speaker: string;
  contentEn: string;
  contentZh: string;
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
  /** 用户在场景中扮演的角色（喂给模型） */
  userRole: string;
  /** 场景设定（喂给模型） */
  setting: string;
  /** 对话目标（展示 + AI 通关判定） */
  goal: string;
  /** 通关所需的最少用户轮数 */
  minTurns: number;
  /** 硬上限：达到即结束（未达成目标则不通关，可重来） */
  maxTurns: number;
  /** 出场角色（1~3 人，按场景定） */
  roles: StageRole[];
  /** 开场白（多人场景可连续几句） */
  opening: StageLine[];
  /** 旧版「答对 N 句」通关线（仅用于旧进度统计，不再决定解锁/通关） */
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
    userRole: '刚搬来的住户',
    setting: '清晨六点半的街角便利店，玻璃上还挂着夜里的水汽，店里只有你一个顾客。',
    goal: '买到一杯热咖啡和一份早餐，并问清店里有没有会员优惠',
    minTurns: 6,
    maxTurns: 12,
    roles: [
      {
        nameEn: 'Maya',
        name: '店员 Maya',
        persona: '二十多岁，语速快但友善，熟悉店里所有商品，喜欢给常客推荐新品',
        emoji: '🧑‍🍳',
      },
    ],
    opening: [
      {
        speaker: 'Maya',
        contentEn: "Morning! You're up early. What can I get for you?",
        contentZh: '早上好！你今天起得真早。想吃点什么？',
      },
      { speaker: 'Maya', contentEn: 'The coffee machine just finished warming up.', contentZh: '咖啡机刚热好。' },
    ],
    target: 5,
    rewardXp: 30,
  },
  {
    category: '居家生活',
    chapter: 'arrive',
    title: '空房间的第一晚',
    intro: '房间只有一张床和一盏灯。房东在门口交代水电和垃圾分类，语速快得像另一门语言。',
    outro: '你把最后一箱书放上书架。灯亮着，这里终于像家了。',
    userRole: '刚签下租约的租客',
    setting: '空荡的出租屋，房东来交代水电和垃圾分类，楼下的邻居正好上楼打招呼。',
    goal: '弄清水电怎么缴费、垃圾哪天收，并确认网络什么时候能装好',
    minTurns: 6,
    maxTurns: 12,
    roles: [
      {
        nameEn: 'Mrs. Chen',
        name: '房东陈太太',
        persona: '五十多岁，干练，说话直接但热心，最在意房子被好好对待',
        emoji: '🧓',
      },
      {
        nameEn: 'Leo',
        name: '邻居 Leo',
        persona: '住楼下的年轻人，随和，主动提供生活信息',
        emoji: '🧑',
      },
    ],
    opening: [
      {
        speaker: 'Mrs. Chen',
        contentEn: 'Here are the keys. The water bill comes every two months, understand?',
        contentZh: '钥匙给你。水费两个月交一次，明白吗？',
      },
      {
        speaker: 'Leo',
        contentEn: 'Hey, I live downstairs. If anything breaks, just knock.',
        contentZh: '嘿，我住楼下。有什么坏了就敲门。',
      },
    ],
    target: 5,
    rewardXp: 30,
  },
  {
    category: '购物消费',
    chapter: 'arrive',
    title: '退货的那张小票',
    intro: '买回来的台灯不亮。你捏着小票站在柜台前，第一次需要为一件小事把话说清楚。',
    outro: '新的台灯亮起来，店员说了句「祝你今天顺利」。你忽然不那么怕麻烦了。',
    userRole: '来退台灯的顾客',
    setting: '家居商店的退货柜台，队伍不长，柜台后面堆着待处理的纸箱。',
    goal: '说明台灯坏了，成功退货或换一个新的，并问清退款到账时间',
    minTurns: 6,
    maxTurns: 12,
    roles: [
      {
        nameEn: 'Nina',
        name: '店员 Nina',
        persona: '退货柜台，流程熟练，态度公事公办，遇到例外会叫经理',
        emoji: '🧑‍💼',
      },
      {
        nameEn: 'Mr. Park',
        name: '值班经理',
        persona: '被叫来处理例外情况，礼貌但重视规则，愿意给合理方案',
        emoji: '👨‍💼',
      },
    ],
    opening: [
      { speaker: 'Nina', contentEn: 'Next, please. Do you have the receipt?', contentZh: '下一位。小票带了吗？' },
      {
        speaker: 'Mr. Park',
        contentEn: "I'm the duty manager. Is there a problem with the lamp?",
        contentZh: '我是值班经理。这盏灯有什么问题吗？',
      },
    ],
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
    userRole: '入职第三天的新员工',
    setting: '开放办公室，收件箱里有一封全英文邮件，抄送了你，同事在旁边的工位。',
    goal: '向同事确认邮件里的任务要求，并约定一个交付时间',
    minTurns: 6,
    maxTurns: 12,
    roles: [
      {
        nameEn: 'Sarah',
        name: '同事 Sarah',
        persona: '项目对接人，语速快，喜欢先听结论，愿意解释但不重复第二遍',
        emoji: '👩‍💻',
      },
      {
        nameEn: 'Daniel',
        name: '主管 Daniel',
        persona: '在隔壁工位，偶尔插话，关心排期与风险',
        emoji: '🧑‍💼',
      },
    ],
    opening: [
      {
        speaker: 'Sarah',
        contentEn: 'Did you see the email about the client update? They need it by Friday.',
        contentZh: '你看到那封关于客户更新的邮件了吗？他们周五之前要。',
      },
      {
        speaker: 'Daniel',
        contentEn: 'If the timeline is tight, tell me now.',
        contentZh: '如果时间紧，现在就告诉我。',
      },
    ],
    target: 6,
    rewardXp: 40,
  },
  {
    category: '学习成长',
    chapter: 'work',
    title: '下班后的那盏灯',
    intro: '同事在茶水间聊起一门夜课。你记下教室号，晚上真的去了。',
    outro: '你在笔记本最后一页写下：说得慢没关系，说清楚就行。',
    userRole: '想报名夜课的在职学习者',
    setting: '社区学院的夜间咨询台，走廊里还有人在上课，墙上贴着课程表。',
    goal: '问清课程安排与费用，判断是否适合自己，并完成试听登记',
    minTurns: 6,
    maxTurns: 12,
    roles: [
      {
        nameEn: 'Ms. Rivera',
        name: '课程顾问',
        persona: '耐心，习惯先问目标再推荐课程，不夸大效果',
        emoji: '👩‍🏫',
      },
      {
        nameEn: 'Ken',
        name: '同学 Ken',
        persona: '刚下课来还书，热心分享真实体验',
        emoji: '🧑‍🎓',
      },
    ],
    opening: [
      {
        speaker: 'Ms. Rivera',
        contentEn: 'Are you here for the evening classes? Tell me what you would like to improve.',
        contentZh: '你是来咨询夜课的吗？说说你想提升什么。',
      },
      {
        speaker: 'Ken',
        contentEn: 'I took the writing class last term. It was worth it.',
        contentZh: '我上学期上过写作课，值得。',
      },
    ],
    target: 8,
    rewardXp: 45,
  },
  {
    category: '科技数码',
    chapter: 'work',
    title: '当众演示的十分钟',
    intro: '会议室的投影连不上，所有人看向你。你得一边修，一边解释。',
    outro: '投影亮起，掌声很轻但真实。你发现自己已经能用英语处理意外。',
    userRole: '准备做演示的员工',
    setting: '会议室，投影连不上，同事都已入座，主持人正在控制节奏。',
    goal: '向同事求助排查投影问题，安抚现场并争取几分钟',
    minTurns: 6,
    maxTurns: 12,
    roles: [
      {
        nameEn: 'Alex',
        name: '同事 Alex',
        persona: '技术支援，冷静，习惯一步步排查',
        emoji: '🧑‍🔧',
      },
      {
        nameEn: 'Grace',
        name: '主持人 Grace',
        persona: '控制会议节奏，愿意给时间但需要明确答复',
        emoji: '👩‍💼',
      },
    ],
    opening: [
      {
        speaker: 'Grace',
        contentEn: "We're ready when you are. Everything okay up there?",
        contentZh: '你准备好我们就开始。上面一切正常吗？',
      },
      {
        speaker: 'Alex',
        contentEn: "Try the HDMI cable. I'll check the adapter.",
        contentZh: '试试 HDMI 线，我去看转接头。',
      },
    ],
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
    userRole: '被朋友带上屋顶的客人',
    setting: '夏夜屋顶，城市灯光在脚下，朋友的朋友递来一罐冰汽水。',
    goal: '和对方聊起来，找到至少一个共同话题，并约好下次一起做点什么',
    minTurns: 6,
    maxTurns: 12,
    roles: [
      {
        nameEn: 'Noah',
        name: 'Noah',
        persona: '朋友的大学同学，做设计，话不多但会接梗，喜欢具体的细节',
        emoji: '🧑‍🎨',
      },
    ],
    opening: [
      {
        speaker: 'Noah',
        contentEn: "So, how do you know Jamie? You're the first person to take the soda.",
        contentZh: '你怎么认识 Jamie 的？你是第一个拿汽水的人。',
      },
    ],
    target: 8,
    rewardXp: 50,
  },
  {
    category: '餐饮美食',
    chapter: 'meet',
    title: '两个人的晚餐',
    intro: '你订了靠窗的位置，比对方早到二十分钟。菜单上没有图片。',
    outro: '走出餐厅时在下小雨。你们共用一把伞，谁也没提回家。',
    userRole: '提前到餐厅的约会者',
    setting: '靠窗的两人桌，菜单没有图片，服务员在桌边等着点单。',
    goal: '点好两个人的菜，照顾对方的口味，并和服务员确认忌口',
    minTurns: 6,
    maxTurns: 14,
    roles: [
      {
        nameEn: 'Marco',
        name: '服务员 Marco',
        persona: '推荐菜很自信，熟悉食材，会主动确认过敏与忌口',
        emoji: '🧑‍🍳',
      },
      {
        nameEn: 'Emma',
        name: 'Emma',
        persona: '迟到十分钟，喜欢尝试新菜，但对某种食材过敏',
        emoji: '👩',
      },
    ],
    opening: [
      {
        speaker: 'Marco',
        contentEn: 'Can I get you something while you wait?',
        contentZh: '等位的时候要不要先来点什么？',
      },
      { speaker: 'Emma', contentEn: "Sorry I'm late! Have you ordered yet?", contentZh: '抱歉我来晚了！你点了吗？' },
    ],
    target: 8,
    rewardXp: 50,
  },
  {
    category: '情感沟通',
    chapter: 'meet',
    title: '说不出口的那句',
    intro: '有些话在心里排了很多遍，一开口却全乱了。今晚你决定说完。',
    outro: '对方安静了很久，然后说：我也是。语言第一次替你承担了重量。',
    userRole: '想认真谈一次的人',
    setting: '安静的客厅，两个人坐在沙发两端，手机都扣在桌上。',
    goal: '把自己的真实感受说清楚，并听完对方的回应',
    minTurns: 8,
    maxTurns: 14,
    roles: [
      {
        nameEn: 'Chris',
        name: 'Chris',
        persona: '有点预感，先沉默后坦白，重视被认真对待',
        emoji: '🧑',
      },
    ],
    opening: [
      { speaker: 'Chris', contentEn: "You said you wanted to talk. I'm listening.", contentZh: '你说想谈谈。我在听。' },
    ],
    target: 10,
    rewardXp: 55,
  },
  {
    category: '娱乐休闲',
    chapter: 'meet',
    title: '周末的一场电影',
    intro: '没有字幕的场次。你买了最后一排，打算听不懂就当看画面。',
    outro: '你笑了三次，都在该笑的地方。原来你已经听得懂玩笑了。',
    userRole: '来看电影的观众',
    setting: '影院大厅，开场前十分钟，售票处排着短队。',
    goal: '和同伴选定影片、买好票和零食，并聊几句对电影的期待',
    minTurns: 6,
    maxTurns: 12,
    roles: [
      {
        nameEn: 'Mia',
        name: '朋友 Mia',
        persona: '电影迷，语速快，喜欢讨论导演和结局',
        emoji: '👩‍🎤',
      },
      {
        nameEn: 'Clerk',
        name: '售票员',
        persona: '简短高效，只回答必要信息',
        emoji: '🧑‍💼',
      },
    ],
    opening: [
      {
        speaker: 'Mia',
        contentEn: 'Okay, we have ten minutes. Comedy or thriller?',
        contentZh: '好，我们只有十分钟。喜剧还是惊悚？',
      },
      { speaker: 'Clerk', contentEn: 'Next in line, please.', contentZh: '下一位，请。' },
    ],
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
    userRole: '错过登机口的旅客',
    setting: '机场航站楼，广播不断，登机口临时变更，改签柜台前排着队。',
    goal: '问清改签方案和行李去向，重新订到当天能走的航班',
    minTurns: 8,
    maxTurns: 14,
    roles: [
      {
        nameEn: 'Anna',
        name: '地勤 Anna',
        persona: '处理改签，语速快，信息准确，不承诺做不到的事',
        emoji: '👩‍✈️',
      },
      {
        nameEn: 'Ben',
        name: '同路旅客 Ben',
        persona: '也在等改签，愿意交换信息，有点焦虑但友善',
        emoji: '🧑‍🦱',
      },
    ],
    opening: [
      {
        speaker: 'Anna',
        contentEn: 'That flight is closed. Are you here to rebook?',
        contentZh: '那趟航班已经关闭了。你是来改签的吗？',
      },
      { speaker: 'Ben', contentEn: 'Same boat. The next one might be at six.', contentZh: '我也是。下一班可能六点。' },
    ],
    target: 10,
    rewardXp: 60,
  },
  {
    category: '健康医疗',
    chapter: 'wander',
    title: '诊所里的一百个词',
    intro: '喉咙痛了三天。挂号单上一半的词你不认识，医生问得很耐心。',
    outro: '拿着药走出诊所，你把症状的英文说法记进备忘录。这次没白病。',
    userRole: '喉咙痛了三天的病人',
    setting: '社区诊所诊室，医生边问边记录，前台在门外安排复诊。',
    goal: '描述清楚症状和持续时间，问清用药方法和复诊时间',
    minTurns: 8,
    maxTurns: 14,
    roles: [
      {
        nameEn: 'Dr. Lee',
        name: 'Dr. Lee',
        persona: '耐心，会换简单说法解释，重视症状细节',
        emoji: '🧑‍⚕️',
      },
      {
        nameEn: 'Front Desk',
        name: '前台',
        persona: '负责预约复诊，说话简短',
        emoji: '👩‍💼',
      },
    ],
    opening: [
      {
        speaker: 'Dr. Lee',
        contentEn: 'Come in, have a seat. What brings you in today?',
        contentZh: '进来坐吧。今天哪里不舒服？',
      },
      {
        speaker: 'Front Desk',
        contentEn: "I'll book your follow-up after the doctor finishes.",
        contentZh: '医生看完后我帮你约复诊。',
      },
    ],
    target: 10,
    rewardXp: 60,
  },
  {
    category: '运动健身',
    chapter: 'wander',
    title: '第一次跟课',
    intro: '教练的口令像连珠炮，旁边的人已经开始第二组，你还在理解动作。',
    outro: '汗水滴在垫子上。下课有人拍拍你肩：下次还来吗？你说，来。',
    userRole: '第一次上团课的学员',
    setting: '健身房团课教室，音乐已经响了，学员各自铺开垫子。',
    goal: '向教练说明自己的水平，问清动作要点，坚持上完这节课',
    minTurns: 8,
    maxTurns: 14,
    roles: [
      {
        nameEn: 'Zoe',
        name: '教练 Zoe',
        persona: '口令密集但会单独纠正，鼓励但不放水',
        emoji: '💪',
      },
      {
        nameEn: 'Ryan',
        name: '学员 Ryan',
        persona: '练了半年，愿意带新人，说话随意',
        emoji: '🧑‍🦱',
      },
    ],
    opening: [
      {
        speaker: 'Zoe',
        contentEn: 'First time? Grab a mat and stay in the back. Follow my pace.',
        contentZh: '第一次来？拿张垫子站后面，跟我的节奏。',
      },
      { speaker: 'Ryan', contentEn: "Don't worry. I started here too.", contentZh: '别担心，我也是从这儿开始的。' },
    ],
    target: 12,
    rewardXp: 65,
  },
  {
    category: '天气与季节',
    chapter: 'wander',
    title: '入冬的第一场雪',
    intro: '窗户一夜之间白了。楼下有人喊你的名字，让你快点下来。',
    outro: '你把手伸出阳台，雪落在掌心化了。你想起刚来那天，也是这样的天。',
    userRole: '被朋友叫下楼的住户',
    setting: '一夜之间白了的居民楼，楼下有人喊你，台阶上结了薄冰。',
    goal: '和朋友商量今天做什么（堆雪人、喝热饮或散步），并约好时间',
    minTurns: 6,
    maxTurns: 12,
    roles: [
      {
        nameEn: 'Lily',
        name: '朋友 Lily',
        persona: '兴奋，喜欢拍照，行动力强',
        emoji: '👩‍🦰',
      },
      {
        nameEn: 'Mr. Wu',
        name: '楼下吴大爷',
        persona: '在扫雪，提醒路滑，顺口聊两句家常',
        emoji: '🧓',
      },
    ],
    opening: [
      {
        speaker: 'Lily',
        contentEn: "It snowed! Get down here, it's beautiful!",
        contentZh: '下雪了！快下来，太美了！',
      },
      { speaker: 'Mr. Wu', contentEn: 'Careful, the steps are slippery.', contentZh: '小心，台阶滑。' },
    ],
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

/** 按角色英文名取角色（用于把模型输出的 speaker 映射成展示信息）。 */
export function stageRoleOf(story: StageStory, nameEn: string): StageRole | undefined {
  return story.roles.find((role) => role.nameEn === nameEn);
}
