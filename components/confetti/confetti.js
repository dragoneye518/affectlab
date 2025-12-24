Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  lifetimes: {
    ready() {
      this.initCanvas();
    },
    detached() {
      if (this.animationId) {
        this.canvas.cancelAnimationFrame(this.animationId);
      }
    }
  },
  methods: {
    initCanvas() {
      const query = this.createSelectorQuery();
      query.select('#confetti')
        .fields({ node: true, size: true })
        .exec((res) => {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getSystemInfoSync().pixelRatio;
          
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);
          
          this.canvas = canvas;
          this.ctx = ctx;
          this.width = res[0].width;
          this.height = res[0].height;
          
          this.startAnimation();
        });
    },
    startAnimation() {
      const particles = [];
      const colors = ['#ff00ff', '#00ffff', '#ffff00', '#ffffff'];
      
      for (let i = 0; i < 100; i++) {
        particles.push({
          x: this.width / 2,
          y: this.height / 2,
          vx: (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 20,
          size: Math.random() * 8 + 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 100
        });
      }
      
      const animate = () => {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.width, this.height);
        let active = false;
        
        particles.forEach(p => {
          if (p.life > 0) {
            active = true;
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.5; // Gravity
            p.life--;
            
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x, p.y, p.size, p.size);
          }
        });
        
        if (active) {
          this.animationId = this.canvas.requestAnimationFrame(animate);
        }
      };
      
      animate();
    }
  }
})
