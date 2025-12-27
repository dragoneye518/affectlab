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
    resultReadOnly: false,
    
    // Overlays
    showSignIn: false,
    showAd: false,
    adType: 'CANDY',
    adScene: 'HOME_NAV',
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
    rerollBoostOnce: false,
    adTemplateId: null,
    generatingApiPath: '',
    generatingApiData: null,
    returnViewAfterResult: null,

    templeFairToday: '',
    templeFairProgress: null,
    templeFairTodayEntry: null,
    templeFairAction: null,
    showLanternEditor: false,
    lanternTitleDraft: '',
    lanternIsPublicDraft: false,
    showStampBooths: false,
    showTempleFairPublicModal: false,
    showTempleFairMemoryModal: false,
    templeFairStats: null,
    templeFairStatsLoading: false,
    templeFairPublicLanterns: [],
    templeFairPublicLanternsOffset: 0,
    templeFairPublicLanternsLoading: false,
    templeFairMemoryDays: [],
    templeFairBooths: [
      { id: 'fortune', label: '抽签摊', sub: 'LUCK SIGN' },
      { id: 'reply', label: '嘴替摊', sub: 'SHARP REPLY' },
      { id: 'mask', label: '面具摊', sub: 'SOCIAL MASK' }
    ],
    
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
    this.refreshTempleFairToday();

    // Check Share URL
    if (params && params.open === 'ad') {
      this.onWatchAd();
    }
    this.applyPendingShareParams();
  },

  getTodayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  refreshTempleFairToday() {
    this.setData({ templeFairToday: this.getTodayStr() }, () => {
      this.refreshTempleFairTodayEntry();
    });
  },

  readTempleFairProgress() {
    const raw = wx.getStorageSync('cp_temple_fair_progress');
    if (!raw) return { eventId: '2026_temple_fair', days: [], updatedAt: Date.now() };
    try {
      const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!p || typeof p !== 'object') return { eventId: '2026_temple_fair', days: [], updatedAt: Date.now() };
      if (!Array.isArray(p.days)) p.days = [];
      if (!p.eventId) p.eventId = '2026_temple_fair';
      return p;
    } catch (e) {
      return { eventId: '2026_temple_fair', days: [], updatedAt: Date.now() };
    }
  },

  writeTempleFairProgress(progress) {
    const p = progress && typeof progress === 'object' ? progress : { eventId: '2026_temple_fair', days: [], updatedAt: Date.now() };
    p.updatedAt = Date.now();
    try {
      wx.setStorageSync('cp_temple_fair_progress', JSON.stringify(p));
    } catch (e) {}
    this.setData({ templeFairProgress: p }, () => {
      this.refreshTempleFairTodayEntry();
      this.refreshTempleFairMemoryDays(p);
    });
  },

  ensureTempleFairTodayEntry(progress) {
    const p = progress && typeof progress === 'object' ? progress : { eventId: '2026_temple_fair', days: [] };
    const today = this.data.templeFairToday || this.getTodayStr();
    const days = Array.isArray(p.days) ? p.days : [];
    let entry = days.find(x => x && x.date === today) || null;
    if (!entry) {
      entry = { date: today, sign: null, lantern: null, stamp: null };
      p.days = [entry].concat(days).slice(0, 60);
    }
    return { progress: p, entry };
  },

  refreshTempleFairTodayEntry() {
    const progress = this.data.templeFairProgress || this.readTempleFairProgress();
    const { progress: next, entry } = this.ensureTempleFairTodayEntry(progress);
    if (next !== progress) {
      this.writeTempleFairProgress(next);
      return;
    }
    this.setData({ templeFairTodayEntry: entry });
  },

  refreshTempleFairMemoryDays(progress) {
    const p = progress && typeof progress === 'object' ? progress : (this.data.templeFairProgress || this.readTempleFairProgress());
    const days = Array.isArray(p.days) ? p.days : [];
    const list = days
      .filter(d => d && typeof d === 'object' && (
        (d.sign && d.sign.recordId) || (d.lantern && d.lantern.recordId) || (d.stamp && d.stamp.recordId)
      ))
      .slice(0, 14);
    this.setData({ templeFairMemoryDays: list });
  },

  async syncTempleFairFromServer() {
    if (!getAffectLabToken()) return;
    try {
      const res = await requestAffectLab({ path: '/event/temple_fair/status', method: 'GET' });
      const progress = res?.data?.data?.progress;
      if (res?.statusCode === 200 && progress && typeof progress === 'object') {
        const merged = { ...this.readTempleFairProgress(), ...progress };
        this.writeTempleFairProgress(merged);
      }
    } catch (e) {}
  },

  async loadTempleFairStats() {
    if (this.data.templeFairStatsLoading) return;
    this.setData({ templeFairStatsLoading: true });
    try {
      const res = await requestAffectLab({ path: '/event/temple_fair/stats', method: 'GET', auth: false });
      const stats = res?.data?.data;
      if (res?.statusCode === 200 && stats && typeof stats === 'object') {
        this.setData({ templeFairStats: stats });
      }
    } catch (e) {} finally {
      this.setData({ templeFairStatsLoading: false });
    }
  },

  async loadTempleFairPublicLanterns(reset) {
    if (this.data.templeFairPublicLanternsLoading) return;
    const shouldReset = !!reset;
    const offset = shouldReset ? 0 : (Number(this.data.templeFairPublicLanternsOffset) || 0);
    this.setData({ templeFairPublicLanternsLoading: true });
    try {
      const res = await requestAffectLab({
        path: '/event/temple_fair/lanterns/public',
        method: 'GET',
        auth: false,
        data: { offset, limit: 10 }
      });
      const items = res?.data?.data?.items;
      if (res?.statusCode === 200 && Array.isArray(items)) {
        const next = shouldReset ? items : (this.data.templeFairPublicLanterns || []).concat(items);
        this.setData({
          templeFairPublicLanterns: next,
          templeFairPublicLanternsOffset: offset + items.length
        });
      }
    } catch (e) {} finally {
      this.setData({ templeFairPublicLanternsLoading: false });
    }
  },

  onRefreshTempleFairPublic() {
    this.loadTempleFairPublicLanterns(true);
  },

  onLoadMoreTempleFairPublic() {
    this.loadTempleFairPublicLanterns(false);
  },

  onOpenPublicLanternResult(e) {
    const idx = Number(e?.currentTarget?.dataset?.idx);
    const item = Number.isFinite(idx) ? (this.data.templeFairPublicLanterns || [])[idx] : null;
    const result = item && typeof item === 'object' ? item.result : null;
    if (!result || typeof result !== 'object') return;
    this.setData({
      showTempleFairPublicModal: false,
      showTempleFairMemoryModal: false,
      generatedResult: result,
      view: 'RESULT',
      resultReadOnly: true,
      returnViewAfterResult: 'TEMPLE'
    }, () => this.hideTabBarSafe());
  },

  onOpenMemoryDaySign(e) {
    const idx = Number(e?.currentTarget?.dataset?.idx);
    const day = Number.isFinite(idx) ? (this.data.templeFairMemoryDays || [])[idx] : null;
    const sign = day && typeof day === 'object' ? day.sign : null;
    if (!sign || typeof sign !== 'object' || !sign.recordId) return;
    this.setData({
      showTempleFairPublicModal: false,
      showTempleFairMemoryModal: false,
      generatedResult: {
        id: sign.recordId,
        templateId: 'custom-signal',
        imageUrl: sign.imageUrl || '',
        text: sign.text || '',
        content: sign.content || '',
        userInput: sign.userInput || '',
        timestamp: sign.timestamp || Date.now(),
        rarity: sign.rarity || 'N',
        filterSeed: sign.filterSeed || 0,
        luckScore: sign.luckScore || 0
      },
      view: 'RESULT',
      resultReadOnly: true,
      returnViewAfterResult: 'TEMPLE'
    }, () => this.hideTabBarSafe());
  },

  onOpenTempleFair() {
    const progress = this.readTempleFairProgress();
    this.setData({
      view: 'TEMPLE',
      templeFairProgress: progress,
      generatingApiPath: '',
      generatingApiData: null,
      returnViewAfterResult: null,
      templeFairAction: null,
      showTempleFairPublicModal: false,
      showTempleFairMemoryModal: false
    }, () => {
      this.hideTabBarSafe();
      this.refreshTempleFairToday();
      this.refreshTempleFairMemoryDays(progress);
      this.syncTempleFairFromServer();
      this.loadTempleFairStats();
    });
  },

  onCloseTempleFair() {
    this.setData({
      view: 'HOME',
      showLanternEditor: false,
      showStampBooths: false,
      showTempleFairPublicModal: false,
      showTempleFairMemoryModal: false,
      templeFairAction: null
    }, () => {
      this.showTabBarSafe();
    });
  },

  onOpenTempleFairPublic() {
    this.setData({ showTempleFairPublicModal: true }, () => {
      this.loadTempleFairPublicLanterns(true);
    });
  },

  onCloseTempleFairPublic() {
    this.setData({ showTempleFairPublicModal: false });
  },

  onOpenTempleFairMemory() {
    const progress = this.data.templeFairProgress || this.readTempleFairProgress();
    this.refreshTempleFairMemoryDays(progress);
    this.setData({ showTempleFairMemoryModal: true });
  },

  onCloseTempleFairMemory() {
    this.setData({ showTempleFairMemoryModal: false });
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
      this.openCandyAd('PROFILE');
    }

    this.refreshBalanceFromServer();

    const lastOpened = wx.getStorageSync('cp_last_opened_result');
    if (lastOpened) {
      lastOpened.dateStr = new Date(lastOpened.timestamp).toLocaleDateString();
      this.setData({ generatedResult: lastOpened, view: 'RESULT', resultReadOnly: true }, () => {
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
      const isTempleFairResult = this.data.returnViewAfterResult === 'TEMPLE';
      const safeSubject = isTempleFairResult ? this.getTempleFairShareSubject(res) : this.sanitizeShareSubject(res.userInput);
      if (isTempleFairResult) {
        return {
          title: `赛博庙会·${safeSubject}`,
          path: `/pages/index/index?tid=${res.templateId}&u=${encodeURIComponent(safeSubject)}&r=${res.rarity}&s=${res.luckScore}&tf=1`
        };
      }
      return {
        title: `[${res.rarity}] ${safeSubject} 的运势评分: ${res.luckScore}`,
        path: `/pages/index/index?tid=${res.templateId}&u=${encodeURIComponent(safeSubject)}&r=${res.rarity}&s=${res.luckScore}`
      };
    }
    return {
      title: '赛博情绪实验室',
      path: '/pages/index/index'
    };
  },

  sanitizeShareSubject(raw) {
    const s = String(raw || '').replace(/\r/g, ' ').replace(/\n/g, ' ').trim().replace(/\s+/g, ' ');
    const t = (s || '匿名香客').slice(0, 20);
    if (this.isTempleFairLanternTitleUnsafe(t)) return '匿名香客';
    return t;
  },

  getTempleFairShareSubject(result) {
    const rid = result && typeof result === 'object' ? String(result.id || '') : '';
    const progress = this.data.templeFairProgress || this.readTempleFairProgress();
    const days = Array.isArray(progress?.days) ? progress.days : [];
    const hit = days.find(d => {
      if (!d || typeof d !== 'object') return false;
      const signRid = d?.sign?.recordId ? String(d.sign.recordId) : '';
      const lanternRid = d?.lantern?.recordId ? String(d.lantern.recordId) : '';
      const stampRid = d?.stamp?.recordId ? String(d.stamp.recordId) : '';
      return (rid && (rid === signRid || rid === lanternRid || rid === stampRid));
    }) || null;
    const title = hit?.lantern?.title ? String(hit.lantern.title) : '';
    if (title) return this.sanitizeShareSubject(title);
    const signText = hit?.sign?.text ? String(hit.sign.text) : '';
    if (signText) return this.sanitizeShareSubject(signText);
    const fallback = String(result?.content || result?.text || '') || '匿名香客';
    return this.sanitizeShareSubject(fallback);
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
    this.openCandyAd('HOME_NAV');
  },

  openCandyAd(scene) {
    const s = String(scene || '').trim().toUpperCase();
    this.setData({ adType: 'CANDY', adScene: s || 'HOME_NAV', showAd: true, adTimeLeft: 5 });
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
      requestAffectLab({ path: '/user/reward/ad', method: 'POST', data: { scene: this.data.adScene || 'HOME_NAV' } })
        .then((res) => {
          const bal = res?.data?.data?.balance;
          const amt = res?.data?.data?.amount;
          if (typeof bal === 'number') {
            this.setData({ candyCount: bal });
          }
          wx.showToast({ title: `算力 +${typeof amt === 'number' ? amt : 10}`, icon: 'none' });
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
      const tid = this.data.adTemplateId || this.data.selectedTemplate?.id || this.data.generatedResult?.templateId;
      if (!tid || !this.data.selectedTemplate || !this.data.userInput) return;
      requestAffectLab({ path: '/user/reward/ad', method: 'POST', data: { scene: 'REROLL', templateId: tid } })
        .then((res) => {
          const bal = res?.data?.data?.balance;
          const amt = res?.data?.data?.amount;
          if (typeof bal === 'number') {
            this.setData({ candyCount: bal });
          }
          wx.showToast({ title: `重抽补贴 +${typeof amt === 'number' ? amt : 1}`, icon: 'none' });
          this.setData({ view: 'GENERATING', rerollBoostOnce: true, freeGenerateOnce: false });
        })
        .catch(() => {
          wx.showToast({ title: '重抽补贴领取失败，请检查后端服务', icon: 'none' });
        });
    }
  },

  onTemplateSelect(e) {
    this.setData({ selectedTemplate: e.detail, isInputting: true });
  },
  
  onCustomSignalSelect() {
    const custom = this.getTemplateById('custom-signal') || this.getFallbackCustomSignalTemplate();
    this.setData({ selectedTemplate: custom, isInputting: true });
  },
  
  closeInput() {
    this.setData({ isInputting: false });
  },
  
  async onInputConfirm(e) {
    const text = e.detail.text;
    const { selectedTemplate, candyCount } = this.data;

    if (this.data.templeFairAction === 'SIGN') {
      if (!getAffectLabToken()) await affectLabLogin();
      if (!getAffectLabToken()) {
        wx.showToast({ title: '登录失败，请检查后端服务', icon: 'none' });
        this.setData({ templeFairAction: null, isInputting: false });
        return;
      }
      this.setData({
        userInput: text,
        isInputting: false,
        view: 'GENERATING',
        freeGenerateOnce: false,
        rerollBoostOnce: false,
        generatingApiPath: '/event/temple_fair/daily_draw',
        generatingApiData: { userInput: text },
        returnViewAfterResult: 'TEMPLE'
      });
      return;
    }
    
    if (candyCount < selectedTemplate.cost) {
      this.setData({ isInputting: false });
      this.openCandyAd('INSUFFICIENT');
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
      freeGenerateOnce: false,
      generatingApiPath: '',
      generatingApiData: null,
      returnViewAfterResult: this.data.templeFairAction ? 'TEMPLE' : null
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
    const balance = e && e.detail ? e.detail.balance : undefined;
    const templeAction = this.data.templeFairAction;
    if (templeAction === 'SIGN') {
      this.applyTempleSignResult(res);
    } else if (templeAction && templeAction.startsWith('STAMP:')) {
      const boothId = templeAction.split(':')[1] || '';
      this.applyTempleStampResult(res, boothId);
    }
    this.setData({
      generatedResult: res,
      view: 'RESULT',
      resultReadOnly: false,
      freeGenerateOnce: false,
      rerollBoostOnce: false,
      candyCount: typeof balance === 'number' ? balance : this.data.candyCount,
      generatingApiPath: '',
      generatingApiData: null,
      templeFairAction: null
    }, () => {
      this.hideTabBarSafe();
    });
    if (typeof balance !== 'number') this.refreshBalanceFromServer();
  },

  onGenerationError(e) {
    const back = this.data.returnViewAfterResult || (this.data.view === 'TEMPLE' ? 'TEMPLE' : 'HOME');
    this.setData({
      view: back,
      freeGenerateOnce: false,
      rerollBoostOnce: false,
      generatingApiPath: '',
      generatingApiData: null,
      templeFairAction: null,
      isInputting: false
    });
    if (back === 'HOME') this.showTabBarSafe();
    wx.showToast({ title: e?.detail?.message || '生成失败，请检查后端服务', icon: 'none' });
  },

  onGenerateInsufficient() {
    this.setData({
      view: 'HOME',
      adType: 'CANDY',
      showAd: true,
      adTimeLeft: 5,
      freeGenerateOnce: false,
      rerollBoostOnce: false
    });
    this.startAdTimer();
    this.showTabBarSafe();
    wx.showToast({ title: '糖果不足，看广告补充', icon: 'none' });
  },
  
  closeResult() {
    const back = this.data.returnViewAfterResult || 'HOME';
    this.setData({
      view: back,
      freeGenerateOnce: false,
      rerollBoostOnce: false,
      resultReadOnly: false,
      adTemplateId: null,
      returnViewAfterResult: null,
      generatingApiPath: '',
      generatingApiData: null
    });
    if (back === 'HOME') this.showTabBarSafe();
  },

  getTempleSignTemplate() {
    return this.getTemplateById('custom-signal') || this.getFallbackCustomSignalTemplate();
  },

  getFallbackCustomSignalTemplate() {
    return {
      id: 'custom-signal',
      title: '今日一签',
      subtitle: '',
      tag: '',
      assets: {},
      imageUrl: '',
      cost: 0,
      category: '',
      inputHint: '输入你的任何情绪 (如: 不想上班, 前任找我)...',
      quickPrompts: [],
      description: '',
      keywords: [],
      presetTexts: []
    };
  },

  onTempleDailyDraw() {
    const entry = this.data.templeFairTodayEntry;
    if (entry && entry.sign && entry.sign.recordId) {
      this.setData({
        generatedResult: {
          id: entry.sign.recordId,
          templateId: 'custom-signal',
          imageUrl: entry.sign.imageUrl || '',
          text: entry.sign.text || '',
          content: entry.sign.content || '',
          userInput: entry.sign.userInput || '',
          timestamp: entry.sign.timestamp || Date.now(),
          rarity: entry.sign.rarity || 'N',
          filterSeed: entry.sign.filterSeed || 0,
          luckScore: entry.sign.luckScore || 0
        },
        view: 'RESULT',
        resultReadOnly: true,
        returnViewAfterResult: 'TEMPLE'
      }, () => this.hideTabBarSafe());
      return;
    }
    const t = this.getTempleSignTemplate();
    if (!t) {
      wx.showToast({ title: '签文模板缺失', icon: 'none' });
      return;
    }
    this.setData({ selectedTemplate: t, isInputting: true, templeFairAction: 'SIGN' });
  },

  applyTempleSignResult(res) {
    const progress = this.readTempleFairProgress();
    const { progress: p, entry } = this.ensureTempleFairTodayEntry(progress);
    const displayText = (res && res.templateId === 'custom-signal') ? (String(res.content || '').trim() || String(res.text || '').trim()) : String(res.text || '').trim();
    entry.sign = {
      recordId: res?.id || '',
      text: displayText,
      content: res?.content || '',
      userInput: res?.userInput || '',
      imageUrl: res?.imageUrl || '',
      timestamp: res?.timestamp || Date.now(),
      rarity: res?.rarity || 'N',
      filterSeed: res?.filterSeed || 0,
      luckScore: res?.luckScore || 0
    };
    this.writeTempleFairProgress(p);
  },

  onOpenLanternEditor() {
    const entry = this.data.templeFairTodayEntry;
    if (!entry || !entry.sign || !entry.sign.recordId) {
      wx.showToast({ title: '先完成今日一签', icon: 'none' });
      return;
    }
    const current = entry.lantern || {};
    const draftTitle = current.title || '香火已上链';
    this.setData({
      showLanternEditor: true,
      lanternTitleDraft: draftTitle,
      lanternIsPublicDraft: !!current.isPublic
    });
  },

  onCloseLanternEditor() {
    this.setData({ showLanternEditor: false });
  },

  onLanternTitleInput(e) {
    this.setData({ lanternTitleDraft: e?.detail?.value || '' });
  },

  onLanternPublicChange(e) {
    this.setData({ lanternIsPublicDraft: !!(e && e.detail ? e.detail.value : false) });
  },

  normalizeTempleFairLanternTitle(raw) {
    const s = String(raw || '').replace(/\r/g, ' ').replace(/\n/g, ' ').trim().replace(/\s+/g, ' ');
    return (s || '香火已上链').slice(0, 20);
  },

  isTempleFairLanternTitleUnsafe(title) {
    const t = String(title || '').trim();
    if (!t) return false;
    const patterns = [
      /(https?:\/\/|www\.)/i,
      /\b[a-z0-9-]+\.(com|cn|net|org|io|cc)\b/i,
      /(?:\+?86[-\s]?)?1[3-9]\d{9}/,
      /(微信|vx|v信|wechat|qq|加群|群号|私聊|联系我)/i
    ];
    return patterns.some(r => r.test(t));
  },

  onSaveLantern() {
    const entry = this.data.templeFairTodayEntry;
    if (!entry || !entry.sign || !entry.sign.recordId) return;
    const isPublic = !!this.data.lanternIsPublicDraft;
    const title = this.normalizeTempleFairLanternTitle(this.data.lanternTitleDraft);
    if (isPublic && this.isTempleFairLanternTitleUnsafe(title)) {
      wx.showToast({ title: '公开标题不安全，请修改', icon: 'none' });
      return;
    }
    const progress = this.readTempleFairProgress();
    const { progress: p, entry: todayEntry } = this.ensureTempleFairTodayEntry(progress);
    const prevLantern = todayEntry.lantern && typeof todayEntry.lantern === 'object' ? { ...todayEntry.lantern } : null;
    todayEntry.lantern = { recordId: entry.sign.recordId, title, isPublic };
    this.writeTempleFairProgress(p);
    this.setData({ showLanternEditor: false });
    if (getAffectLabToken()) {
      requestAffectLab({
        path: '/event/temple_fair/lantern',
        method: 'POST',
        data: { recordId: entry.sign.recordId, title, isPublic }
      }).then((res) => {
        if (res?.statusCode === 200) return;
        const msg = (res?.data && (res.data.detail || res.data.msg)) || '挂灯失败';
        const latest = this.readTempleFairProgress();
        const { progress: p2, entry: e2 } = this.ensureTempleFairTodayEntry(latest);
        e2.lantern = prevLantern;
        this.writeTempleFairProgress(p2);
        wx.showToast({ title: String(msg).slice(0, 20), icon: 'none' });
      }).catch(() => {
        const latest = this.readTempleFairProgress();
        const { progress: p2, entry: e2 } = this.ensureTempleFairTodayEntry(latest);
        e2.lantern = prevLantern;
        this.writeTempleFairProgress(p2);
        wx.showToast({ title: '后端不可达，已回退', icon: 'none' });
      });
    }
    wx.showToast({ title: '挂灯成功', icon: 'none' });
  },

  onOpenStampBooths() {
    const entry = this.data.templeFairTodayEntry;
    if (!entry || !entry.sign || !entry.sign.recordId) {
      wx.showToast({ title: '先完成今日一签', icon: 'none' });
      return;
    }
    this.setData({ showStampBooths: true });
  },

  onCloseStampBooths() {
    this.setData({ showStampBooths: false });
  },

  pickBoothTemplate(boothId) {
    const templates = this.data.templates || [];
    const byId = (id) => templates.find(t => t && t.id === id) || null;
    if (boothId === 'fortune') return byId('cyber-fortune') || byId('energy-daily') || byId('custom-signal');
    if (boothId === 'reply') return byId('relative-shield') || byId('roast-boss') || byId('diet-excuse');
    if (boothId === 'mask') return byId('mbti-meme') || byId('rich-vibe') || byId('clown-cert');
    return templates[0] || null;
  },

  onChooseStampBooth(e) {
    const boothId = e?.currentTarget?.dataset?.id;
    const booth = (this.data.templeFairBooths || []).find(x => x && x.id === boothId) || null;
    const t = this.pickBoothTemplate(boothId);
    if (!t) {
      wx.showToast({ title: '摊位模板缺失', icon: 'none' });
      return;
    }
    this.setData({
      showStampBooths: false,
      selectedTemplate: t,
      isInputting: true,
      templeFairAction: `STAMP:${boothId}`,
      _templeStampBoothLabel: booth ? booth.label : ''
    });
  },

  applyTempleStampResult(res, boothId) {
    const booth = (this.data.templeFairBooths || []).find(x => x && x.id === boothId) || null;
    const progress = this.readTempleFairProgress();
    const { progress: p, entry } = this.ensureTempleFairTodayEntry(progress);
    entry.stamp = {
      recordId: res?.id || '',
      boothId: boothId,
      boothLabel: booth ? booth.label : (this.data._templeStampBoothLabel || ''),
      templateId: res?.templateId || '',
      rarity: res?.rarity || 'N'
    };
    this.writeTempleFairProgress(p);
    if (getAffectLabToken()) {
      requestAffectLab({
        path: '/event/temple_fair/stamp',
        method: 'POST',
        data: {
          recordId: res?.id || '',
          boothId: boothId,
          boothLabel: booth ? booth.label : (this.data._templeStampBoothLabel || ''),
          templateId: res?.templateId || '',
          rarity: res?.rarity || 'N'
        }
      }).catch(() => {});
    }
  },
  
  startReroll() {
    const tid = this.data.generatedResult?.templateId || this.data.selectedTemplate?.id || null;
    this.setData({ adType: 'REROLL', showAd: true, adTimeLeft: 5, adTemplateId: tid });
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
    this.hideTabBarSafe();
    this.setData({ 
      showCategory: true,
      _tempCategoryFilter: this.data.categoryFilter,
      _tempSearchTerm: this.data.searchTerm
    });
  },
  
  closeRadar() {
    this.setData({ showCategory: false });
    this.showTabBarSafe();
  },

  onRadarCancel() {
    this.setData({
      categoryFilter: this.data._tempCategoryFilter,
      searchTerm: this.data._tempSearchTerm,
      showCategory: false
    });
    this.updateTemplates();
    this.showTabBarSafe();
  },

  onRadarConfirm() {
    this.setData({ showCategory: false });
    this.showTabBarSafe();
  },
  
  onSelectCategory(e) {
    this.setData({ categoryFilter: e.currentTarget.dataset.id, searchTerm: '' });
    this.updateTemplates();
  },
  
  onTagSearch(e) {
    const tag = e.currentTarget.dataset.tag.replace('#', '');
    if (this.data.searchTerm === tag) {
      this.setData({ searchTerm: '', categoryFilter: null });
    } else {
      this.setData({ searchTerm: tag, categoryFilter: null });
    }
    this.updateTemplates();
  },
  
  onTagFilter(e) {
    const tag = e.currentTarget.dataset.tag;
    if (this.data.searchTerm === tag) {
      this.setData({ searchTerm: '', categoryFilter: null });
    } else {
      this.setData({ searchTerm: tag, categoryFilter: null });
    }
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
    this.showTabBarSafe();
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
