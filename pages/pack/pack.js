import { requestAffectLab, getAffectLabToken, affectLabLogin } from '../../utils/api';

const PAGE_SIZE = 10;
const CATEGORY_OPTIONS = [
  { key: '', label: '全部' },
  { key: 'lucky', label: '能量指南' },
  { key: 'sharp', label: '高情商嘴替' },
  { key: 'persona', label: '社交人设' },
  { key: 'future', label: '未来' }
];
const RARITY_OPTIONS = [
  { key: '', label: '全部' },
  { key: 'N', label: 'N' },
  { key: 'R', label: 'R' },
  { key: 'SR', label: 'SR' },
  { key: 'SSR', label: 'SSR' }
];

Page({
  data: {
    candyCount: 0,
    contentPaddingTop: 80,
    statusBarHeight: 20,
    navBarHeight: 44,
    menuButtonWidth: 90,
    items: [],
    offset: 0,
    loading: false,
    hasMore: true,
    total: 0,
    kw: '',
    selectedCategory: '',
    selectedRarity: '',
    categories: CATEGORY_OPTIONS,
    rarities: RARITY_OPTIONS
  },

  normalizeHistory(items) {
    const list = Array.isArray(items) ? items : [];
    const out = [];
    for (const it of list) {
      if (!it || typeof it !== 'object') continue;
      const item = { ...it };
      const ts = item && item.timestamp ? item.timestamp : Date.now();
      item.dateStr = new Date(ts).toLocaleDateString();

      const text = String(item.text || '').trim();
      const userInput = String(item.userInput || '').trim();
      let displayText = '';
      if (item.templateId === 'custom-signal') {
        const content = String(item.content || '').trim();
        displayText = content || text || userInput;
      } else {
        displayText = text || userInput;
      }
      if (displayText.length > 16) displayText = displayText.slice(0, 16);
      item.displayText = displayText;
      out.push(item);
    }
    return out;
  },

  async ensureLogin() {
    if (!getAffectLabToken()) await affectLabLogin();
    return !!getAffectLabToken();
  },

  onLoad() {
    const app = getApp();
    if (app.globalData && app.globalData.totalHeaderHeight) {
      this.setData({
        contentPaddingTop: app.globalData.totalHeaderHeight + 10,
        statusBarHeight: app.globalData.statusBarHeight,
        navBarHeight: app.globalData.navBarHeight,
        menuButtonWidth: app.globalData.menuButtonWidth
      });
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }

    this.refreshAll();
  },

  onReachBottom() {
    this.loadMore();
  },

  onPullDownRefresh() {
    this.refreshAll(true);
  },

  onKwInput(e) {
    const v = e?.detail?.value;
    this.setData({ kw: typeof v === 'string' ? v : '' });
  },

  onSearchConfirm() {
    this.refreshAll();
  },

  onClearKw() {
    if (!this.data.kw) return;
    this.setData({ kw: '' });
    this.refreshAll();
  },

  onSelectCategory(e) {
    const key = e?.currentTarget?.dataset?.key;
    const next = key === this.data.selectedCategory ? '' : (key || '');
    this.setData({ selectedCategory: next });
    this.refreshAll();
  },

  onSelectRarity(e) {
    const key = e?.currentTarget?.dataset?.key;
    const next = key === this.data.selectedRarity ? '' : (key || '');
    this.setData({ selectedRarity: next });
    this.refreshAll();
  },

  async refreshAll(stopPullDown) {
    this.setData({ items: [], offset: 0, hasMore: true, total: 0 });
    try {
      await this.loadBalance();
      await this.loadMore(true);
    } finally {
      if (stopPullDown) wx.stopPullDownRefresh();
    }
  },

  async loadBalance() {
    const ok = await this.ensureLogin();
    if (!ok) {
      wx.showToast({ title: '登录失败，请检查后端服务', icon: 'none' });
      return;
    }
    try {
      const res = await requestAffectLab({ path: '/user/balance', method: 'GET' });
      const bal = res?.data?.data?.balance;
      if (typeof bal === 'number') this.setData({ candyCount: bal });
    } catch (e) {}
  },

  buildCardsPath(limit, offset) {
    const parts = [`/cards?limit=${limit}&offset=${offset}`];
    const kw = String(this.data.kw || '').trim();
    if (kw) parts.push(`kw=${encodeURIComponent(kw)}`);
    const cat = String(this.data.selectedCategory || '').trim();
    if (cat) parts.push(`category=${encodeURIComponent(cat)}`);
    const rar = String(this.data.selectedRarity || '').trim();
    if (rar) parts.push(`rarity=${encodeURIComponent(rar)}`);
    return parts.join('&');
  },

  async loadMore(skipToast) {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    const ok = await this.ensureLogin();
    if (!ok) {
      this.setData({ loading: false });
      if (!skipToast) wx.showToast({ title: '登录失败，请检查后端服务', icon: 'none' });
      return;
    }
    const offset = Number(this.data.offset) || 0;
    try {
      const res = await requestAffectLab({ path: this.buildCardsPath(PAGE_SIZE, offset), method: 'GET' });
      const rows = res?.data?.data?.items;
      const total = Number(res?.data?.data?.total);
      const arr = Array.isArray(rows) ? rows : [];
      const mapped = this.normalizeHistory(arr);
      this.setData({
        items: this.data.items.concat(mapped),
        offset: offset + arr.length,
        hasMore: arr.length >= PAGE_SIZE,
        total: Number.isFinite(total) ? total : this.data.total
      });
    } catch (e) {
      if (!skipToast) wx.showToast({ title: '加载失败，请检查后端服务', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onHistorySelect(e) {
    const item = e.currentTarget.dataset.item;
    wx.setStorageSync('cp_last_opened_result', item);
    wx.switchTab({ url: '/pages/index/index' });
  }
});
