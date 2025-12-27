import { requestAffectLab } from '../../utils/api';

Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    template: Object,
    userInput: String,
    freeGenerateOnce: {
      type: Boolean,
      value: false
    },
    rerollBoostOnce: {
      type: Boolean,
      value: false
    }
  },
  data: {
    logs: [],
    progress: 0
  },
  lifetimes: {
    attached() {
      this._requested = false;
      this.startGeneration();
    },
    detached() {
      this.cleanup();
    }
  },
  methods: {
    startGeneration() {
      const sysLogs = [
        "INITIALIZING NEURAL LINK...",
        "ENCRYPTING USER INPUT...",
        `CONTEXT: "${this.properties.userInput.substring(0, 15)}..."`,
        "ACCESSING SOUL_DATA_V2...",
        "CONTENT_SAFETY_CHECK_V2... PASS",
        "DECRYPTING EMOTIONAL PATTERNS...",
        "SYNTHESIZING REALITY...",
        "APPLYING CYBER_FILTERS...",
        "FINALIZING..."
      ];

      let logIndex = 0;
      this.logInterval = setInterval(() => {
        if (logIndex < sysLogs.length) {
          const newLogs = [...this.data.logs.slice(-5), `> ${sysLogs[logIndex]}`];
          this.setData({ logs: newLogs });
          logIndex++;
        }
      }, 400);

      this.progressInterval = setInterval(() => {
        if (this.data.progress < 100) {
           this.setData({
             progress: Math.min(100, this.data.progress + Math.random() * 5)
           });
        }
      }, 150);

      this.finishTimeout = setTimeout(() => {
        this.finish();
      }, 4500);
    },
    cleanup() {
      clearInterval(this.logInterval);
      clearInterval(this.progressInterval);
      clearTimeout(this.finishTimeout);
    },
    finish() {
      if (this._requested) return;
      this._requested = true;
      const { template, userInput, freeGenerateOnce, rerollBoostOnce } = this.properties;
      requestAffectLab({
        path: '/cards/generate',
        method: 'POST',
        data: { templateId: template.id, userInput, free: !!freeGenerateOnce, reroll: !!rerollBoostOnce }
      })
        .then((res) => {
          if (res && res.statusCode === 400 && res.data && res.data.detail === 'Insufficient Balance') {
            this.triggerEvent('insufficient', {});
            return;
          }
          const result = res?.data?.data?.result;
          const balance = res?.data?.data?.balance;
          if (res.statusCode === 200 && result) {
            this.triggerEvent('finish', { result, balance, fromServer: true });
            return;
          }
          const message = (res && res.data && (res.data.detail || res.data.msg)) || '生成失败，请检查后端服务';
          this.triggerEvent('error', { message, statusCode: res?.statusCode });
        })
        .catch(() => {
          this.triggerEvent('error', { message: '生成失败，请检查后端服务' });
        });
    }
  }
})
