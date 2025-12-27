import { requestAffectLab, fetchAffectLabTemplates } from '../../utils/api';

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
      try {
        const resp = await requestAffectLab({
          path: '/text/polish',
          method: 'POST',
          data: { inputText: raw },
          auth: false,
          timeoutMs: 15000
        });
        const payload = (resp && resp.data && resp.data.data) ? resp.data.data : (resp && resp.data ? resp.data : null);
        const options = payload && Array.isArray(payload.options) ? payload.options : null;
        const cleaned = [];
        if (options) {
          for (const it of options) {
            const style = String(it && it.style ? it.style : '').trim().toUpperCase();
            const text = String(it && it.text ? it.text : '').trim();
            if (!style || !text) continue;
            if (!['TOXIC', 'EMO', 'GLITCH'].includes(style)) continue;
            cleaned.push({ style, text: text.slice(0, 50) });
          }
        }

        const nextOpts = cleaned.length > 0 ? cleaned : null;
        const recommendedId = payload && payload.recommendedTemplateId ? String(payload.recommendedTemplateId).trim() : '';
        if (recommendedId) {
          try {
            const templates = await fetchAffectLabTemplates();
            const t = (Array.isArray(templates) ? templates : []).find(x => x && x.id === recommendedId);
            this.setData({
              recommendedId,
              recommendedTemplateName: t ? (t.title || '') : ''
            });
          } catch (e) {
            this.setData({ recommendedId });
          }
        }
        if (!nextOpts) {
          wx.showToast({ title: '转译失败，无可用数据', icon: 'none' });
        }
        this.setData({ polishOptions: nextOpts, isPolishing: false });
      } catch (e) {
        wx.showToast({ title: '转译失败，请检查后端服务', icon: 'none' });
        this.setData({ polishOptions: null, isPolishing: false });
      }
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
