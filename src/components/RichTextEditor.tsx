import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Highlight } from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Markdown } from 'tiptap-markdown';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
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
  knownNoteTitles?: string[];
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
 * - Converts any legacy HTML spans <span data-wiki-link="Title"> back to [[Title]]
 * - Cleans up headings with list prefixes: e.g. "• 无序列表项## 标题" -> "## 标题"
 * - Keeps [[Title]] intact as native editable text so TipTap allows normal editing without read-only barriers
 */
export function parseMarkdownToHtml(rawMarkdown: string): string {
  if (!rawMarkdown) return '';

  let text = rawMarkdown
    .replace(/\\\[\\\[/g, '[[')
    .replace(/\\\]\\\]/g, ']]')
    .replace(/\\\*/g, '*')
    .replace(/\\_/g, '_');

  // Convert any legacy <span data-wiki-link="Title"> back to [[Title]]
  text = text.replace(/<span\s+data-wiki-link="([^"]+)"[^>]*>[\s\S]*?<\/span>/gi, '[[$1]]');

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

  return md.render(text);
}

// Calculate contrasting text brightness for solid color block labels
function isLightColor(hex: string): boolean {
  if (!hex || !hex.startsWith('#')) return true;
  const clean = hex.replace('#', '');
  if (clean.length < 6) return true;
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 145;
}

/**
 * Custom TipTap Extension for [[WikiLink]] inline decorations:
 * - Keeps the text 100% normal editable text (no atomic nodes, no read-only traps)
 * - Highlights existing notes in blue (.tiptap-wikilink-existing)
 * - Highlights new/non-existing notes in gray (.tiptap-wikilink-new)
 */
export const WikiLinkDecoration = Extension.create<{
  getKnownTitles: () => string[];
}>({
  name: 'wikiLinkDecoration',

  addOptions() {
    return {
      getKnownTitles: () => [],
    };
  },

  addProseMirrorPlugins() {
    const extension = this;
    return [
      new Plugin({
        key: new PluginKey('wikiLinkDecorationPlugin'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const doc = state.doc;
            const known = extension.options.getKnownTitles() || [];
            const norm = (s: string) => s.replace(/：/g, ':').trim().toLowerCase();

            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;

              const regex = /\[\[([^\]\n]+)\]\]/g;
              let match;
              while ((match = regex.exec(node.text)) !== null) {
                const start = pos + match.index;
                const end = start + match[0].length;
                const innerTitle = match[1].trim();
                const exists = known.some((t: string) => norm(t) === norm(innerTitle));

                decorations.push(
                  Decoration.inline(start, end, {
                    class: exists ? 'tiptap-wikilink-existing' : 'tiptap-wikilink-new',
                    'data-wiki-title': innerTitle,
                  })
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

export function RichTextEditor({
  content,
  onChange,
  className,
  placeholder = '开始记录双链笔记...',
  knownNoteTitles = [],
}: RichTextEditorProps) {
  const [activeColorModal, setActiveColorModal] = useState<'text' | 'bg' | null>(null);

  // Live selected text colors
  const [activeSelectionTextColor, setActiveSelectionTextColor] = useState<string | null>(null);
  const [activeSelectionHighlightColor, setActiveSelectionHighlightColor] = useState<string | null>(null);

  // Last used colors for quick 1-click apply
  const [lastTextColor, setLastTextColor] = useState<string>('#2563EB');
  const [lastHighlightColor, setLastHighlightColor] = useState<string>('#FEF08A');

  const currentTextColor = activeSelectionTextColor || lastTextColor;
  const currentHighlightColor = activeSelectionHighlightColor || lastHighlightColor;

  const knownTitlesRef = useRef<string[]>(knownNoteTitles);
  useEffect(() => {
    knownTitlesRef.current = knownNoteTitles;
  }, [knownNoteTitles]);

  const lastEmittedContentRef = useRef<string>(content);
  const isLocalChangeRef = useRef<boolean>(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      WikiLinkDecoration.configure({
        getKnownTitles: () => knownTitlesRef.current,
      }),
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: parseMarkdownToHtml(content),
    onUpdate: ({ editor }) => {
      let raw = (editor.storage as any).markdown?.getMarkdown() || '';
      // Ensure [[...]] is saved cleanly without escape slashes
      raw = raw.replace(/\\\[\\\[/g, '[[').replace(/\\\]\\\]/g, ']]');
      raw = raw.replace(/<span\s+data-wiki-link="([^"]+)"[^>]*>[\s\S]*?<\/span>/gi, '[[$1]]');
      lastEmittedContentRef.current = raw;
      isLocalChangeRef.current = true;
      onChange(raw);
    },
    onSelectionUpdate: ({ editor }) => {
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
    },
  });

  // Re-trigger decoration update when knownNoteTitles content actually changes
  const lastKnownTitlesHashRef = useRef<string>('');
  useEffect(() => {
    knownTitlesRef.current = knownNoteTitles;
    const currentHash = knownNoteTitles.join('|||');
    if (lastKnownTitlesHashRef.current !== currentHash) {
      lastKnownTitlesHashRef.current = currentHash;
      if (editor && !editor.isDestroyed && editor.view) {
        try {
          editor.view.dispatch(editor.state.tr);
        } catch (_) {
          // ignore if view not ready
        }
      }
    }
  }, [knownNoteTitles, editor]);

  // Sync external content changes (e.g. switching active note or external updates)
  useEffect(() => {
    if (!editor) return;
    if (isLocalChangeRef.current) {
      isLocalChangeRef.current = false;
      return;
    }
    if (content === lastEmittedContentRef.current) {
      return;
    }
    lastEmittedContentRef.current = content;
    const currentMd = (editor.storage as any).markdown?.getMarkdown() || '';
    if (content !== currentMd) {
      editor.commands.setContent(parseMarkdownToHtml(content));
    }
  }, [content, editor]);

  // Insert or convert to WikiLink:
  // - If text is selected: wraps it as [[selectedText]]
  // - If no text selected: inserts [[]] and places cursor right in the middle between [[ and ]]
  // - Fully editable normal text without dummy placeholder strings that require cumbersome backspacing on mobile keyboards
  const handleInsertWikiLink = useCallback(() => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;

    if (!empty) {
      const selectedText = editor.state.doc.textBetween(from, to).trim();
      if (selectedText) {
        const insertText = `[[${selectedText}]]`;
        editor
          .chain()
          .focus()
          .insertContentAt({ from, to }, insertText)
          .setTextSelection({ from: from + 2, to: from + 2 + selectedText.length })
          .run();
        return;
      }
    }

    // When empty selection: directly insert [[]] and position caret inside
    editor
      .chain()
      .focus()
      .insertContentAt(from, '[[]]')
      .setTextSelection(from + 2)
      .run();
  }, [editor]);

  // Independent per-line list toggle:
  // - Switches only the current line/item without modifying or polluting adjacent lines
  // - Bullet and numbered lists can freely coexist
  const handleToggleList = useCallback(
    (targetType: 'bulletList' | 'orderedList') => {
      if (!editor) return;

      const isTargetActive = editor.isActive(targetType);
      const otherType = targetType === 'bulletList' ? 'orderedList' : 'bulletList';
      const isOtherActive = editor.isActive(otherType);

      if (isTargetActive) {
        // Toggle off the current list item back to a standard paragraph
        editor.chain().focus().liftListItem('listItem').run();
      } else if (isOtherActive) {
        // Switch between list types: lift this item out and wrap specifically into the target type
        // This keeps other lines intact!
        editor
          .chain()
          .focus()
          .liftListItem('listItem')
          .wrapInList(targetType)
          .run();
      } else {
        // Wrap current line into target list type
        editor
          .chain()
          .focus()
          .wrapInList(targetType)
          .run();
      }
    },
    [editor]
  );

  // Fast apply text color (live selection or last used)
  const handleFastApplyTextColor = () => {
    if (!editor) return;
    editor.chain().focus().setColor(currentTextColor).run();
  };

  // Fast apply highlight color (live selection or last used)
  const handleFastApplyHighlightColor = () => {
    if (!editor) return;
    editor.chain().focus().toggleHighlight({ color: currentHighlightColor }).run();
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
            onClick={() => handleToggleList('bulletList')}
            className={`p-1.5 rounded-md transition cursor-pointer ${
              editor.isActive('bulletList') ? 'bg-slate-200 text-[#2C4056]' : 'text-slate-600 hover:bg-slate-200/70'
            }`}
            title="无序列表"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleList('orderedList')}
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

          {/* 文字色 并排胶囊按钮 (左边实心矩形色块快捷应用，右边下拉小图标打开调色板) */}
          <div className="inline-flex items-stretch h-7 rounded-lg border border-slate-300 bg-white shadow-2xs overflow-hidden shrink-0">
            <button
              type="button"
              onClick={handleFastApplyTextColor}
              className="flex items-center justify-center px-2.5 h-full transition cursor-pointer hover:opacity-90 active:scale-95 border-r border-slate-200/80"
              style={{
                backgroundColor: currentTextColor,
              }}
              title={`点击直接应用文字色 (${currentTextColor})`}
            >
              <span
                className="text-[11px] font-bold tracking-tight select-none"
                style={{
                  color: isLightColor(currentTextColor) ? '#0f172a' : '#ffffff',
                  textShadow: isLightColor(currentTextColor) ? 'none' : '0 1px 2px rgba(0,0,0,0.5)',
                }}
              >
                字色
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveColorModal((prev) => (prev === 'text' ? null : 'text'))}
              className={`w-5 sm:w-6 flex items-center justify-center h-full hover:bg-slate-100 transition cursor-pointer ${
                activeColorModal === 'text' ? 'bg-slate-100 text-[#2C4056]' : 'text-slate-500'
              }`}
              title="打开文字色彩记忆面板"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 高亮色 并排胶囊按钮 (左边实心矩形色块快捷应用，右边下拉小图标打开调色板) */}
          <div className="inline-flex items-stretch h-7 rounded-lg border border-slate-300 bg-white shadow-2xs overflow-hidden shrink-0">
            <button
              type="button"
              onClick={handleFastApplyHighlightColor}
              className="flex items-center justify-center px-2.5 h-full transition cursor-pointer hover:opacity-90 active:scale-95 border-r border-slate-200/80"
              style={{
                backgroundColor: currentHighlightColor,
              }}
              title={`点击直接应用高亮色 (${currentHighlightColor})`}
            >
              <span
                className="text-[11px] font-bold tracking-tight select-none"
                style={{
                  color: isLightColor(currentHighlightColor) ? '#0f172a' : '#ffffff',
                  textShadow: isLightColor(currentHighlightColor) ? 'none' : '0 1px 2px rgba(0,0,0,0.5)',
                }}
              >
                高亮
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveColorModal((prev) => (prev === 'bg' ? null : 'bg'))}
              className={`w-5 sm:w-6 flex items-center justify-center h-full hover:bg-slate-100 transition cursor-pointer ${
                activeColorModal === 'bg' ? 'bg-slate-100 text-[#2C4056]' : 'text-slate-500'
              }`}
              title="打开高亮色彩记忆面板"
            >
              <ChevronDown className="w-3.5 h-3.5" />
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

