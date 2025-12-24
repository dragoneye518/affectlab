import { polishTextWithDeepSeek } from '../../utils/api';
import { TEMPLATES } from '../../utils/constants';

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
      
      this.setData({ isPolishing: true, polishOptions: null, recommendedId: null });
      
      const result = await polishTextWithDeepSeek(this.data.input);
      
      if (result) {
        let recommendedId = null;
        let recommendedTemplateName = '';
        
        if (result.recommendedTemplateId && result.recommendedTemplateId !== this.properties.template.id) {
           const exists = TEMPLATES.find(t => t.id === result.recommendedTemplateId);
           if (exists) {
             recommendedId = exists.id;
             recommendedTemplateName = exists.title;
           }
        }
        
        this.setData({
          polishOptions: result.options,
          recommendedId,
          recommendedTemplateName
        });
      }
      this.setData({ isPolishing: false });
    },
    onSelectOption(e) {
      this.setData({ 
        input: e.currentTarget.dataset.text,
        polishOptions: null,
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
        this.triggerEvent('confirm', { text: this.data.input || "无题" });
      }, 800);
    }
  }
})
