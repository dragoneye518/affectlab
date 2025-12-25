Component({
  data: {
    selected: 0,
    hidden: false
  },
  methods: {
    onSwitchTab(e) {
      const index = Number(e.currentTarget.dataset.index);
      const path = e.currentTarget.dataset.path;
      if (!path) return;
      wx.switchTab({ url: path });
      this.setData({ selected: index });
    }
  }
});
