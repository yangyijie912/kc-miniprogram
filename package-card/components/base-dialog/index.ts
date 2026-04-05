Component({
  properties: {
    open: {
      type: Boolean,
      value: false,
    },
    title: {
      type: String,
      value: '标题',
    },
    showFooter: {
      type: Boolean,
      value: true,
    },
    closeOnMask: {
      type: Boolean,
      value: true,
    },
  },

  data: {},

  methods: {
    onClose() {
      this.triggerEvent('close');
    },
    onConfirm() {
      this.triggerEvent('confirm');
    },
    onMaskTap() {
      if (!this.properties.closeOnMask) {
        return;
      }
      this.triggerEvent('close');
    },
    // 阻止事件冒泡
    noop() {},
  },
});
