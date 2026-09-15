import React, { useState } from 'react';
import { db } from '../db/database';
import type { ReadingMaterial, Question } from '../types';
import { Upload, X, FileText, Check, Plus, Trash2 } from 'lucide-react';

interface ImportMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMaterialImported: (materialId: string) => void;
}

export const ImportMaterialModal: React.FC<ImportMaterialModalProps> = ({
  isOpen,
  onClose,
  onMaterialImported,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'CET-4' | 'CET-6' | 'Custom'>('CET-4');
  const [content, setContent] = useState('');
  const [questions, setQuestions] = useState<
    Array<{ content: string; options: string[]; answer: string; explanation: string }>
  >([]);
  const [fileName, setFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    readFile(file);
  };

  const readFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      // Try to parse title
      const titleMatch = text.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        setTitle(titleMatch[1].trim());
      } else {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }

      // Check category in title
      if (file.name.includes('六级') || file.name.includes('CET6') || file.name.includes('CET-6')) {
        setCategory('CET-6');
      } else if (file.name.includes('四级') || file.name.includes('CET4') || file.name.includes('CET-4')) {
        setCategory('CET-4');
      }

      setContent(text);
    };
    reader.readAsText(file);
  };

  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        content: `Question ${prev.length + 1}: `,
        options: ['A. Option 1', 'B. Option 2', 'C. Option 3', 'D. Option 4'],
        answer: 'A',
        explanation: '本题答案依据及解析...',
      },
    ]);
  };

  const handleUpdateQuestion = (
    index: number,
    field: 'content' | 'answer' | 'explanation',
    val: string
  ) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: val } : q))
    );
  };

  const handleUpdateOption = (qIdx: number, optIdx: number, val: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOpts = [...q.options];
        newOpts[optIdx] = val;
        return { ...q, options: newOpts };
      })
    );
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    try {
      const materialId = `mat-${Date.now()}`;
      const newMaterial: ReadingMaterial = {
        id: materialId,
        title: title.trim(),
        markdownContent: content.trim(),
        category,
        createTime: Date.now(),
      };

      await db.readingMaterials.add(newMaterial);

      if (questions.length > 0) {
        const newQs: Question[] = questions.map((q, idx) => ({
          id: `q-${materialId}-${idx + 1}`,
          materialId,
          content: q.content,
          options: q.options,
          answer: q.answer.trim().toUpperCase(),
          explanation: q.explanation,
        }));
        await db.questions.bulkAdd(newQs);
      }

      onMaterialImported(materialId);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-[var(--border-hairline)] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E2EBF2] flex items-center justify-center text-[#2C4056]">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-[16px] text-[#253447]">
                导入本地真题 / 阅读素材 (Markdown)
              </h3>
              <p className="text-xs text-[#5E7080]">
                支持直接拖入 .md 或 .txt 文件，所有数据存储在本地 IndexedDB
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4 font-sans text-xs">
          {/* File Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-200 hover:border-[#4C6378] rounded-2xl p-5 text-center bg-slate-50/60 transition cursor-pointer relative"
          >
            <input
              type="file"
              accept=".md,.txt,.markdown"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <FileText className="w-8 h-8 mx-auto text-slate-400 mb-1.5" />
            <p className="font-semibold text-slate-700 text-sm">
              {fileName ? `已选文件：${fileName}` : '点击选择或拖曳本地 Markdown 文件到此处'}
            </p>
            <p className="text-slate-400 mt-1">支持 .md / .txt 文本格式</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-semibold text-slate-700">文章标题</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：CET-6 真题精析：Artificial Intelligence and Labor"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#4C6378] outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">考试分类</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#4C6378] outline-hidden bg-white"
              >
                <option value="CET-4">CET-4 (英语四级)</option>
                <option value="CET-6">CET-6 (英语六级)</option>
                <option value="Custom">考研/雅思/自定义</option>
              </select>
            </div>
          </div>

          {/* Reading Material Text */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700">阅读原文 Markdown 正文</label>
            <textarea
              required
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="在此粘贴阅读英文原文..."
              className="w-full px-3 py-2 font-serif-en text-xs rounded-xl border border-slate-200 focus:border-[#4C6378] outline-hidden leading-relaxed"
            />
          </div>

          {/* Optional Questions Builder */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-700">
                配套真题题目 ({questions.length})
              </span>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-[#E2EBF2] text-[#2C4056] hover:bg-[#D3E1ED] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加题目</span>
              </button>
            </div>

            {questions.map((q, qIdx) => (
              <div
                key={qIdx}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-2 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={q.content}
                    onChange={(e) => handleUpdateQuestion(qIdx, 'content', e.target.value)}
                    placeholder="题目题干..."
                    className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                  <div className="flex items-center gap-1">
                    <label className="text-[11px] text-slate-500">答案:</label>
                    <select
                      value={q.answer}
                      onChange={(e) => handleUpdateQuestion(qIdx, 'answer', e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(qIdx)}
                    className="text-rose-500 hover:text-rose-700 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {q.options.map((opt, optIdx) => (
                    <input
                      key={optIdx}
                      type="text"
                      value={opt}
                      onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                      placeholder={`选项 ${['A', 'B', 'C', 'D'][optIdx]}`}
                      className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px]"
                    />
                  ))}
                </div>

                <input
                  type="text"
                  value={q.explanation}
                  onChange={(e) => handleUpdateQuestion(qIdx, 'explanation', e.target.value)}
                  placeholder="考点解析（选填）..."
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600"
                />
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !content.trim()}
              className="px-5 py-1.5 rounded-xl bg-[#2C4056] hover:bg-[#3D536B] disabled:opacity-50 text-white font-medium text-xs shadow-sm cursor-pointer"
            >
              {isSubmitting ? '正在导入...' : '确认导入'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
