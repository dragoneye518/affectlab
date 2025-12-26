import { requestAffectLab, getAffectLabToken, affectLabLogin } from '../../utils/api';

Page({
  data: {
    candyCount: 0,
    contentPaddingTop: 80,
    statusBarHeight: 20,
    navBarHeight: 44,
    menuButtonWidth: 90,
    title: '明细',
    mode: 'credit',
    items: []
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
    this.refreshItems();
  },

  goBack() {
    wx.navigateBack();
  },

  setMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.mode) return;
    const title = mode === 'debit' ? '消费明细' : '充值明细';
    this.setData({ mode, title });
    this.refreshItems();
  },

  refreshItems() {
    const filter = this.data.mode === 'debit' ? 'DEBIT' : 'CREDIT';
    this.setData({ items: [] });

    const load = async () => {
      if (!getAffectLabToken()) await affectLabLogin();
      if (!getAffectLabToken()) {
        wx.showToast({ title: '登录失败，无可用数据', icon: 'none' });
        return;
      }

      requestAffectLab({ path: '/user/transactions?limit=200&offset=0', method: 'GET' })
        .then((res) => {
          const items = res?.data?.data?.items;
          if (!Array.isArray(items)) return;
          const mapped = items
            .filter((it) => {
              const amt = Number(it.amount || 0);
              if (filter === 'CREDIT') return amt > 0;
              if (filter === 'DEBIT') return amt < 0;
              return true;
            })
            .slice(0, 80)
            .map((it) => {
              const ts = it.created_at ? new Date(it.created_at).getTime() : Date.now();
              const amount = Number(it.amount || 0);
              const title = it.reason ? `${it.type} · ${it.reason}` : it.type;
              const sub = new Date(ts).toLocaleString();
              return { id: String(it.id), ts, type: it.type, amount, title, sub };
            });
          this.setData({ items: mapped });
        })
        .catch(() => {
          wx.showToast({ title: '加载失败，无可用数据', icon: 'none' });
        });

      requestAffectLab({ path: '/user/balance', method: 'GET' })
        .then((res) => {
          const bal = res?.data?.data?.balance;
          if (typeof bal === 'number') this.setData({ candyCount: bal });
        })
        .catch(() => {});
    };

    load();
  }
});
