import { ensureWallet } from '../../utils/util';

Page({
  data: {
    candyCount: 0,
    contentPaddingTop: 80,
    statusBarHeight: 20,
    navBarHeight: 44,
    menuButtonWidth: 90,
    history: [],
    canClaimDaily: false
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

    const history = wx.getStorageSync('cp_history') || [];
    for (const item of history) {
      item.dateStr = new Date(item.timestamp).toLocaleDateString();
    }
    this.setData({ history });

    const wallet = ensureWallet();
    this.setData({ candyCount: wallet.balance });
  },

  onHistorySelect(e) {
    const item = e.currentTarget.dataset.item;
    wx.setStorageSync('cp_last_opened_result', item);
    wx.switchTab({ url: '/pages/index/index' });
  }
});
