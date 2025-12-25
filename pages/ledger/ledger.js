import { ensureWallet, buildLedgerView } from '../../utils/util';

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
    const wallet = ensureWallet();
    const filter = this.data.mode === 'debit' ? 'DEBIT' : 'CREDIT';
    const items = buildLedgerView({ ledger: wallet.ledger, limit: 80, filter });
    this.setData({ candyCount: wallet.balance, items });
  }
});
