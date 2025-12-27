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
            this.setData({ history: this.normalizeHistory(items) });
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
