import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Highlight } from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Markdown } from 'tiptap-markdown';

interface RichTextEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  className?: string;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, className, placeholder }: RichTextEditorProps) {
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
        class: 'prose prose-sm sm:prose max-w-none focus:outline-none min-h-[300px] text-slate-800 p-2',
      },
    },
  });

  useEffect(() => {
    // Sync external content changes back into the editor (e.g., when switching notes)
    if (editor && content !== (editor.storage as any).markdown.getMarkdown()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className={`w-full flex flex-col border border-slate-200 rounded-lg overflow-hidden ${className || ''}`}>
      <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 shrink-0 text-slate-700 overflow-x-auto">
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2 py-1 rounded hover:bg-slate-200 text-xs font-bold ${editor.isActive('heading', { level: 1 }) ? 'bg-slate-200' : ''}`}
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 rounded hover:bg-slate-200 text-xs font-bold ${editor.isActive('heading', { level: 2 }) ? 'bg-slate-200' : ''}`}
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-2 py-1 rounded hover:bg-slate-200 text-xs font-bold ${editor.isActive('heading', { level: 3 }) ? 'bg-slate-200' : ''}`}
        >
          H3
        </button>
        <div className="w-[1px] h-4 bg-slate-300 mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded hover:bg-slate-200 text-xs font-bold ${editor.isActive('bold') ? 'bg-slate-200' : ''}`}
        >
          粗体
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 rounded hover:bg-slate-200 text-xs italic ${editor.isActive('italic') ? 'bg-slate-200' : ''}`}
        >
          斜体
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`px-2 py-1 rounded hover:bg-slate-200 text-xs line-through ${editor.isActive('strike') ? 'bg-slate-200' : ''}`}
        >
          删除线
        </button>
        <button
          onClick={() => editor.chain().focus().insertContent('[[请输入标题]]').run()}
          className="px-2 py-1 rounded hover:bg-slate-200 text-xs font-bold text-[#4C6378]"
          title="插入双向链接"
        >
          [[双链]]
        </button>
        <div className="w-[1px] h-4 bg-slate-300 mx-1" />
        <label className="flex items-center gap-1 text-[11px] cursor-pointer">
          文字
          <input 
            type="color" 
            onInput={(e) => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()} 
            value={editor.getAttributes('textStyle').color || '#000000'}
            className="w-5 h-5 p-0 border-0 rounded cursor-pointer"
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] cursor-pointer ml-1">
          背景
          <input 
            type="color" 
            onInput={(e) => editor.chain().focus().toggleHighlight({ color: (e.target as HTMLInputElement).value }).run()} 
            className="w-5 h-5 p-0 border-0 rounded cursor-pointer"
          />
        </label>
      </div>
      <div className="flex-1 bg-white overflow-y-auto cursor-text" onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
