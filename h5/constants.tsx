import { Template, Rarity } from './types';

// Thematic Visual Archetypes (Kept for reference or future fallback)
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
// Strictly mapped from user provided OSS URLs
// Note: URLs are now unsigned (public access), removing expiration issues.
export const TEMPLATE_ASSETS: Record<string, Record<Rarity, string>> = {
    'custom-signal': { // NEW: Universal Template
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/custom-N.png', // Fallback/Placeholder if specific custom assets exist, using generic abstract
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%87%B4%E6%9C%AA%E6%9D%A5-R.png', // Reusing abstract futuristic images for universal feel
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%87%B4%E6%9C%AA%E6%9D%A5-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%87%B4%E6%9C%AA%E6%9D%A5-SSR.png'
    },
    'horse-2026': { // 2026丙午
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/2026%E4%B8%99%E5%8D%88-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/2026%E4%B8%99%E5%8D%88-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/2026%E4%B8%99%E5%8D%88-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/2026%E4%B8%99%E5%8D%88-SSR.png'
    },
    'mbti-meme': { // MBTI
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/MBTI-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/MBTI-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/MBTI-SR.png', // Fixed copy-paste error in provided list
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/MBTI-SSR.png'
    },
    'clown-cert': { // 纯爱小丑
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%BA%AF%E7%88%B1%E5%B0%8F%E4%B8%91-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%BA%AF%E7%88%B1%E5%B0%8F%E4%B8%91-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%BA%AF%E7%88%B1%E5%B0%8F%E4%B8%91-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%BA%AF%E7%88%B1%E5%B0%8F%E4%B8%91-SSR.png'
    },
    'wood-fish': { // 电子木鱼
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%94%B5%E5%AD%90%E6%9C%A8%E9%B1%BC-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%94%B5%E5%AD%90%E6%9C%A8%E9%B1%BC-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%94%B5%E5%AD%90%E6%9C%A8%E9%B1%BC-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%94%B5%E5%AD%90%E6%9C%A8%E9%B1%BC-SSR.png'
    },
    'diet-excuse': { // 减肥借口
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%87%8F%E8%82%A5%E5%80%9F%E5%8F%A3-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%87%8F%E8%82%A5%E5%80%9F%E5%8F%A3-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%87%8F%E8%82%A5%E5%80%9F%E5%8F%A3-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%87%8F%E8%82%A5%E5%80%9F%E5%8F%A3-SSR.png'
    },
    'cyber-fortune': { // 今日运势
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E4%BB%8A%E6%97%A5%E8%BF%90%E5%8A%BF-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E4%BB%8A%E6%97%A5%E8%BF%90%E5%8A%BF-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E4%BB%8A%E6%97%A5%E8%BF%90%E5%8A%BF-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E4%BB%8A%E6%97%A5%E8%BF%90%E5%8A%BF-SSR.png' // Fixed copy-paste error
    },
    'roast-boss': { // 开工嘴替
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%BC%80%E5%B7%A5%E5%98%B4%E6%9B%BF-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%BC%80%E5%B7%A5%E5%98%B4%E6%9B%BF-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%BC%80%E5%B7%A5%E5%98%B4%E6%9B%BF-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%BC%80%E5%B7%A5%E5%98%B4%E6%9B%BF-SSR.png'
    },
    'rich-vibe': { // 老钱风
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%80%81%E9%92%B1%E9%A3%8E-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%80%81%E9%92%B1%E9%A3%8E-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%80%81%E9%92%B1%E9%A3%8E-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%80%81%E9%92%B1%E9%A3%8E-SSR.png'
    },
    'ai-partner': { // 理想型
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%90%86%E6%83%B3%E5%9E%8B-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%90%86%E6%83%B3%E5%9E%8B-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%90%86%E6%83%B3%E5%9E%8B-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E7%90%86%E6%83%B3%E5%9E%8B-SSR.png'
    },
    'pet-voice': { // 毛孩子
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E6%AF%9B%E5%AD%A9%E5%AD%90-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E6%AF%9B%E5%AD%A9%E5%AD%90-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E6%AF%9B%E5%AD%A9%E5%AD%90-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E6%AF%9B%E5%AD%A9%E5%AD%90-SSR.png'
    },
    'energy-daily': { // 能量指南
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%83%BD%E9%87%8F%E6%8C%87%E5%8D%97-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%83%BD%E9%87%8F%E6%8C%87%E5%8D%97-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%83%BD%E9%87%8F%E6%8C%87%E5%8D%97-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%83%BD%E9%87%8F%E6%8C%87%E5%8D%97-SSR.png'
    },
    'ex-reply': { // 前任告别
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%89%8D%E4%BB%BB%E5%91%8A%E5%88%AB-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%89%8D%E4%BB%BB%E5%91%8A%E5%88%AB-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%89%8D%E4%BB%BB%E5%91%8A%E5%88%AB-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E5%89%8D%E4%BB%BB%E5%91%8A%E5%88%AB-SSR.png'
    },
    'relative-shield': { // 亲戚糊弄
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E4%BA%B2%E6%88%9A%E7%B3%8A%E5%BC%84-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E4%BA%B2%E6%88%9A%E7%B3%8A%E5%BC%84-S.png', // Maintained 'S' per user input as it might be specific file name
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E4%BA%B2%E6%88%9A%E7%B3%8A%E5%BC%84-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E4%BA%B2%E6%88%9A%E7%B3%8A%E5%BC%84-SSR.png'
    },
    'sleep-wallpaper': { // 赛博安睡
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%B5%9B%E5%8D%9A%E5%AE%89%E7%9D%A1-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%B5%9B%E5%8D%9A%E5%AE%89%E7%9D%A1-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%B5%9B%E5%8D%9A%E5%AE%89%E7%9D%A1-SR.png', // Fixed copy-paste error
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%B5%9B%E5%8D%9A%E5%AE%89%E7%9D%A1-SSR.png'
    },
    'horse-greeting': { // 赛博拜年
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%B5%9B%E5%8D%9A%E6%8B%9C%E5%B9%B4-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%B5%9B%E5%8D%9A%E6%8B%9C%E5%B9%B4-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%B5%9B%E5%8D%9A%E6%8B%9C%E5%B9%B4-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%B5%9B%E5%8D%9A%E6%8B%9C%E5%B9%B4-SSR.png'
    },
    'future-2027': { // 致2027
        N: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%87%B4%E6%9C%AA%E6%9D%A5-N.png',
        R: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%87%B4%E6%9C%AA%E6%9D%A5-R.png',
        SR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%87%B4%E6%9C%AA%E6%9D%A5-SR.png',
        SSR: 'https://longyan-sh.oss-cn-shanghai.aliyuncs.com/pixel/template/%E8%87%B4%E6%9C%AA%E6%9D%A5-SSR.png'
    }
};

// Optimized Image Generator based on Rarity using pre-signed OSS Assets
export const getThematicImage = (templateId: string, rarity: Rarity): string => {
    // Direct lookup from the Asset Matrix
    const assets = TEMPLATE_ASSETS[templateId];
    if (assets) {
        // Return the exact rarity match, or fallback to 'R' or 'N' if something is missing
        return assets[rarity] || assets['R'] || assets['N'] || assets['SR'];
    }

    // Fallback for any unknown templates (should not happen with current config)
    return `https://source.unsplash.com/random/400x500/?abstract,${rarity}&t=${Date.now()}`;
};

// Helper to get consistent keywords for a template
export const getTemplateKeywords = (templateId: string): string => {
    const t = TEMPLATES.find(t => t.id === templateId);
    if (t) return extractTheme(t);
    return 'abstract';
}

const extractTheme = (t: Template): string => {
    // Mapping IDs to THEMES
    if (t.id.includes('energy') || t.id.includes('wood')) return THEMES.ZEN;
    if (t.id.includes('fortune') || t.id.includes('money')) return THEMES.WEALTH;
    if (t.id.includes('greeting') || t.id.includes('partner')) return THEMES.LOVE;
    if (t.id.includes('shield') || t.id.includes('roast') || t.id.includes('diet')) return THEMES.CHAOS;
    if (t.id.includes('rich')) return THEMES.LUXURY;
    if (t.id.includes('pet') || t.id.includes('meme')) return THEMES.MEME;
    return THEMES.FUTURE; // Default
}

// Updated TEMPLATES to use the high-quality SR/SSR images as previews
export const TEMPLATES: Template[] = [
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
    description: '前任突然联系怎么办？AI 帮你体面送走。',
    keywords: ['前任', '恋爱', '分手', '情感'],
    presetTexts: [
      '您呼叫的用户已成仙。',
      '复合？垃圾分类了解一下。',
      '你的戏可以像你的钱一样少吗？',
      '不好意思，我对碳基生物过敏。'
    ]
  },
  {
    id: 'diet-excuse',
    title: '减肥借口·生成器',
    subtitle: 'Diet Excuse',
    tag: 'NEW',
    imageUrl: TEMPLATE_ASSETS['diet-excuse']['SR'],
    cost: 1,
    category: 'sharp',
    inputHint: '你想吃什么？',
    quickPrompts: ['奶茶', '火锅', '烧烤', '炸鸡'],
    description: '想吃又怕胖？让 AI 给你一个无法反驳的吃它的理由。',
    keywords: ['减肥', '美食', '吃货', '奶茶'],
    presetTexts: [
      '奶茶是茶，茶是养生的，所以喝奶茶=养生。',
      '吃饱了才有力气减肥。',
      '这顿不算，明天再减。',
      '肉肉这么可爱，为什么要减掉它？'
    ]
  },

  // --- Category: 🎭 社交人设 ---
  {
    id: 'pet-voice',
    title: '毛孩子·内心戏',
    subtitle: 'Pet Inner Voice',
    tag: 'HOT',
    imageUrl: TEMPLATE_ASSETS['pet-voice']['SSR'],
    cost: 2,
    category: 'persona',
    inputHint: '你的宠物在干嘛？',
    quickPrompts: ['睡觉', '拆家', '瞪我', '要饭'],
    description: '生成宠物的腹黑内心独白。',
    keywords: ['宠物', '猫', '狗', '萌宠'],
    presetTexts: [
      '两脚兽，你的服务态度越来越差了。',
      '朕的江山（指沙发）又被你坐了。',
      '虽然我拆了家，但我依然是个好宝宝。',
      '别拍了，出场费结一下。'
    ]
  },
  {
    id: 'rich-vibe',
    title: '老钱风·滤镜',
    subtitle: 'Old Money Vibe',
    tag: 'NEW',
    imageUrl: TEMPLATE_ASSETS['rich-vibe']['SSR'],
    cost: 3,
    category: 'persona',
    inputHint: '春节去哪了？(如: 家里蹲)',
    quickPrompts: ['老家农村', '人山人海', '加班', '特种兵旅游'],
    description: '把回村过年的照片，生成“老钱风”朋友圈素材。',
    keywords: ['老钱', '炫富', '高级', '朋友圈'],
    presetTexts: [
      '松弛感，是最大的奢侈品。(背景是村口大鹅)',
      'Busy doing nothing.',
      'City Walk in My Hometown. (其实是赶集)',
      '有些东西出生没有，这辈子就有了（比如花呗）。'
    ]
  },
  {
    id: 'mbti-meme',
    title: 'MBTI·刻板印象',
    subtitle: 'MBTI Stereotypes',
    tag: 'HOT',
    imageUrl: TEMPLATE_ASSETS['mbti-meme']['SR'],
    cost: 1,
    category: 'persona',
    inputHint: '输入你的 MBTI',
    quickPrompts: ['INFP', 'ENTJ', 'ISFP', 'ENFP'],
    description: '生成你的专属人格梗图，精准破防。',
    keywords: ['mbti', '人格', '心理', 'infp', 'entj'],
    presetTexts: [
      'I 人地狱：过年被叫起来表演才艺。',
      'E 人天堂：电梯里只有自己一个人...并不。',
      'P 人的计划：没有计划。',
      'J 人的崩溃：计划被打乱。'
    ]
  },
  {
    id: 'clown-cert',
    title: '纯爱战士·认证',
    subtitle: 'Lover Certificate',
    tag: 'NEW',
    imageUrl: TEMPLATE_ASSETS['clown-cert']['SSR'],
    cost: 1,
    category: 'persona',
    inputHint: '你做了什么深情的事？',
    quickPrompts: ['秒回消息', '送早饭', '被发好人卡', '等待'],
    description: '致敬每一个在爱情里付出真心的你（又名小丑）。',
    keywords: ['小丑', '舔狗', '深情', 'emo'],
    presetTexts: [
      '哥谭市杰出市民。',
      '小丑竟是我自己。',
      '麦当劳吉祥物预备役。',
      '深情总被雨打风吹去，剩下都是笑话。'
    ]
  },

  // --- Category: 🕰️ 2026 时空 ---
  {
    id: 'horse-2026',
    title: '2026·状态解析', 
    subtitle: '2026 Status',
    tag: 'LIMITED',
    imageUrl: TEMPLATE_ASSETS['horse-2026']['SSR'],
    cost: 5, 
    category: 'future',
    inputHint: '输入你的名字',
    quickPrompts: ['事业', '财富', '感情', '健康'],
    description: '丙午马年能量场解析。AI 预测你今年的“高光时刻”。',
    keywords: ['2026', '马年', '分析', '火马', '丙午'],
    presetTexts: [
      '丙午火马：你的行动力将是去年的 10 倍。',
      '关键词：【破局】。别犹豫，直接干。',
      '剧透：你会在夏天遇到一个改变你轨迹的机会。',
      '2026 这里的空气，全是自由（和钱）的味道。'
    ]
  },
  {
    id: 'future-2027', 
    title: '给2027的信',
    subtitle: 'Letter to 2027',
    tag: 'FUTURE',
    imageUrl: TEMPLATE_ASSETS['future-2027']['SR'],
    cost: 4,
    category: 'future',
    inputHint: '立个Flag',
    quickPrompts: ['存款一百万', '环游世界', '学会Python', '脱单'],
    description: '现在是 2026。给一年后的自己写封信，看看能实现多少。',
    keywords: ['2027', '未来', '目标', 'Flag'],
    presetTexts: [
      '致2027的你：希望你已经不用再定闹钟了。',
      'Flag 只要立得住，不怕倒。',
      '请查收这封来自一年前的“野心”。',
      '那时的你，应该已经变成大佬了吧。'
    ]
  },
  {
    id: 'ai-partner',
    title: '理想型·生成',
    subtitle: 'AI Soulmate',
    tag: 'FUTURE',
    imageUrl: TEMPLATE_ASSETS['ai-partner']['SSR'],
    cost: 4,
    category: 'future',
    inputHint: '输入你喜欢的类型',
    quickPrompts: ['腹黑年下', '温柔爹系', '清冷学霸', '搞笑女'],
    description: '2026 年每个人都分配对象？提前看看你的 AI 伴侣长啥样。',
    keywords: ['对象', '恋爱', '伴侣', '二次元'],
    presetTexts: [
      '除了不爱洗碗，TA 是一百分。',
      '你的理想型，只存在于二次元和代码里。',
      '正在为您匹配...匹配失败，您太优秀了。',
      '这就是你梦里的那个纸片人。'
    ]
  },
  // --- Universal Template (Hidden from main categories logic, but used for Custom Signal) ---
  {
    id: 'custom-signal',
    title: '自由特调·信号',
    subtitle: 'Custom Signal',
    tag: 'HOT',
    imageUrl: TEMPLATE_ASSETS['custom-signal']['SSR'],
    cost: 3,
    category: 'future',
    inputHint: '输入任何你想说的话...',
    quickPrompts: ['发疯', '许愿', '吐槽', '告白'],
    description: '未定义的情绪？在这里发射你的专属宇宙信号。',
    keywords: ['custom', '自由', '特调'],
    presetTexts: [
        '信号已接收。',
        '正在转译为宇宙通用语...',
        '情绪价值提取中...',
        '这就是你的专属频率。'
    ]
  }
];

// No longer needed mock data
export const MOCK_GENERATED_IMAGES = [];
