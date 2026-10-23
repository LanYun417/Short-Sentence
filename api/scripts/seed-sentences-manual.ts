/**
 * 题库初始化：人工撰写题目 + Agnes 生图。
 *
 * 为什么需要它：上游生题接口（NVIDIA）账号级 429 时，`SentenceGenService` 的生文阶段
 * 一条也产不出来。此时用人工撰写的题目直接建库，只走生图管线（Agnes）补齐配图，
 * 保证客户端可用。
 *
 * 幂等：按 sentenceEn 去重，已存在的题目跳过；只给 `pending_image` 的题补图。
 *
 * 用法：
 *   npm run seed:sentences            # 建题 + 生图
 *   npm run seed:sentences -- --text-only   # 只建题，不生图
 */
import sharp from 'sharp';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AiCallLogService } from '../src/common/ai/ai-call-log.service.js';
import { AgnesImageProvider } from '../src/common/ai/agnes-image.provider.js';
import { FileService } from '../src/common/file/file.service.js';
import { imageGenConfig } from '../src/common/config/image-gen-config.js';

/** 单题定义。 */
interface SentenceSeed {
  /** 英文句子（唯一键） */
  en: string;
  /** 中文释义（用户端题干） */
  zh: string;
  /** 音标 */
  ipa: string;
  /** 场景构图提示词（英文，喂给生图模型） */
  scene: string;
  /** 难度：1 易 / 2 中 / 3 难 */
  difficulty: number;
  /** 场景分类名（与 sentence_category.name 对齐） */
  category: string;
}

/** 配图风格后缀（与 SentenceGenService 保持一致，保证全站画风统一）。 */
const IMAGE_STYLE_SUFFIX =
  'flat cartoon illustration style, clean vector art, soft cel shading, friendly characters, bright pastel colors, wide 16:9 composition, no text in image';

/** 生图并发度：Agnes 免费额度对突发很敏感，单并发最稳。 */
const IMAGE_CONCURRENCY = 1;
/** 两次生图之间的最小间隔（毫秒），避免触发每分钟速率限制。 */
const MIN_INTERVAL_MS = 12_000;
/** 单张图最多尝试次数（429 时按次数指数退避）。 */
const MAX_ATTEMPTS = 4;

const SEEDS: SentenceSeed[] = [
  // ── 日常生活 ──────────────────────────────────────────────
  {
    en: 'Could you help me carry these boxes upstairs?',
    zh: '你能帮我把这些箱子搬到楼上吗？',
    ipa: '/kʊd juː help miː ˈkæri ðiːz ˈbɒksɪz ˌʌpˈsteəz/',
    scene: 'Two friends in a stairwell, one holding a stack of cardboard boxes, the other reaching out to help',
    difficulty: 1,
    category: '日常生活',
  },
  {
    en: 'I usually wake up at seven and make my own breakfast.',
    zh: '我通常七点起床，自己做早餐。',
    ipa: '/aɪ ˈjuːʒuəli weɪk ʌp ət ˈsevn ænd meɪk maɪ əʊn ˈbrekfəst/',
    scene: 'A person in a sunny kitchen cracking eggs while a roommate pours coffee at the counter',
    difficulty: 1,
    category: '日常生活',
  },
  {
    en: "The Wi-Fi isn't working, so I'll restart the router.",
    zh: 'Wi-Fi 连不上了，我重启一下路由器。',
    ipa: '/ðə ˈwaɪfaɪ ˈɪznt ˈwɜːkɪŋ səʊ aɪl ˌriːˈstɑːt ðə ˈruːtə/',
    scene: 'A frustrated person kneeling by a router with blinking lights while another checks a laptop screen',
    difficulty: 2,
    category: '日常生活',
  },
  {
    en: "Don't forget to lock the door before you leave.",
    zh: '你走之前别忘了锁门。',
    ipa: '/dəʊnt fəˈɡet tuː lɒk ðə dɔː bɪˈfɔː juː liːv/',
    scene: 'One person at an open apartment door holding keys, reminding another who is putting on shoes',
    difficulty: 1,
    category: '日常生活',
  },
  {
    en: "I've been trying to cut down on screen time.",
    zh: '我一直在试着减少看屏幕的时间。',
    ipa: '/aɪv biːn ˈtraɪɪŋ tuː kʌt daʊn ɒn skriːn taɪm/',
    scene: 'Two people on a park bench, one putting a phone face down while the other nods approvingly',
    difficulty: 2,
    category: '日常生活',
  },
  {
    en: 'My neighbor keeps borrowing my tools without asking.',
    zh: '我的邻居总是不问一声就借走我的工具。',
    ipa: '/maɪ ˈneɪbə kiːps ˈbɒrəʊɪŋ maɪ tuːlz wɪˈðaʊt ˈɑːskɪŋ/',
    scene: 'A person gesturing at an empty toolbox while talking to a friend over a fence',
    difficulty: 2,
    category: '日常生活',
  },
  {
    en: 'We need to take out the recycling tonight.',
    zh: '我们今晚得把可回收垃圾拿出去。',
    ipa: '/wiː niːd tuː teɪk aʊt ðə ˌriːˈsaɪklɪŋ təˈnaɪt/',
    scene: 'Two roommates sorting bottles and cardboard into blue bins in a kitchen at night',
    difficulty: 1,
    category: '日常生活',
  },
  {
    en: 'The elevator is out of service, so we took the stairs.',
    zh: '电梯停运了，所以我们走了楼梯。',
    ipa: '/ði ˈelɪveɪtə ɪz aʊt əv ˈsɜːvɪs səʊ wiː tʊk ðə steəz/',
    scene: 'Two office workers climbing stairs past an out-of-order elevator sign, slightly out of breath',
    difficulty: 2,
    category: '日常生活',
  },
  {
    en: 'I finally got around to cleaning out the garage.',
    zh: '我终于腾出时间把车库清理干净了。',
    ipa: '/aɪ ˈfaɪnəli ɡɒt əˈraʊnd tuː ˈkliːnɪŋ aʊt ðə ˈɡærɑːʒ/',
    scene: 'A person in a cluttered garage holding a broom, another helping lift an old bicycle',
    difficulty: 2,
    category: '日常生活',
  },
  {
    en: 'Could you keep it down? The baby is finally asleep.',
    zh: '你们能小点声吗？宝宝好不容易睡着了。',
    ipa: '/kʊd juː kiːp ɪt daʊn ðə ˈbeɪbi ɪz ˈfaɪnəli əˈsliːp/',
    scene: 'A tired parent whispering at a doorway while two guests lower their voices on a sofa',
    difficulty: 1,
    category: '日常生活',
  },
  {
    en: "I'd rather stay in tonight and catch up on sleep.",
    zh: '我今晚只想待在家里补觉。',
    ipa: '/aɪd ˈrɑːðə steɪ ɪn təˈnaɪt ænd kætʃ ʌp ɒn sliːp/',
    scene: 'One person in pajamas declining an invitation while a friend stands at the door with a jacket on',
    difficulty: 2,
    category: '日常生活',
  },
  {
    en: "The tap's been dripping for three days straight.",
    zh: '水龙头已经连续滴了三天了。',
    ipa: '/ðə tæps biːn ˈdrɪpɪŋ fə θriː deɪz streɪt/',
    scene: 'A person pointing at a dripping kitchen tap while another holds a wrench and a towel',
    difficulty: 2,
    category: '日常生活',
  },
  {
    en: "Let's split the chores so nobody gets stuck with everything.",
    zh: '我们把家务分一分，别让某一个人全包了。',
    ipa: '/lets splɪt ðə tʃɔːz səʊ ˈnəʊbədi ɡets stʌk wɪð ˈevriθɪŋ/',
    scene: 'Two roommates writing a chore chart on a whiteboard stuck to a fridge',
    difficulty: 2,
    category: '日常生活',
  },
  {
    en: "I'm running low on coffee, so I'll grab some on the way home.",
    zh: '我咖啡快喝完了，回家路上买点。',
    ipa: '/aɪm ˈrʌnɪŋ ləʊ ɒn ˈkɒfi səʊ aɪl ɡræb sʌm ɒn ðə weɪ həʊm/',
    scene: 'A person peering into an almost empty coffee tin while talking to a partner in a kitchen',
    difficulty: 2,
    category: '日常生活',
  },
  {
    en: 'She hung the laundry out to dry in the sun.',
    zh: '她把洗好的衣服挂出去晒。',
    ipa: '/ʃiː hʌŋ ðə ˈlɒndri aʊt tuː draɪ ɪn ðə sʌn/',
    scene: 'A woman hanging clothes on a balcony line while a neighbor waters plants next door',
    difficulty: 2,
    category: '日常生活',
  },
  {
    en: 'We should probably winterize the balcony this weekend.',
    zh: '我们这周末该把阳台做过冬准备了。',
    ipa: '/wiː ʃʊd ˈprɒbəbli ˈwɪntəraɪz ðə ˈbælkəni ðɪs ˌwiːkˈend/',
    scene: 'A couple wrapping potted plants on a balcony with frost visible on the railing',
    difficulty: 3,
    category: '日常生活',
  },
  {
    en: "He's been putting off fixing the leaky roof for months.",
    zh: '他拖着修漏雨的屋顶已经好几个月了。',
    ipa: '/hiːz biːn ˈpʊtɪŋ ɒf ˈfɪksɪŋ ðə ˈliːki ruːf fə mʌnθs/',
    scene: 'A person on a ladder inspecting a stained ceiling while another holds a bucket below',
    difficulty: 2,
    category: '日常生活',
  },

  // ── 职场办公 ──────────────────────────────────────────────
  {
    en: "Let's circle back to that after the stand-up.",
    zh: '我们站会之后再回头聊那件事。',
    ipa: '/lets ˈsɜːkl bæk tuː ðæt ˈɑːftə ðə ˈstænd ʌp/',
    scene: 'Two colleagues leaving a morning stand-up meeting, one gesturing to a laptop',
    difficulty: 2,
    category: '职场办公',
  },
  {
    en: "I'll loop you in once the contract is signed.",
    zh: '合同一签我就把你拉进来。',
    ipa: '/aɪl luːp juː ɪn wʌns ðə ˈkɒntrækt ɪz saɪnd/',
    scene: 'A manager at a desk holding a contract, speaking to a colleague standing nearby',
    difficulty: 2,
    category: '职场办公',
  },
  {
    en: 'Could you walk me through the numbers again?',
    zh: '你能再带我过一遍这些数据吗？',
    ipa: '/kʊd juː wɔːk miː θruː ðə ˈnʌmbəz əˈɡen/',
    scene: 'Two colleagues at a monitor covered in charts, one pointing at a line graph',
    difficulty: 2,
    category: '职场办公',
  },
  {
    en: 'The deadline got pushed to next Thursday.',
    zh: '截止日期推迟到下周四了。',
    ipa: '/ðə ˈdedlaɪn ɡɒt pʊʃt tuː nekst ˈθɜːzdeɪ/',
    scene: 'A team lead announcing a schedule change in front of a wall calendar',
    difficulty: 1,
    category: '职场办公',
  },
  {
    en: "I'd rather not commit to a date before the review.",
    zh: '在评审之前我不想敲定日期。',
    ipa: '/aɪd ˈrɑːðə nɒt kəˈmɪt tuː ə deɪt bɪˈfɔː ðə rɪˈvjuː/',
    scene: 'Two people in a meeting room, one raising a hand cautiously while the other holds a planner',
    difficulty: 2,
    category: '职场办公',
  },
  {
    en: "Let's take this offline and hash out the details.",
    zh: '我们私下再细聊，把细节敲定。',
    ipa: '/lets teɪk ðɪs ˌɒflaɪn ænd hæʃ aʊt ðə ˈdiːteɪlz/',
    scene: 'Two colleagues stepping into a hallway from a noisy meeting room, speaking quietly',
    difficulty: 3,
    category: '职场办公',
  },
  {
    en: "She's been shouldering most of the client work.",
    zh: '客户端的工作大部分都是她在扛。',
    ipa: '/ʃiːz biːn ˈʃəʊldərɪŋ məʊst əv ðə ˈklaɪənt wɜːk/',
    scene: 'A colleague juggling folders and a phone at a desk, another looking concerned',
    difficulty: 3,
    category: '职场办公',
  },
  {
    en: 'I need to run this by legal before we send it out.',
    zh: '发出去之前我得让法务过一遍。',
    ipa: '/aɪ niːd tuː rʌn ðɪs baɪ ˈliːɡl bɪˈfɔː wiː send ɪt aʊt/',
    scene: 'A person holding a printed document, talking to a colleague in a glass-walled office',
    difficulty: 2,
    category: '职场办公',
  },
  {
    en: "We're spinning up a small team for the migration.",
    zh: '我们正在为迁移组建一个小团队。',
    ipa: '/wɪə ˈspɪnɪŋ ʌp ə smɔːl tiːm fə ðə maɪˈɡreɪʃn/',
    scene: 'Two managers sketching an org chart on a whiteboard with sticky notes',
    difficulty: 2,
    category: '职场办公',
  },
  {
    en: "Don't sugarcoat it — just tell me where we stand.",
    zh: '别绕弯子，直接说我们现在是什么情况。',
    ipa: '/dəʊnt ˈʃʊɡəkəʊt ɪt dʒʌst tel miː weə wiː stænd/',
    scene: 'A serious conversation between two colleagues across a desk, one leaning forward',
    difficulty: 2,
    category: '职场办公',
  },
  {
    en: 'The merger paperwork is stuck in compliance.',
    zh: '合并的文件卡在合规环节了。',
    ipa: '/ðə ˈmɜːdʒə ˈpeɪpəwɜːk ɪz stʌk ɪn kəmˈplaɪəns/',
    scene: 'Two people in suits looking at a stack of binders in a corporate corridor',
    difficulty: 3,
    category: '职场办公',
  },
  {
    en: "I'll draft the proposal and you can red-team it.",
    zh: '我来起草方案，你来做反面挑刺。',
    ipa: '/aɪl drɑːft ðə prəˈpəʊzl ænd juː kæn red tiːm ɪt/',
    scene: 'One colleague typing at a laptop while another reviews a printed proposal with a pen',
    difficulty: 3,
    category: '职场办公',
  },
  {
    en: 'We overspent on ads this quarter, so budgets are tight.',
    zh: '这个季度广告超支了，所以预算很紧。',
    ipa: '/wiː ˌəʊvəˈspent ɒn ædz ðɪs ˈkwɔːtə səʊ ˈbʌdʒɪts ə taɪt/',
    scene: 'Two colleagues reviewing expense charts on a screen with worried expressions',
    difficulty: 2,
    category: '职场办公',
  },
  {
    en: 'He got promoted after turning the team around.',
    zh: '他把团队带出头之后就升职了。',
    ipa: '/hiː ɡɒt prəˈməʊtɪd ˈɑːftə ˈtɜːnɪŋ ðə tiːm əˈraʊnd/',
    scene: 'Colleagues applauding a smiling person in an open-plan office',
    difficulty: 2,
    category: '职场办公',
  },
  {
    en: "Let's not boil the ocean on the first release.",
    zh: '第一版我们别想着一步到位全做完。',
    ipa: '/lets nɒt bɔɪl ði ˈəʊʃn ɒn ðə fɜːst rɪˈliːs/',
    scene: 'A product manager narrowing a long feature list on a whiteboard while a developer nods',
    difficulty: 3,
    category: '职场办公',
  },
  {
    en: "I'm swamped — can we push the one-on-one to Friday?",
    zh: '我忙不过来了，一对一能挪到周五吗？',
    ipa: '/aɪm swɒmpt kæn wiː pʊʃ ðə wʌn ɒn wʌn tuː ˈfraɪdeɪ/',
    scene: 'A person at a desk piled with papers speaking apologetically to a colleague',
    difficulty: 2,
    category: '职场办公',
  },
  {
    en: 'The client wants a full refund for the delayed shipment.',
    zh: '客户因为发货延误要求全额退款。',
    ipa: '/ðə ˈklaɪənt wɒnts ə fʊl ˈriːfʌnd fə ðə dɪˈleɪd ˈʃɪpmənt/',
    scene: 'Two colleagues on a call with headsets, one holding a shipping manifest',
    difficulty: 2,
    category: '职场办公',
  },

  // ── 旅行出行 ──────────────────────────────────────────────
  {
    en: 'Is this seat taken, or can I sit here?',
    zh: '这个位子有人吗，还是我可以坐？',
    ipa: '/ɪz ðɪs siːt ˈteɪkən ɔː kæn aɪ sɪt hɪə/',
    scene: 'A traveler gesturing to an empty train seat while the seated passenger looks up',
    difficulty: 1,
    category: '旅行出行',
  },
  {
    en: 'My flight got delayed by two hours.',
    zh: '我的航班延误了两个小时。',
    ipa: '/maɪ flaɪt ɡɒt dɪˈleɪd baɪ tuː ˈaʊəz/',
    scene: 'Two passengers looking at a departure board showing a delayed flight',
    difficulty: 1,
    category: '旅行出行',
  },
  {
    en: 'Could you recommend somewhere off the beaten track?',
    zh: '你能推荐一个游客不多的地方吗？',
    ipa: '/kʊd juː ˌrekəˈmend ˈsʌmweə ɒf ðə ˈbiːtn træk/',
    scene: 'A traveler asking a local at a small information kiosk, pointing at a map',
    difficulty: 2,
    category: '旅行出行',
  },
  {
    en: 'We missed our connection because of the layover.',
    zh: '因为中转时间不够，我们没赶上联运航班。',
    ipa: '/wiː mɪst ˈaʊə kəˈnekʃn bɪˈkɒz əv ðə ˈleɪəʊvə/',
    scene: 'Two travelers running through an airport corridor with rolling suitcases',
    difficulty: 2,
    category: '旅行出行',
  },
  {
    en: 'How much is a round trip to the city center?',
    zh: '到市中心的往返票多少钱？',
    ipa: '/haʊ mʌtʃ ɪz ə raʊnd trɪp tuː ðə ˈsɪti ˈsentə/',
    scene: 'A traveler buying a ticket at a station counter from a clerk behind glass',
    difficulty: 1,
    category: '旅行出行',
  },
  {
    en: "I'd like to check in and upgrade to an aisle seat.",
    zh: '我想办值机并换成靠过道的座位。',
    ipa: '/aɪd laɪk tuː tʃek ɪn ænd ʌpˈɡreɪd tuː ən aɪl siːt/',
    scene: 'A passenger at an airline check-in desk handing over a passport',
    difficulty: 2,
    category: '旅行出行',
  },
  {
    en: 'The passport control line moved surprisingly fast.',
    zh: '护照检查的队伍动得出奇地快。',
    ipa: '/ðə ˈpɑːspɔːt kənˈtrəʊl laɪn muːvd səˈpraɪzɪŋli fɑːst/',
    scene: 'Two travelers in an airport queue, one looking relieved at the moving line',
    difficulty: 2,
    category: '旅行出行',
  },
  {
    en: "Let's grab a taxi instead of dragging these bags.",
    zh: '我们打车吧，别拖着这些行李走了。',
    ipa: '/lets ɡræb ə ˈtæksi ɪnˈsted əv ˈdræɡɪŋ ðiːz bæɡz/',
    scene: 'Two travelers with heavy suitcases hailing a taxi at a curb',
    difficulty: 1,
    category: '旅行出行',
  },
  {
    en: 'I always overpack and end up carrying way too much.',
    zh: '我老是塞太多，结果背一路太重的东西。',
    ipa: '/aɪ ˈɔːlweɪz ˌəʊvəˈpæk ænd end ʌp ˈkæriɪŋ weɪ tuː mʌtʃ/',
    scene: 'A traveler struggling to close an overflowing suitcase while a friend watches amused',
    difficulty: 2,
    category: '旅行出行',
  },
  {
    en: 'The hotel is fully booked, but they found us a nearby one.',
    zh: '酒店满房了，但他们帮我们找了附近一家。',
    ipa: '/ðə həʊˈtel ɪz ˈfʊli bʊkt bʌt ðeɪ faʊnd ʌs ə ˌnɪəˈbaɪ wʌn/',
    scene: 'A receptionist shaking her head at a couple, then pointing out the window',
    difficulty: 2,
    category: '旅行出行',
  },
  {
    en: 'Do I need to declare anything at customs?',
    zh: '我在海关需要申报什么吗？',
    ipa: '/duː aɪ niːd tuː dɪˈkleə ˈeniθɪŋ ət ˈkʌstəmz/',
    scene: 'A traveler at a customs counter handing a form to an officer',
    difficulty: 2,
    category: '旅行出行',
  },
  {
    en: 'We got hopelessly lost wandering the old town.',
    zh: '我们在老城里转得完全迷路了。',
    ipa: '/wiː ɡɒt ˈhəʊpləsli lɒst ˈwɒndərɪŋ ði əʊld taʊn/',
    scene: 'Two travelers with a paper map at a narrow cobblestone alley intersection',
    difficulty: 2,
    category: '旅行出行',
  },
  {
    en: 'The train platform changed at the last minute.',
    zh: '站台在最后一刻变了。',
    ipa: '/ðə treɪn ˈplætfɔːm tʃeɪndʒd ət ðə lɑːst ˈmɪnɪt/',
    scene: 'Two passengers sprinting across a station platform with an announcement board overhead',
    difficulty: 1,
    category: '旅行出行',
  },
  {
    en: "I'd rather rent a bike and explore at my own pace.",
    zh: '我宁愿租辆自行车按自己的节奏逛。',
    ipa: '/aɪd ˈrɑːðə rent ə baɪk ænd ɪkˈsplɔː ət maɪ əʊn peɪs/',
    scene: 'A traveler renting a bicycle from a shop owner on a sunny street',
    difficulty: 2,
    category: '旅行出行',
  },
  {
    en: 'Keep your boarding pass handy for the gate check.',
    zh: '登机牌留着，检票口要用的。',
    ipa: '/kiːp jɔː ˈbɔːdɪŋ pɑːs ˈhændi fə ðə ɡeɪt tʃek/',
    scene: 'A traveler holding a boarding pass while an airline agent checks it at the gate',
    difficulty: 2,
    category: '旅行出行',
  },
  {
    en: 'The local bus only takes exact change.',
    zh: '当地的公交车只收正好的零钱。',
    ipa: '/ðə ˈləʊkl bʌs ˈəʊnli teɪks ɪɡˈzækt tʃeɪndʒ/',
    scene: 'A passenger counting coins by a bus driver while other riders wait',
    difficulty: 2,
    category: '旅行出行',
  },
  {
    en: 'We almost missed the last ferry back to the island.',
    zh: '我们差点错过回岛的最后一班渡轮。',
    ipa: '/wiː ˈɔːlməʊst mɪst ðə lɑːst ˈferi bæk tuː ði ˈaɪlənd/',
    scene: 'Two travelers running toward a departing ferry at a harbor at dusk',
    difficulty: 2,
    category: '旅行出行',
  },

  // ── 餐饮美食 ──────────────────────────────────────────────
  {
    en: 'Could we get a table for two by the window?',
    zh: '能给我们一个靠窗的两人位吗？',
    ipa: '/kʊd wiː ɡet ə teɪbl fə tuː baɪ ðə ˈwɪndəʊ/',
    scene: 'A couple speaking to a host at a restaurant entrance, gesturing to a window table',
    difficulty: 1,
    category: '餐饮美食',
  },
  {
    en: "I'll have the grilled salmon, please.",
    zh: '我要一份烤三文鱼。',
    ipa: '/aɪl hæv ðə ɡrɪld ˈsæmən pliːz/',
    scene: 'A diner pointing at a menu while a waiter writes the order on a notepad',
    difficulty: 1,
    category: '餐饮美食',
  },
  {
    en: 'Are there any dishes without peanuts?',
    zh: '有不含花生的菜吗？',
    ipa: '/ɑː ðeə ˈeni ˈdɪʃɪz wɪˈðaʊt ˈpiːnʌts/',
    scene: 'A diner asking a waiter about ingredients, pointing at a menu item',
    difficulty: 1,
    category: '餐饮美食',
  },
  {
    en: "The kitchen is backed up, so it'll be another twenty minutes.",
    zh: '厨房积单了，还要再等二十分钟。',
    ipa: '/ðə ˈkɪtʃɪn ɪz bækt ʌp səʊ ɪtl biː əˈnʌðə ˈtwenti ˈmɪnɪts/',
    scene: 'A waiter apologizing to a seated couple in a busy restaurant',
    difficulty: 2,
    category: '餐饮美食',
  },
  {
    en: "Could we get the bill? We're in a bit of a hurry.",
    zh: '能结账吗？我们有点赶时间。',
    ipa: '/kʊd wiː ɡet ðə bɪl wɪər ɪn ə bɪt əv ə ˈhʌri/',
    scene: 'A diner waving to a waiter while a companion checks a watch',
    difficulty: 1,
    category: '餐饮美食',
  },
  {
    en: 'This soup could use a little more salt.',
    zh: '这汤可以再加点盐。',
    ipa: '/ðɪs suːp kʊd juːz ə ˈlɪtl mɔː sɒlt/',
    scene: 'A diner tasting soup with a spoon while another reaches for the salt shaker',
    difficulty: 2,
    category: '餐饮美食',
  },
  {
    en: "I'm allergic to shellfish, so let's order something else.",
    zh: '我对贝类过敏，我们点别的吧。',
    ipa: '/aɪm əˈlɜːdʒɪk tuː ˈʃelfɪʃ səʊ lets ˈɔːdə ˈsʌmθɪŋ els/',
    scene: 'A diner shaking their head at a menu while a friend looks concerned',
    difficulty: 2,
    category: '餐饮美食',
  },
  {
    en: 'The portion sizes here are huge for the price.',
    zh: '这里的分量对这个价格来说太大了。',
    ipa: '/ðə ˈpɔːʃn saɪzɪz hɪər ə hjuːdʒ fə ðə praɪs/',
    scene: 'Two diners staring at oversized plates on a small cafe table',
    difficulty: 2,
    category: '餐饮美食',
  },
  {
    en: 'Would you like that for here or to go?',
    zh: '您是在这吃还是带走？',
    ipa: '/wʊd juː laɪk ðæt fə hɪə ɔː tuː ɡəʊ/',
    scene: 'A cashier at a counter holding a paper bag, asking a customer',
    difficulty: 1,
    category: '餐饮美食',
  },
  {
    en: "I'll treat you this time — you paid last round.",
    zh: '这次我请，上一轮是你付的。',
    ipa: '/aɪl triːt juː ðɪs taɪm juː peɪd lɑːst raʊnd/',
    scene: 'One diner reaching for the bill while the other raises a hand to object',
    difficulty: 2,
    category: '餐饮美食',
  },
  {
    en: 'The steak is cooked exactly how I asked.',
    zh: '牛排的火候正好是我要的。',
    ipa: '/ðə steɪk ɪz kʊkt ɪɡˈzæktli haʊ aɪ ɑːskt/',
    scene: 'A diner cutting into a steak with a satisfied expression, waiter standing by',
    difficulty: 2,
    category: '餐饮美食',
  },
  {
    en: "Let's split the appetizers and share a couple of mains.",
    zh: '我们前菜分着吃，主菜点两份分着尝。',
    ipa: '/lets splɪt ði ˈæpɪtaɪzəz ænd ʃeə ə ˈkʌpl əv meɪnz/',
    scene: 'Two diners discussing a menu together, pointing at different dishes',
    difficulty: 2,
    category: '餐饮美食',
  },
  {
    en: 'Do you have anything vegetarian on the menu?',
    zh: '菜单上有素食吗？',
    ipa: '/duː juː hæv ˈeniθɪŋ ˌvedʒəˈteəriən ɒn ðə ˈmenjuː/',
    scene: 'A diner asking a waiter while holding a menu open',
    difficulty: 1,
    category: '餐饮美食',
  },
  {
    en: 'The coffee here is strong enough to wake the dead.',
    zh: '这里的咖啡浓得能把死人唤醒。',
    ipa: '/ðə ˈkɒfi hɪər ɪz strɒŋ ɪˈnʌf tuː weɪk ðə ded/',
    scene: 'Two friends laughing over espresso cups at a small cafe counter',
    difficulty: 2,
    category: '餐饮美食',
  },
  {
    en: 'We waited forty minutes and nobody even took our order.',
    zh: '我们等了四十分钟都没人来点单。',
    ipa: '/wiː ˈweɪtɪd ˈfɔːti ˈmɪnɪts ænd ˈnəʊbədi ˈiːvn tʊk ˈaʊər ˈɔːdə/',
    scene: 'An annoyed couple at a table looking around for staff in a half-empty restaurant',
    difficulty: 2,
    category: '餐饮美食',
  },
  {
    en: 'Could you wrap up the leftovers for me?',
    zh: '能把剩菜帮我打包吗？',
    ipa: '/kʊd juː ræp ʌp ðə ˈleftəʊvəz fə miː/',
    scene: 'A diner handing a plate to a waiter who holds a takeaway box',
    difficulty: 2,
    category: '餐饮美食',
  },
  {
    en: "The chef's tasting menu changes with the season.",
    zh: '主厨品鉴菜单随季节更换。',
    ipa: '/ðə ʃefs ˈteɪstɪŋ ˈmenjuː ˈtʃeɪndʒɪz wɪð ðə ˈsiːzn/',
    scene: 'A chef explaining dishes to a seated guest in an open kitchen restaurant',
    difficulty: 3,
    category: '餐饮美食',
  },

  // ── 社交闲聊 ──────────────────────────────────────────────
  {
    en: 'Long time no see — how have you been?',
    zh: '好久不见，你最近怎么样？',
    ipa: '/lɒŋ taɪm nəʊ siː haʊ hæv juː biːn/',
    scene: 'Two old friends greeting each other warmly on a street corner',
    difficulty: 1,
    category: '社交闲聊',
  },
  {
    en: 'I heard you moved across the country.',
    zh: '我听说你搬到国家另一头了。',
    ipa: '/aɪ hɜːd juː muːvd əˈkrɒs ðə ˈkʌntri/',
    scene: 'Two friends chatting over coffee, one leaning in with interest',
    difficulty: 2,
    category: '社交闲聊',
  },
  {
    en: 'We should catch up properly over coffee sometime.',
    zh: '我们该找个时间喝杯咖啡好好聊聊。',
    ipa: '/wiː ʃʊd kætʃ ʌp ˈprɒpəli ˈəʊvə ˈkɒfi ˈsʌmtaɪm/',
    scene: 'Two acquaintances exchanging phone numbers outside a cafe',
    difficulty: 1,
    category: '社交闲聊',
  },
  {
    en: "Sorry I'm late — the traffic was brutal.",
    zh: '抱歉我迟到了，路太堵了。',
    ipa: '/ˈsɒri aɪm leɪt ðə ˈtræfɪk wɒz ˈbruːtl/',
    scene: 'A person arriving breathless at a restaurant table where a friend waits',
    difficulty: 1,
    category: '社交闲聊',
  },
  {
    en: "You won't believe who I ran into at the airport.",
    zh: '你绝对想不到我在机场碰到谁了。',
    ipa: '/juː wəʊnt bɪˈliːv huː aɪ ræn ˈɪntuː ət ði ˈeəpɔːt/',
    scene: 'A friend leaning across a cafe table excitedly telling a story',
    difficulty: 2,
    category: '社交闲聊',
  },
  {
    en: "Let's not make it weird — I just wanted to check in.",
    zh: '别搞得尴尬，我就是想问候一声。',
    ipa: '/lets nɒt meɪk ɪt wɜːd aɪ dʒʌst ˈwɒntɪd tuː tʃek ɪn/',
    scene: 'Two people in an awkward conversation at a doorway, one holding a phone',
    difficulty: 2,
    category: '社交闲聊',
  },
  {
    en: "I'm not great at keeping in touch, honestly.",
    zh: '说实话，我不太擅长和人保持联系。',
    ipa: '/aɪm nɒt ɡreɪt ət ˈkiːpɪŋ ɪn tʌtʃ ˈɒnɪstli/',
    scene: 'A person speaking candidly to a friend on a park bench',
    difficulty: 2,
    category: '社交闲聊',
  },
  {
    en: 'Did you mean what you said earlier, or were you joking?',
    zh: '你刚才说的是认真的还是开玩笑？',
    ipa: '/dɪd juː miːn wɒt juː sed ˈɜːliə ɔː wɜː juː ˈdʒəʊkɪŋ/',
    scene: 'Two friends in a serious conversation across a kitchen table',
    difficulty: 2,
    category: '社交闲聊',
  },
  {
    en: "She's the kind of person who remembers everyone's birthday.",
    zh: '她是那种记得所有人生日的人。',
    ipa: '/ʃiːz ðə kaɪnd əv ˈpɜːsn huː rɪˈmembəz ˈevriwʌnz ˈbɜːθdeɪ/',
    scene: 'Two people talking about a mutual friend at a party',
    difficulty: 2,
    category: '社交闲聊',
  },
  {
    en: "I'd rather you didn't post that picture of me.",
    zh: '那张我的照片你还是别发了。',
    ipa: '/aɪd ˈrɑːðə juː ˈdɪdnt pəʊst ðæt ˈpɪktʃə əv miː/',
    scene: 'A person asking a friend to delete a photo on a phone screen',
    difficulty: 2,
    category: '社交闲聊',
  },
  {
    en: 'We drifted apart after we graduated, as people do.',
    zh: '毕业后我们就慢慢疏远了，大家都这样。',
    ipa: '/wiː drɪftɪd əˈpɑːt ˈɑːftə wiː ˈɡrædʒueɪtɪd æz ˈpiːpl duː/',
    scene: 'Two former classmates meeting by chance at a reunion, slightly awkward',
    difficulty: 2,
    category: '社交闲聊',
  },
  {
    en: "He apologizes like it's a competition he wants to win.",
    zh: '他道歉的样子像在参加一场想赢的比赛。',
    ipa: '/hiː əˈpɒlədʒaɪz laɪk ɪts ə ˌkɒmpəˈtɪʃn hiː wɒnts tuː wɪn/',
    scene: 'Two friends exchanging a knowing look while a third talks animatedly',
    difficulty: 3,
    category: '社交闲聊',
  },
  {
    en: "I'm throwing a small dinner thing on Saturday — you in?",
    zh: '我周六办个小聚餐，你来吗？',
    ipa: '/aɪm ˈθrəʊɪŋ ə smɔːl ˈdɪnə θɪŋ ɒn ˈsætədeɪ juː ɪn/',
    scene: 'A host inviting a friend in a hallway, holding a shopping bag of groceries',
    difficulty: 2,
    category: '社交闲聊',
  },
  {
    en: "Let's agree to disagree and order dessert.",
    zh: '我们求同存异，先点甜品吧。',
    ipa: '/lets əˈɡriː tuː ˌdɪsəˈɡriː ænd ˈɔːdə dɪˈzɜːt/',
    scene: 'Two diners laughing off an argument while a dessert menu sits between them',
    difficulty: 2,
    category: '社交闲聊',
  },
  {
    en: "You can always crash on my couch if you're in town.",
    zh: '你要是来这边，随时可以睡我沙发。',
    ipa: '/juː kæn ˈɔːlweɪz kræʃ ɒn maɪ kaʊtʃ ɪf jɔːr ɪn taʊn/',
    scene: 'A host showing a guest a living room couch with a folded blanket',
    difficulty: 2,
    category: '社交闲聊',
  },
  {
    en: "I didn't mean to overshare — forget I said that.",
    zh: '我不是要说这么多的，忘了我那句话吧。',
    ipa: '/aɪ ˈdɪdnt miːn tuː ˌəʊvəˈʃeə fəˈɡet aɪ sed ðæt/',
    scene: 'A person covering their face slightly while a friend smiles reassuringly',
    difficulty: 2,
    category: '社交闲聊',
  },

  // ── 学习成长 ──────────────────────────────────────────────
  {
    en: 'Could you explain that grammar point one more time?',
    zh: '你能再解释一遍那个语法点吗？',
    ipa: '/kʊd juː ɪkˈspleɪn ðæt ˈɡræmə pɔɪnt wʌn mɔː taɪm/',
    scene: 'A student asking a tutor at a desk covered with notebooks',
    difficulty: 1,
    category: '学习成长',
  },
  {
    en: "I've been reviewing my notes every evening.",
    zh: '我每天晚上都在复习笔记。',
    ipa: '/aɪv biːn rɪˈvjuːɪŋ maɪ nəʊts ˈevri ˈiːvnɪŋ/',
    scene: 'A student reading notes at a desk lamp while a roommate studies nearby',
    difficulty: 1,
    category: '学习成长',
  },
  {
    en: 'Repetition beats cramming, every single time.',
    zh: '反复练习每次都胜过临时抱佛脚。',
    ipa: '/ˌrepəˈtɪʃn biːts ˈkræmɪŋ ˈevri ˈsɪŋɡl taɪm/',
    scene: 'A teacher explaining study habits to a student in a library',
    difficulty: 2,
    category: '学习成长',
  },
  {
    en: "Don't be afraid to make mistakes out loud.",
    zh: '别怕开口出错。',
    ipa: '/dəʊnt biː əˈfreɪd tuː meɪk mɪˈsteɪks aʊt laʊd/',
    scene: 'A language tutor encouraging a nervous student in a small classroom',
    difficulty: 1,
    category: '学习成长',
  },
  {
    en: 'I pick up new words faster when I see them in context.',
    zh: '单词放在语境里我学得快得多。',
    ipa: '/aɪ pɪk ʌp njuː wɜːdz ˈfɑːstə wen aɪ siː ðem ɪn ˈkɒntekst/',
    scene: 'A student highlighting sentences in a book while talking to a study partner',
    difficulty: 2,
    category: '学习成长',
  },
  {
    en: 'The tutor corrected my pronunciation gently.',
    zh: '老师很温和地纠正了我的发音。',
    ipa: '/ðə ˈtjuːtə kəˈrektɪd maɪ prəˌnʌnsiˈeɪʃn ˈdʒentli/',
    scene: 'A tutor and student practicing pronunciation face to face at a table',
    difficulty: 2,
    category: '学习成长',
  },
  {
    en: 'Set a goal you can actually keep up with.',
    zh: '定一个你真能坚持的目标。',
    ipa: '/set ə ɡəʊl juː kæn ˈæktʃuəli kiːp ʌp wɪð/',
    scene: 'A mentor pointing at a simple goal list while a student nods',
    difficulty: 2,
    category: '学习成长',
  },
  {
    en: 'I quit the course because the pace was too fast.',
    zh: '我退掉了那门课，节奏太快了。',
    ipa: '/aɪ kwɪt ðə kɔːs bɪˈkɒz ðə peɪs wɒz tuː fɑːst/',
    scene: 'Two students talking in a campus corridor, one looking relieved',
    difficulty: 2,
    category: '学习成长',
  },
  {
    en: 'Reading aloud helps me remember phrases.',
    zh: '大声朗读能帮我记住短语。',
    ipa: '/ˈriːdɪŋ əˈlaʊd helps miː rɪˈmembə ˈfreɪzɪz/',
    scene: 'A student reading a book aloud at a desk while a classmate listens',
    difficulty: 1,
    category: '学习成长',
  },
  {
    en: 'He aced the exam without pulling an all-nighter.',
    zh: '他没通宵就考了高分。',
    ipa: '/hiː eɪst ði ɪɡˈzæm wɪˈðaʊt ˈpʊlɪŋ ən ˈɔːl naɪtə/',
    scene: 'Two students comparing results outside an exam hall, one looking amazed',
    difficulty: 3,
    category: '学习成长',
  },
  {
    en: 'Learning a language is mostly about showing up.',
    zh: '学语言主要靠的是持续出现。',
    ipa: '/ˈlɜːnɪŋ ə ˈlæŋɡwɪdʒ ɪz ˈməʊstli əˈbaʊt ˈʃəʊɪŋ ʌp/',
    scene: 'A teacher writing a simple habit chart on a classroom board',
    difficulty: 2,
    category: '学习成长',
  },
  {
    en: 'I keep a running list of words I keep forgetting.',
    zh: '我有一个常忘单词的滚动清单。',
    ipa: '/aɪ kiːp ə ˈrʌnɪŋ lɪst əv wɜːdz aɪ kiːp fəˈɡetɪŋ/',
    scene: 'A student writing vocabulary in a small notebook at a cafe table',
    difficulty: 2,
    category: '学习成长',
  },
  {
    en: 'Fluency is just confidence wearing a disguise.',
    zh: '流利不过是化了妆的自信。',
    ipa: '/ˈfluːənsi ɪz dʒʌst ˈkɒnfɪdəns ˈweərɪŋ ə dɪsˈɡaɪz/',
    scene: 'A tutor smiling while a student speaks with growing confidence',
    difficulty: 3,
    category: '学习成长',
  },
  {
    en: 'Ten minutes a day beats three hours on Sunday.',
    zh: '每天十分钟胜过周日三个小时。',
    ipa: '/ten ˈmɪnɪts ə deɪ biːts θriː ˈaʊəz ɒn ˈsʌndeɪ/',
    scene: 'A mentor showing a calendar with small daily checkmarks to a student',
    difficulty: 2,
    category: '学习成长',
  },
  {
    en: 'Try describing the picture instead of translating it.',
    zh: '试着描述这幅图，而不是翻译它。',
    ipa: '/traɪ dɪˈskraɪbɪŋ ðə ˈpɪktʃə ɪnˈsted əv trænzˈleɪtɪŋ ɪt/',
    scene: 'A tutor pointing at an illustration while a student describes it in English',
    difficulty: 2,
    category: '学习成长',
  },
  {
    en: 'Practice is the shortest path to sounding natural.',
    zh: '练习是听起来最自然的最短路径。',
    ipa: '/ˈpræktɪs ɪz ðə ˈʃɔːtəst pɑːθ tuː ˈsaʊndɪŋ ˈnætʃrəl/',
    scene: 'A student practicing a dialogue with a tutor in a bright study room',
    difficulty: 2,
    category: '学习成长',
  },
];

/** 并发执行（简单 worker pool，避免一次性打满上游）。 */
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }
      await worker(items[index] as T);
    }
  });
  await Promise.all(runners);
}

async function main(): Promise<void> {
  const textOnly = process.argv.includes('--text-only');
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    // 1. 分类名 → id
    const categories = await prisma.sentenceCategory.findMany({ select: { id: true, name: true } });
    const categoryIdOf = new Map(categories.map((row) => [row.name, row.id]));
    const missing = [...new Set(SEEDS.map((s) => s.category))].filter((name) => !categoryIdOf.has(name));
    if (missing.length > 0) {
      throw new Error(`以下分类在库中不存在：${missing.join('、')}（先跑 npm run seed）`);
    }

    // 2. 建题（按 sentenceEn 幂等去重）
    let inserted = 0;
    let skipped = 0;
    for (const seed of SEEDS) {
      const existing = await prisma.sentence.findUnique({ where: { sentenceEn: seed.en }, select: { id: true } });
      if (existing) {
        skipped += 1;
        continue;
      }
      await prisma.sentence.create({
        data: {
          categoryId: categoryIdOf.get(seed.category) as bigint,
          sentenceEn: seed.en,
          translationZh: seed.zh,
          ipa: seed.ipa,
          scenePrompt: seed.scene,
          difficulty: seed.difficulty,
          source: 'manual',
          status: 'pending_image',
          imageFileId: 0n,
        },
      });
      inserted += 1;
    }
    console.log(`题目：新增 ${inserted}，已存在 ${skipped}，合计 ${SEEDS.length}`);

    if (textOnly) {
      console.log('已指定 --text-only，跳过生图。');
      return;
    }

    // 3. 给缺图题目补配图（Agnes）
    const pending = await prisma.sentence.findMany({
      where: { status: 'pending_image', imageFileId: 0n },
      select: { id: true, scenePrompt: true },
      orderBy: { id: 'asc' },
    });
    if (pending.length === 0) {
      console.log('没有待生图的题目，结束。');
      return;
    }
    console.log(`待生图：${pending.length} 张（并发 ${IMAGE_CONCURRENCY}）`);

    const imageGen = new AgnesImageProvider(new AiCallLogService(prisma));
    const fileService = new FileService(prisma);
    let done = 0;
    let failed = 0;
    /** 上次发起请求的时刻（用于限速） */
    let lastStart = 0;

    await runPool(pending, IMAGE_CONCURRENCY, async (row) => {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        // 限速：保证两次请求之间至少间隔 MIN_INTERVAL_MS
        const wait = Math.max(0, lastStart + MIN_INTERVAL_MS - Date.now());
        if (wait > 0) {
          await new Promise((resolve) => setTimeout(resolve, wait));
        }
        lastStart = Date.now();
        try {
          const image = await imageGen.generate(`${row.scenePrompt}, ${IMAGE_STYLE_SUFFIX}`, {
            size: imageGenConfig.imageSize,
            ratio: imageGenConfig.imageRatio,
          });
          const webp = await sharp(image.buffer)
            .resize({ width: imageGenConfig.imageMaxWidth, withoutEnlargement: true })
            .webp({ quality: imageGenConfig.imageQuality })
            .toBuffer();
          const saved = await fileService.save(`${Number(row.id)}.webp`, 'image/webp', webp, null);
          await prisma.sentence.update({
            where: { id: row.id },
            data: { imageFileId: BigInt(saved.file.id), status: 'ready' },
          });
          done += 1;
          if (done % 5 === 0) {
            console.log(`  进度 ${done}/${pending.length}`);
          }
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const rateLimited = message.includes('429') || message.includes('rate_limit');
          if (attempt < MAX_ATTEMPTS) {
            const backoff = (rateLimited ? 30_000 : 5_000) * attempt;
            console.warn(
              `  第 ${attempt} 次失败（${rateLimited ? '限流' : '其他'}），${Math.round(backoff / 1000)}s 后重试：${message.slice(0, 120)}`,
            );
            await new Promise((resolve) => setTimeout(resolve, backoff));
            continue;
          }
          failed += 1;
          console.warn(`  生图放弃（sentence ${row.id}）：${message.slice(0, 160)}`);
        }
      }
    });

    console.log(`配图：成功 ${done}，失败 ${failed}`);
    const [ready, pendingCount] = await Promise.all([
      prisma.sentence.count({ where: { status: 'ready' } }),
      prisma.sentence.count({ where: { status: 'pending_image' } }),
    ]);
    console.log(`题库现状：就绪 ${ready}，待生图 ${pendingCount}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('题库初始化失败：', error);
  process.exit(1);
});
