import { requestAffectLab, getAffectLabToken, affectLabLogin } from '../../utils/api';

const PAGE_SIZE = 20;

Page({
  data: {
    candyCount: 0,
    contentPaddingTop: 80,
    statusBarHeight: 20,
    navBarHeight: 44,
    menuButtonWidth: 90,
    title: '明细',
    mode: 'credit',
    items: [],
    offset: 0,
    loading: false,
    hasMore: true,
    totalRecharge: 0,
    totalConsume: 0
  },

  mapTxType(type) {
    const t = String(type || '').toUpperCase();
    if (t === 'RECHARGE') return '充值';
    if (t === 'CONSUME') return '消费';
    if (t === 'REROLL') return '重抽';
    return t || '明细';
  },

  mapTxReason(reason) {
    const r = String(reason || '').toUpperCase();
    if (r === 'INIT') return '新用户赠送';
    if (r === 'DAILY') return '每日补给';
    if (r === 'AD') return '广告补给';
    if (r === 'AD_REROLL') return '广告重抽补贴';
    if (r === 'GENERATE') return '生成情绪卡';
    if (r === 'REROLL_GENERATE') return '重抽生成';
    return reason ? String(reason) : '';
  },

  onLoad(options) {
    const app = getApp();
    if (app.globalData && app.globalData.totalHeaderHeight) {
      this.setData({
        contentPaddingTop: app.globalData.totalHeaderHeight + 10,
        statusBarHeight: app.globalData.statusBarHeight,
        navBarHeight: app.globalData.navBarHeight,
        menuButtonWidth: app.globalData.menuButtonWidth
      });
    }

    const mode = options && options.mode ? options.mode : 'credit';
    const title = mode === 'debit' ? '消费明细' : '充值明细';
    this.setData({ title, mode });
  },

  onShow() {
    this.refreshAll();
  },

  onReachBottom() {
    this.loadMore();
  },

  onPullDownRefresh() {
    this.refreshAll(true);
  },

  goBack() {
    wx.navigateBack();
  },

  setMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.mode) return;
    const title = mode === 'debit' ? '消费明细' : '充值明细';
    this.setData({ mode, title, items: [], offset: 0, hasMore: true });
    this.loadMore();
  },

  async ensureLogin() {
    if (!getAffectLabToken()) await affectLabLogin();
    return !!getAffectLabToken();
  },

  async refreshAll(stopPullDown) {
    this.setData({ items: [], offset: 0, hasMore: true });
    try {
      await this.loadTotals();
      await this.loadMore(true);
    } finally {
      if (stopPullDown) wx.stopPullDownRefresh();
    }
  },

  async loadTotals() {
    const ok = await this.ensureLogin();
    if (!ok) {
      wx.showToast({ title: '登录失败，无可用数据', icon: 'none' });
      return;
    }
    try {
      const res = await requestAffectLab({ path: '/user/me', method: 'GET' });
      const bal = res?.data?.data?.balance || {};
      const balance = Number(bal.balance);
      const totalRecharge = Number(bal.total_recharge);
      const totalConsume = Number(bal.total_consume);
      this.setData({
        candyCount: Number.isFinite(balance) ? balance : this.data.candyCount,
        totalRecharge: Number.isFinite(totalRecharge) ? totalRecharge : 0,
        totalConsume: Number.isFinite(totalConsume) ? totalConsume : 0
      });
    } catch (e) {}
  },

  async loadMore(skipToast) {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });

    const ok = await this.ensureLogin();
    if (!ok) {
      this.setData({ loading: false });
      if (!skipToast) wx.showToast({ title: '登录失败，无可用数据', icon: 'none' });
      return;
    }

    const type = this.data.mode === 'debit' ? 'CONSUME' : 'RECHARGE';
    const offset = Number(this.data.offset) || 0;
    try {
      const res = await requestAffectLab({
        path: `/user/transactions?limit=${PAGE_SIZE}&offset=${offset}&type=${type}`,
        method: 'GET'
      });
      const rows = res?.data?.data?.items;
      const arr = Array.isArray(rows) ? rows : [];
      const mapped = arr.map((it) => {
        const ts = it.created_at ? new Date(it.created_at).getTime() : Date.now();
        const amount = Number(it.amount || 0);
        const typeCN = this.mapTxType(it.type);
        const reasonCN = this.mapTxReason(it.reason);
        const title = reasonCN ? `${typeCN} · ${reasonCN}` : typeCN;
        const sub = new Date(ts).toLocaleString();
        return { id: String(it.id), ts, type: it.type, amount, title, sub };
      });

      this.setData({
        items: this.data.items.concat(mapped),
        offset: offset + arr.length,
        hasMore: arr.length >= PAGE_SIZE
      });
    } catch (e) {
      if (!skipToast) wx.showToast({ title: '加载失败，无可用数据', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
