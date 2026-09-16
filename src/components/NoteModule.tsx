import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Note, ReadingMaterial } from '../types';
import { db } from '../db/database';
import { syncNoteLinks, getBacklinksForNote } from '../utils/markdownHelper';
import { MarkdownRenderer } from './MarkdownRenderer';
import { RichTextEditor } from './RichTextEditor';
import {
  FileText,
  Plus,
  Download,
  Trash2,
  ExternalLink,
  Eye,
  Edit3,
  Link as LinkIcon,
  BookOpen,
  ArrowRight,
  Folder,
} from 'lucide-react';

interface NoteModuleProps {
  onJumpToMaterial: (materialId: string, anchorStartPos?: number) => void;
  activeNoteIdProp?: string | null;
  onOpenDirectory?: () => void;
}

export const NoteModule: React.FC<NoteModuleProps> = ({
  onJumpToMaterial,
  activeNoteIdProp,
  onOpenDirectory,
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(activeNoteIdProp || null);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('edit');
  const [materials, setMaterials] = useState<Record<string, ReadingMaterial>>({});
  const [backlinks, setBacklinks] = useState<Note[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Active note
  const activeNote = notes.find((n) => n.id === activeNoteId);

  useEffect(() => {
    loadNotesAndMaterials();
  }, []);

  useEffect(() => {
    if (activeNoteIdProp) {
      setActiveNoteId(activeNoteIdProp);
    }
  }, [activeNoteIdProp]);

  useEffect(() => {
    if (activeNote) {
      loadBacklinks(activeNote.title);
    }
  }, [activeNote?.id, activeNote?.title]);

  const loadNotesAndMaterials = async () => {
    const allNotes = await db.notes.toArray();
    setNotes(allNotes.sort((a, b) => (b.createTime ?? 0) - (a.createTime ?? 0)));

    const allMats = await db.readingMaterials.toArray();
    const matMap: Record<string, ReadingMaterial> = {};
    allMats.forEach((m) => {
      matMap[m.id] = m;
    });
    setMaterials(matMap);

    if (!activeNoteId && allNotes.length > 0) {
      setActiveNoteId(allNotes[0].id);
    }
  };

  const loadBacklinks = async (title: string) => {
    try {
      const sourceNoteIds = await getBacklinksForNote(title);
      if (sourceNoteIds.length > 0) {
        const linkedNotes = await db.notes.where('id').anyOf(sourceNoteIds).toArray();
        setBacklinks(linkedNotes);
      } else {
        setBacklinks([]);
      }
    } catch {
      setBacklinks([]);
    }
  };

  const handleCreateNewNote = async () => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: '未命名双链笔记',
      markdownContent: `# 未命名双链笔记\n\n开始撰写笔记内容...\n\n你可以使用 \`[[另一篇笔记名称]]\` 创建双向内部链接。`,
      createTime: Date.now(),
    };
    await db.notes.add(newNote);
    await syncNoteLinks(newNote.id, newNote.markdownContent);
    await loadNotesAndMaterials();
    setActiveNoteId(newNote.id);
    setViewMode('edit');
  };

  const handleUpdateActiveNote = async (
    updates: Partial<Pick<Note, 'title' | 'markdownContent'>>
  ) => {
    if (!activeNote) return;
    const updated = { ...activeNote, ...updates };

    await db.notes.put(updated);
    if (updates.markdownContent !== undefined) {
      await syncNoteLinks(updated.id, updated.markdownContent);
    }

    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  const handleDeleteActiveNote = async () => {
    if (!activeNote) return;
    if (!confirm(`确定要删除笔记《${activeNote.title}》吗？`)) return;

    await db.notes.delete(activeNote.id);
    await db.noteLinks.where('sourceNoteId').equals(activeNote.id).delete();

    const remaining = notes.filter((n) => n.id !== activeNote.id);
    setNotes(remaining);
    setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
  };

  const handleExportMarkdown = () => {
    if (!activeNote) return;
    const blob = new Blob([activeNote.markdownContent], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNote.title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleWikiLinkClick = async (targetTitle: string) => {
    const target = notes.find((n) => n.title.trim().toLowerCase() === targetTitle.trim().toLowerCase());
    if (target) {
      setActiveNoteId(target.id);
    } else {
      if (confirm(`未找到笔记《${targetTitle}》，是否立即创建并打开？`)) {
        const created: Note = {
          id: `note-${Date.now()}`,
          title: targetTitle,
          markdownContent: `# ${targetTitle}\n\n此页面由双链关联自动创建。\n\n反向链接：[[${activeNote?.title || '主页'}]]\n`,
          createTime: Date.now(),
        };
        await db.notes.add(created);
        await syncNoteLinks(created.id, created.markdownContent);
        await loadNotesAndMaterials();
        setActiveNoteId(created.id);
        setViewMode('edit');
      }
    }
  };

  const knownNoteTitles = useMemo(() => notes.map((n) => n.title), [notes]);

  if (!activeNote) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-white p-6 text-center select-none">
        <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4 shadow-xs">
          <FileText className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-1">暂无选中的双链笔记</h3>
        <p className="text-xs text-slate-500 max-w-sm mb-5">
          在左侧目录树中选择笔记，或直接新建一篇双链笔记开始梳理核心考点与词汇。
        </p>
        <button
          type="button"
          onClick={handleCreateNewNote}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#2C4056] hover:bg-[#3D536B] text-white text-xs font-semibold shadow-md transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>新建双链笔记</span>
        </button>
      </div>
    );
  }

  const linkedMaterial = activeNote.materialId ? materials[activeNote.materialId] : null;

  return (
    <div className="h-full w-full flex flex-col bg-white overflow-hidden relative">
      {/* 1. Minimal Header Bar (No nested card frames, edge-to-edge) */}
      <div className="shrink-0 flex items-center justify-between px-3 sm:px-6 py-2.5 bg-white border-b border-slate-100 shadow-xs z-10">
        {/* Left: Title & Anchor Source */}
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <input
            type="text"
            value={activeNote.title}
            onChange={(e) => handleUpdateActiveNote({ title: e.target.value })}
            placeholder="笔记标题..."
            className="text-sm sm:text-base font-bold text-[#1E293B] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#4C6378] focus:outline-hidden px-1 py-0.5 transition truncate max-w-md"
          />

          {linkedMaterial && (
            <button
              type="button"
              onClick={() => onJumpToMaterial(activeNote.materialId!, activeNote.anchorStartPos)}
              className="shrink-0 hidden md:flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-medium transition cursor-pointer"
              title={`反向跳转到真题素材：《${linkedMaterial.title}》`}
            >
              <BookOpen className="w-3 h-3 text-[#4C6378]" />
              <span className="truncate max-w-[140px]">{linkedMaterial.title}</span>
              <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Right: View Mode Toggle & Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Preview / Edit Toggle */}
          <div className="flex p-0.5 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'preview'
                  ? 'bg-white text-[#2C4056] shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>预览</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'edit'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
              <span>编辑</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportMarkdown}
            title="导出 .md 文件"
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleDeleteActiveNote}
            title="删除此笔记"
            className="p-1.5 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reading anchor banner (if created from reading passage) */}
      {linkedMaterial && (
        <div className="md:hidden shrink-0 px-4 py-1 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-1.5 truncate">
            <BookOpen className="w-3.5 h-3.5 text-[#4C6378] shrink-0" />
            <span className="truncate">来自：《{linkedMaterial.title}》</span>
          </div>
          <button
            type="button"
            onClick={() => onJumpToMaterial(activeNote.materialId!, activeNote.anchorStartPos)}
            className="text-xs text-[#2C4056] font-semibold hover:underline flex items-center gap-0.5 shrink-0"
          >
            <span>定位原文</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 2. Main Full-Screen Canvas Area (No outer rounded card, max space) */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        {viewMode === 'edit' ? (
          <div className="flex-1 flex flex-col w-full h-full min-h-0">
            <RichTextEditor
              key={activeNote.id}
              content={activeNote.markdownContent}
              onChange={(mdContent) => handleUpdateActiveNote({ markdownContent: mdContent })}
              placeholder="开始使用富文本与 [[双向链接]] 记录笔记..."
              className="flex-1 w-full h-full bg-white"
              knownNoteTitles={knownNoteTitles}
              onWikiLinkClick={handleWikiLinkClick}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto w-full p-4 sm:p-8 max-w-4xl mx-auto font-serif-cn leading-relaxed pb-24">
            {/* Markdown rendered with [[WikiLinks]], Highlights, Colors */}
            <MarkdownRenderer
              content={activeNote.markdownContent}
              onWikiLinkClick={handleWikiLinkClick}
              knownNoteTitles={knownNoteTitles}
            />

            {/* Obsidian-style Backlinks Panel */}
            <div className="mt-12 pt-6 border-t border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans flex items-center gap-1.5 mb-3">
                <LinkIcon className="w-3.5 h-3.5 text-[#4C6378]" />
                <span>反向链接 (Backlinks to this note · {backlinks.length})</span>
              </h4>

              {backlinks.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  暂无其他笔记双向引用此卡片。可在其它笔记中输入 <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-700">[[{activeNote.title}]]</code> 进行网状串联。
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {backlinks.map((bn) => (
                    <button
                      key={bn.id}
                      type="button"
                      onClick={() => setActiveNoteId(bn.id)}
                      className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-[#4C6378] hover:bg-slate-50 transition cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 group-hover:text-[#2C4056]">
                        <FileText className="w-3.5 h-3.5 text-[#4C6378]" />
                        <span className="truncate">{bn.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                        {bn.markdownContent.replace(/[#*`>]/g, '').slice(0, 70)}...
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
