// Thematic Visual Archetypes
const THEMES = {
    WEALTH: 'technology,city,building', 
    LOVE: 'flower,sky,soft',       
    ZEN: 'stone,water,leaf',    
    CHAOS: 'glitch,abstract,dark', 
    FUTURE: 'cyberpunk,neon,space', 
    MEME: 'cat,dog,funny',
    LUXURY: 'gold,jewelry,architecture'
};

// --- ASSET MATRIX (Source of Truth) ---
const TEMPLATE_ASSETS = {
    'custom-signal': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/custom-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%87%B4%E6%9C%AA%E6%9D%A5-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%87%B4%E6%9C%AA%E6%9D%A5-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%87%B4%E6%9C%AA%E6%9D%A5-SSR.png'
    },
    'horse-2026': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/2026%E4%B8%99%E5%8D%88-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/2026%E4%B8%99%E5%8D%88-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/2026%E4%B8%99%E5%8D%88-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/2026%E4%B8%99%E5%8D%88-SSR.png'
    },
    'mbti-meme': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/MBTI-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/MBTI-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/MBTI-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/MBTI-SSR.png'
    },
    'clown-cert': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%BA%AF%E7%88%B1%E5%B0%8F%E4%B8%91-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%BA%AF%E7%88%B1%E5%B0%8F%E4%B8%91-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%BA%AF%E7%88%B1%E5%B0%8F%E4%B8%91-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%BA%AF%E7%88%B1%E5%B0%8F%E4%B8%91-SSR.png'
    },
    'wood-fish': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%94%B5%E5%AD%90%E6%9C%A8%E9%B1%BC-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%94%B5%E5%AD%90%E6%9C%A8%E9%B1%BC-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%94%B5%E5%AD%90%E6%9C%A8%E9%B1%BC-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%94%B5%E5%AD%90%E6%9C%A8%E9%B1%BC-SSR.png'
    },
    'diet-excuse': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%87%8F%E8%82%A5%E5%80%9F%E5%8F%A3-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%87%8F%E8%82%A5%E5%80%9F%E5%8F%A3-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%87%8F%E8%82%A5%E5%80%9F%E5%8F%A3-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%87%8F%E8%82%A5%E5%80%9F%E5%8F%A3-SSR.png'
    },
    'cyber-fortune': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E4%BB%8A%E6%97%A5%E8%BF%90%E5%8A%BF-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E4%BB%8A%E6%97%A5%E8%BF%90%E5%8A%BF-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E4%BB%8A%E6%97%A5%E8%BF%90%E5%8A%BF-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E4%BB%8A%E6%97%A5%E8%BF%90%E5%8A%BF-SSR.png'
    },
    'roast-boss': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%BC%80%E5%B7%A5%E5%98%B4%E6%9B%BF-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%BC%80%E5%B7%A5%E5%98%B4%E6%9B%BF-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%BC%80%E5%B7%A5%E5%98%B4%E6%9B%BF-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%BC%80%E5%B7%A5%E5%98%B4%E6%9B%BF-SSR.png'
    },
    'rich-vibe': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%80%81%E9%92%B1%E9%A3%8E-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%80%81%E9%92%B1%E9%A3%8E-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%80%81%E9%92%B1%E9%A3%8E-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%80%81%E9%92%B1%E9%A3%8E-SSR.png'
    },
    'ai-partner': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%90%86%E6%83%B3%E5%9E%8B-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%90%86%E6%83%B3%E5%9E%8B-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%90%86%E6%83%B3%E5%9E%8B-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%90%86%E6%83%B3%E5%9E%8B-SSR.png'
    },
    'pet-voice': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E6%AF%9B%E5%AD%A9%E5%AD%90-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E6%AF%9B%E5%AD%A9%E5%AD%90-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E6%AF%9B%E5%AD%A9%E5%AD%90-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E6%AF%9B%E5%AD%A9%E5%AD%90-SSR.png'
    },
    'energy-daily': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%83%BD%E9%87%8F%E6%8C%87%E5%8D%97-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%83%BD%E9%87%8F%E6%8C%87%E5%8D%97-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%83%BD%E9%87%8F%E6%8C%87%E5%8D%97-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%83%BD%E9%87%8F%E6%8C%87%E5%8D%97-SSR.png'
    },
    'ex-reply': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%89%8D%E4%BB%BB%E5%91%8A%E5%88%AB-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%89%8D%E4%BB%BB%E5%91%8A%E5%88%AB-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%89%8D%E4%BB%BB%E5%91%8A%E5%88%AB-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%89%8D%E4%BB%BB%E5%91%8A%E5%88%AB-SSR.png'
    },
    'relative-shield': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E4%BA%B2%E6%88%9A%E7%B3%8A%E5%BC%84-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E4%BA%B2%E6%88%9A%E7%B3%8A%E5%BC%84-S.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E4%BA%B2%E6%88%9A%E7%B3%8A%E5%BC%84-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E4%BA%B2%E6%88%9A%E7%B3%8A%E5%BC%84-SSR.png'
    },
    'sleep-wallpaper': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%B5%9B%E5%8D%9A%E5%AE%89%E7%9D%A1-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%B5%9B%E5%8D%9A%E5%AE%89%E7%9D%A1-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%B5%9B%E5%8D%9A%E5%AE%89%E7%9D%A1-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%B5%9B%E5%8D%9A%E5%AE%89%E7%9D%A1-SSR.png'
    },
    'horse-greeting': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%B5%9B%E5%8D%9A%E6%8B%9C%E5%B9%B4-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%B5%9B%E5%8D%9A%E6%8B%9C%E5%B9%B4-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%B5%9B%E5%8D%9A%E6%8B%9C%E5%B9%B4-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%B5%9B%E5%8D%9A%E6%8B%9C%E5%B9%B4-SSR.png'
    },
    'future-2027': {
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%87%B4%E6%9C%AA%E6%9D%A5-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%87%B4%E6%9C%AA%E6%9D%A5-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%87%B4%E6%9C%AA%E6%9D%A5-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%87%B4%E6%9C%AA%E6%9D%A5-SSR.png'
    }
};

const TEMPLATES = [
  // --- Category: 🔮 能量指南 ---
  {
    id: 'energy-daily',
    title: '今日能量·指南',
    subtitle: 'Daily Energy Guide',
    tag: 'HOT',
    imageUrl: TEMPLATE_ASSETS['energy-daily']['SR'], 
    cost: 1,
    category: 'lucky',
    inputHint: '输入你的昵称',
    quickPrompts: ['打工人版', '恋爱脑版', '求财版', '水逆退散'],
    description: 'AI 解析今日能量磁场，提供行动建议。',
    keywords: ['能量', '指南', '日签', '心情'],
    presetTexts: [
      '宜：带薪发呆。忌：自我怀疑。',
      '今日能量关键词：搞钱。其余免谈。',
      '检测到焦虑信号，建议立刻点一杯奶茶。',
      '今日桃花指数：404 Not Found，但财运 200 OK。'
    ]
  },
  {
    id: 'cyber-fortune',
    title: '今日运势',
    subtitle: 'Daily Fortune',
    tag: 'LIMITED',
    imageUrl: TEMPLATE_ASSETS['cyber-fortune']['SR'],
    cost: 2,
    category: 'lucky',
    inputHint: '输入你的生辰八字或微信昵称',
    quickPrompts: ['测财运', '测桃花', '测事业', '测水逆'],
    description: '每日运势生成。',
    keywords: ['运势', '算命', '搞钱', '马年'],
    presetTexts: [
      '今日宜：搞钱，忌：emo。',
      '财运爆表，速来领取！',
      '注意：水逆退散，好运附体！',
      '您的专属今日运势已加载。'
    ]
  },
  {
    id: 'horse-greeting', 
    title: '赛博拜年·不土味',
    subtitle: 'Cyber Greetings',
    tag: 'LIMITED', 
    imageUrl: TEMPLATE_ASSETS['horse-greeting']['SSR'],
    cost: 1, 
    category: 'lucky',
    inputHint: '给谁拜年？(如: 老板, 二姨)',
    quickPrompts: ['给老板', '给甲方', '给相亲对象', '家族群'],
    description: '2026 丙午马年限定。拒绝复制粘贴，AI 帮你高情商拜年。',
    keywords: ['拜年', '春节', '祝福', '红包', '马年'],
    presetTexts: [
      '祝您：发际线与职位齐飞，发量共奖金一色。',
      '丙午年，祝您像火马一样：暴躁搞钱，优雅生活。',
      '过年好！新的一年，BUG 绕着走，需求全通过。',
      '也不说什么场面话了，祝您：暴富、自由、健康。'
    ]
  },
  {
    id: 'wood-fish',
    title: '电子木鱼·静心',
    subtitle: 'Cyber Zen',
    tag: 'HOT',
    imageUrl: TEMPLATE_ASSETS['wood-fish']['SR'],
    cost: 1,
    category: 'lucky',
    inputHint: '输入你想原谅的人/事',
    quickPrompts: ['原谅老板', '原谅前任', '原谅自己', '消除焦虑'],
    description: '春节被问烦了？敲敲木鱼，回归Inner Peace。',
    keywords: ['木鱼', '解压', '佛系', '静心', '原谅'],
    presetTexts: [
      '烦恼 -999，Inner Peace +1。',
      '施主，你的怨气太重，建议重启。',
      '扣 1 佛祖陪你一起敲。',
      '原谅他吧，虽然他是傻X。'
    ]
  },
  {
    id: 'sleep-wallpaper', 
    title: '赛博安睡·壁纸',
    subtitle: 'Cyber Sleep Mode',
    tag: 'NEW',
    imageUrl: TEMPLATE_ASSETS['sleep-wallpaper']['SSR'],
    cost: 1,
    category: 'lucky',
    inputHint: '因为什么睡不着？',
    quickPrompts: ['焦虑', '想玩手机', '明天开会', '失恋'],
    description: '深夜 EMO 专用。生成一张安睡壁纸，物理封印手机。',
    keywords: ['睡眠', '失眠', '深夜', '壁纸'],
    presetTexts: [
      '系统提示：大脑正在关机，请勿强制唤醒。',
      '今夜不营业，去梦里暴富。',
      '熬夜会变丑，这个理由够不够？',
      '月亮睡了你不睡，你是秃头小宝贝。'
    ]
  },

  // --- Category: 🌶️ 高情商嘴替 ---
  {
    id: 'relative-shield', 
    title: '亲戚糊弄学·Pro',
    subtitle: 'Relative Shield',
    tag: 'HOT',
    imageUrl: TEMPLATE_ASSETS['relative-shield']['SR'],
    cost: 2,
    category: 'sharp',
    inputHint: '亲戚问了什么 (如: 工资多少)',
    quickPrompts: ['催婚', '问工资', '催生娃', '比成绩'],
    description: '春节特供：一张图优雅结束尴尬聊天，保护心理健康。',
    keywords: ['亲戚', '催婚', '过年', '怼人'],
    presetTexts: [
      '阿姨，您儿子期末考了多少分？',
      '对象在摩尔庄园，工资在欢乐斗地主。',
      '不婚不育，芳龄永继。',
      '再问自杀（开玩笑的）。'
    ]
  },
  {
    id: 'roast-boss',
    title: '开工嘴替·高情商',
    subtitle: 'Office Survival',
    tag: 'NEW',
    imageUrl: TEMPLATE_ASSETS['roast-boss']['SR'],
    cost: 2,
    category: 'sharp',
    inputHint: '老板画了什么饼？',
    quickPrompts: ['不想开工', '求红包', '需求变了', '预算不够'],
    description: '节后复工必备。高情商回复老板，低内耗净化心灵。',
    keywords: ['职场', '老板', '甲方', '打工人', '发疯'],
    presetTexts: [
      '这个需求做不了，建议你报警。',
      '已读不回是成年人最后的礼貌。',
      '饼画得太大，由于某种原因无法显示。',
      '工资是精神损失费，不是你的买命钱。'
    ]
  },
  {
    id: 'ex-reply',
    title: '前任体面告别',
    subtitle: 'Ex Closure',
    tag: 'NEW',
    imageUrl: TEMPLATE_ASSETS['ex-reply']['SSR'],
    cost: 3,
    category: 'sharp',
    inputHint: '前任发了啥？',
    quickPrompts: ['求复合', '借钱', '诈尸', '现任更好'],
    description: '再也不见。生成一张体面的告别卡片。',
    keywords: ['前任', '分手', '情感', '告别'],
    presetTexts: [
      '已阅，退下。',
      '你若安好，那还得了。',
      '垃圾分类，请勿乱扔。',
      '复活赛打赢了再来找我。'
    ]
  },
  {
    id: 'diet-excuse',
    title: '减肥借口·生成器',
    subtitle: 'Diet Excuse',
    tag: 'HOT',
    imageUrl: TEMPLATE_ASSETS['diet-excuse']['SR'],
    cost: 1,
    category: 'sharp',
    inputHint: '想吃什么？(如: 奶茶, 火锅)',
    quickPrompts: ['奶茶', '火锅', '烧烤', '炸鸡'],
    description: '吃饱了才有力气减肥。生成一个无法反驳的理由。',
    keywords: ['减肥', '美食', '吃货', '借口'],
    presetTexts: [
      '奶茶是水，水没有热量。',
      '吃饱了才能对抗地心引力。',
      '这顿不吃，怎么有力气减肥？',
      '脂肪是我的保护色。'
    ]
  },

  // --- Category: 🎭 社交人设 ---
  {
    id: 'mbti-meme',
    title: 'MBTI·刻板印象',
    subtitle: 'MBTI Meme',
    tag: 'HOT',
    imageUrl: TEMPLATE_ASSETS['mbti-meme']['SR'],
    cost: 1,
    category: 'persona',
    inputHint: '你的 MBTI 是？(如: INFP)',
    quickPrompts: ['INFP', 'ENTJ', 'INTJ', 'ENFP'],
    description: '生成你的 MBTI 专属梗图。',
    keywords: ['MBTI', '性格', '人设', '梗图'],
    presetTexts: [
      'INFP: 正在内耗中，请勿打扰。',
      'ENTJ: 只有工作能让我快乐。',
      'INTJ: 愚蠢的人类。',
      'ENFP: 快乐小狗，在线摇尾巴。'
    ]
  },
  {
    id: 'rich-vibe',
    title: '老钱风·装腔指南',
    subtitle: 'Old Money Vibe',
    tag: 'NEW',
    imageUrl: TEMPLATE_ASSETS['rich-vibe']['SR'],
    cost: 2,
    category: 'persona',
    inputHint: '想在朋友圈发点啥？',
    quickPrompts: ['下午茶', '看展', '滑雪', '高尔夫'],
    description: '朋友圈装腔专用。生成一张看不懂但很贵的图。',
    keywords: ['老钱', '富二代', '装逼', '朋友圈'],
    presetTexts: [
      '松弛感，是最大的奢侈品。',
      '有些东西，出生没有，这辈子大概率也没有了。',
      '忙里偷闲，享受片刻宁静。',
      'Be humble, be rich.'
    ]
  },
  {
    id: 'clown-cert',
    title: '纯爱小丑·确诊书',
    subtitle: 'Clown Certificate',
    tag: 'HOT',
    imageUrl: TEMPLATE_ASSETS['clown-cert']['SSR'],
    cost: 1,
    category: 'persona',
    inputHint: '做了什么舔狗的事？',
    quickPrompts: ['秒回消息', '送礼物被拒', '被发好人卡', '深夜网抑云'],
    description: '恋爱脑确诊书。献给每一个在爱情里卑微的你。',
    keywords: ['舔狗', '小丑', '恋爱脑', '深情'],
    presetTexts: [
      '小丑竟是我自己。',
      '宝，今天去输液了，输的什么液？想你的夜。',
      '她只是回消息慢，她不是不爱我。',
      '纯爱战神，应声倒地。'
    ]
  },
  {
    id: 'pet-voice',
    title: '毛孩子·内心戏',
    subtitle: 'Pet Voice',
    tag: 'NEW',
    imageUrl: TEMPLATE_ASSETS['pet-voice']['SR'],
    cost: 1,
    category: 'persona',
    inputHint: '你家主子在干嘛？',
    quickPrompts: ['拆家', '睡觉', '鄙视我', '要罐罐'],
    description: '宠物视角吐槽愚蠢的铲屎官。',
    keywords: ['猫', '狗', '宠物', '铲屎官'],
    presetTexts: [
      '铲屎的，朕饿了。',
      '愚蠢的人类，离我远点。',
      '这个家没我得散。',
      '你的工资不够我买罐罐。'
    ]
  },

  // --- Category: 🚀 2026未来 ---
  {
    id: 'future-2027',
    title: '致2027·未来信',
    subtitle: 'Letter to 2027',
    tag: 'FUTURE',
    imageUrl: TEMPLATE_ASSETS['future-2027']['SSR'],
    cost: 3,
    category: 'future',
    inputHint: '想对未来的自己说什么？',
    quickPrompts: ['发财了吗', '结婚了吗', '世界和平', '还在加班吗'],
    description: '写给一年后的自己。时空胶囊。',
    keywords: ['未来', '2027', '信', '梦想'],
    presetTexts: [
      '希望那时的你，已经实现了现在的梦想。',
      '别忘了为什么出发。',
      '2027，请对我好一点。',
      '愿你历尽千帆，归来仍是少年。'
    ]
  },
  {
    id: 'horse-2026',
    title: '2026 丙午·火马',
    subtitle: 'Fire Horse 2026',
    tag: 'FUTURE',
    imageUrl: TEMPLATE_ASSETS['horse-2026']['SSR'],
    cost: 3,
    category: 'future',
    inputHint: '输入你的新年愿望',
    quickPrompts: ['暴富', '脱单', '健康', '自由'],
    description: '提前预演 2026 丙午马年。火马之年，动荡与机遇并存。',
    keywords: ['2026', '马年', '丙午', '预言'],
    presetTexts: [
      '火马之年，浴火重生。',
      '动荡是强者的阶梯。',
      '抓住机遇，逆风翻盘。',
      '愿你如烈火般热烈，如骏马般奔腾。'
    ]
  },
  {
    id: 'ai-partner',
    title: 'AI 理想型·生成',
    subtitle: 'AI Partner',
    tag: 'FUTURE',
    imageUrl: TEMPLATE_ASSETS['ai-partner']['SSR'],
    cost: 2,
    category: 'future',
    inputHint: '你的理想型是？(如: 温柔, 多金)',
    quickPrompts: ['霸道总裁', '温柔学长', '高冷御姐', '粘人小狗'],
    description: '现实太苦？生成一个完美的 AI 伴侣。',
    keywords: ['AI', '伴侣', '恋爱', '虚拟'],
    presetTexts: [
      '已为您匹配最佳伴侣。',
      '数据加载中... 您的心动对象即将上线。',
      '虚拟的爱，也是爱。',
      '正在计算契合度... 100%。'
    ]
  },
  // Universal Template (Custom Signal) - Hidden from main list usually, but here for reference
  {
    id: 'custom-signal',
    title: '信号转译',
    subtitle: 'Signal Decode',
    tag: 'NEW',
    imageUrl: TEMPLATE_ASSETS['custom-signal']['SSR'],
    cost: 1,
    category: 'future',
    inputHint: '输入任意内容',
    quickPrompts: [],
    description: '通用信号转译模块。',
    keywords: ['通用', '转译', '信号'],
    presetTexts: []
  }
];

const extractTheme = (t) => {
    if (t.id.includes('energy') || t.id.includes('wood')) return THEMES.ZEN;
    if (t.id.includes('fortune') || t.id.includes('money')) return THEMES.WEALTH;
    if (t.id.includes('greeting') || t.id.includes('partner')) return THEMES.LOVE;
    if (t.id.includes('shield') || t.id.includes('roast') || t.id.includes('diet')) return THEMES.CHAOS;
    if (t.id.includes('rich')) return THEMES.LUXURY;
    if (t.id.includes('pet') || t.id.includes('meme')) return THEMES.MEME;
    return THEMES.FUTURE; 
};

const getTemplateKeywords = (templateId) => {
    const t = TEMPLATES.find(t => t.id === templateId);
    if (t) return extractTheme(t);
    return 'abstract';
};

const getThematicImage = (templateId, rarity) => {
    const assets = TEMPLATE_ASSETS[templateId];
    if (assets) {
        return assets[rarity] || assets['R'] || assets['N'] || assets['SR'];
    }
    // Fallback using random image service if template not found (shouldn't happen)
    return `https://picsum.photos/400/500?random=${Date.now()}`;
};

module.exports = {
    TEMPLATES,
    TEMPLATE_ASSETS,
    getThematicImage,
    getTemplateKeywords
};
