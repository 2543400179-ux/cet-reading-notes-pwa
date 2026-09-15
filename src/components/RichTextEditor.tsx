import React, { useEffect, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Highlight } from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Markdown } from 'tiptap-markdown';
import { Node, mergeAttributes } from '@tiptap/core';
import MarkdownIt from 'markdown-it';
import { ColorMemoryPanel } from './ColorMemoryPanel';
import {
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  Highlighter,
  Undo,
  Redo,
  Quote,
  ChevronDown,
  Eraser,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  className?: string;
  placeholder?: string;
  onWikiLinkClick?: (title: string) => void;
}

// Markdown-it engine to parse incoming raw markdown into rich HTML
const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
});

/**
 * Pre-processes raw markdown into standard HTML for TipTap:
 * - Cleans up escaped brackets: \[\[ -> [[
 * - Cleans up headings with list prefixes: e.g. "• 无序列表项## 标题" -> "## 标题"
 * - Converts [[Title]] into <span data-wiki-link="Title">🔗 Title</span>
 * - Renders into HTML so TipTap creates real H1-H3, Bold, Italic, WikiLink nodes without markdown symbols
 */
export function parseMarkdownToHtml(rawMarkdown: string): string {
  if (!rawMarkdown) return '';

  let text = rawMarkdown
    .replace(/\\\[\\\[/g, '[[')
    .replace(/\\\]\\\]/g, ']]')
    .replace(/\\\*/g, '*')
    .replace(/\\_/g, '_');

  // Fix corrupted heading lines where list bullets or placeholders got attached
  text = text
    .split('\n')
    .map((line) => {
      const hMatch = line.match(/^(?:[-*+•]\s*)?(?:无序列表项\s*)?(#{1,6})\s*(.*)$/);
      if (hMatch) {
        return `${hMatch[1]} ${hMatch[2].replace(/^无序列表项\s*/, '').trim()}`;
      }
      return line.replace(/^•\s*/, '- ').replace(/^无序列表项\s*/, '');
    })
    .join('\n');

  // Convert [[WikiLink]] to custom HTML span for WikiLinkNode to parse
  text = text.replace(/\[\[([^\]\n]+)\]\]/g, (_, title) => {
    const cleanTitle = title.trim();
    return `<span data-wiki-link="${cleanTitle}">🔗 ${cleanTitle}</span>`;
  });

  return md.render(text);
}

// Custom TipTap node for [[WikiLink]] that renders as a blue pill with 🔗 icon (no brackets!)
export const WikiLinkNode = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      title: {
        default: '新笔记',
        parseHTML: (element) => {
          return (
            element.getAttribute('data-wiki-link') ||
            element.textContent?.replace(/^[🔗\s\[]+|[\]\s]+$/g, '') ||
            '新笔记'
          );
        },
        renderHTML: (attributes) => ({
          'data-wiki-link': attributes.title,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wiki-link]',
      },
      {
        tag: 'a[data-wiki-link]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-wiki-link': node.attrs.title,
        class:
          'inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 cursor-pointer select-none hover:bg-sky-100 hover:text-sky-900 shadow-2xs transition align-baseline',
        contenteditable: 'false',
      }),
      `🔗 ${node.attrs.title}`,
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(`[[${node.attrs.title}]]`);
        },
        parse: {},
      },
    };
  },
});

export function RichTextEditor({
  content,
  onChange,
  className,
  placeholder = '开始记录双链笔记...',
  onWikiLinkClick,
}: RichTextEditorProps) {
  const [activeColorModal, setActiveColorModal] = useState<'text' | 'bg' | null>(null);

  // Live selected text colors
  const [activeSelectionTextColor, setActiveSelectionTextColor] = useState<string | null>(null);
  const [activeSelectionHighlightColor, setActiveSelectionHighlightColor] = useState<string | null>(null);

  // Last used colors for quick 1-click apply
  const [lastTextColor, setLastTextColor] = useState<string>('#2563EB');
  const [lastHighlightColor, setLastHighlightColor] = useState<string>('#FEF08A');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      WikiLinkNode,
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: parseMarkdownToHtml(content),
    onUpdate: ({ editor }) => {
      let raw = (editor.storage as any).markdown?.getMarkdown() || '';
      // Ensure any <span data-wiki-link="Title"> is serialized cleanly as [[Title]]
      raw = raw.replace(/<span\s+data-wiki-link="([^"]+)"[^>]*>[\s\S]*?<\/span>/gi, '[[$1]]');
      onChange(raw);
    },
    onTransaction: ({ editor }) => {
      const textColor = editor.getAttributes('textStyle').color || null;
      const hlColor = editor.getAttributes('highlight').color || null;
      setActiveSelectionTextColor(textColor);
      setActiveSelectionHighlightColor(hlColor);
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-slate max-w-none focus:outline-hidden min-h-[300px] font-serif-cn leading-relaxed text-slate-800',
      },
      handleClick: (view, pos, event) => {
        const target = event.target as HTMLElement;
        const wikiSpan = target.closest('[data-wiki-link]');
        if (wikiSpan && onWikiLinkClick) {
          const title = wikiSpan.getAttribute('data-wiki-link');
          if (title) {
            onWikiLinkClick(title);
            return true;
          }
        }
        return false;
      },
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (!editor) return;
    const currentMd = (editor.storage as any).markdown?.getMarkdown() || '';
    if (content !== currentMd) {
      editor.commands.setContent(parseMarkdownToHtml(content));
    }
  }, [content, editor]);

  // Insert or convert to WikiLink
  const handleInsertWikiLink = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to).trim();
    const title = selectedText || '新双链笔记';

    editor
      .chain()
      .focus()
      .insertContent({
        type: 'wikiLink',
        attrs: { title },
      })
      .run();
  }, [editor]);

  // Fast apply last text color
  const handleFastApplyTextColor = () => {
    if (!editor) return;
    editor.chain().focus().setColor(lastTextColor).run();
  };

  // Fast apply last highlight color
  const handleFastApplyHighlightColor = () => {
    if (!editor) return;
    editor.chain().focus().toggleHighlight({ color: lastHighlightColor }).run();
  };

  if (!editor) return null;

  return (
    <div className={`w-full h-full flex flex-col relative bg-white ${className || ''}`}>
      {/* 1. Editor Surface (Top & Middle area, naturally scrolls, browser selection popups appear safely above) */}
      <div
        className="flex-1 overflow-y-auto cursor-text p-4 sm:p-6"
        onClick={() => editor.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>

      {/* 2. Compact Color Memory Panel (Appears right above bottom toolbar, taking ~1/3 screen max) */}
      {activeColorModal && (
        <div className="absolute bottom-[92px] inset-x-2 sm:inset-x-auto sm:left-4 sm:w-96 z-40 animate-in slide-in-from-bottom-2 duration-150">
          <ColorMemoryPanel
            activeTextColor={activeSelectionTextColor}
            activeHighlightColor={activeSelectionHighlightColor}
            onSelectColor={(hex, type) => {
              if (type === 'text') {
                setLastTextColor(hex);
                editor.chain().focus().setColor(hex).run();
              } else {
                setLastHighlightColor(hex);
                editor.chain().focus().toggleHighlight({ color: hex }).run();
              }
            }}
            onClearColor={() => {
              editor.chain().focus().unsetHighlight().unsetColor().run();
            }}
            onClose={() => setActiveColorModal(null)}
          />
        </div>
      )}

      {/* 3. Fixed Bottom Toolbar (Two rows, mobile-friendly, won't be blocked by browser copy/paste toolbar) */}
      <div className="shrink-0 w-full bg-slate-50/95 backdrop-blur-md border-t border-slate-200/90 shadow-xs px-2 sm:px-4 py-1.5 flex flex-col gap-1.5 z-30 select-none">
        {/* Row 1: Block formatting (H1-H3), Typographic styles (Bold, Italic, Strike, Quote), and Lists */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {/* Headings */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-2 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-0.5 ${
              editor.isActive('heading', { level: 1 })
                ? 'bg-slate-200 text-[#2C4056] font-extrabold'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
            title="一级标题 H1"
          >
            <Heading1 className="w-3.5 h-3.5" />
            <span className="text-[11px]">H1</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-0.5 ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-slate-200 text-[#2C4056] font-extrabold'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
            title="二级标题 H2"
          >
            <Heading2 className="w-3.5 h-3.5" />
            <span className="text-[11px]">H2</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-2 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-0.5 ${
              editor.isActive('heading', { level: 3 })
                ? 'bg-slate-200 text-[#2C4056] font-extrabold'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
            title="三级标题 H3"
          >
            <Heading3 className="w-3.5 h-3.5" />
            <span className="text-[11px]">H3</span>
          </button>

          <div className="w-[1px] h-4 bg-slate-300 mx-1 shrink-0" />

          {/* Text Styling */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded-md transition cursor-pointer ${
              editor.isActive('bold') ? 'bg-slate-200 text-[#2C4056]' : 'text-slate-600 hover:bg-slate-200/70'
            }`}
            title="加粗 (Ctrl+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded-md transition cursor-pointer ${
              editor.isActive('italic') ? 'bg-slate-200 text-[#2C4056]' : 'text-slate-600 hover:bg-slate-200/70'
            }`}
            title="斜体 (Ctrl+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded-md transition cursor-pointer ${
              editor.isActive('strike') ? 'bg-slate-200 text-[#2C4056]' : 'text-slate-600 hover:bg-slate-200/70'
            }`}
            title="删除线"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded-md transition cursor-pointer ${
              editor.isActive('blockquote') ? 'bg-slate-200 text-[#2C4056]' : 'text-slate-600 hover:bg-slate-200/70'
            }`}
            title="引用块"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-slate-300 mx-1 shrink-0" />

          {/* Lists */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded-md transition cursor-pointer ${
              editor.isActive('bulletList') ? 'bg-slate-200 text-[#2C4056]' : 'text-slate-600 hover:bg-slate-200/70'
            }`}
            title="无序列表"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded-md transition cursor-pointer ${
              editor.isActive('orderedList') ? 'bg-slate-200 text-[#2C4056]' : 'text-slate-600 hover:bg-slate-200/70'
            }`}
            title="有序列表"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Row 2: WikiLinks, Text Color Split, Highlight Split, Clear, Undo/Redo */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {/* [[双链]] 按钮 */}
          <button
            type="button"
            onClick={handleInsertWikiLink}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-xs font-semibold text-sky-800 border border-sky-200 transition cursor-pointer shrink-0 shadow-2xs"
            title="插入双向笔记链接"
          >
            <LinkIcon className="w-3 h-3 text-sky-600" />
            <span>[[双链]]</span>
          </button>

          <div className="w-[1px] h-4 bg-slate-300 mx-0.5 shrink-0" />

          {/* 文字色 分段控件 (左边色块快捷应用，右边箭头/调色板打开记忆面板) */}
          <div className="inline-flex items-center rounded-lg border border-slate-300/80 bg-white shadow-2xs overflow-hidden shrink-0">
            <button
              type="button"
              onClick={handleFastApplyTextColor}
              className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-50 transition cursor-pointer text-xs font-medium text-slate-700"
              title="点击直接应用文字色"
            >
              <div
                className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-2xs"
                style={{ backgroundColor: activeSelectionTextColor || lastTextColor }}
              />
              <span className="text-[11px] font-semibold">字色</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveColorModal((prev) => (prev === 'text' ? null : 'text'))}
              className={`px-1.5 py-1 border-l border-slate-200 hover:bg-slate-100 transition cursor-pointer ${
                activeColorModal === 'text' ? 'bg-slate-100 text-[#2C4056]' : 'text-slate-500'
              }`}
              title="打开完整调色板"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* 高亮色 分段控件 (左边色块快捷应用，右边箭头/调色板打开记忆面板) */}
          <div className="inline-flex items-center rounded-lg border border-slate-300/80 bg-white shadow-2xs overflow-hidden shrink-0">
            <button
              type="button"
              onClick={handleFastApplyHighlightColor}
              className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-50 transition cursor-pointer text-xs font-medium text-slate-700"
              title="点击直接应用高亮背景色"
            >
              <div
                className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-2xs"
                style={{ backgroundColor: activeSelectionHighlightColor || lastHighlightColor }}
              />
              <Highlighter className="w-3 h-3 text-amber-600" />
              <span className="text-[11px] font-semibold">高亮</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveColorModal((prev) => (prev === 'bg' ? null : 'bg'))}
              className={`px-1.5 py-1 border-l border-slate-200 hover:bg-slate-100 transition cursor-pointer ${
                activeColorModal === 'bg' ? 'bg-slate-100 text-[#2C4056]' : 'text-slate-500'
              }`}
              title="打开完整调色板"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* 清除色彩 */}
          <button
            type="button"
            onClick={() => {
              editor.chain().focus().unsetHighlight().unsetColor().run();
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-200/70 text-[11px] text-slate-500 hover:text-slate-800 transition cursor-pointer shrink-0"
            title="清除所选文字的颜色与高亮"
          >
            <Eraser className="w-3 h-3" />
            <span>清除</span>
          </button>

          <div className="ml-auto flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-30 text-slate-600 transition cursor-pointer"
              title="撤销 (Ctrl+Z)"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-30 text-slate-600 transition cursor-pointer"
              title="重做 (Ctrl+Y)"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

