Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  methods: {
    onSelect() {
      this.triggerEvent('select');
    }
  }
})
