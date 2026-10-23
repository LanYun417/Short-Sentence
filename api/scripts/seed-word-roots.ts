/**
 * 词根词典初始数据（人工撰写）。
 *
 * 用途：上游 AI 限流（429）期间，先让词典有可用内容；每日入库任务恢复后会自动扩充。
 * 幂等：按 word 去重，已存在则跳过。
 */
import { PrismaService } from '../src/prisma/prisma.service.js';

interface Seed {
  word: string;
  phonetic: string;
  meaning: string;
  parts: Array<{ type: 'prefix' | 'root' | 'suffix'; text: string; meaning: string }>;
  explanation: string;
  related: string[];
}

const SEEDS: Seed[] = [
  {
    word: 'unavoidable',
    phonetic: '/ˌʌnəˈvɔɪdəbl/',
    meaning: 'adj. 不可避免的',
    parts: [
      { type: 'prefix', text: 'un-', meaning: '否定（不）' },
      { type: 'root', text: 'avoid', meaning: '避开' },
      { type: 'suffix', text: '-able', meaning: '可…的' },
    ],
    explanation: 'un-（不）+ avoid（避开）+ -able（可…的）→ 不可避开的。',
    related: ['avoid', 'avoidable', 'avoidance'],
  },
  {
    word: 'impossible',
    phonetic: '/ɪmˈpɒsəbl/',
    meaning: 'adj. 不可能的',
    parts: [
      { type: 'prefix', text: 'im-', meaning: '否定（in- 在 p 前同化）' },
      { type: 'root', text: 'poss', meaning: '能够' },
      { type: 'suffix', text: '-ible', meaning: '可…的' },
    ],
    explanation: 'im-（不）+ possible（可能的）→ 不可能的；in- 遇到 p 会变成 im-。',
    related: ['possible', 'possibility', 'impossibly'],
  },
  {
    word: 'reconstruct',
    phonetic: '/ˌriːkənˈstrʌkt/',
    meaning: 'v. 重建；重构',
    parts: [
      { type: 'prefix', text: 're-', meaning: '再、重新' },
      { type: 'prefix', text: 'con-', meaning: '共同、加强' },
      { type: 'root', text: 'struct', meaning: '建造' },
    ],
    explanation: 're-（重新）+ construct（建造）→ 重新建造。',
    related: ['construct', 'structure', 'reconstruction'],
  },
  {
    word: 'transportation',
    phonetic: '/ˌtrænspɔːˈteɪʃn/',
    meaning: 'n. 运输；交通',
    parts: [
      { type: 'prefix', text: 'trans-', meaning: '横越、转移' },
      { type: 'root', text: 'port', meaning: '携带、搬运' },
      { type: 'suffix', text: '-ation', meaning: '名词后缀' },
    ],
    explanation: 'trans-（跨越）+ port（搬运）+ -ation（名词）→ 把人或物搬到别处，即运输。',
    related: ['transport', 'portable', 'export'],
  },
  {
    word: 'incredible',
    phonetic: '/ɪnˈkredəbl/',
    meaning: 'adj. 难以置信的；极好的',
    parts: [
      { type: 'prefix', text: 'in-', meaning: '否定' },
      { type: 'root', text: 'cred', meaning: '相信' },
      { type: 'suffix', text: '-ible', meaning: '可…的' },
    ],
    explanation: 'in-（不）+ cred（相信）+ -ible（可…的）→ 不可相信的。',
    related: ['credit', 'credible', 'credulous'],
  },
  {
    word: 'bilingual',
    phonetic: '/ˌbaɪˈlɪŋɡwəl/',
    meaning: 'adj. 双语的',
    parts: [
      { type: 'prefix', text: 'bi-', meaning: '二、双' },
      { type: 'root', text: 'lingu', meaning: '语言' },
      { type: 'suffix', text: '-al', meaning: '…的' },
    ],
    explanation: 'bi-（双）+ lingu（语言）+ -al（…的）→ 会两种语言的。',
    related: ['language', 'linguistics', 'monolingual'],
  },
  {
    word: 'misunderstand',
    phonetic: '/ˌmɪsʌndəˈstænd/',
    meaning: 'v. 误解',
    parts: [
      { type: 'prefix', text: 'mis-', meaning: '错误' },
      { type: 'prefix', text: 'under-', meaning: '在下；理解' },
      { type: 'root', text: 'stand', meaning: '站立' },
    ],
    explanation: 'mis-（错误）+ understand（理解）→ 理解错了，即误解。',
    related: ['understand', 'misunderstanding', 'mislead'],
  },
  {
    word: 'disappear',
    phonetic: '/ˌdɪsəˈpɪə/',
    meaning: 'v. 消失',
    parts: [
      { type: 'prefix', text: 'dis-', meaning: '否定、相反' },
      { type: 'root', text: 'appear', meaning: '出现' },
    ],
    explanation: 'dis-（相反）+ appear（出现）→ 不再出现，即消失。',
    related: ['appear', 'appearance', 'disappearance'],
  },
  {
    word: 'improvement',
    phonetic: '/ɪmˈpruːvmənt/',
    meaning: 'n. 改进；改善',
    parts: [
      { type: 'prefix', text: 'im-', meaning: '进入、使' },
      { type: 'root', text: 'prove', meaning: '证明、检验（引申为好处）' },
      { type: 'suffix', text: '-ment', meaning: '名词后缀' },
    ],
    explanation: 'improve（改善）+ -ment（名词）→ 改进这件事或结果。',
    related: ['improve', 'prove', 'movement'],
  },
  {
    word: 'remarkable',
    phonetic: '/rɪˈmɑːkəbl/',
    meaning: 'adj. 非凡的；值得注意的',
    parts: [
      { type: 'prefix', text: 're-', meaning: '再次、加强' },
      { type: 'root', text: 'mark', meaning: '标记、注意' },
      { type: 'suffix', text: '-able', meaning: '可…的' },
    ],
    explanation: 're-（加强）+ mark（注意）+ -able（可…的）→ 值得被注意的。',
    related: ['mark', 'remark', 'remarkably'],
  },
  {
    word: 'international',
    phonetic: '/ˌɪntəˈnæʃnəl/',
    meaning: 'adj. 国际的',
    parts: [
      { type: 'prefix', text: 'inter-', meaning: '在…之间' },
      { type: 'root', text: 'nation', meaning: '国家、民族' },
      { type: 'suffix', text: '-al', meaning: '…的' },
    ],
    explanation: 'inter-（之间）+ nation（国家）+ -al（…的）→ 国家之间的，即国际的。',
    related: ['nation', 'national', 'internet'],
  },
  {
    word: 'autobiography',
    phonetic: '/ˌɔːtəbaɪˈɒɡrəfi/',
    meaning: 'n. 自传',
    parts: [
      { type: 'prefix', text: 'auto-', meaning: '自己' },
      { type: 'root', text: 'bio', meaning: '生命' },
      { type: 'root', text: 'graph', meaning: '写、记录' },
      { type: 'suffix', text: '-y', meaning: '名词后缀' },
    ],
    explanation: 'auto-（自己）+ bio（生命）+ graph（写）+ -y（名词）→ 写自己一生的书。',
    related: ['biology', 'biography', 'photograph'],
  },
];

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    let created = 0;
    let skipped = 0;
    for (const seed of SEEDS) {
      const existing = await prisma.wordRoot.findUnique({ where: { word: seed.word }, select: { id: true } });
      if (existing) {
        skipped += 1;
        continue;
      }
      await prisma.wordRoot.create({
        data: {
          word: seed.word,
          phonetic: seed.phonetic,
          meaning: seed.meaning,
          analysis: {
            phonetic: seed.phonetic,
            meaning: seed.meaning,
            parts: seed.parts,
            explanation: seed.explanation,
            related: seed.related,
          },
          source: 'manual',
          searchCount: 0,
        },
      });
      created += 1;
    }
    console.log(`词根词典：新增 ${created}，已存在 ${skipped}，合计 ${SEEDS.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('词根初始数据写入失败：', error);
  process.exit(1);
});
