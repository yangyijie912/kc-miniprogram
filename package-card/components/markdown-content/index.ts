import MarkdownIt from '@/package-card/components/markdown-content/markdown-it';

const INLINE_CODE_STYLE =
  "padding: 4rpx 10rpx; border-radius: 10rpx; background: rgba(61, 43, 24, 0.08); color: #7c3f1c; font-size: 24rpx; font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;";
const LINK_STYLE = 'color: #1f5eff; text-decoration: underline; word-break: break-all;';
const STRONG_STYLE = 'color: #1e1c18; font-weight: 700;';
const EM_STYLE = 'color: #725f4e;';
const IMAGE_STYLE =
  'display: block; width: 100%; max-width: 100%; padding: 18rpx 0; border-radius: 20rpx;';

type MarkdownToken = {
  type: string;
  tag: string;
  content: string;
  children?: MarkdownToken[];
  map?: [number, number];
  attrSet(name: string, value: string): void;
};

type MarkdownRenderer = {
  render(tokens: MarkdownToken[], options: unknown, env: unknown): string;
  renderInline(tokens: MarkdownToken[], options: unknown, env: unknown): string;
};

type MarkdownBlock =
  | { type: 'heading'; level: number; html: string }
  | { type: 'paragraph'; html: string }
  | { type: 'list'; ordered: boolean; items: Array<{ html: string }> }
  | { type: 'quote'; html: string }
  | { type: 'divider' }
  | { type: 'code'; text: string }
  | { type: 'table'; rows: MarkdownTableRow[] };

type MarkdownTableRow = {
  cells: MarkdownTableCell[];
};

type MarkdownTableCell = {
  html: string;
  head: boolean;
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
    html: false, // 禁止直接注入 HTML，避免用户输入影响小程序页面结构。
    breaks: true,
    linkify: true,
    typographer: true,
  });

  // 只保留明确链接识别，避免普通学习文本被误判成链接。
  if (md.linkify && typeof md.linkify.set === 'function') {
    md.linkify.set({
      fuzzyLink: false,
      fuzzyEmail: false,
      fuzzyIP: false,
    });
  }

  md.renderer.rules.code_inline = (tokens: MarkdownToken[], idx: number) => {
    const token = tokens[idx];
    return `<code style="${INLINE_CODE_STYLE}">${escapeHtml(token.content)}</code>`;
  };

  md.renderer.rules.link_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: { renderToken(tokens: MarkdownToken[], idx: number, options: unknown): string },
  ) => {
    tokens[idx].attrSet('style', LINK_STYLE);
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.strong_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: { renderToken(tokens: MarkdownToken[], idx: number, options: unknown): string },
  ) => {
    tokens[idx].attrSet('style', STRONG_STYLE);
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.em_open = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: { renderToken(tokens: MarkdownToken[], idx: number, options: unknown): string },
  ) => {
    tokens[idx].attrSet('style', EM_STYLE);
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.image = (
    tokens: MarkdownToken[],
    idx: number,
    options: unknown,
    _env: unknown,
    self: { renderToken(tokens: MarkdownToken[], idx: number, options: unknown): string },
  ) => {
    tokens[idx].attrSet('style', IMAGE_STYLE);
    return self.renderToken(tokens, idx, options);
  };

  return md;
}

const md = createMarkdownIt();

function renderInline(tokens?: MarkdownToken[]) {
  if (!tokens || tokens.length === 0) {
    return '';
  }

  return (md.renderer as MarkdownRenderer).renderInline(tokens, md.options, {});
}

function collectList(tokens: MarkdownToken[], start: number) {
  const openingType = tokens[start].type;
  const closingType = openingType === 'ordered_list_open' ? 'ordered_list_close' : 'bullet_list_close';
  const items: Array<{ html: string }> = [];
  let depth = 0;
  let currentParts: string[] | null = null;

  for (let i = start + 1; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token.type === openingType) {
      depth += 1;
    }

    if (token.type === closingType) {
      if (depth === 0) {
        return { items, end: i };
      }
      depth -= 1;
    }

    if (depth === 0 && token.type === 'list_item_open') {
      currentParts = [];
      continue;
    }

    if (depth === 0 && token.type === 'list_item_close') {
      if (currentParts) {
        items.push({ html: currentParts.join('') });
      }
      currentParts = null;
      continue;
    }

    if (!currentParts) {
      continue;
    }

    if (token.type === 'inline') {
      currentParts.push(renderInline(token.children));
    }

    if (token.type === 'softbreak' || token.type === 'hardbreak') {
      currentParts.push('<br />');
    }
  }

  return { items, end: start };
}

function collectTable(tokens: MarkdownToken[], start: number) {
  const rows: MarkdownTableRow[] = [];
  let currentRow: MarkdownTableRow | null = null;
  let currentCellHead: boolean | null = null;

  for (let i = start + 1; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token.type === 'table_close') {
      return { rows, end: i };
    }

    if (token.type === 'tr_open') {
      currentRow = { cells: [] };
      continue;
    }

    if (token.type === 'tr_close') {
      if (currentRow) {
        rows.push(currentRow);
      }
      currentRow = null;
      continue;
    }

    if (token.type === 'th_open') {
      currentCellHead = true;
      continue;
    }

    if (token.type === 'td_open') {
      currentCellHead = false;
      continue;
    }

    if (token.type === 'th_close' || token.type === 'td_close') {
      currentCellHead = null;
      continue;
    }

    if (token.type === 'inline' && currentRow && currentCellHead !== null) {
      currentRow.cells.push({
        html: renderInline(token.children),
        head: currentCellHead,
      });
    }
  }

  return { rows, end: start };
}

function collectQuote(tokens: MarkdownToken[], start: number) {
  const parts: string[] = [];

  for (let i = start + 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type === 'blockquote_close') {
      return { html: parts.join('<br />'), end: i };
    }
    if (token.type === 'inline') {
      parts.push(renderInline(token.children));
    }
  }

  return { html: parts.join('<br />'), end: start };
}

function parseMarkdown(content: string) {
  const tokens = md.parse(content, {}) as MarkdownToken[];
  const blocks: MarkdownBlock[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const nextToken = tokens[i + 1];

    if (token.type === 'heading_open' && nextToken && nextToken.type === 'inline') {
      const level = Number(token.tag.replace('h', '')) || 3;
      blocks.push({ type: 'heading', level, html: renderInline(nextToken.children) });
      i += 2;
      continue;
    }

    if (token.type === 'paragraph_open' && nextToken && nextToken.type === 'inline') {
      blocks.push({ type: 'paragraph', html: renderInline(nextToken.children) });
      i += 2;
      continue;
    }

    if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
      const { items, end } = collectList(tokens, i);
      blocks.push({ type: 'list', ordered: token.type === 'ordered_list_open', items });
      i = end;
      continue;
    }

    if (token.type === 'blockquote_open') {
      const { html, end } = collectQuote(tokens, i);
      blocks.push({ type: 'quote', html });
      i = end;
      continue;
    }

    if (token.type === 'hr') {
      blocks.push({ type: 'divider' });
      continue;
    }

    if (token.type === 'fence' || token.type === 'code_block') {
      blocks.push({ type: 'code', text: token.content });
      continue;
    }

    if (token.type === 'table_open') {
      const { rows, end } = collectTable(tokens, i);
      blocks.push({ type: 'table', rows });
      i = end;
    }
  }

  return blocks;
}

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
    markdownBlocks: [] as MarkdownBlock[],
  },

  methods: {
    renderMarkdown() {
      this.setData({
        markdownBlocks: this.data.content ? parseMarkdown(this.data.content) : [],
      });
    },
  },

  lifetimes: {
    attached() {
      this.renderMarkdown();
    },
  },
});
