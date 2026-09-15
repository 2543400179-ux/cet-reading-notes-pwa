import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import type {
  ReadingMaterial,
  Question,
  Highlight,
  ViewMode,
  TextSelectionInfo,
  Note,
} from '../types';
import { db } from '../db/database';
import { QuestionCard } from './QuestionCard';
import { TextSelectionPopover } from './TextSelectionPopover';
import { segmentTextWithHighlights, getSelectionCharOffsets } from '../utils/highlightHelper';
import { MarkdownEditorToolbar } from './MarkdownEditorToolbar';
import { MatchQuestionSection } from './MatchQuestionSection';
import { ClozeQuestionSection } from './ClozeQuestionSection';
import { ClozeBlankInline } from './ClozeBlankInline';
import { RichTextEditor } from './RichTextEditor';
import {
  BookOpen,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Trash2,
  Upload,
  ListOrdered,
  Pencil,
  Folder,
} from 'lucide-react';

interface ReadingViewProps {
  viewMode?: ViewMode;
  onAiAnalyze: (text: string, contextSnippet: string) => void;
  onCreateNoteWithAnchor: (
    snippet: string,
    materialId: string,
    startPos: number,
    endPos: number
  ) => void;
  targetAnchorPos?: number | null;
  targetMaterialIdProp?: string | null;
  onOpenDirectory?: () => void;
  onSelectMaterialId?: (id: string) => void;
}

export const ReadingView: React.FC<ReadingViewProps> = ({
  onAiAnalyze,
  onCreateNoteWithAnchor,
  targetAnchorPos,
  targetMaterialIdProp,
  onOpenDirectory,
  onSelectMaterialId,
}) => {
  const [materials, setMaterials] = useState<ReadingMaterial[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [currentMaterial, setCurrentMaterial] = useState<ReadingMaterial | null>(null);
  const [isLoadingMaterial, setIsLoadingMaterial] = useState<boolean>(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  // Submission state for current material
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [currentScore, setCurrentScore] = useState<{ correct: number; total: number } | null>(null);

  // Book mode (read-only, text selection for AI analysis) vs Pencil mode (in-place editable text)
  const [readEditMode, setReadEditMode] = useState<'book' | 'pencil'>('book');

  // Text selection state
  const [selectionInfo, setSelectionInfo] = useState<TextSelectionInfo | null>(null);

  // Active clicked highlight for management
  const [activeHighlight, setActiveHighlight] = useState<Highlight | null>(null);

  // Floating Sheet state
  const [sheetHeight, setSheetHeight] = useState<number>(() =>
    typeof window !== 'undefined'
      ? Math.min(460, Math.round(window.innerHeight * 0.55))
      : 380
  );
  const [isSheetCollapsed, setIsSheetCollapsed] = useState<boolean>(false);
  const isDraggingSheet = useRef<boolean>(false);
  const startDragY = useRef<number>(0);
  const startDragHeight = useRef<number>(0);

  // Question panel scroll position memory keyed by materialId
  const questionScrollPosMap = useRef<Record<string, number>>({});
  const questionContainerRef = useRef<HTMLDivElement>(null);

  // Passage container ref for selection calculation & scrolling
  const passageRef = useRef<HTMLDivElement>(null);
  const passageScrollRef = useRef<HTMLDivElement>(null);
  const savedPassageScrollTopRef = useRef<number>(0);
  const materialTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [availableNotes, setAvailableNotes] = useState<Note[]>([]);

  // Load available notes for wiki-link suggestions
  useEffect(() => {
    db.notes.toArray().then(setAvailableNotes).catch(console.error);
  }, []);

  // Mode switcher that preserves scroll position
  const handleToggleReadEditMode = (mode: 'book' | 'pencil') => {
    if (passageScrollRef.current) {
      savedPassageScrollTopRef.current = passageScrollRef.current.scrollTop;
    }
    setReadEditMode(mode);
  };

  // Restore scroll position immediately upon switching mode so user stays where they clicked
  useLayoutEffect(() => {
    if (passageScrollRef.current && savedPassageScrollTopRef.current > 0) {
      passageScrollRef.current.scrollTop = savedPassageScrollTopRef.current;
    }
  }, [readEditMode]);

  // Load materials on mount & listen to import updates
  useEffect(() => {
    loadMaterials();

    const onMaterialsUpdated = (e: any) => {
      const firstId = e?.detail?.firstMaterialId;
      loadMaterials(firstId || undefined);
    };

    window.addEventListener('materials-updated', onMaterialsUpdated);
    return () => window.removeEventListener('materials-updated', onMaterialsUpdated);
  }, []);

  // When targetMaterialIdProp changes from directory tree or reverse jump
  useEffect(() => {
    if (targetMaterialIdProp && targetMaterialIdProp !== selectedMaterialId) {
      setSelectedMaterialId(targetMaterialIdProp);
    }
  }, [targetMaterialIdProp]);

  // When targetAnchorPos is provided, scroll to that position smoothly
  useEffect(() => {
    if (targetAnchorPos !== undefined && targetAnchorPos !== null && passageRef.current) {
      setTimeout(() => {
        const anchorEl = document.getElementById(`anchor-pos-${targetAnchorPos}`);
        if (anchorEl) {
          anchorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          anchorEl.classList.add('ring-2', 'ring-amber-400', 'transition-all');
          setTimeout(() => {
            anchorEl.classList.remove('ring-2', 'ring-amber-400');
          }, 2500);
        }
      }, 200);
    }
  }, [targetAnchorPos, selectedMaterialId]);

  // Instantly load material, questions & highlights when selectedMaterialId changes
  useEffect(() => {
    if (selectedMaterialId) {
      loadMaterialAndDetails(selectedMaterialId);
      setIsSubmitted(false);
      setCurrentScore(null);
    }
  }, [selectedMaterialId]);

  // Restore question container scroll position when material or collapsed state changes
  useEffect(() => {
    if (!isSheetCollapsed && selectedMaterialId && questionContainerRef.current) {
      const savedScroll = questionScrollPosMap.current[selectedMaterialId] || 0;
      requestAnimationFrame(() => {
        if (questionContainerRef.current) {
          questionContainerRef.current.scrollTop = savedScroll;
        }
      });
    }
  }, [selectedMaterialId, isSheetCollapsed, questions]);

  const loadMaterialAndDetails = async (matId: string) => {
    setIsLoadingMaterial(true);
    try {
      // Direct IndexedDB get takes < 2ms
      const mat = await db.readingMaterials.get(matId);
      if (mat) {
        setCurrentMaterial(mat);
      } else {
        // Fallback: refresh all materials
        const all = await db.readingMaterials.reverse().sortBy('createTime');
        setMaterials(all);
        const found = all.find((m) => m.id === matId);
        if (found) setCurrentMaterial(found);
      }

      // Concurrently load questions and highlights
      const [qs, hls] = await Promise.all([
        db.questions.where('materialId').equals(matId).toArray(),
        db.highlights.where('materialId').equals(matId).toArray(),
      ]);
      setQuestions(qs);
      setHighlights(hls);
    } catch (err) {
      console.error('Failed to load material details:', err);
    } finally {
      setIsLoadingMaterial(false);
    }
  };

  const loadMaterials = async (preferredId?: string) => {
    const all = await db.readingMaterials.reverse().sortBy('createTime');
    setMaterials(all);
    if (preferredId) {
      setSelectedMaterialId(preferredId);
    } else if (all.length > 0 && !selectedMaterialId) {
      setSelectedMaterialId(all[0].id);
    }
  };

  // Directly update Markdown content in Pencil mode
  const handleUpdateMaterialContent = async (newContent: string) => {
    if (!currentMaterial) return;
    const updated = { ...currentMaterial, markdownContent: newContent };
    setCurrentMaterial(updated);
    await db.readingMaterials.put(updated);
    setMaterials((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  // Handle Answer Selection
  const handleAnswerSelected = async (questionId: string, optionLetter: string) => {
    const targetQ = questions.find((q) => q.id === questionId);
    if (!targetQ) return;

    const updated = { ...targetQ, userAnswer: optionLetter };
    await db.questions.put(updated);
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? updated : q)));
  };

  // Record scrolling in question panel for state memory
  const handleQuestionScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (selectedMaterialId) {
      questionScrollPosMap.current[selectedMaterialId] = e.currentTarget.scrollTop;
    }
  };

  // Text selection handler
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !passageRef.current) {
      setSelectionInfo(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      setSelectionInfo(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!passageRef.current.contains(range.commonAncestorContainer)) {
      setSelectionInfo(null);
      return;
    }

    const offsets = getSelectionCharOffsets(passageRef.current, range);
    if (!offsets) return;

    const rect = range.getBoundingClientRect();
    setSelectionInfo({
      text,
      startPos: offsets.start,
      endPos: offsets.end,
      rect: {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      },
    });
  };

  // Add Highlight
  const handleAddHighlight = async (bgColor: string, textColor: string) => {
    if (!selectionInfo || !selectedMaterialId) return;

    const newHl: Highlight = {
      id: `hl-${Date.now()}`,
      materialId: selectedMaterialId,
      startPos: selectionInfo.startPos,
      endPos: selectionInfo.endPos,
      bgColor,
      textColor,
      text: selectionInfo.text,
    };

    await db.highlights.add(newHl);
    setHighlights((prev) => [...prev, newHl]);
    setSelectionInfo(null);
    window.getSelection()?.removeAllRanges();
  };

  // Delete Highlight
  const handleDeleteHighlight = async (hlId: string) => {
    await db.highlights.delete(hlId);
    setHighlights((prev) => prev.filter((h) => h.id !== hlId));
    setActiveHighlight(null);
  };

  // Change Highlight Color
  const handleChangeHighlightColor = async (
    hl: Highlight,
    bgColor: string,
    textColor: string
  ) => {
    const updated = { ...hl, bgColor, textColor };
    await db.highlights.put(updated);
    setHighlights((prev) => prev.map((h) => (h.id === hl.id ? updated : h)));
    setActiveHighlight(updated);
  };

  // Floating Sheet Drag Handlers
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    isDraggingSheet.current = true;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startDragY.current = clientY;
    startDragHeight.current = sheetHeight;
  };

  const handleTouchMove = (e: TouchEvent | MouseEvent) => {
    if (!isDraggingSheet.current) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = startDragY.current - clientY;
    const newH = Math.max(100, Math.min(window.innerHeight - 80, startDragHeight.current + deltaY));
    setSheetHeight(newH);
    if (isSheetCollapsed && newH > 130) {
      setIsSheetCollapsed(false);
    }
  };

  const handleTouchEnd = () => {
    isDraggingSheet.current = false;
  };

  useEffect(() => {
    const onMove = (e: TouchEvent | MouseEvent) => handleTouchMove(e);
    const onEnd = () => handleTouchEnd();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [sheetHeight, isSheetCollapsed]);

  // Questions answered count
  const handleSubmitAnswers = async () => {
    if (!currentMaterial) return;

    const correctCount = questions.filter((q) => q.userAnswer === q.answer).length;
    const totalCount = questions.length;

    if (correctCount === totalCount && totalCount > 0) {
      try {
        const confetti = (await import('canvas-confetti')).default;
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#4C6378', '#7E93A4', '#FEF08A', '#BBF7D0'],
        });
      } catch {
        // Fallback
      }
    }

    const newRecord = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      correctCount,
      totalCount,
    };

    const updatedHistory = [...(currentMaterial.history || []), newRecord];
    const updatedMaterial = { ...currentMaterial, history: updatedHistory };

    await db.readingMaterials.put(updatedMaterial);
    setMaterials((prev) => prev.map((m) => (m.id === updatedMaterial.id ? updatedMaterial : m)));

    setIsSubmitted(true);
    setCurrentScore({ correct: correctCount, total: totalCount });
  };

  const handleClearHistory = async () => {
    if (!currentMaterial) return;
    if (confirm('确定要清除所有的练习记录吗？')) {
      const updatedMaterial = { ...currentMaterial, history: [] };
      await db.readingMaterials.put(updatedMaterial);
      setMaterials((prev) => prev.map((m) => (m.id === updatedMaterial.id ? updatedMaterial : m)));

      // Clear current user answers to reset test
      const updatedQuestions = questions.map((q) => ({ ...q, userAnswer: undefined }));
      await db.questions.bulkPut(updatedQuestions);
      setQuestions(updatedQuestions);

      setIsSubmitted(false);
      setCurrentScore(null);
    }
  };

  const readingType = questions.length > 0 ? questions[0].type || 'choice' : 'choice';

  const wordBank: import('../types').WordBankItem[] = [];
  if (readingType === 'cloze' && questions.length > 0) {
    const rawOptions = questions[0].options || [];
    rawOptions.forEach(opt => {
      const match = opt.match(/^([A-O])[\.\s]+(.*)$/i);
      if (match) {
        wordBank.push({ letter: match[1].toUpperCase(), word: match[2].trim() });
      }
    });
  }

  const renderTextWithCloze = (text: string) => {
    if (readingType !== 'cloze') return text;
    // split by [number]
    const regex = /(\[\d+\])/g;
    const parts = text.split(regex);
    return parts.map((part, index) => {
      if (part.match(/^\[\d+\]$/)) {
        const num = parseInt(part.slice(1, -1), 10);
        const question = questions.find((q) => Number(q.number) === num);
        return (
          <span key={`cloze-${index}`} id={`cloze-blank-${num}`}>
            <ClozeBlankInline
              blankNumber={num}
              question={question}
              wordBank={wordBank}
              isSubmitted={isSubmitted}
              onSelectWord={handleAnswerSelected}
              onClearWord={(qId) => handleAnswerSelected(qId, '')}
              allQuestions={questions}
            />
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const renderQuestionSection = () => {
    if (readingType === 'cloze') {
      return (
        <div className="w-full space-y-0 pb-12">
          <ClozeQuestionSection
            questions={questions}
            wordBank={wordBank}
            isSubmitted={isSubmitted}
            onAnswerSelected={handleAnswerSelected}
            onSubmit={handleSubmitAnswers}
            onReset={handleClearHistory}
            onFocusBlank={(num) => {
              const anchorEl = document.getElementById(`cloze-blank-${num}`);
              if (anchorEl) {
                anchorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                anchorEl.classList.add('ring-2', 'ring-blue-400', 'rounded-md');
                setTimeout(() => anchorEl.classList.remove('ring-2', 'ring-blue-400', 'rounded-md'), 2000);
              }
            }}
          />
        </div>
      );
    }
    
    if (readingType === 'match') {
      return (
        <div className="w-full space-y-0 pb-12">
          <MatchQuestionSection
            questions={questions}
            isSubmitted={isSubmitted}
            onAnswerSelected={handleAnswerSelected}
            onSubmit={handleSubmitAnswers}
            onReset={handleClearHistory}
          />
        </div>
      );
    }

    return (
      <div className="w-full space-y-0 pb-12">
        {questions.map((q, idx) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={idx}
            total={questions.length}
            isSubmitted={isSubmitted}
            onAnswerSelected={handleAnswerSelected}
          />
        ))}

        {questions.length > 0 && !isSubmitted && (
          <div className="flex justify-center pt-4 pb-6">
            <button
              type="button"
              onClick={handleSubmitAnswers}
              className="bg-[#2C4056] text-white px-8 py-2.5 rounded-lg text-sm font-semibold shadow-xs hover:bg-[#3D536B] transition-colors cursor-pointer"
            >
              批阅 (Submit)
            </button>
          </div>
        )}

        {isSubmitted && currentScore && (
          <div className="bg-emerald-50/90 border-y border-emerald-200 p-4 text-center space-y-1 my-3">
            <h3 className="text-emerald-900 font-bold text-sm">批阅结果</h3>
            <p className="text-emerald-700 text-2xl font-mono font-bold">
              {currentScore.correct} / {currentScore.total}
            </p>
            <p className="text-emerald-600 text-xs">
              准确率:{' '}
              {currentScore.total > 0
                ? Math.round((currentScore.correct / currentScore.total) * 100)
                : 0}
              %
            </p>
          </div>
        )}

        {/* History section */}
        {currentMaterial?.history && currentMaterial.history.length > 0 && (
          <div className="mt-4 border-t border-slate-200 pt-3 px-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-slate-600 font-bold text-xs">历史练习记录</h4>
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-[11px] text-rose-500 hover:text-rose-700 transition cursor-pointer"
              >
                清除记录
              </button>
            </div>
            <div className="space-y-1">
              {currentMaterial.history
                .slice()
                .reverse()
                .map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between bg-slate-50 rounded p-2 px-3 border border-slate-100 text-xs"
                  >
                    <span className="text-slate-500 font-mono text-[11px]">
                      {new Date(record.timestamp).toLocaleString()}
                    </span>
                    <span
                      className={`font-bold ${
                        record.correctCount === record.totalCount
                          ? 'text-emerald-600'
                          : 'text-slate-700'
                      }`}
                    >
                      {record.correctCount} / {record.totalCount}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const answeredCount = questions.filter((q) => Boolean(q.userAnswer)).length;

  // Render passage content: in-place editable textarea in Pencil mode, or readable passage in Book mode
  const renderPassageContent = () => {
    if (isLoadingMaterial) {
      return (
        <div className="space-y-4 py-4 animate-pulse">
          <div className="h-4 bg-slate-200/80 rounded w-4/5" />
          <div className="h-4 bg-slate-200/80 rounded w-full" />
          <div className="h-4 bg-slate-200/80 rounded w-11/12" />
          <div className="h-4 bg-slate-200/80 rounded w-3/4" />
          <div className="h-4 bg-slate-200/80 rounded w-5/6" />
        </div>
      );
    }

    if (!currentMaterial) {
      return (
        <div className="py-16 text-center text-slate-500">
          <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="text-xs">暂无选中的阅读材料，请从左侧目录树选择或导入材料</p>
          <button
            type="button"
            onClick={onOpenDirectory}
            className="mt-3 px-3 py-1.5 text-xs bg-[#2C4056] text-white rounded-lg hover:bg-[#3D536B] transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Folder className="w-3.5 h-3.5" />
            <span>打开左侧目录树</span>
          </button>
        </div>
      );
    }

    if (readEditMode === 'pencil') {
      return (
        <div className="w-full flex flex-col flex-1 h-full min-h-[65vh] pb-24">
          <RichTextEditor
            // Propagate markdown content cleanly to Tiptap
            content={currentMaterial.markdownContent}
            onChange={(html) => handleUpdateMaterialContent(html)}
            placeholder="在此直接原地修改富文本内容..."
            className="w-full flex-1 bg-white"
          />
        </div>
      );
    }

    const segments = segmentTextWithHighlights(
      currentMaterial.markdownContent,
      highlights
    );

    return (
      <div
        ref={passageRef}
        onMouseUp={handleTextSelection}
        onTouchEnd={handleTextSelection}
        className="font-serif-en text-[16px] sm:text-[17px] leading-[1.8] text-[#253447] w-full select-text selection:bg-[#4C6378]/25 space-y-3"
      >
        {segments.map((seg, idx) => {
          let content: React.ReactNode = null;
          
          const parts = seg.text.split('\n\n');
          if (parts.length > 1) {
            content = parts.map((part, pIdx) => (
              <React.Fragment key={`${idx}-${pIdx}`}>
                <span>{renderTextWithCloze(part)}</span>
                {pIdx < parts.length - 1 && <br className="my-2" />}
              </React.Fragment>
            ));
          } else {
            content = renderTextWithCloze(seg.text);
          }

          if (seg.highlights && seg.highlights.length > 0) {
            // Apply all highlights as nested elements
            seg.highlights.forEach((hl, i) => {
              content = (
                <mark
                  key={`hl-${hl.id}-${i}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveHighlight(hl);
                  }}
                  style={{
                    backgroundColor: hl.bgColor !== 'transparent' ? hl.bgColor : undefined,
                    color: hl.textColor !== 'inherit' ? hl.textColor : undefined,
                  }}
                  className={`rounded-xs px-0.5 py-0.5 cursor-pointer hover:opacity-90 transition-all inline relative ${i === 0 ? 'font-medium' : ''}`}
                  title="点击管理此高亮"
                >
                  {content}
                </mark>
              );
            });
            
            return (
              <span key={idx} id={`anchor-pos-${seg.startPos}`}>
                {content}
              </span>
            );
          }

          return <span key={idx} id={`anchor-pos-${seg.startPos}`}>{content}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Material Selector Subheader */}
      <div className="px-2 sm:px-4 py-1.5 bg-white/95 backdrop-blur-md border-b border-[var(--border-hairline)] flex items-center justify-between gap-1.5 shrink-0 z-10 text-xs">
        {/* Left: Material Selector */}
        <div className="flex items-center min-w-0 flex-1">
          <select
            value={selectedMaterialId}
            onChange={(e) => {
              setSelectedMaterialId(e.target.value);
              onSelectMaterialId?.(e.target.value);
            }}
            className="w-full text-xs font-serif-cn font-medium bg-[#F0F4F8] hover:bg-[#E2EBF2] text-[#253447] border border-slate-200 rounded-md py-1 px-2 outline-hidden truncate transition cursor-pointer"
          >
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.category ? `[${m.category}] ` : ''}
                {m.title}
              </option>
            ))}
          </select>
        </div>

        {/* Right: Book / Pencil Toggle Switch + Stats + Import */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Book / Pencil mode toggle */}
          <div className="flex p-0.5 bg-slate-100 rounded-md border border-slate-200/80">
            <button
              type="button"
              onClick={() => handleToggleReadEditMode('book')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${
                readEditMode === 'book'
                  ? 'bg-white text-[#2C4056] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="书本模式：只读浏览，支持划词选中文本与AI解析"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>书本</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleReadEditMode('pencil')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${
                readEditMode === 'pencil'
                  ? 'bg-white text-amber-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="铅笔模式：原地编辑Markdown原文"
            >
              <Pencil className="w-3.5 h-3.5 text-amber-600" />
              <span>铅笔</span>
            </button>
          </div>

          <span className="hidden xs:inline-block px-1.5 py-0.5 rounded bg-[#E2EBF2] text-[#2C4056] text-[11px] font-medium whitespace-nowrap">
            {answeredCount}/{questions.length} 题
          </span>
        </div>
      </div>

      {/* SINGLE VIEW MODE: Full-screen Reading Passage + Bottom Floating Sheet */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Full-screen Reading Passage (No big cards, maximum mobile area) */}
        <div ref={passageScrollRef} className="flex-1 overflow-y-auto px-2.5 sm:px-6 py-2.5 pb-28">
          <div className="w-full">
            <div className="mb-2.5 pb-2 border-b border-slate-200/80">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#E2EBF2] text-[#2C4056] font-sans font-semibold">
                  {currentMaterial?.category || 'Reading'}
                </span>
                <span className="text-[11px] text-slate-400 font-sans">
                  {readEditMode === 'pencil' ? '原地编辑 Markdown' : '划词选中文本即可解析或高亮'}
                </span>
              </div>
              <h1 className="font-serif-cn font-bold text-base sm:text-lg text-[#253447] mt-1.5 leading-snug">
                {currentMaterial?.title || (isLoadingMaterial ? '正在加载材料...' : '未选择阅读材料')}
              </h1>
            </div>

            {renderPassageContent()}
          </div>
        </div>

        {/* Floating Sheet for Questions (Flat, subtle hairline border, no thick solid line - Book Mode only) */}
        {readEditMode === 'book' && (
          <div
            style={{
              height: isSheetCollapsed ? '42px' : `${sheetHeight}px`,
              transition: isDraggingSheet.current ? 'none' : 'height 220ms ease-out',
            }}
            className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200/90 flex flex-col z-30 overflow-hidden shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
          >
            {/* Draggable Handle Header */}
            <div
              onMouseDown={handleTouchStart}
              onTouchStart={handleTouchStart}
              onClick={() => {
                if (isSheetCollapsed) {
                  setIsSheetCollapsed(false);
                  setTimeout(() => {
                    if (questionContainerRef.current && selectedMaterialId) {
                      questionContainerRef.current.scrollTop =
                        questionScrollPosMap.current[selectedMaterialId] || 0;
                    }
                  }, 50);
                }
              }}
              className="w-full pt-1.5 pb-1 px-3 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none bg-[#F8FAFC] border-b border-slate-200 shrink-0"
            >
              {/* Drag pill indicator */}
              <div className="w-8 h-1 rounded-full bg-slate-300 hover:bg-slate-400 mb-1" />

              <div className="w-full flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#253447] flex items-center gap-1 font-sans text-xs">
                    <ListOrdered className="w-3.5 h-3.5 text-[#4C6378]" />
                    <span>
                      题目面板 ({answeredCount}/{questions.length}已答)
                    </span>
                  </span>
                  {isSheetCollapsed && (
                    <span className="text-[10px] text-slate-400 font-sans">· 点击展开</span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {!isSheetCollapsed && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSheetHeight(window.innerHeight * 0.78);
                      }}
                      className="p-1 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                      title="展开大面板"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const willCollapse = !isSheetCollapsed;
                      setIsSheetCollapsed(willCollapse);
                      if (!willCollapse) {
                        setTimeout(() => {
                          if (questionContainerRef.current && selectedMaterialId) {
                            questionContainerRef.current.scrollTop =
                              questionScrollPosMap.current[selectedMaterialId] || 0;
                          }
                        }, 50);
                      }
                    }}
                    className="p-1 rounded hover:bg-slate-200 text-slate-600 font-semibold cursor-pointer"
                    title={isSheetCollapsed ? '展开面板' : '折叠面板'}
                  >
                    {isSheetCollapsed ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Independent Question Scrolling Area with Scroll Position Memory */}
            <div
              ref={questionContainerRef}
              onScroll={handleQuestionScroll}
              className={`flex-1 overflow-y-auto px-1 sm:px-3 py-1 sm:py-2 touch-pan-y ${
                isSheetCollapsed ? 'hidden' : 'block'
              }`}
            >
              <div className="w-full">
                {questions.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 font-sans">
                    暂无题目，可通过导入 Markdown 自动添加
                  </div>
                ) : (
                  renderQuestionSection()
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Text Selection Popover */}
      <TextSelectionPopover
        selectionInfo={selectionInfo}
        onAiAnalyze={(text) => {
          if (!currentMaterial) return;
          onAiAnalyze(text, currentMaterial.markdownContent.slice(0, 300));
        }}
        onAddHighlight={handleAddHighlight}
        onCreateNoteFromSelection={(text, startPos, endPos) => {
          if (!currentMaterial) return;
          onCreateNoteWithAnchor(text, currentMaterial.id, startPos, endPos);
        }}
        onClose={() => setSelectionInfo(null)}
      />

      {/* Active Highlight Management Popover */}
      {activeHighlight && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#2C4056] text-white px-3.5 py-2 rounded-lg shadow-xl flex items-center gap-2.5 animate-in fade-in zoom-in-95 text-xs">
          <span className="text-[11px] text-slate-200 font-sans">高亮色：</span>
          <div className="flex items-center gap-1.5">
            {[
              { bg: '#FEF08A', text: '#1E293B' },
              { bg: '#BBF7D0', text: '#14532D' },
              { bg: '#BAE6FD', text: '#0369A1' },
              { bg: '#FECDD3', text: '#881337' },
              { bg: '#DDD6FE', text: '#4C1D95' },
            ].map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  handleChangeHighlightColor(activeHighlight, p.bg, p.text)
                }
                className="w-4.5 h-4.5 rounded-full border border-white/40 cursor-pointer"
                style={{ backgroundColor: p.bg }}
              />
            ))}
          </div>

          <div className="w-[1px] h-3.5 bg-white/20" />

          <button
            type="button"
            onClick={() => handleDeleteHighlight(activeHighlight.id)}
            className="flex items-center gap-1 text-xs text-rose-300 hover:text-rose-100 cursor-pointer font-sans"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>删除</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveHighlight(null)}
            className="text-xs text-slate-300 hover:text-white ml-1 cursor-pointer font-sans"
          >
            关闭
          </button>
        </div>
      )}
    </div>
  );
};
// synced
