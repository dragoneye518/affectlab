import { affectLabLogin, requestAffectLab } from './utils/api';

App({
  onLaunch() {
    // Get System Info for Custom Navbar
    let windowInfo = {};
    let deviceInfo = {};
    let appBaseInfo = {};
    try {
      if (typeof wx.getWindowInfo === 'function') {
        windowInfo = wx.getWindowInfo() || {};
      }
    } catch (e) {}
    try {
      if (typeof wx.getDeviceInfo === 'function') {
        deviceInfo = wx.getDeviceInfo() || {};
      }
    } catch (e) {}
    try {
      if (typeof wx.getAppBaseInfo === 'function') {
        appBaseInfo = wx.getAppBaseInfo() || {};
      }
    } catch (e) {}
    const systemInfo = Object.assign({}, appBaseInfo, deviceInfo, windowInfo);
    let menuButtonInfo = {};
    try {
      if (typeof wx.getMenuButtonBoundingClientRect === 'function') {
        menuButtonInfo = wx.getMenuButtonBoundingClientRect() || {};
      }
    } catch (e) {
      menuButtonInfo = {};
    }
    
    // Calculate safe area and navbar height
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    // Navigation bar height (excluding status bar) usually aligns with capsule
    // Formula: (Capsule Top - Status Bar Top) * 2 + Capsule Height
    const capsuleTop = typeof menuButtonInfo.top === 'number' ? menuButtonInfo.top : (statusBarHeight + 4);
    const capsuleHeight = typeof menuButtonInfo.height === 'number' ? menuButtonInfo.height : 32;
    const capsuleLeft = typeof menuButtonInfo.left === 'number' ? menuButtonInfo.left : (systemInfo.windowWidth ? systemInfo.windowWidth - 90 : 0);
    const navBarHeight = (capsuleTop - statusBarHeight) * 2 + capsuleHeight;
    const totalHeaderHeight = statusBarHeight + navBarHeight;
    const menuButtonWidth = (systemInfo.windowWidth || 0) - capsuleLeft; // Width reserved for capsule from right edge

    this.globalData = {
      userInfo: null,
      systemInfo,
      menuButtonInfo,
      statusBarHeight,
      navBarHeight,
      totalHeaderHeight,
      menuButtonWidth
    };

    requestAffectLab({ path: '/health', method: 'GET', auth: false, timeoutMs: 2500 })
      .then((res) => {
        if (!res || res.statusCode !== 200) {
          wx.showToast({ title: '后端健康检查失败', icon: 'none' });
          return;
        }
        return affectLabLogin();
      })
      .then((data) => {
        if (data && data.token) {
          this.globalData = this.globalData || {};
          this.globalData.affectlab = {
            token: data.token,
            userId: data.user_id,
            openid: data.openid,
            balance: data.balance
          };
        }
      })
      .catch(() => {});
  },
  globalData: {
    userInfo: null
  }
})
