App({
  onLaunch() {
    // Check local storage for history init
    const history = wx.getStorageSync('cp_history') || [];
    if (!wx.getStorageSync('cp_history')) {
      wx.setStorageSync('cp_history', []);
    }
  },
  globalData: {
    userInfo: null
  }
})
