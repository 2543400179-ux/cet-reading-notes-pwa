import React, { useState, useRef, useEffect } from 'react';
import type { Question, WordBankItem } from '../types';
import { CheckCircle2, XCircle, X } from 'lucide-react';

interface ClozeBlankInlineProps {
  blankNumber: number;
  question?: Question;
  wordBank: WordBankItem[];
  isSubmitted: boolean;
  onSelectWord: (questionId: string, letter: string) => void;
  onClearWord: (questionId: string) => void;
  allQuestions: Question[];
}

export const ClozeBlankInline: React.FC<ClozeBlankInlineProps> = ({
  blankNumber,
  question,
  wordBank,
  isSubmitted,
  onSelectWord,
  onClearWord,
  allQuestions,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!question) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-xs font-bold mx-1">
        [{blankNumber}]
      </span>
    );
  }

  const selectedLetter = question.userAnswer?.toUpperCase();
  const isAnswered = Boolean(selectedLetter);
  const isCorrect =
    isSubmitted && selectedLetter === question.answer.toUpperCase();

  const currentWordItem = wordBank.find(
    (w) => w.letter.toUpperCase() === selectedLetter
  );
  const correctWordItem = wordBank.find(
    (w) => w.letter.toUpperCase() === question.answer.toUpperCase()
  );

  // Check which other questions are using words
  const usedWordMap = new Map<string, Question>();
  allQuestions.forEach((q) => {
    if (q.userAnswer) {
      usedWordMap.set(q.userAnswer.toUpperCase(), q);
    }
  });

  return (
    <span
      ref={containerRef}
      className="relative inline-block align-baseline mx-1 my-0.5 select-none"
    >
      {/* Inline Blank Trigger */}
      <button
        type="button"
        disabled={isSubmitted}
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-sans transition-all cursor-pointer ${
          isSubmitted
            ? isCorrect
              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-medium'
              : 'border-rose-400 bg-rose-50 text-rose-900'
            : isAnswered
            ? 'border-[#2C4056] bg-[#E2EBF2] text-[#2C4056] font-medium shadow-xs hover:bg-[#D5E2EC]'
            : 'border-dashed border-[#2C4056]/60 bg-[#F0F4F8] hover:border-[#2C4056] hover:bg-white text-[#2C4056]'
        }`}
      >
        {/* Blank Number Pill */}
        <span
          className={`px-1.5 py-0.2 rounded-full font-mono text-[11px] font-bold ${
            isSubmitted
              ? isCorrect
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 text-white'
              : isAnswered
              ? 'bg-[#2C4056] text-white'
              : 'bg-slate-300 text-slate-700'
          }`}
        >
          {blankNumber}
        </span>

        {/* Word Display or Empty Line */}
        {isSubmitted ? (
          isCorrect ? (
            <span className="flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{currentWordItem?.word || selectedLetter}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              <span className="line-through opacity-70">
                {currentWordItem?.word || selectedLetter || '未填'}
              </span>
              <span className="font-semibold text-emerald-700 ml-0.5">
                → {correctWordItem ? `${correctWordItem.letter}.${correctWordItem.word}` : question.answer}
              </span>
            </span>
          )
        ) : isAnswered && currentWordItem ? (
          <span className="flex items-center gap-1">
            <span className="font-semibold">{currentWordItem.word}</span>
            <span className="text-[10px] opacity-75 font-mono">
              ({currentWordItem.letter})
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onClearWord(question.id);
              }}
              className="p-0.5 rounded-full hover:bg-slate-300/60 text-slate-500 hover:text-slate-900 transition-colors ml-0.5"
              title="清除选择"
            >
              <X className="w-3 h-3" />
            </span>
          </span>
        ) : (
          <span className="font-mono text-slate-400 tracking-wider">______</span>
        )}
      </button>

      {/* Floating Popover Word Picker */}
      {isOpen && !isSubmitted && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 sm:w-80 p-3 bg-white rounded-xl shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="text-xs font-semibold text-[#2C4056]">
              为第 <span className="font-mono text-blue-600 font-bold">{blankNumber}</span> 空选择词汇：
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto p-0.5">
            {wordBank.map((item) => {
              const usingQ = usedWordMap.get(item.letter);
              const isUsedByOther = usingQ && usingQ.id !== question.id;
              const isChosen = selectedLetter === item.letter;

              return (
                <button
                  key={item.letter}
                  type="button"
                  disabled={Boolean(isUsedByOther)}
                  onClick={() => {
                    onSelectWord(question.id, item.letter);
                    setIsOpen(false);
                  }}
                  className={`p-1.5 rounded-lg flex items-center justify-between text-xs transition-all cursor-pointer ${
                    isChosen
                      ? 'bg-[#2C4056] text-white ring-1 ring-[#2C4056] shadow-xs'
                      : isUsedByOther
                      ? 'bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed'
                      : 'bg-slate-50 hover:bg-[#E2EBF2] text-slate-700 hover:text-[#2C4056] border border-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="font-mono font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center bg-black/10 shrink-0">
                      {item.letter}
                    </span>
                    <span className="truncate">{item.word}</span>
                  </span>
                  {isUsedByOther && (
                    <span className="text-[9px] text-slate-400 shrink-0">
                      填{usingQ.number}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {isAnswered && (
            <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onClearWord(question.id);
                  setIsOpen(false);
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
              >
                清除当前填词
              </button>
            </div>
          )}
        </div>
      )}
    </span>
  );
};
// synced
