App({
  onLaunch() {
    // Get System Info for Custom Navbar
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    
    // Calculate safe area and navbar height
    const statusBarHeight = systemInfo.statusBarHeight;
    // Navigation bar height (excluding status bar) usually aligns with capsule
    // Formula: (Capsule Top - Status Bar Top) * 2 + Capsule Height
    const navBarHeight = (menuButtonInfo.top - statusBarHeight) * 2 + menuButtonInfo.height;
    const totalHeaderHeight = statusBarHeight + navBarHeight;
    const menuButtonWidth = systemInfo.windowWidth - menuButtonInfo.left; // Width reserved for capsule from right edge

    this.globalData = {
      userInfo: null,
      systemInfo,
      menuButtonInfo,
      statusBarHeight,
      navBarHeight,
      totalHeaderHeight,
      menuButtonWidth
    };

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
