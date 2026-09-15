import React, { useState, useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Quote,
  Code,
  List,
  ListOrdered,
  Highlighter,
  Palette,
  Link as LinkIcon,
  X,
  Search,
  Check,
  Plus,
} from 'lucide-react';
import type { Note } from '../types';

export const HIGHLIGHT_COLOR_PRESETS = [
  { name: '柠檬黄', color: '#FEF08A' },
  { name: '薄荷绿', color: '#BBF7D0' },
  { name: '晴空蓝', color: '#BAE6FD' },
  { name: '浅樱粉', color: '#FECDD3' },
  { name: '薰衣草紫', color: '#E9D5FF' },
  { name: '暖杏橙', color: '#FED7AA' },
];

export const TEXT_COLOR_PRESETS = [
  { name: '炭黑', color: '#1E293B' },
  { name: '绯红', color: '#DC2626' },
  { name: '宝蓝', color: '#2563EB' },
  { name: '翠绿', color: '#059669' },
  { name: '绛紫', color: '#7C3AED' },
  { name: '琥珀', color: '#D97706' },
];

interface MarkdownEditorToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  content: string;
  onUpdateContent: (newContent: string) => void;
  availableNotes?: Note[];
  className?: string;
}

export const MarkdownEditorToolbar: React.FC<MarkdownEditorToolbarProps> = ({
  textareaRef,
  content,
  onUpdateContent,
  availableNotes = [],
  className = '',
}) => {
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showWikiLinkPicker, setShowWikiLinkPicker] = useState(false);
  const [wikiSearch, setWikiSearch] = useState('');
  const [customHighlightColor, setCustomHighlightColor] = useState('#FEF08A');
  const [customTextColor, setCustomTextColor] = useState('#2563EB');

  // Track selection so clicking popover does not lose selected text
  const savedSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  // Virtual keyboard offset tracker for mobile
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      // Distance from visual viewport bottom to window innerHeight
      const bottomOffset = window.innerHeight - (vv.height + vv.offsetTop);
      setKeyboardHeight(Math.max(0, Math.round(bottomOffset)));
    };

    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  const saveCurrentSelection = () => {
    const el = textareaRef.current;
    if (el) {
      savedSelectionRef.current = {
        start: el.selectionStart ?? 0,
        end: el.selectionEnd ?? 0,
      };
    }
  };

  // Insert formatting around current cursor / selection
  const insertFormatting = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    const currentVal = content || '';

    if (!textarea) {
      onUpdateContent(currentVal + `${prefix}${defaultText}${suffix}`);
      return;
    }

    // Determine start & end from current selection or saved selection
    let start = textarea.selectionStart;
    let end = textarea.selectionEnd;
    if (start === end && savedSelectionRef.current.end > savedSelectionRef.current.start) {
      start = savedSelectionRef.current.start;
      end = savedSelectionRef.current.end;
    }

    const selectedText = currentVal.substring(start, end) || defaultText;
    const replacement = `${prefix}${selectedText}${suffix}`;
    const newContent = currentVal.substring(0, start) + replacement + currentVal.substring(end);

    onUpdateContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const newCursor = start + replacement.length;
      textarea.setSelectionRange(newCursor, newCursor);
      savedSelectionRef.current = { start: newCursor, end: newCursor };
    }, 15);
  };

  // Insert heading at beginning of current line
  const insertHeading = (level: 1 | 2 | 3 | 4) => {
    const textarea = textareaRef.current;
    const currentVal = content || '';
    const hPrefix = '#'.repeat(level) + ' ';

    if (!textarea) {
      onUpdateContent(currentVal + `\n${hPrefix}标题\n`);
      return;
    }

    const start = textarea.selectionStart;
    const lastNewline = currentVal.lastIndexOf('\n', start - 1);
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;

    const lineText = currentVal.substring(lineStart);
    const headingMatch = lineText.match(/^(#{1,6}\s+)/);

    let newContent = '';
    if (headingMatch) {
      newContent =
        currentVal.substring(0, lineStart) +
        hPrefix +
        lineText.substring(headingMatch[0].length);
    } else {
      newContent =
        currentVal.substring(0, lineStart) + hPrefix + currentVal.substring(lineStart);
    }

    onUpdateContent(newContent);
    setTimeout(() => {
      textarea.focus();
    }, 15);
  };

  const applyHighlightColor = (color: string) => {
    insertFormatting(
      `<mark style="background-color: ${color}; color: inherit;">`,
      `</mark>`,
      '高亮重点'
    );
    setShowHighlightPicker(false);
  };

  const applyTextColor = (color: string) => {
    insertFormatting(`<span style="color: ${color};">`, `</span>`, '彩色字样');
    setShowTextColorPicker(false);
  };

  const applyWikiLink = (noteTitle: string) => {
    insertFormatting(`[[${noteTitle}]]`);
    setShowWikiLinkPicker(false);
    setWikiSearch('');
  };

  return (
    <div
      style={{
        bottom: `${keyboardHeight}px`,
        transition: 'bottom 140ms ease-out',
      }}
      className={`fixed sm:sticky left-0 right-0 z-40 bg-white/98 backdrop-blur-md border-t border-slate-200 shadow-md ${className}`}
    >
      {/* 
        CRITICAL ARCHITECTURAL FIX:
        Popovers are rendered in this parent container, OUTSIDE the overflow-x scroll container,
        so they are NEVER cut off by overflow-x and their clicks execute smoothly!
      */}

      {/* 1. WikiLink Popover Picker */}
      {showWikiLinkPicker && (
        <>
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setShowWikiLinkPicker(false)}
          />
          <div
            className="absolute bottom-12 left-4 z-50 w-72 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 animate-in fade-in zoom-in-95 duration-150"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-amber-600" />
                <span>插入或新建双链 [[...]]</span>
              </span>
              <button
                type="button"
                onClick={() => setShowWikiLinkPicker(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={wikiSearch}
                onChange={(e) => setWikiSearch(e.target.value)}
                placeholder="搜索已有笔记或直接输入新建..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-100 rounded-xl border border-transparent focus:border-amber-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1">
              {availableNotes
                .filter((n) => n.title.toLowerCase().includes(wikiSearch.toLowerCase()))
                .slice(0, 10)
                .map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => applyWikiLink(n.title)}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-100 text-xs text-slate-800 flex items-center justify-between group transition cursor-pointer"
                  >
                    <span className="truncate">{n.title}</span>
                    <Check className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-emerald-600 shrink-0" />
                  </button>
                ))}

              {wikiSearch.trim() &&
                !availableNotes.some(
                  (n) => n.title.toLowerCase() === wikiSearch.trim().toLowerCase()
                ) && (
                  <button
                    type="button"
                    onClick={() => applyWikiLink(wikiSearch.trim())}
                    className="w-full text-left px-2.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-xs text-amber-900 font-medium flex items-center gap-1.5 transition cursor-pointer border border-amber-200/60"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span className="truncate">创建双链：[[{wikiSearch.trim()}]]</span>
                  </button>
                )}

              {availableNotes.length === 0 && !wikiSearch.trim() && (
                <div className="py-3 text-center text-xs text-slate-400">
                  输入名称可直接生成双链，如 [[核心名词]]
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 2. Highlight Color Picker Popover */}
      {showHighlightPicker && (
        <>
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setShowHighlightPicker(false)}
          />
          <div
            className="absolute bottom-12 left-16 sm:left-32 z-50 w-60 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 animate-in fade-in zoom-in-95 duration-150"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1 mb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Highlighter className="w-3.5 h-3.5 text-yellow-600" />
                <span>选择文本背景高亮</span>
              </span>
              <button
                type="button"
                onClick={() => setShowHighlightPicker(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 mb-2.5">
              {HIGHLIGHT_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() => applyHighlightColor(preset.color)}
                  className="h-8 rounded-xl border border-slate-200/80 hover:scale-105 active:scale-95 transition flex items-center justify-center text-[11px] font-semibold text-slate-800 shadow-2xs cursor-pointer"
                  style={{ backgroundColor: preset.color }}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">自定义高亮</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={customHighlightColor}
                  onChange={(e) => setCustomHighlightColor(e.target.value)}
                  className="w-7 h-7 rounded-lg cursor-pointer border-0"
                />
                <button
                  type="button"
                  onClick={() => applyHighlightColor(customHighlightColor)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-white text-xs font-medium hover:bg-slate-700 transition cursor-pointer"
                >
                  应用
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 3. Text Color Picker Popover */}
      {showTextColorPicker && (
        <>
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setShowTextColorPicker(false)}
          />
          <div
            className="absolute bottom-12 left-28 sm:left-48 z-50 w-60 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 animate-in fade-in zoom-in-95 duration-150"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1 mb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-blue-600" />
                <span>选择文字字体颜色</span>
              </span>
              <button
                type="button"
                onClick={() => setShowTextColorPicker(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 mb-2.5">
              {TEXT_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() => applyTextColor(preset.color)}
                  className="h-8 rounded-xl border border-slate-200 bg-white hover:scale-105 active:scale-95 transition flex items-center justify-center text-[11px] font-bold shadow-2xs cursor-pointer"
                  style={{ color: preset.color }}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">自定义色值</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={customTextColor}
                  onChange={(e) => setCustomTextColor(e.target.value)}
                  className="w-7 h-7 rounded-lg cursor-pointer border-0"
                />
                <button
                  type="button"
                  onClick={() => applyTextColor(customTextColor)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-white text-xs font-medium hover:bg-slate-700 transition cursor-pointer"
                >
                  应用
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 
        Scrollable Toolbar Actions Track (prevent textarea blur on mousedown)
      */}
      <div className="px-2 sm:px-4 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar select-none">
        {/* Headings */}
        <div className="flex items-center bg-slate-100 rounded-xl p-0.5 text-xs font-bold text-slate-700 shrink-0">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertHeading(1)}
            className="px-2 py-1 rounded-lg hover:bg-white transition cursor-pointer"
            title="一级标题 H1"
          >
            H1
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertHeading(2)}
            className="px-2 py-1 rounded-lg hover:bg-white transition cursor-pointer"
            title="二级标题 H2"
          >
            H2
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertHeading(3)}
            className="px-2 py-1 rounded-lg hover:bg-white transition cursor-pointer"
            title="三级标题 H3"
          >
            H3
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertHeading(4)}
            className="px-2 py-1 rounded-lg hover:bg-white transition cursor-pointer"
            title="四级标题 H4"
          >
            H4
          </button>
        </div>

        {/* Separator */}
        <div className="w-[1px] h-5 bg-slate-200 mx-0.5 shrink-0" />

        {/* Bold, Italic, Strikethrough */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertFormatting('**', '**', '粗体文本')}
          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition cursor-pointer shrink-0"
          title="加粗 (Ctrl+B / **)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertFormatting('*', '*', '斜体文本')}
          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition cursor-pointer shrink-0"
          title="斜体 (*)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertFormatting('~~', '~~', '删除线文本')}
          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition cursor-pointer shrink-0"
          title="删除线 (~~)"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        {/* Quote & Code Block */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertFormatting('\n> ', '', '引用文句...')}
          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition cursor-pointer shrink-0"
          title="引用 (>)"
        >
          <Quote className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertFormatting('\n```\n', '\n```\n', '代码或长文本')}
          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition cursor-pointer shrink-0"
          title="代码块 (```)"
        >
          <Code className="w-4 h-4" />
        </button>

        {/* Lists */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertFormatting('\n- ', '', '无序列表项')}
          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition cursor-pointer shrink-0"
          title="无序列表 (-)"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertFormatting('\n1. ', '', '有序列表项')}
          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition cursor-pointer shrink-0"
          title="有序列表 (1.)"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        {/* Separator */}
        <div className="w-[1px] h-5 bg-slate-200 mx-0.5 shrink-0" />

        {/* [[双链]] Picker Toggle */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            saveCurrentSelection();
          }}
          onClick={() => {
            setShowWikiLinkPicker(!showWikiLinkPicker);
            setShowHighlightPicker(false);
            setShowTextColorPicker(false);
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border transition cursor-pointer shadow-xs shrink-0 ${
            showWikiLinkPicker
              ? 'bg-amber-100 text-amber-950 border-amber-400'
              : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
          }`}
          title="插入 [[双向链接]]"
        >
          <LinkIcon className="w-3.5 h-3.5 text-amber-700" />
          <span>[[双链]]</span>
        </button>

        {/* Multi-Color Background Highlight Toggle */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            saveCurrentSelection();
          }}
          onClick={() => {
            setShowHighlightPicker(!showHighlightPicker);
            setShowTextColorPicker(false);
            setShowWikiLinkPicker(false);
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border transition cursor-pointer shadow-xs shrink-0 ${
            showHighlightPicker
              ? 'bg-yellow-100 text-yellow-950 border-yellow-400'
              : 'bg-yellow-50 hover:bg-yellow-100 text-yellow-900 border-yellow-200'
          }`}
          title="文本背景高亮换色"
        >
          <Highlighter className="w-3.5 h-3.5 text-yellow-700" />
          <span>高亮背景</span>
        </button>

        {/* Text Font Color Picker Toggle */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            saveCurrentSelection();
          }}
          onClick={() => {
            setShowTextColorPicker(!showTextColorPicker);
            setShowHighlightPicker(false);
            setShowWikiLinkPicker(false);
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border transition cursor-pointer shadow-xs shrink-0 ${
            showTextColorPicker
              ? 'bg-blue-100 text-blue-950 border-blue-400'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200'
          }`}
          title="自定义文字颜色"
        >
          <Palette className="w-3.5 h-3.5 text-blue-700" />
          <span>文字颜色</span>
        </button>
      </div>
    </div>
  );
};
