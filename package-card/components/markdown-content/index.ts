import MarkdownIt from '@/package-card/components/markdown-content/markdown-it';

const HEADING_STYLES: Record<string, string> = {
  h1: 'font-size: 40rpx; margin: 36rpx 0 18rpx; color: #1e1c18; line-height: 1.45; font-weight: 700;',
  h2: 'font-size: 35rpx; margin: 36rpx 0 18rpx; color: #1e1c18; line-height: 1.45; font-weight: 700;',
  h3: 'font-size: 31rpx; margin: 36rpx 0 18rpx; color: #1e1c18; line-height: 1.45; font-weight: 700;',
  h4: 'font-size: 28rpx; margin: 36rpx 0 18rpx; color: #1e1c18; line-height: 1.45; font-weight: 700;',
  h5: 'font-size: 28rpx; margin: 36rpx 0 18rpx; color: #1e1c18; line-height: 1.45; font-weight: 700;',
  h6: 'font-size: 28rpx; margin: 36rpx 0 18rpx; color: #1e1c18; line-height: 1.45; font-weight: 700;',
};

const PARAGRAPH_STYLE = 'margin: 18rpx 0; color: #5e564d;';
const LIST_STYLE = 'margin: 18rpx 0; padding-left: 34rpx;';
const LIST_ITEM_STYLE = 'margin: 10rpx 0; color: #5e564d;';
const BLOCKQUOTE_STYLE =
  'margin: 22rpx 0; padding: 18rpx 22rpx; border-left: 8rpx solid rgba(18, 122, 114, 0.28); border-radius: 0 18rpx 18rpx 0; background: rgba(18, 122, 114, 0.06); color: #5d6c69;';
const INLINE_CODE_STYLE =
  "padding: 4rpx 10rpx; border-radius: 10rpx; background: rgba(61, 43, 24, 0.08); color: #7c3f1c; font-size: 24rpx; font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;";
const CODE_BLOCK_STYLE =
  "display: block; padding: 0; background: transparent; color: #f7efe6; font-size: 24rpx; line-height: 1.8; white-space: pre; font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;";
const PRE_STYLE =
  'margin: 22rpx 0; padding: 22rpx 24rpx; border-radius: 20rpx; background: #2a2420; overflow: auto;';
const LINK_STYLE = 'color: #1f5eff; text-decoration: underline; word-break: break-all;';
const STRONG_STYLE = 'color: #1e1c18; font-weight: 700;';
const EM_STYLE = 'color: #725f4e;';
const IMAGE_STYLE =
  'display: block; width: 100%; max-width: 100%; margin: 22rpx 0; border-radius: 20rpx;';
const HR_STYLE = 'margin: 28rpx 0; border: none; border-top: 1rpx solid rgba(61, 43, 24, 0.12);';

type MarkdownToken = {
  tag: string;
  content: string;
  attrSet(name: string, value: string): void;
};

type MarkdownRendererState = {
  renderToken(tokens: MarkdownToken[], idx: number, options: unknown): string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}

function createMarkdownIt() {
  const md = new MarkdownIt({
    html: false, // 禁止 HTML 标签，确保安全
    breaks: true, // 换行转换为 <br>
    linkify: true, // 自动识别链接
    typographer: true, // 启用一些语言替换 + 引号美化
  });

  // 只保留明确的链接识别，关闭容易误判的模糊链接规则
  if (md.linkify && typeof md.linkify.set === 'function') {
    md.linkify.set({
      fuzzyLink: false,
      fuzzyEmail: false,
      fuzzyIP: false,
    });
  }

  md.renderer.rules.heading_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: MarkdownRendererState,
  ) => {
    const token = tokens[idx];
    token.attrSet('style', HEADING_STYLES[token.tag] || HEADING_STYLES.h3);
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.paragraph_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: MarkdownRendererState,
  ) => {
    tokens[idx].attrSet('style', PARAGRAPH_STYLE);
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.bullet_list_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: MarkdownRendererState,
  ) => {
    tokens[idx].attrSet('style', LIST_STYLE);
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.ordered_list_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: MarkdownRendererState,
  ) => {
    tokens[idx].attrSet('style', LIST_STYLE);
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.list_item_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: MarkdownRendererState,
  ) => {
    tokens[idx].attrSet('style', LIST_ITEM_STYLE);
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.blockquote_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: MarkdownRendererState,
  ) => {
    tokens[idx].attrSet('style', BLOCKQUOTE_STYLE);
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.code_inline = (tokens: MarkdownToken[], idx: number) => {
    const token = tokens[idx];
    return `<code style="${INLINE_CODE_STYLE}">${escapeHtml(token.content)}</code>`;
  };

  md.renderer.rules.fence = (tokens: MarkdownToken[], idx: number) => {
    const token = tokens[idx];
    return `<pre style="${PRE_STYLE}"><code style="${CODE_BLOCK_STYLE}">${escapeHtml(token.content)}</code></pre>`;
  };

  md.renderer.rules.code_block = (tokens: MarkdownToken[], idx: number) => {
    const token = tokens[idx];
    return `<pre style="${PRE_STYLE}"><code style="${CODE_BLOCK_STYLE}">${escapeHtml(token.content)}</code></pre>`;
  };

  md.renderer.rules.link_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: MarkdownRendererState,
  ) => {
    tokens[idx].attrSet('style', LINK_STYLE);
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.strong_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: MarkdownRendererState,
  ) => {
    tokens[idx].attrSet('style', STRONG_STYLE);
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.em_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: MarkdownRendererState,
  ) => {
    tokens[idx].attrSet('style', EM_STYLE);
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.image = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: MarkdownRendererState,
  ) => {
    tokens[idx].attrSet('style', IMAGE_STYLE);
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.hr = () => `<hr style="${HR_STYLE}" />`;

  return md;
}

const md = createMarkdownIt();

Component({
  properties: {
    content: {
      type: String,
      value: '',
      observer() {
        this.renderMarkdown();
      },
    },
  },

  data: {
    renderMarkdownToRichText: '',
  },

  methods: {
    renderMarkdown() {
      if (!this.data.content) {
        this.setData({
          renderMarkdownToRichText: '',
        });
        return;
      }
      const html = md.render(this.data.content);
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
