import React, { useState, useEffect } from 'react';
import { Sparkles, X, Copy, Check, Plus, BookOpen, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { parseTextWithAi } from '../services/aiService';
import { db } from '../db/database';
import type { Note } from '../types';

interface AiAnalysisModalProps {
  isOpen: boolean;
  selectedText: string;
  contextSnippet: string;
  materialId?: string;
  onClose: () => void;
  onInsertToNote: (title: string, markdownSnippet: string) => void;
  onNavigateToNotes: () => void;
}

export const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({
  isOpen,
  selectedText,
  contextSnippet,
  materialId,
  onClose,
  onInsertToNote,
  onNavigateToNotes,
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inserted, setInserted] = useState(false);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [targetNoteId, setTargetNoteId] = useState<string>('new');

  useEffect(() => {
    if (isOpen && selectedText) {
      loadNotes();
      fetchAnalysis();
    } else {
      setResult('');
      setError(null);
      setInserted(false);
    }
  }, [isOpen, selectedText]);

  const loadNotes = async () => {
    try {
      const notes = await db.notes.reverse().sortBy('createTime');
      setAllNotes(notes);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const analysis = await parseTextWithAi(selectedText, contextSnippet);
      setResult(analysis);

      // Record in Dexie aiRecords
      await db.aiRecords.add({
        id: `ai-${Date.now()}`,
        sourceText: selectedText,
        result: analysis,
        createTime: Date.now(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '解析请求失败，请检查网络或 API 配置';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`> "${selectedText}"\n\n${result}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = async () => {
    const markdownToInsert = `\n\n### 📖 原文精析摘录\n> "${selectedText}"\n\n${result}\n`;

    if (targetNoteId === 'new') {
      // Create new note
      const newTitle = `AI精析：${selectedText.slice(0, 18).replace(/\n/g, ' ')}...`;
      const newNote: Note = {
        id: `note-${Date.now()}`,
        title: newTitle,
        markdownContent: `# ${newTitle}\n${markdownToInsert}`,
        createTime: Date.now(),
        materialId,
        anchorSnippet: selectedText.slice(0, 100),
      };
      await db.notes.add(newNote);
    } else {
      // Append to existing note
      const existing = await db.notes.get(targetNoteId);
      if (existing) {
        existing.markdownContent = existing.markdownContent + markdownToInsert;
        await db.notes.put(existing);
      }
    }

    setInserted(true);
    setTimeout(() => {
      onClose();
      onNavigateToNotes();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl border border-[var(--border-hairline)] overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-[16px] text-[#253447]">
                四六级考点与句型深度解析
              </h3>
              <p className="text-xs text-[#5E7080]">
                语法主干 · 高频搭配 · 考点点拨 · 语境译文
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 font-serif-cn">
          {/* Selected passage quote */}
          <div className="p-3.5 rounded-2xl bg-[#F0F4F8] border-l-4 border-[var(--color-accent)] text-sm">
            <span className="text-xs font-semibold text-[#5E7080] block mb-1 uppercase tracking-wider font-sans">
              Selected Passage
            </span>
            <p className="font-serif-en italic text-[15px] text-[#253447] leading-relaxed">
              "{selectedText}"
            </p>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-[#4C6378]" />
              <p className="text-sm font-sans animate-pulse">正在调用大模型拆解长难句与真题考点...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
              <div>
                <p className="font-medium">解析遇到问题</p>
                <p className="text-xs mt-1 text-rose-700">{error}</p>
                <button
                  onClick={fetchAnalysis}
                  className="mt-2 text-xs font-semibold underline hover:text-rose-900 cursor-pointer"
                >
                  重新尝试
                </button>
              </div>
            </div>
          )}

          {/* Analysis Markdown Result */}
          {!loading && result && (
            <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-2 text-[#253447]">
              {result.split('\n').map((line, idx) => {
                if (line.startsWith('### ')) {
                  return (
                    <h4
                      key={idx}
                      className="text-[15px] font-bold text-[#2C4056] mt-4 mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-1"
                    >
                      {line.replace('### ', '')}
                    </h4>
                  );
                }
                if (line.startsWith('- ')) {
                  return (
                    <li key={idx} className="ml-4 list-disc text-[14px]">
                      {line.replace('- ', '')}
                    </li>
                  );
                }
                if (line.startsWith('> ')) {
                  return (
                    <blockquote
                      key={idx}
                      className="border-l-2 border-amber-300 pl-3 py-1 my-2 bg-amber-50/50 rounded-r text-xs text-amber-900"
                    >
                      {line.replace('> ', '')}
                    </blockquote>
                  );
                }
                if (!line.trim()) {
                  return <div key={idx} className="h-1" />;
                }
                return (
                  <p key={idx} className="text-[14px]">
                    {line}
                  </p>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!loading && result && (
          <div className="px-5 py-3.5 border-t border-[var(--border-hairline)] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-sans">存入目标笔记：</label>
              <select
                value={targetNoteId}
                onChange={(e) => setTargetNoteId(e.target.value)}
                className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 max-w-[180px] truncate"
              >
                <option value="new">+ 新建专属双链笔记</option>
                {allNotes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '已复制' : '复制内容'}</span>
              </button>

              <button
                type="button"
                onClick={handleInsert}
                disabled={inserted}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#2C4056] hover:bg-[#3D536B] active:scale-95 text-white text-xs font-medium shadow-sm transition cursor-pointer"
              >
                {inserted ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> 已成功插入并跳转
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" /> 插入笔记
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
