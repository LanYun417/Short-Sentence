/**
 * 接龙主题种子数据。
 *
 * 与成就种子同口径：**代码即内容**，按 title 幂等写入（已存在就不动），
 * 运营改过的标题/提示不会被下一次启动覆盖。
 */
export interface ChainTopicSeed {
  title: string;
  starterEn: string;
  promptZh: string;
  sort: number;
}

export const CHAIN_TOPIC_SEEDS: ChainTopicSeed[] = [
  {
    title: '如果那天我没有上那班地铁',
    starterEn: "If I hadn't taken that train, none of this would have happened.",
    promptZh: '接着写那个「如果」：可以是遗憾，也可以是庆幸。',
    sort: 1,
  },
  {
    title: '凌晨三点，手机亮了',
    starterEn: 'At three in the morning, my phone lit up.',
    promptZh: '接着写：是谁发来的，你回了什么。',
    sort: 2,
  },
  {
    title: '第一次一个人吃饭',
    starterEn: "I sat by the window with a menu I couldn't read.",
    promptZh: '接着写：你怎么点的单，后来发生了什么。',
    sort: 3,
  },
  {
    title: '搬到新城市的第一周',
    starterEn: 'In my first week here, I got lost twice.',
    promptZh: '接着写：你向谁问了路，对方说了什么。',
    sort: 4,
  },
  {
    title: '那封没发出去的邮件',
    starterEn: 'I wrote the email, then deleted every word.',
    promptZh: '接着写：你为什么把它删掉。',
    sort: 5,
  },
  {
    title: '雨停之后',
    starterEn: 'The rain stopped just as the bus arrived.',
    promptZh: '接着写：你上了车，还是留在了原地。',
    sort: 6,
  },
  {
    title: '便利店的热咖啡',
    starterEn: "The clerk handed me a coffee I hadn't ordered.",
    promptZh: '接着写：那杯咖啡是谁的，你说了什么。',
    sort: 7,
  },
  {
    title: '多年以后',
    starterEn: 'Years later, I still remember that hallway.',
    promptZh: '接着写：那个走廊里发生过什么。',
    sort: 8,
  },
];
