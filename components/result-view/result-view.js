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
    showToast: false,
    toastMessage: '',
    isSaving: false
  },
  observers: {
    'result': function(res) {
      if (res && res.timestamp) {
        this.setData({
          timestampStr: new Date(res.timestamp).toLocaleDateString()
        });
      }
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
