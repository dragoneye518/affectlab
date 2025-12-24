Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    template: {
      type: Object,
      value: {}
    }
  },
  data: {
    tagClass: '',
    categoryClass: ''
  },
  observers: {
    'template': function(t) {
      if (!t) return;
      let tagClass = '';
      switch(t.tag) {
        case 'HOT': tagClass = 'tag-hot'; break;
        case 'NEW': tagClass = 'tag-new'; break;
        case 'LIMITED': tagClass = 'tag-limited'; break;
        case 'FUTURE': tagClass = 'tag-future'; break;
      }
      
      let categoryClass = '';
      switch(t.category) {
        case 'lucky': categoryClass = 'cat-lucky'; break;
        case 'sharp': categoryClass = 'cat-sharp'; break;
        case 'persona': categoryClass = 'cat-persona'; break;
        case 'future': categoryClass = 'cat-future'; break;
      }
      
      this.setData({ tagClass, categoryClass });
    }
  },
  methods: {
    onSelect() {
      this.triggerEvent('select', this.properties.template);
    }
  }
})
