Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    rarity: {
      type: String,
      value: 'N'
    },
    className: {
      type: String,
      value: ''
    }
  },
  data: {
    transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
    shineOpacity: 0,
    shinePos: { x: 0, y: 0 }
  },
  methods: {
    onClick() {
      this.triggerEvent('click');
    },
    handleMove(e) {
      const touch = e.touches[0];
      const query = this.createSelectorQuery();
      query.select('.relative').boundingClientRect((rect) => {
        if (!rect) return;
        
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const isSSR = this.properties.rarity === 'SSR';
        const intensity = isSSR ? 20 : 10;
        
        const rotateX = ((y - centerY) / centerY) * -intensity;
        const rotateY = ((x - centerX) / centerX) * intensity;
        
        this.setData({
          transform: `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`,
          shineOpacity: isSSR ? 0.6 : 0.3,
          shinePos: {
            x: (x / rect.width) * 100,
            y: (y / rect.height) * 100
          }
        });
      }).exec();
    },
    handleLeave() {
      this.setData({
        transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
        shineOpacity: 0
      });
    }
  }
})
