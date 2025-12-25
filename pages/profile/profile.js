import { ensureWallet, computeWalletSummary, clearWalletLedger, addLedgerEntry } from '../../utils/util';

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

    const last = wx.getStorageSync('cp_last_signin');
    const today = new Date().toDateString();
    this.setData({ canClaimDaily: last !== today });

    const wallet = ensureWallet();
    const summary = computeWalletSummary(wallet.ledger);
    this.setData({ candyCount: wallet.balance, summary });
  },

  goCreditDetail() {
    wx.navigateTo({ url: '/pages/ledger/ledger?mode=credit' });
  },

  goDebitDetail() {
    wx.navigateTo({ url: '/pages/ledger/ledger?mode=debit' });
  },

  onClearLedger() {
    const next = clearWalletLedger();
    const summary = computeWalletSummary(next.ledger);
    this.setData({ candyCount: next.balance, summary });
  },

  onOpenDaily() {
    if (!this.data.canClaimDaily) return;
    const wallet = addLedgerEntry({ amount: 10, type: 'DAILY' });
    wx.setStorageSync('cp_last_signin', new Date().toDateString());
    const summary = computeWalletSummary(wallet.ledger);
    this.setData({ canClaimDaily: false, candyCount: wallet.balance, summary });
    wx.showToast({ title: '领取成功', icon: 'none' });
  },

  onWatchAd() {
    wx.setStorageSync('cp_after_ad_redirect', '/pages/profile/profile');
    wx.setStorageSync('cp_open_ad_on_load', true);
    wx.switchTab({ url: '/pages/index/index' });
  }
});
