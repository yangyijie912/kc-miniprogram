type DialogType = 'table' | 'title' | 'list' | null;
type ListType = 'ordered' | 'unordered';

const titleLevels = [
  { label: '一级标题', value: 1 },
  { label: '二级标题', value: 2 },
  { label: '三级标题', value: 3 },
  { label: '四级标题', value: 4 },
  { label: '五级标题', value: 5 },
  { label: '六级标题', value: 6 },
] as const;

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
    tableRows: 3 as number,
    tableColumns: 3 as number,
    listType: 'unordered' as ListType,
    titleLevel: 1 as number,
    titleLevels,
    dialogState: {
      visible: false,
      title: '标题',
      type: null,
    } as { visible: boolean; title: string; type: DialogType },
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
    onBlur(e: WechatMiniprogram.Input) {
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
    insertHeading(level = 1, text = '默认标题') {
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
    insertList(type: ListType = 'unordered') {
      if (type === 'ordered') {
        this.appendContent('1. 第一项\n2. 第二项\n3. 第三项');
        return;
      }
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
      const language = 'typescript';
      const code = `示例代码`;
      const codeBlock = `\`\`\`${language}\n${code}\n\`\`\``;
      this.appendContent(codeBlock);
    },

    // 插入表格
    insertTable(rows = 3, columns = 3) {
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

    // 打开内容编辑对话框
    openContentDialog(e: WechatMiniprogram.CustomEvent) {
      const { type, title } = e.currentTarget.dataset as { type: DialogType; title: string };
      this.setData({
        // 每次打开都回到默认值
        tableRows: 3,
        tableColumns: 3,
        listType: 'unordered',
        titleLevel: 1,
        // 更新对话框状态
        dialogState: {
          title,
          type,
          visible: true, // 保持其他属性不变
        },
      });
    },

    // 关闭内容编辑对话框
    closeContentDialog() {
      this.setData({
        dialogState: {
          ...this.data.dialogState,
          visible: false,
        },
      });
    },

    // 根据对话框类型确认插入内容
    onContentConfirm() {
      const { dialogState, tableRows, tableColumns, titleLevel, listType } = this.data;
      switch (dialogState.type) {
        case 'table':
          this.insertTable(tableRows, tableColumns);
          break;
        case 'title':
          this.insertHeading(
            titleLevel,
            titleLevels.find((l) => l.value === titleLevel)?.label ?? '默认标题',
          );
          break;
        case 'list':
          this.insertList(listType);
          break;
        default:
          break;
      }
      this.closeContentDialog();
    },

    // 更新表格行列数
    onTableRowsInput(e: WechatMiniprogram.Input) {
      this.setData({ tableRows: Number(e.detail.value) || 0 });
    },
    onTableColumnsInput(e: WechatMiniprogram.Input) {
      this.setData({ tableColumns: Number(e.detail.value) || 0 });
    },
    // 更新标题级别
    onTitleLevelSelect(e: WechatMiniprogram.BaseEvent) {
      const { value } = e.currentTarget.dataset as { value: string };
      this.setData({ titleLevel: parseInt(value, 10) || 1 });
    },
    // 更新列表类型
    onListTypeSelect(e: WechatMiniprogram.BaseEvent) {
      const { value } = e.currentTarget.dataset as { value: ListType };
      this.setData({ listType: value });
    },
  },

  lifetimes: {
    // 组件被加载时，初始化本地内容
    created() {
      this.setData({ localContent: this.data.modelValue });
    },
  },
});
