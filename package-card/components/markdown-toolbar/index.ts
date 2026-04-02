Component({
  properties: {
    modelValue: {
      type: String,
      value: '',
      observer() {
        this.setData({ localContent: this.data.modelValue });
      },
    },
  },

  data: {
    isMore: false as boolean,
    localContent: '' as string,
    cursorPosition: 0 as number,
    lockInsertPosition: false as boolean,
  },

  methods: {
    // 显示更多
    showMore() {
      this.setData({ isMore: true });
    },
    // 显示更少
    showLess() {
      this.setData({ isMore: false });
    },

    // 输入
    onInput(e: WechatMiniprogram.Input) {
      const value = e.detail.value;
      // 更新光标位置和本地内容并触发事件通知父组件
      const pos = e.detail.cursor;
      this.setData({ localContent: value, cursorPosition: pos, lockInsertPosition: false });
      this.triggerEvent('update', { value });
    },

    // 聚焦
    onFocus() {
      this.setData({ lockInsertPosition: false });
    },

    // 失焦：失去焦点时确保更新光标
    onBlur(e) {
      if (this.data.lockInsertPosition) {
        return;
      }
      const value = e.detail.value;
      const pos = e.detail.cursor ?? value.length;
      this.setData({ cursorPosition: pos });
    },

    // 插入内容
    appendContent(text: string) {
      const pos = this.data.cursorPosition;
      const value = this.data.localContent;
      const newValue = value.slice(0, pos) + text + value.slice(pos);
      this.setData({
        localContent: newValue,
        cursorPosition: pos + text.length,
        lockInsertPosition: true,
      });
      this.triggerEvent('update', { value: newValue });
    },

    // 插入标题
    insertHeading() {
      const level = 1;
      const text = '一级标题';
      this.appendContent(`${'#'.repeat(level)} ${text}`);
    },

    // 插入加粗文本
    insertBold() {
      const text = '重点内容';
      this.appendContent(`**${text}**`);
    },

    // 插入引用
    insertQuote() {
      const text = '在这里写引用内容';
      this.appendContent(`> ${text}`);
    },

    // 插入列表
    insertList() {
      this.appendContent('- 第一项\n- 第二项\n- 第三项');
    },

    // 插入链接
    insertLink() {
      const text = '链接文字';
      const url = 'https://example.com';
      this.appendContent(`[${text}](${url})`);
    },

    // 插入代码
    insertCodeBlock() {
      const language = 'ts';
      const code = `示例代码`;
      const codeBlock = `\`\`\`${language}\n${code}\n\`\`\``;
      this.appendContent(codeBlock);
    },

    // 插入表格
    insertTable() {
      const rows = 3;
      const columns = 3;
      if (rows <= 0 || columns <= 0) {
        wx.showToast({
          title: '行列数必须大于0',
          icon: 'none',
        });
        return;
      }

      let table = '|';
      for (let c = 0; c < columns; c++) {
        table += ` Header ${c + 1} |`;
      }
      table += '\n|';
      for (let c = 0; c < columns; c++) {
        table += ' --- |';
      }
      for (let r = 0; r < rows; r++) {
        table += '\n|';
        for (let c = 0; c < columns; c++) {
          table += ` Cell ${r + 1}-${c + 1} |`;
        }
      }
      this.appendContent(table);
    },

    // 插入分割线
    insertDivider() {
      this.appendContent('---');
    },

    // 插入图片模板
    insertImageTemplate() {
      this.appendContent('![图片描述](https://example.com/image.jpg)');
    },
  },

  lifetimes: {
    // 组件被加载时，初始化本地内容
    created() {
      this.setData({ localContent: this.data.modelValue });
    },
  },
});
