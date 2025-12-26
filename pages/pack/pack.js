import { requestAffectLab, getAffectLabToken, affectLabLogin } from '../../utils/api';

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

    this.setData({ history: [] });

    const load = async () => {
      if (!getAffectLabToken()) await affectLabLogin();
      if (!getAffectLabToken()) {
        wx.showToast({ title: '登录失败，请检查后端服务', icon: 'none' });
        return;
      }
      requestAffectLab({ path: '/user/balance', method: 'GET' })
        .then((res) => {
          const bal = res?.data?.data?.balance;
          if (typeof bal === 'number') this.setData({ candyCount: bal });
        })
        .catch(() => {});
      requestAffectLab({ path: '/cards', method: 'GET' })
        .then((res) => {
          const items = res?.data?.data?.items;
          if (res.statusCode === 200 && Array.isArray(items)) {
            for (const item of items) {
              item.dateStr = new Date(item.timestamp).toLocaleDateString();
            }
            this.setData({ history: items });
          } else {
            wx.showToast({ title: '加载失败，请检查后端服务', icon: 'none' });
          }
        })
        .catch(() => {
          wx.showToast({ title: '加载失败，请检查后端服务', icon: 'none' });
        });
    };
    load();
  },

  onHistorySelect(e) {
    const item = e.currentTarget.dataset.item;
    wx.setStorageSync('cp_last_opened_result', item);
    wx.switchTab({ url: '/pages/index/index' });
  }
});
