Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  methods: {
    onClose() {
      this.triggerEvent('close');
    }
  }
})
