import { TEMPLATES, getThematicImage } from '../../utils/constants';

Page({
  data: {
    view: 'HOME',
    candyCount: 20,
    contentPaddingTop: 80, // Default padding
    history: [],
    
    // Selection & Input
    selectedTemplate: null,
    userInput: "",
    isInputting: false,
    
    // Results
    generatedResult: null,
    
    // Overlays
    showSignIn: false,
    showAd: false,
    adType: 'CANDY',
    showCategory: false,
    
    // Filters
    filteredTemplates: [],
    categoryFilter: null,
    searchTerm: "",
    
    // Daily
    canClaimDaily: false,
    
    // Banner Timer
    timeLeft: { d: '00', h: '00', m: '00', s: '00' },
    
    // Ad Timer
    adTimeLeft: 5,

    // Categories Data
    categories: [
      { id: 'lucky', label: '能量指南', sub: 'LUCKY GUIDE', activeClass: 'cat-active-lucky' },
      { id: 'sharp', label: '高情商嘴替', sub: 'SHARP REPLY', activeClass: 'cat-active-sharp' },
      { id: 'persona', label: '社交人设', sub: 'SOCIAL MASK', activeClass: 'cat-active-persona' },
      { id: 'future', label: '2026 未来', sub: 'FUTURE 2026', activeClass: 'cat-active-future' },
    ]
  },

  onLoad(options) {
    // Get Safe Area Padding from App Global Data
    const app = getApp();
    if (app.globalData && app.globalData.totalHeaderHeight) {
      this.setData({
        contentPaddingTop: app.globalData.totalHeaderHeight + 10 // Add slight buffer
      });
    }

    // Load History
    const history = wx.getStorageSync('cp_history') || [];
    this.setData({ history });
    
    // Check Daily
    const last = wx.getStorageSync('cp_last_signin');
    const today = new Date().toDateString();
    this.setData({ canClaimDaily: last !== today });
    
    this.updateTemplates();
    this.startBannerTimer();

    // Check Share URL
    const params = options || wx.getLaunchOptionsSync().query;
    const tid = params.tid;
    if (tid) {
      const t = TEMPLATES.find(temp => temp.id === tid);
      const u = params.u;
      const r = params.r;
      const s = params.s;
      if (t && u && r) {
        this.setData({
          sharedResult: {
            id: 'shared',
            templateId: tid,
            imageUrl: getThematicImage(tid, r),
            text: t.presetTexts[0], // Simplified
            userInput: u,
            timestamp: Date.now(),
            rarity: r,
            filterSeed: 0,
            luckScore: s ? parseInt(s) : 80
          }
        });
      }
    }
  },

  onShowShareOverlay() {
    this.setData({ showShare: true });
  },

  closeShareOverlay() {
    this.setData({ showShare: false });
  },

  closeSharedResult() {
    this.setData({ sharedResult: null, view: 'HOME' });
  },

  preventTouchMove() {},
  
  onShareAppMessage() {
    if (this.data.generatedResult && this.data.view === 'RESULT') {
      const res = this.data.generatedResult;
      return {
        title: `[${res.rarity}] ${res.userInput} 的运势评分: ${res.luckScore}`,
        path: `/pages/index/index?tid=${res.templateId}&u=${encodeURIComponent(res.userInput)}&r=${res.rarity}&s=${res.luckScore}`
      };
    }
    return {
      title: '赛博情绪实验室',
      path: '/pages/index/index'
    };
  },

  updateTemplates() {
    const { categoryFilter, searchTerm } = this.data;
    const filtered = TEMPLATES.filter(t => {
      if (t.id === 'custom-signal') return false;
      const matchCat = categoryFilter ? t.category === categoryFilter : true;
      const matchSearch = searchTerm ? (
        t.title.includes(searchTerm) || 
        t.keywords.some(k => k.includes(searchTerm)) ||
        t.tag === searchTerm
      ) : true;
      return matchCat && matchSearch;
    });
    this.setData({ filteredTemplates: filtered });
  },

  onSetView(e) {
    this.setData({ view: e.detail });
  },
  
  goHome() {
    this.setData({ view: 'HOME' });
  },

  onOpenDaily() {
    this.setData({ showSignIn: true });
  },
  
  closeSignIn() {
    this.setData({ showSignIn: false });
  },
  
  onClaimDaily() {
    if (this.data.canClaimDaily) {
      this.setData({
        candyCount: this.data.candyCount + 10,
        canClaimDaily: false,
        showSignIn: false
      });
      wx.setStorageSync('cp_last_signin', new Date().toDateString());
      wx.showToast({ title: '领取成功', icon: 'none' });
    }
  },

  onWatchAd() {
    this.setData({ adType: 'CANDY', showAd: true, adTimeLeft: 5 });
    this.startAdTimer();
  },
  
  startAdTimer() {
    this.adTimer = setInterval(() => {
      if (this.data.adTimeLeft <= 1) {
        clearInterval(this.adTimer);
        this.setData({ adTimeLeft: 0 });
      } else {
        this.setData({ adTimeLeft: this.data.adTimeLeft - 1 });
      }
    }, 1000);
  },
  
  onAdComplete() {
    clearInterval(this.adTimer);
    this.setData({ showAd: false });
    if (this.data.adType === 'CANDY') {
      this.setData({ candyCount: this.data.candyCount + 10 });
      wx.showToast({ title: '糖果 +10', icon: 'none' });
    } else if (this.data.adType === 'REROLL') {
      if (this.data.selectedTemplate && this.data.userInput) {
        this.setData({ view: 'GENERATING' });
      }
    }
  },

  onTemplateSelect(e) {
    this.setData({ selectedTemplate: e.detail, isInputting: true });
  },
  
  onCustomSignalSelect() {
    const custom = TEMPLATES.find(t => t.id === 'custom-signal');
    if (custom) {
      this.setData({ selectedTemplate: custom, isInputting: true });
    }
  },
  
  closeInput() {
    this.setData({ isInputting: false });
  },
  
  onInputConfirm(e) {
    const text = e.detail.text;
    const { selectedTemplate, candyCount } = this.data;
    
    if (candyCount < selectedTemplate.cost) {
      this.setData({ isInputting: false, adType: 'CANDY', showAd: true, adTimeLeft: 5 });
      this.startAdTimer();
      wx.showToast({ title: '糖果不足，看广告补充', icon: 'none' });
      return;
    }
    
    this.setData({
      userInput: text,
      candyCount: candyCount - selectedTemplate.cost,
      isInputting: false,
      view: 'GENERATING'
    });
  },
  
  onSwitchTemplate(e) {
    const target = TEMPLATES.find(t => t.id === e.detail.templateId);
    if (target) {
      this.setData({ selectedTemplate: target });
    }
  },

  onGenerationFinish(e) {
    const res = e.detail.result;
    const newHistory = [res, ...this.data.history];
    this.setData({
      generatedResult: res,
      history: newHistory,
      view: 'RESULT'
    });
    wx.setStorageSync('cp_history', newHistory);
  },
  
  closeResult() {
    this.setData({ view: 'HOME' });
  },
  
  startReroll() {
    this.setData({ adType: 'REROLL', showAd: true, adTimeLeft: 5 });
    this.startAdTimer();
  },
  
  onHistorySelect(e) {
    const item = e.currentTarget.dataset.item;
    // Format dateStr for display if needed or rely on component
    item.dateStr = new Date(item.timestamp).toLocaleDateString();
    this.setData({ generatedResult: item, view: 'RESULT' });
  },

  // Radar / Filter Logic
  onOpenRadar() {
    this.setData({ showCategory: true });
  },
  
  closeRadar() {
    this.setData({ showCategory: false });
  },
  
  onSelectCategory(e) {
    this.setData({ categoryFilter: e.currentTarget.dataset.id, searchTerm: '', showCategory: false });
    this.updateTemplates();
  },
  
  onTagSearch(e) {
    const tag = e.currentTarget.dataset.tag.replace('#', '');
    this.setData({ searchTerm: tag, categoryFilter: null, showCategory: false });
    this.updateTemplates();
  },
  
  onTagFilter(e) {
    const tag = e.currentTarget.dataset.tag;
    this.setData({ searchTerm: tag, categoryFilter: null });
    this.updateTemplates();
  },
  
  clearFilter() {
    this.setData({ searchTerm: '', categoryFilter: null });
    this.updateTemplates();
  },
  
  resetRadar() {
    this.setData({ searchTerm: '', categoryFilter: null, showCategory: false });
    this.updateTemplates();
  },
  
  onSearchInput(e) {
    this.setData({ searchTerm: e.detail.value });
  },
  
  onSearchConfirm() {
    this.setData({ showCategory: false });
    this.updateTemplates();
  },

  startBannerTimer() {
    const targetDate = new Date().getTime() + (3 * 24 * 60 * 60 * 1000) + (14 * 60 * 60 * 1000);
    this.bannerTimer = setInterval(() => {
        const current = new Date().getTime();
        const distance = targetDate - current;

        if (distance < 0) {
             clearInterval(this.bannerTimer);
             return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        
        this.setData({
            timeLeft: {
                d: days.toString().padStart(2, '0'),
                h: hours.toString().padStart(2, '0'),
                m: minutes.toString().padStart(2, '0')
            }
        });
    }, 1000);
  }
})
