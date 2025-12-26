import { requestAffectLab, getAffectLabToken, affectLabLogin, fetchAffectLabTemplates } from '../../utils/api';

let _warnedEmptyTemplates = false;

Page({
  data: {
    view: 'HOME',
    candyCount: 0,
    contentPaddingTop: 80, // Default padding
    statusBarHeight: 20,
    navBarHeight: 44,
    menuButtonWidth: 90,
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
    templates: [],
    filteredTemplates: [],
    categoryFilter: null,
    searchTerm: "",
    templatesLoading: false,
    templatesLoadError: "",
    
    // Daily
    canClaimDaily: false,

    pendingShareParams: null,
    
    // Banner Timer
    timeLeft: { d: '00', h: '00', m: '00', s: '00' },
    
    // Ad Timer
    adTimeLeft: 5,
    freeGenerateOnce: false,

    // Categories Data
    categories: [
      { id: 'lucky', label: '能量指南', sub: 'LUCKY GUIDE', activeClass: 'cat-active-lucky' },
      { id: 'sharp', label: '高情商嘴替', sub: 'SHARP REPLY', activeClass: 'cat-active-sharp' },
      { id: 'persona', label: '社交人设', sub: 'SOCIAL MASK', activeClass: 'cat-active-persona' },
      { id: 'future', label: '2026 未来', sub: 'FUTURE 2026', activeClass: 'cat-active-future' },
    ]
  },

  hideTabBarSafe() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden: true });
    }
  },

  showTabBarSafe() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden: false });
    }
  },

  onLoad(options) {
    try {
      console.log('Index onLoad', { ts: Date.now() });
    } catch (e) {}
    // Get Safe Area Padding from App Global Data
    const app = getApp();
    if (app.globalData && app.globalData.totalHeaderHeight) {
      const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
      const th = Number(app.globalData.totalHeaderHeight);
      const sb = Number(app.globalData.statusBarHeight);
      const nb = Number(app.globalData.navBarHeight);
      const mbw = Number(app.globalData.menuButtonWidth);
      this.setData({
        contentPaddingTop: Number.isFinite(th) ? clamp(th + 10, 56, 180) : 80,
        statusBarHeight: Number.isFinite(sb) ? clamp(sb, 0, 80) : 20,
        navBarHeight: Number.isFinite(nb) ? clamp(nb, 32, 120) : 44,
        menuButtonWidth: Number.isFinite(mbw) ? clamp(mbw, 60, 240) : 90
      });
    }

    affectLabLogin().finally(() => {
      this.refreshMeFromServer();
    });
    
    const params = options || wx.getLaunchOptionsSync().query;
    const tid = params && params.tid;
    const u = params && params.u;
    const r = params && params.r;
    const s = params && params.s;
    if (tid && u && r) {
      this.setData({ pendingShareParams: { tid, u, r, s } });
    }

    this.loadTemplates();
    this.startBannerTimer();

    // Check Share URL
    if (params && params.open === 'ad') {
      this.onWatchAd();
    }
    this.applyPendingShareParams();
  },

  getTemplateById(templateId) {
    const list = this.data.templates || [];
    return list.find(t => t.id === templateId) || null;
  },

  async loadTemplates() {
    this.setData({ templatesLoading: true, templatesLoadError: "" });
    let list = [];
    try {
      list = await fetchAffectLabTemplates();
    } catch (e) {
      list = [];
      this.setData({ templatesLoadError: '模板加载失败，请检查后端服务' });
    }
    const next = Array.isArray(list) ? list : [];
    this.setData({ templates: next, templatesLoading: false }, () => {
      this.updateTemplates();
      this.applyPendingShareParams();
      if (next.length === 0 && !_warnedEmptyTemplates) {
        _warnedEmptyTemplates = true;
        try {
          wx.showToast({ title: '暂无模板数据，请检查后端模板落库/接口', icon: 'none' });
        } catch (e) {}
      }
    });
  },

  applyPendingShareParams() {
    const p = this.data.pendingShareParams;
    if (!p) return;
    const t = this.getTemplateById(p.tid);
    if (!t) return;

    const assets = t.assets || {};
    const img = (assets && assets[p.r]) ? assets[p.r] : '';
    const presetTexts = Array.isArray(t.presetTexts) ? t.presetTexts : [];

    this.setData({
      sharedResult: {
        id: 'shared',
        templateId: p.tid,
        imageUrl: img,
        text: presetTexts[0] || t.title,
        userInput: decodeURIComponent(p.u),
        timestamp: Date.now(),
        rarity: p.r,
        filterSeed: 0,
        luckScore: p.s ? parseInt(p.s) : 80
      },
      pendingShareParams: null
    });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }

    if (wx.getStorageSync('cp_open_ad_on_load')) {
      wx.removeStorageSync('cp_open_ad_on_load');
      this.onWatchAd();
    }

    this.refreshBalanceFromServer();

    const lastOpened = wx.getStorageSync('cp_last_opened_result');
    if (lastOpened) {
      lastOpened.dateStr = new Date(lastOpened.timestamp).toLocaleDateString();
      this.setData({ generatedResult: lastOpened, view: 'RESULT' }, () => {
        this.hideTabBarSafe();
      });
      wx.removeStorageSync('cp_last_opened_result');
    } else {
      if (this.data.view !== 'RESULT' && !this.data.sharedResult) {
        this.showTabBarSafe();
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
    this.showTabBarSafe();
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
    const source = this.data.templates || [];
    const filtered = source.filter(t => {
      if (t.id === 'custom-signal') return false;
      const matchCat = categoryFilter ? t.category === categoryFilter : true;
      const matchSearch = searchTerm ? (
        t.title.includes(searchTerm) || 
        (Array.isArray(t.keywords) ? t.keywords : []).some(k => String(k || '').includes(searchTerm)) ||
        t.tag === searchTerm
      ) : true;
      return matchCat && matchSearch;
    });
    this.setData({ filteredTemplates: filtered });
  },

  onOpenDaily() {
    this.setData({ showSignIn: true });
  },
  
  closeSignIn() {
    this.setData({ showSignIn: false });
  },
  
    onClaimDaily() {
    if (this.data.canClaimDaily) {
      requestAffectLab({ path: '/user/reward/daily', method: 'POST', data: {} })
        .then((res) => {
          const bal = res?.data?.data?.balance;
          if (typeof bal === 'number') {
            this.setData({ candyCount: bal });
          }
          this.setData({ canClaimDaily: false, showSignIn: false });
          wx.showToast({ title: '领取成功', icon: 'none' });
        })
        .catch(() => {
          wx.showToast({ title: '领取失败，无可用数据', icon: 'none' });
        });
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
      requestAffectLab({ path: '/user/reward/ad', method: 'POST', data: { amount: 10 } })
        .then((res) => {
          const bal = res?.data?.data?.balance;
          if (typeof bal === 'number') {
            this.setData({ candyCount: bal });
          }
          wx.showToast({ title: '糖果 +10', icon: 'none' });
        })
        .catch(() => {
          wx.showToast({ title: '领取失败，请检查后端服务', icon: 'none' });
        });

      const nextUrl = wx.getStorageSync('cp_after_ad_redirect');
      if (nextUrl) {
        wx.removeStorageSync('cp_after_ad_redirect');
        wx.redirectTo({ url: nextUrl });
      }
    } else if (this.data.adType === 'REROLL') {
      if (this.data.selectedTemplate && this.data.userInput) {
        this.setData({ view: 'GENERATING', freeGenerateOnce: true });
      }
    }
  },

  onTemplateSelect(e) {
    this.setData({ selectedTemplate: e.detail, isInputting: true });
  },
  
  onCustomSignalSelect() {
    const custom = this.getTemplateById('custom-signal');
    if (custom) {
      this.setData({ selectedTemplate: custom, isInputting: true });
    }
  },
  
  closeInput() {
    this.setData({ isInputting: false });
  },
  
  async onInputConfirm(e) {
    const text = e.detail.text;
    const { selectedTemplate, candyCount } = this.data;
    
    if (candyCount < selectedTemplate.cost) {
      this.setData({ isInputting: false, adType: 'CANDY', showAd: true, adTimeLeft: 5 });
      this.startAdTimer();
      wx.showToast({ title: '糖果不足，看广告补充', icon: 'none' });
      return;
    }
    if (!getAffectLabToken()) await affectLabLogin();
    if (!getAffectLabToken()) {
      wx.showToast({ title: '登录失败，请检查后端服务', icon: 'none' });
      return;
    }

    this.setData({
      userInput: text,
      isInputting: false,
      view: 'GENERATING',
      freeGenerateOnce: false
    });
  },
  
  onSwitchTemplate(e) {
    const target = this.getTemplateById(e.detail.templateId);
    if (target) {
      this.setData({ selectedTemplate: target });
    }
  },

  onGenerationFinish(e) {
    const res = e.detail.result;
    this.setData({
      generatedResult: res,
      view: 'RESULT',
      freeGenerateOnce: false
    }, () => {
      this.hideTabBarSafe();
    });
    this.refreshBalanceFromServer();
  },

  onGenerationError(e) {
    this.setData({ view: 'HOME', freeGenerateOnce: false });
    this.showTabBarSafe();
    wx.showToast({ title: e?.detail?.message || '生成失败，请检查后端服务', icon: 'none' });
  },

  onGenerateInsufficient() {
    this.setData({
      view: 'HOME',
      adType: 'CANDY',
      showAd: true,
      adTimeLeft: 5,
      freeGenerateOnce: false
    });
    this.startAdTimer();
    this.showTabBarSafe();
    wx.showToast({ title: '糖果不足，看广告补充', icon: 'none' });
  },
  
  closeResult() {
    this.setData({ view: 'HOME', freeGenerateOnce: false });
    this.showTabBarSafe();
  },
  
  startReroll() {
    this.setData({ adType: 'REROLL', showAd: true, adTimeLeft: 5 });
    this.startAdTimer();
  },

  refreshBalanceFromServer() {
    if (!getAffectLabToken()) return;
    requestAffectLab({ path: '/user/balance', method: 'GET' })
      .then((res) => {
        const bal = res?.data?.data?.balance;
        if (typeof bal === 'number') {
          this.setData({ candyCount: bal });
        }
      })
      .catch(() => {});
  },

  refreshMeFromServer() {
    if (!getAffectLabToken()) return;
    requestAffectLab({ path: '/user/me', method: 'GET' })
      .then((res) => {
        const bal = Number(res?.data?.data?.balance?.balance);
        const lastDailyDate = res?.data?.data?.balance?.last_daily_date;
        if (!Number.isNaN(bal)) {
          this.setData({ candyCount: bal });
        }
        const today = new Date().toISOString().slice(0, 10);
        this.setData({ canClaimDaily: lastDailyDate !== today });
      })
      .catch(() => {});
  },

  onOpenRadar() {
    this.setData({ 
      showCategory: true,
      _tempCategoryFilter: this.data.categoryFilter,
      _tempSearchTerm: this.data.searchTerm
    });
  },
  
  closeRadar() {
    this.setData({ showCategory: false });
  },

  onRadarCancel() {
    this.setData({
      categoryFilter: this.data._tempCategoryFilter,
      searchTerm: this.data._tempSearchTerm,
      showCategory: false
    });
    this.updateTemplates();
  },

  onRadarConfirm() {
    this.setData({ showCategory: false });
  },
  
  onSelectCategory(e) {
    this.setData({ categoryFilter: e.currentTarget.dataset.id, searchTerm: '' });
    this.updateTemplates();
  },
  
  onTagSearch(e) {
    const tag = e.currentTarget.dataset.tag.replace('#', '');
    this.setData({ searchTerm: tag, categoryFilter: null });
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
    this.setData({ searchTerm: '', categoryFilter: null });
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
