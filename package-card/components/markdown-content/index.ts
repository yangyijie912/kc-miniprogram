import MarkdownIt from '@/package-card/components/markdown-content/markdown-it';

const HEADING_STYLES: Record<string, string> = {
  h1: 'display: block; font-size: 40rpx; padding: 42rpx 0 22rpx; color: #1e1c18; line-height: 1.62; font-weight: 700;',
  h2: 'display: block; font-size: 35rpx; padding: 38rpx 0 18rpx; color: #1e1c18; line-height: 1.62; font-weight: 700;',
  h3: 'display: block; font-size: 31rpx; padding: 34rpx 0 16rpx; color: #1e1c18; line-height: 1.6; font-weight: 700;',
  h4: 'display: block; font-size: 28rpx; padding: 30rpx 0 14rpx; color: #1e1c18; line-height: 1.6; font-weight: 700;',
  h5: 'display: block; font-size: 28rpx; padding: 30rpx 0 14rpx; color: #1e1c18; line-height: 1.6; font-weight: 700;',
  h6: 'display: block; font-size: 28rpx; padding: 30rpx 0 14rpx; color: #1e1c18; line-height: 1.6; font-weight: 700;',
};

const PARAGRAPH_STYLE = 'display: block; padding: 16rpx 0; color: #5e564d; line-height: 1.95;';
const LIST_STYLE = 'display: block; padding: 16rpx 0 16rpx 34rpx;';
const LIST_ITEM_STYLE = 'display: list-item; padding: 6rpx 0; color: #5e564d; line-height: 1.9;';
const BLOCKQUOTE_STYLE =
  'display: block; padding: 22rpx 28rpx; border-left: 8rpx solid rgba(18, 122, 114, 0.28); border-radius: 0 18rpx 18rpx 0; background: rgba(18, 122, 114, 0.1); color: #5d6c69; line-height: 2;';
const INLINE_CODE_STYLE =
  "padding: 4rpx 10rpx; border-radius: 10rpx; background: rgba(61, 43, 24, 0.08); color: #7c3f1c; font-size: 24rpx; font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;";
const CODE_BLOCK_STYLE =
  "display: block; padding: 0; background: transparent; color: #f7efe6; font-size: 24rpx; line-height: 1.8; white-space: pre; font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;";
const PRE_STYLE =
  'display: block; padding: 28rpx 28rpx; border-radius: 20rpx; background: #2a2420; overflow: auto;';
const LINK_STYLE = 'color: #1f5eff; text-decoration: underline; word-break: break-all;';
const STRONG_STYLE = 'color: #1e1c18; font-weight: 700;';
const EM_STYLE = 'color: #725f4e;';
const IMAGE_STYLE =
  'display: block; width: 100%; max-width: 100%; padding: 18rpx 0; border-radius: 20rpx;';
const HR_STYLE =
  'display: block; width: 100%; padding: 18rpx 0; border: 0; line-height: 0; font-size: 0;';
const TABLE_WRAPPER_STYLE =
  'display: block; padding: 18rpx 0; overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 18rpx; background: rgba(255, 255, 255, 0.72);';
const TABLE_STYLE = 'width: 100%; min-width: 100%; border-collapse: collapse; table-layout: auto;';
const TABLE_CELL_STYLE =
  'min-width: 160rpx; padding: 18rpx 20rpx; border: 1rpx solid rgba(61, 43, 24, 0.12); color: #5e564d; line-height: 1.75; vertical-align: top; word-break: break-word; text-align: left;';
const TABLE_HEAD_STYLE =
  'background: rgba(18, 122, 114, 0.08); color: #1e1c18; font-weight: 700; text-align: left;';

function spacer(height: number) {
  return `<div style="display:block;height:${height}rpx;min-height:${height}rpx;line-height:0;font-size:0;overflow:hidden;"></div>`;
}

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
    return `${spacer(token.tag === 'h1' ? 28 : 22)}${self.renderToken(tokens, idx, options)}`;
  };

  md.renderer.rules.paragraph_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: MarkdownRendererState,
  ) => {
    tokens[idx].attrSet('style', PARAGRAPH_STYLE);
    return `${spacer(12)}${self.renderToken(tokens, idx, options)}`;
  };

  md.renderer.rules.bullet_list_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: MarkdownRendererState,
  ) => {
    tokens[idx].attrSet('style', LIST_STYLE);
    return `${spacer(12)}${self.renderToken(tokens, idx, options)}`;
  };

  md.renderer.rules.ordered_list_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: MarkdownRendererState,
  ) => {
    tokens[idx].attrSet('style', LIST_STYLE);
    return `${spacer(12)}${self.renderToken(tokens, idx, options)}`;
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
    return `${spacer(14)}${self.renderToken(tokens, idx, options)}`;
  };

  md.renderer.rules.table_open = () =>
    `${spacer(14)}<div style="${TABLE_WRAPPER_STYLE}"><table style="${TABLE_STYLE}">`;

  md.renderer.rules.table_close = () => '</table></div>';

  md.renderer.rules.th_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: MarkdownRendererState,
  ) => {
    tokens[idx].attrSet('style', `${TABLE_CELL_STYLE} ${TABLE_HEAD_STYLE}`);
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.td_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: MarkdownRendererState,
  ) => {
    tokens[idx].attrSet('style', TABLE_CELL_STYLE);
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.code_inline = (tokens: MarkdownToken[], idx: number) => {
    const token = tokens[idx];
    return `<code style="${INLINE_CODE_STYLE}">${escapeHtml(token.content)}</code>`;
  };

  md.renderer.rules.fence = (tokens: MarkdownToken[], idx: number) => {
    const token = tokens[idx];
    return `${spacer(14)}<pre style="${PRE_STYLE}"><code style="${CODE_BLOCK_STYLE}">${escapeHtml(token.content)}</code></pre>`;
  };

  md.renderer.rules.code_block = (tokens: MarkdownToken[], idx: number) => {
    const token = tokens[idx];
    return `${spacer(14)}<pre style="${PRE_STYLE}"><code style="${CODE_BLOCK_STYLE}">${escapeHtml(token.content)}</code></pre>`;
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
    return `${spacer(10)}${self.renderToken(tokens, idx, options)}`;
  };

  md.renderer.rules.hr = () =>
    `${spacer(14)}<div style="${HR_STYLE}"><div style="width: 100%; height: 2rpx; background: rgba(61, 43, 24, 0.24);"></div></div>`;

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
