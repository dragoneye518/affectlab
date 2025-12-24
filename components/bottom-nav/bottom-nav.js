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
      this.triggerEvent('setView', 'HOME');
    },
    goMine() {
      this.triggerEvent('setView', 'MINE');
    },
    onOpenRadar() {
      this.triggerEvent('openRadar');
    }
  }
})
