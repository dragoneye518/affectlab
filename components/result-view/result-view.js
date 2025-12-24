Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    result: {
      type: Object,
      value: {}
    },
    isSharedView: {
      type: Boolean,
      value: false
    }
  },
  data: {
    timestampStr: '',
    showToast: false
  },
  observers: {
    'result': function(res) {
      if (res && res.timestamp) {
        this.setData({
          timestampStr: new Date(res.timestamp).toLocaleDateString()
        });
      }
    }
  },
  methods: {
    onClose() {
      this.triggerEvent('close');
    },
    onReroll() {
      this.triggerEvent('reroll');
    },
    onShare() {
      this.triggerEvent('share');
    },
    handleTouchStart() {
      this.setData({ showToast: true });
      setTimeout(() => {
        this.setData({ showToast: false });
      }, 2500);
    }
  }
})
