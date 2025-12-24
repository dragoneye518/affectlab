Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    candyCount: {
      type: Number,
      value: 0
    },
    canClaimDaily: {
      type: Boolean,
      value: false
    }
  },
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    menuButtonWidth: 90
  },
  lifetimes: {
    attached() {
      const app = getApp();
      if (app.globalData.statusBarHeight) {
        this.setData({
          statusBarHeight: app.globalData.statusBarHeight,
          navBarHeight: app.globalData.navBarHeight,
          menuButtonWidth: app.globalData.menuButtonWidth
        });
      }
    }
  },
  methods: {
    goHome() {
      this.triggerEvent('setView', 'HOME');
    },
    onOpenDaily() {
      this.triggerEvent('openDaily');
    },
    onWatchAd() {
      this.triggerEvent('watchAd');
    }
  }
})
