/**
 * 音标库种子数据（48 个国际音标，DJ 音标口径，国内通用教材顺序）。
 *
 * 用途：Web / App 两端「音标学习」共用的一份静态参考数据，由种子写入 `ipa_phoneme`。
 * - 分组：vowel 单元音(12) / diphthong 双元音(8) / consonant_voiceless 清辅音(11) / consonant_voiced 浊辅音(17)；
 * - 示例词是**测验题的素材**：看词选音标、看音标选词都由 exampleWords 派生，故每个音标 3 个词起步；
 * - 只增不改：修订内容应在同一条目上更新，不要新增重复 symbol（symbol 唯一，重复会触发唯一索引）。
 */

/** 音标类型（与 schema 注释一致）。 */
export type IpaPhonemeType = 'vowel' | 'diphthong' | 'consonant_voiceless' | 'consonant_voiced';

/** 一条音标种子。 */
export interface IpaPhonemeSeed {
  /** 音标符号（不含斜线） */
  symbol: string;
  /** 类型 */
  type: IpaPhonemeType;
  /** 示例词 */
  exampleWords: string[];
  /** 中文发音要点（口型 + 常见错误） */
  tips: string;
}

export const IPA_PHONEME_SEEDS: IpaPhonemeSeed[] = [
  // ---------------- 单元音（12）----------------
  {
    symbol: 'iː',
    type: 'vowel',
    exampleWords: ['see', 'tree', 'meat'],
    tips: '长音。嘴角向两边展开，像微笑，保持约 1 秒。常见错误：读得太短，变成 sit 的 /ɪ/。',
  },
  {
    symbol: 'ɪ',
    type: 'vowel',
    exampleWords: ['sit', 'big', 'city'],
    tips: '短音。嘴唇放松扁平，声音短促。常见错误：读成 /iː/，sit 听起来像 seat。',
  },
  {
    symbol: 'e',
    type: 'vowel',
    exampleWords: ['bed', 'ten', 'head'],
    tips: '半开前元音。下巴略放，嘴角平。常见错误：读成 /æ/ 或 /ɪ/。',
  },
  {
    symbol: 'æ',
    type: 'vowel',
    exampleWords: ['cat', 'apple', 'hand'],
    tips: '大口型。下巴明显放下，嘴角向两边拉。常见错误：嘴张不够，读成 bed 的 /e/。',
  },
  {
    symbol: 'ɑː',
    type: 'vowel',
    exampleWords: ['car', 'park', 'father'],
    tips: '长音。嘴巴大大张开，声音低沉靠后。常见错误：读得短或太紧，变成 /ʌ/。',
  },
  {
    symbol: 'ʌ',
    type: 'vowel',
    exampleWords: ['cup', 'but', 'love'],
    tips: '短音。嘴唇自然，声音轻靠后。常见错误：与 /ɑː/ /æ/ 混淆，cup 读成 cap。',
  },
  {
    symbol: 'ɒ',
    type: 'vowel',
    exampleWords: ['hot', 'dog', 'box'],
    tips: '圆唇短音。嘴唇收圆，下巴略放。常见错误：圆唇不够，读成 /ɑː/。',
  },
  {
    symbol: 'ɔː',
    type: 'vowel',
    exampleWords: ['door', 'more', 'ball'],
    tips: '长音。双唇收圆前突并保持。常见错误：读得太短，或圆唇消失。',
  },
  {
    symbol: 'ʊ',
    type: 'vowel',
    exampleWords: ['book', 'put', 'good'],
    tips: '短音。双唇微圆、放松。常见错误：与 /uː/ 混淆，book 读成 boot。',
  },
  {
    symbol: 'uː',
    type: 'vowel',
    exampleWords: ['food', 'blue', 'moon'],
    tips: '长音。双唇收圆前突，保持约 1 秒。常见错误：圆唇不足，或读得太短。',
  },
  {
    symbol: 'ɜː',
    type: 'vowel',
    exampleWords: ['bird', 'work', 'her'],
    tips: '长音。嘴唇自然扁平，舌尖不碰上腭。常见错误：卷舌（中式 /ɜɚ/）或加尾音。',
  },
  {
    symbol: 'ə',
    type: 'vowel',
    exampleWords: ['about', 'teacher', 'sofa'],
    tips: '最放松的音，只出现在非重读音节。常见错误：读得太重太清楚，破坏英语节奏。',
  },

  // ---------------- 双元音（8）----------------
  {
    symbol: 'eɪ',
    type: 'diphthong',
    exampleWords: ['cake', 'name', 'day'],
    tips: '从 /e/ 滑到 /ɪ/，前长后短、前重后轻。常见错误：拆成两个独立的音读。',
  },
  {
    symbol: 'aɪ',
    type: 'diphthong',
    exampleWords: ['bike', 'my', 'time'],
    tips: '从大口 /a/ 滑到 /ɪ/。常见错误：起点不够开，my 读成 /meɪ/。',
  },
  {
    symbol: 'ɔɪ',
    type: 'diphthong',
    exampleWords: ['boy', 'coin', 'voice'],
    tips: '从圆唇 /ɔ/ 滑到 /ɪ/。常见错误：圆唇消失，boy 读成 /baɪ/。',
  },
  {
    symbol: 'əʊ',
    type: 'diphthong',
    exampleWords: ['nose', 'home', 'go'],
    tips: '从放松的 /ə/ 滑到圆唇 /ʊ/。常见错误：起点太重，或收尾不收圆。',
  },
  {
    symbol: 'aʊ',
    type: 'diphthong',
    exampleWords: ['house', 'now', 'out'],
    tips: '从大口 /a/ 滑到圆唇 /ʊ/，嘴由大变小。常见错误：后半段没收圆，读成 /aː/。',
  },
  {
    symbol: 'ɪə',
    type: 'diphthong',
    exampleWords: ['ear', 'here', 'near'],
    tips: '从 /ɪ/ 滑到 /ə/。常见错误：拆成「衣+呃」两拍，或加出 /r/ 音。',
  },
  {
    symbol: 'eə',
    type: 'diphthong',
    exampleWords: ['hair', 'care', 'air'],
    tips: '从 /e/ 滑到 /ə/。常见错误：读成单元音 /eː/，air 听起来像 /e/。',
  },
  {
    symbol: 'ʊə',
    type: 'diphthong',
    exampleWords: ['tour', 'poor', 'sure'],
    tips: '从 /ʊ/ 滑到 /ə/。常见错误：前半段不收圆，或读成单元音 /ɔː/。',
  },

  // ---------------- 清辅音（11）----------------
  {
    symbol: 'p',
    type: 'consonant_voiceless',
    exampleWords: ['pen', 'apple', 'pig'],
    tips: '双唇闭合后爆破，声带不振动；词首要送气（放纸片能吹动）。常见错误：读成 /b/（少送气）。',
  },
  {
    symbol: 't',
    type: 'consonant_voiceless',
    exampleWords: ['table', 'cat', 'letter'],
    tips: '舌尖抵上齿龈后爆破，声带不振动。常见错误：读成 /d/。',
  },
  {
    symbol: 'k',
    type: 'consonant_voiceless',
    exampleWords: ['cat', 'book', 'key'],
    tips: '舌后部抬起贴软腭后爆破。常见错误：读成 /g/（声带不该振）。',
  },
  {
    symbol: 'f',
    type: 'consonant_voiceless',
    exampleWords: ['fish', 'phone', 'off'],
    tips: '上齿轻触下唇，气流磨擦而出。常见错误：上齿不接触，读成 /h/。',
  },
  {
    symbol: 's',
    type: 'consonant_voiceless',
    exampleWords: ['sun', 'bus', 'rice'],
    tips: '舌尖靠近齿龈，气流从舌面窄缝擦出，像蛇声。常见错误：读成 /z/。',
  },
  {
    symbol: 'ʃ',
    type: 'consonant_voiceless',
    exampleWords: ['she', 'fish', 'station'],
    tips: '舌位后移、双唇微圆，先堵后擦。常见错误：嘴唇不收圆，读成 /s/。',
  },
  {
    symbol: 'θ',
    type: 'consonant_voiceless',
    exampleWords: ['think', 'three', 'mouth'],
    tips: '舌尖轻置于上下齿间出气，声带不振动。常见错误：舌尖收回齿龈读成 /s/（中式通病）。',
  },
  {
    symbol: 'tʃ',
    type: 'consonant_voiceless',
    exampleWords: ['chair', 'watch', 'teacher'],
    tips: '从 /t/ 快速滑到 /ʃ/，双唇微突。常见错误：读成汉语「欺」（太尖）。',
  },
  {
    symbol: 'tr',
    type: 'consonant_voiceless',
    exampleWords: ['tree', 'train', 'street'],
    tips: '/t/ 接到 /r/，舌尖先抵齿龈再上扬。常见错误：读成汉语「戳」。',
  },
  {
    symbol: 'ts',
    type: 'consonant_voiceless',
    exampleWords: ['cats', 'hats', 'students'],
    tips: '从 /t/ 滑到 /z/，多出现在词尾复数。常见错误：读成汉语「次」。',
  },
  {
    symbol: 'h',
    type: 'consonant_voiceless',
    exampleWords: ['hat', 'house', 'behind'],
    tips: '声门摩擦出气，声带不振动。常见错误：摩擦太重，读成 /x/（「赫」）。',
  },

  // ---------------- 浊辅音（17）----------------
  {
    symbol: 'b',
    type: 'consonant_voiced',
    exampleWords: ['book', 'cab', 'table'],
    tips: '双唇闭合爆破，声带振动（摸喉有震感）。常见错误：气流冲出太猛。',
  },
  {
    symbol: 'd',
    type: 'consonant_voiced',
    exampleWords: ['dog', 'red', 'ladder'],
    tips: '舌尖抵齿龈爆破，声带振动。常见错误：读成 /t/ 或汉语「特」。',
  },
  {
    symbol: 'g',
    type: 'consonant_voiced',
    exampleWords: ['go', 'bag', 'egg'],
    tips: '舌后部贴软腭爆破，声带振动。常见错误：收尾时多做一次爆破（中式 /gə/）。',
  },
  {
    symbol: 'v',
    type: 'consonant_voiced',
    exampleWords: ['very', 'love', 'seven'],
    tips: '上齿触下唇摩擦，声带振动。常见错误：读成 /w/（上齿离开）。',
  },
  {
    symbol: 'z',
    type: 'consonant_voiced',
    exampleWords: ['zoo', 'nose', 'is'],
    tips: '舌尖近齿龈摩擦，声带振动。常见错误：读成 /s/（声带不振）。',
  },
  {
    symbol: 'ʒ',
    type: 'consonant_voiced',
    exampleWords: ['measure', 'vision', 'television'],
    tips: '/ʃ/ 的浊音版：舌位后移、圆唇、声带振动。常见错误：读成 /ʃ/ 或 /r/。',
  },
  {
    symbol: 'ð',
    type: 'consonant_voiced',
    exampleWords: ['this', 'mother', 'weather'],
    tips: '舌尖置于齿间，声带振动。常见错误：舌尖收回读成 /z/ 或 /d/。',
  },
  {
    symbol: 'dʒ',
    type: 'consonant_voiced',
    exampleWords: ['job', 'bridge', 'page'],
    tips: '从 /d/ 滑到 /ʒ/，双唇微突，声带振动。常见错误：读成汉语「知」。',
  },
  {
    symbol: 'dr',
    type: 'consonant_voiced',
    exampleWords: ['dress', 'drive', 'children'],
    tips: '/d/ 接到 /r/，舌尖先抵齿龈再上扬。常见错误：读成汉语「朱」。',
  },
  {
    symbol: 'dz',
    type: 'consonant_voiced',
    exampleWords: ['beds', 'hands', 'words'],
    tips: '从 /d/ 滑到 /z/，多出现在词尾复数。常见错误：读成汉语「资」。',
  },
  {
    symbol: 'm',
    type: 'consonant_voiced',
    exampleWords: ['man', 'home', 'summer'],
    tips: '双唇闭合，气流从鼻腔出。常见错误：口腔漏气，鼻音发成「嗯+音」。',
  },
  {
    symbol: 'n',
    type: 'consonant_voiced',
    exampleWords: ['no', 'ten', 'dinner'],
    tips: '舌尖抵齿龈，气流从鼻腔出。常见错误：读成 /l/（ten/like 不分）。',
  },
  {
    symbol: 'ŋ',
    type: 'consonant_voiced',
    exampleWords: ['sing', 'morning', 'think'],
    tips: '舌后部抬贴软腭，气流从鼻腔出。常见错误：把 -ing 读成「因+格」。',
  },
  {
    symbol: 'l',
    type: 'consonant_voiced',
    exampleWords: ['like', 'ball', 'yellow'],
    tips: '舌尖抵齿龈，气流从舌两侧出。常见错误：舌尖不动，把 light 读成 night。',
  },
  {
    symbol: 'r',
    type: 'consonant_voiced',
    exampleWords: ['red', 'sorry', 'write'],
    tips: '舌尖上扬但不接触上腭，双唇微圆。常见错误：舌尖打颤或读成 /l/。',
  },
  {
    symbol: 'w',
    type: 'consonant_voiced',
    exampleWords: ['we', 'window', 'swim'],
    tips: '双唇收圆后快速滑向后面的元音。常见错误：读成 /v/。',
  },
  {
    symbol: 'j',
    type: 'consonant_voiced',
    exampleWords: ['yes', 'you', 'music'],
    tips: '舌前部向硬腭靠近，像很轻的「耶」。常见错误：摩擦太重读成 /ʒ/。',
  },
];
