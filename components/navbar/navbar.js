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
