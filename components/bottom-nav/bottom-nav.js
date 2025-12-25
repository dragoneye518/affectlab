Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    view: {
      type: String,
      value: 'HOME'
    }
  },
  methods: {
    goHome() {
      if (this.data.view === 'HOME') return;
      wx.switchTab({ url: '/pages/index/index' });
    },
    goPack() {
      if (this.data.view === 'PACK') return;
      wx.switchTab({ url: '/pages/pack/pack' });
    },
    goProfile() {
      if (this.data.view === 'PROFILE') return;
      wx.switchTab({ url: '/pages/profile/profile' });
    }
  }
})
