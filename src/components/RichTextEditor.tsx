import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Highlight } from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Markdown } from 'tiptap-markdown';
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
  Palette,
  Highlighter,
  Undo,
  Redo,
  Quote,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  className?: string;
  placeholder?: string;
}

export function RichTextEditor({
  content,
  onChange,
  className,
  placeholder = '开始记录双链笔记...',
}: RichTextEditorProps) {
  const [activeColorModal, setActiveColorModal] = useState<'text' | 'bg' | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange((editor.storage as any).markdown.getMarkdown());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-slate max-w-none focus:outline-hidden min-h-[350px] p-4 sm:p-6 font-serif-cn leading-relaxed text-slate-800',
      },
    },
  });

  useEffect(() => {
    // Sync external content changes back into the editor (e.g., when switching notes)
    if (editor && content !== (editor.storage as any).markdown?.getMarkdown()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className={`w-full flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white ${className || ''}`}>
      {/* WYSIWYG Modern Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50/90 backdrop-blur-xs border-b border-slate-200 shrink-0 text-slate-700 select-none">
        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2 py-1 rounded-md hover:bg-slate-200 text-xs font-bold transition ${
            editor.isActive('heading', { level: 1 }) ? 'bg-slate-200 text-[#2C4056]' : 'text-slate-600'
          }`}
          title="一级标题 H1"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 rounded-md hover:bg-slate-200 text-xs font-bold transition ${
            editor.isActive('heading', { level: 2 }) ? 'bg-slate-200 text-[#2C4056]' : 'text-slate-600'
          }`}
          title="二级标题 H2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-2 py-1 rounded-md hover:bg-slate-200 text-xs font-bold transition ${
            editor.isActive('heading', { level: 3 }) ? 'bg-slate-200 text-[#2C4056]' : 'text-slate-600'
          }`}
          title="三级标题 H3"
        >
          <Heading3 className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />

        {/* Text styling */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded-md hover:bg-slate-200 transition ${
            editor.isActive('bold') ? 'bg-slate-200 text-[#2C4056]' : 'text-slate-600'
          }`}
          title="加粗 (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded-md hover:bg-slate-200 transition ${
            editor.isActive('italic') ? 'bg-slate-200 text-[#2C4056]' : 'text-slate-600'
          }`}
          title="斜体 (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded-md hover:bg-slate-200 transition ${
            editor.isActive('strike') ? 'bg-slate-200 text-[#2C4056]' : 'text-slate-600'
          }`}
          title="删除线"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded-md hover:bg-slate-200 transition ${
            editor.isActive('blockquote') ? 'bg-slate-200 text-[#2C4056]' : 'text-slate-600'
          }`}
          title="引用块"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded-md hover:bg-slate-200 transition ${
            editor.isActive('bulletList') ? 'bg-slate-200 text-[#2C4056]' : 'text-slate-600'
          }`}
          title="无序列表"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded-md hover:bg-slate-200 transition ${
            editor.isActive('orderedList') ? 'bg-slate-200 text-[#2C4056]' : 'text-slate-600'
          }`}
          title="有序列表"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />

        {/* [[WikiLink]] button */}
        <button
          type="button"
          onClick={() => {
            const selectedText = editor.state.doc.textBetween(
              editor.state.selection.from,
              editor.state.selection.to
            );
            const linkName = selectedText.trim() || '笔记名称';
            editor.chain().focus().insertContent(`[[${linkName}]]`).run();
          }}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#E2EBF2] hover:bg-[#D3E1ED] text-xs font-semibold text-[#2C4056] border border-[#BACCDD] transition cursor-pointer"
          title="插入双向笔记链接 [[...]]"
        >
          <LinkIcon className="w-3 h-3" />
          <span>[[双链]]</span>
        </button>

        <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />

        {/* Text Color with Color Memory Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setActiveColorModal((prev) => (prev === 'text' ? null : 'text'))}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
              activeColorModal === 'text' ? 'bg-slate-200' : 'hover:bg-slate-200 text-slate-700'
            }`}
            title="选择文字颜色（记忆面板）"
          >
            <Palette className="w-3.5 h-3.5 text-blue-600" />
            <span>文字色</span>
          </button>
        </div>

        {/* Background Highlight with Color Memory Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setActiveColorModal((prev) => (prev === 'bg' ? null : 'bg'))}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
              activeColorModal === 'bg' ? 'bg-slate-200' : 'hover:bg-slate-200 text-slate-700'
            }`}
            title="选择背景高亮色（记忆面板）"
          >
            <Highlighter className="w-3.5 h-3.5 text-amber-500" />
            <span>高亮色</span>
          </button>
        </div>

        {/* Quick Clear Highlight/Color */}
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().unsetHighlight().unsetColor().run();
          }}
          className="px-1.5 py-1 rounded-md hover:bg-slate-200 text-[11px] text-slate-500 hover:text-slate-800 transition"
          title="清除所选文字的颜色与高亮"
        >
          清除色彩
        </button>

        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-30 text-slate-600 transition"
            title="撤销 (Ctrl+Z)"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-30 text-slate-600 transition"
            title="重做 (Ctrl+Y)"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Embedded Color Memory Panel when opened */}
      {activeColorModal && (
        <div className="p-3 bg-slate-50 border-b border-slate-200">
          <ColorMemoryPanel
            defaultTab={activeColorModal}
            onSelectColor={(hex, type) => {
              if (type === 'text') {
                editor.chain().focus().setColor(hex).run();
              } else {
                editor.chain().focus().toggleHighlight({ color: hex }).run();
              }
              setActiveColorModal(null);
            }}
            onClose={() => setActiveColorModal(null)}
          />
        </div>
      )}

      {/* Editor Surface */}
      <div
        className="flex-1 bg-white overflow-y-auto cursor-text"
        onClick={() => editor.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
