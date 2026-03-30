import MarkdownIt from 'markdown-it';

Component({
  properties: {
    constent: {
      type: String,
      value: '',
    },
  },

  data: {
    renderMarkdownToRichText: '',
  },

  methods: {
    renderMarkdown() {
      const md = new MarkdownIt({
        html: false, // 禁止 HTML 标签，确保安全
        breaks: true, // 换行转换为 <br>
        linkify: true, // 自动识别链接
        typographer: true, // 启用一些语言替换 + 引号美化
      });
      if (!this.data.constent) {
        return '';
      }
      const html = md.render(this.data.constent);
      this.setData({
        renderMarkdownToRichText: html,
      });
    },
  },

  lifetimes: {
    attached() {
      this.renderMarkdown();
    },
  },
});
