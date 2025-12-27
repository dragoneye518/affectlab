Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    result: {
      type: Object,
      value: {}
    },
    isSharedView: {
      type: Boolean,
      value: false
    },
    isReadOnly: {
      type: Boolean,
      value: false
    }
  },
  data: {
    timestampStr: '',
    displayText: '',
    displayTextSizeClass: 'text-2xl',
    displayTextClampClass: 'line-clamp-2',
    showReadMore: false,
    showFullText: false,
    fullTextSizeClass: 'text-base',
    showToast: false,
    toastMessage: '',
    isSaving: false
  },
  observers: {
    'result': function(res) {
      if (!res) return;
      const ts = res && res.timestamp ? new Date(res.timestamp).toLocaleDateString() : '';
      const text = String(res.text || '').trim();
      const subject = String(res.userInput || '').trim();

      const customSignalFallbackMap = [
        { key: '社恐', value: '社交电量告急' },
        { key: '加班', value: '加班到灵魂掉线' },
        { key: '老板', value: '老板语音暴击' },
        { key: '朋友', value: '友情信号抖动' },
        { key: '失恋', value: '心跳系统宕机' }
      ];

      let displayText = '';
      if (res.templateId === 'custom-signal') {
        const content = String(res.content || '').trim();
        displayText = content;
        if (!displayText) {
          const hit = customSignalFallbackMap.find(x => subject.includes(x.key));
          displayText = hit ? hit.value : '';
        }
        if (!displayText) displayText = text;
        if (!displayText) displayText = subject;
      } else {
        displayText = text;
        if (!displayText) displayText = subject;
      }

      const charCount = Array.from(displayText).length;

      let displayTextSizeClass = 'text-2xl';
      let displayTextClampClass = 'line-clamp-2';
      let showReadMore = false;
      let fullTextSizeClass = 'text-base';

      if (charCount <= 18) {
        displayTextSizeClass = 'text-2xl';
        displayTextClampClass = 'line-clamp-2';
        fullTextSizeClass = 'text-base';
      } else if (charCount <= 28) {
        displayTextSizeClass = 'text-xl';
        displayTextClampClass = 'line-clamp-3';
        fullTextSizeClass = 'text-base';
      } else if (charCount <= 40) {
        displayTextSizeClass = 'text-lg';
        displayTextClampClass = 'line-clamp-4';
        fullTextSizeClass = 'text-base';
      } else if (charCount <= 60) {
        displayTextSizeClass = 'text-base';
        displayTextClampClass = 'line-clamp-4';
        showReadMore = true;
        fullTextSizeClass = 'text-sm';
      } else {
        displayTextSizeClass = 'text-base';
        displayTextClampClass = 'line-clamp-4';
        showReadMore = true;
        fullTextSizeClass = 'text-sm';
      }

      this.setData({
        timestampStr: ts,
        displayText,
        displayTextSizeClass,
        displayTextClampClass,
        showReadMore,
        showFullText: false,
        fullTextSizeClass
      });
    }
  },
  methods: {
    onClose() {
      this.triggerEvent('close');
    },
    onReroll() {
      if (this.properties.isReadOnly) return;
      this.triggerEvent('reroll');
    },
    onShare() {
      this.triggerEvent('share');
    },
    onOpenFullText() {
      if (!this.data.displayText) return;
      this.setData({ showFullText: true });
    },
    onCloseFullText() {
      this.setData({ showFullText: false });
    },
    showToast(message) {
      this.setData({ showToast: true, toastMessage: message || '' });
      setTimeout(() => {
        this.setData({ showToast: false });
      }, 2500);
    },
    trySaveToAlbum(filePath) {
      return new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath,
          success: () => resolve(true),
          fail: (err) => reject(err)
        });
      });
    },
    handleTouchStart() {
      if (this.data.isSaving) return;
      const url = this.properties && this.properties.result ? this.properties.result.imageUrl : '';
      if (!url) {
        this.showToast('无可保存图片');
        return;
      }

      this.setData({ isSaving: true });
      wx.downloadFile({
        url,
        success: async (res) => {
          if (!res || res.statusCode !== 200 || !res.tempFilePath) {
            this.showToast('下载失败，无法保存');
            return;
          }
          try {
            await this.trySaveToAlbum(res.tempFilePath);
            this.showToast('已保存到相册');
          } catch (e) {
            const msg = String(e && e.errMsg ? e.errMsg : '');
            const needAuth = msg.includes('auth') || msg.includes('authorize') || msg.includes('denied') || msg.includes('scope');
            if (!needAuth) {
              this.showToast('保存失败');
              return;
            }
            wx.showModal({
              title: '需要相册权限',
              content: '保存图片到相册需要授权，去设置里打开权限？',
              success: (mres) => {
                if (!mres || !mres.confirm) {
                  this.showToast('未授权，无法保存');
                  return;
                }
                wx.openSetting({
                  success: () => {
                    this.showToast('请重试保存');
                  },
                  fail: () => {
                    this.showToast('打开设置失败');
                  }
                });
              }
            });
          }
        },
        fail: () => {
          this.showToast('下载失败，无法保存');
        },
        complete: () => {
          this.setData({ isSaving: false });
        }
      });
    }
  }
})
