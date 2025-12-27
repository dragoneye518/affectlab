import { fetchAffectLabTemplates } from '../../utils/api';

Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    template: {
      type: Object,
      value: {}
    },
    initialValue: {
      type: String,
      value: ''
    }
  },
  data: {
    input: '',
    isAnimating: false,
    isPolishing: false,
    polishOptions: null,
    polishStyle: '',
    recommendedId: null,
    recommendedTemplateName: '',
    shouldFocus: false,
    isFocused: false
  },
  lifetimes: {
    attached() {
      this.setData({ input: this.properties.initialValue });
      setTimeout(() => {
        this.setData({ shouldFocus: true });
      }, 300);
    }
  },
  methods: {
    onInput(e) {
      this.setData({ input: e.detail.value });
    },
    onFocus() {
      this.setData({ isFocused: true });
    },
    onBlur() {
      this.setData({ isFocused: false });
    },
    onCancel() {
      this.triggerEvent('cancel');
    },
    onQuickPrompt(e) {
      this.setData({ input: e.currentTarget.dataset.text, shouldFocus: true });
    },
    async handleAIPolish() {
      if (!this.data.input.trim() || this.data.isPolishing) return;
      if (!this.properties.template || this.properties.template.id !== 'custom-signal') return;

      this.setData({ isPolishing: true, polishOptions: null, recommendedId: null, polishStyle: '' });

      const raw = this.data.input.trim();
      const opts = [
        { style: 'TOXIC', text: `${raw}？笑死，我先跑路` },
        { style: 'EMO', text: `${raw}。夜色替我说完了` },
        { style: 'GLITCH', text: `${raw} // SIGNAL_LOST_404` },
        { style: 'ZEN', text: `${raw}。先把呼吸调成静音` },
        { style: 'RAGE', text: `${raw}。我宣布：别惹我` }
      ].map(o => ({ style: o.style, text: String(o.text || '').slice(0, 50) }));

      this.setData({ polishOptions: opts, isPolishing: false });
    },
    onSelectOption(e) {
      this.setData({ 
        input: e.currentTarget.dataset.text,
        polishOptions: null,
        polishStyle: e.currentTarget.dataset.style || '',
        shouldFocus: true
      });
    },
    onSwitch() {
      if (this.data.recommendedId) {
        this.triggerEvent('switchTemplate', { templateId: this.data.recommendedId });
      }
    },
    handleConfirm() {
      this.setData({ isAnimating: true });
      setTimeout(() => {
        this.triggerEvent('confirm', { text: this.data.input || "无题", polishStyle: this.data.polishStyle || '' });
      }, 800);
    }
  }
})
