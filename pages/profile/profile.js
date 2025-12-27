import { requestAffectLab, getAffectLabToken, affectLabLogin } from '../../utils/api';

Page({
  data: {
    candyCount: 0,
    contentPaddingTop: 80,
    statusBarHeight: 20,
    navBarHeight: 44,
    menuButtonWidth: 90,
    canClaimDaily: false,
    summary: { totalCredit: 0, totalDebit: 0, adCount: 0, dailyCount: 0, generateCount: 0 }
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
      this.getTabBar().setData({ selected: 2 });
    }

    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);

      if (!getAffectLabToken()) await affectLabLogin();
      if (!getAffectLabToken()) {
        wx.showToast({ title: '登录失败，无可用数据', icon: 'none' });
        return;
      }

      requestAffectLab({ path: '/user/me', method: 'GET' })
        .then((res) => {
          const bal = res?.data?.data?.balance?.balance;
          const lastDailyDate = res?.data?.data?.balance?.last_daily_date;
          if (typeof bal === 'number') {
            this.setData({ candyCount: bal });
          }
          this.setData({ canClaimDaily: lastDailyDate !== today });
        })
        .catch(() => {
          wx.showToast({ title: '加载失败，无可用数据', icon: 'none' });
        });

      requestAffectLab({ path: '/user/transactions?limit=200&offset=0', method: 'GET' })
        .then((res) => {
          const items = res?.data?.data?.items;
          if (!Array.isArray(items)) {
            this.setData({ summary: { totalCredit: 0, totalDebit: 0, adCount: 0, dailyCount: 0, generateCount: 0 } });
            return;
          }
          let totalCredit = 0;
          let totalDebit = 0;
          let adCount = 0;
          let dailyCount = 0;
          let generateCount = 0;
          for (const it of items) {
            const amt = Number(it.amount || 0);
            if (amt > 0) totalCredit += amt;
            if (amt < 0) totalDebit += Math.abs(amt);
            if (it.reason === 'AD' || it.reason === 'AD_REROLL') adCount += 1;
            if (it.reason === 'DAILY') dailyCount += 1;
            if (it.type === 'CONSUME') generateCount += 1;
          }
          this.setData({ summary: { totalCredit, totalDebit, adCount, dailyCount, generateCount } });
        })
        .catch(() => {
          this.setData({ summary: { totalCredit: 0, totalDebit: 0, adCount: 0, dailyCount: 0, generateCount: 0 } });
          wx.showToast({ title: '明细加载失败，无可用数据', icon: 'none' });
        });
    };

    load();
  },

  goCreditDetail() {
    wx.navigateTo({ url: '/pages/ledger/ledger?mode=credit' });
  },

  goDebitDetail() {
    wx.navigateTo({ url: '/pages/ledger/ledger?mode=debit' });
  },

  onOpenDaily() {
    if (!this.data.canClaimDaily) return;
    if (!getAffectLabToken()) return;
    requestAffectLab({ path: '/user/reward/daily', method: 'POST', data: {} })
      .then((res) => {
        const bal = res?.data?.data?.balance;
        if (typeof bal === 'number') {
          this.setData({ canClaimDaily: false, candyCount: bal });
          wx.showToast({ title: '领取成功', icon: 'none' });
          return;
        }
        wx.showToast({ title: '领取失败，无可用数据', icon: 'none' });
      })
      .catch(() => {
        wx.showToast({ title: '领取失败，无可用数据', icon: 'none' });
      });
  },

  onWatchAd() {
    wx.setStorageSync('cp_after_ad_redirect', '/pages/profile/profile');
    wx.setStorageSync('cp_open_ad_on_load', true);
    wx.switchTab({ url: '/pages/index/index' });
  }
});
