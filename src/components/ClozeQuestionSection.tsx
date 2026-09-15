import React, { useState } from 'react';
import type { Question, WordBankItem } from '../types';
import { CheckCircle2, XCircle, RotateCcw, ChevronDown, ChevronUp, HelpCircle, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ClozeQuestionSectionProps {
  questions: Question[];
  wordBank: WordBankItem[];
  isSubmitted: boolean;
  onAnswerSelected: (questionId: string, wordLetter: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  focusedBlankNumber?: number | null;
  onFocusBlank?: (blankNum: number) => void;
}

export const ClozeQuestionSection: React.FC<ClozeQuestionSectionProps> = ({
  questions,
  wordBank,
  isSubmitted,
  onAnswerSelected,
  onSubmit,
  onReset,
  focusedBlankNumber,
  onFocusBlank,
}) => {
  const [openSelectorQId, setOpenSelectorQId] = useState<string | null>(null);
  const [showExplanations, setShowExplanations] = useState<Record<string, boolean>>({});

  const answeredCount = questions.filter((q) => Boolean(q.userAnswer)).length;
  const correctCount = questions.filter(
    (q) => q.userAnswer?.toUpperCase() === q.answer.toUpperCase()
  ).length;

  // Map of letter -> question using it
  const usedWordMap = new Map<string, Question>();
  questions.forEach((q) => {
    if (q.userAnswer) {
      usedWordMap.set(q.userAnswer.toUpperCase(), q);
    }
  });

  const handleSelectWord = (questionId: string, letter: string) => {
    if (isSubmitted) return;
    onAnswerSelected(questionId, letter);
    setOpenSelectorQId(null);
  };

  const handleClearAnswer = (questionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isSubmitted) return;
    onAnswerSelected(questionId, '');
    setOpenSelectorQId(null);
  };

  const toggleExplanation = (qId: string) => {
    setShowExplanations((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleSubmit = () => {
    onSubmit();
    if (correctCount >= questions.length * 0.8 && questions.length > 0) {
      try {
        confetti({
          particleCount: 55,
          spread: 60,
          origin: { y: 0.7 },
        });
      } catch {
        // Safe fallback
      }
    }
  };

  return (
    <div className="w-full flex flex-col bg-white">
      {/* Top sticky action & progress bar */}
      <div className="px-4 py-3 bg-[#F8FAFC] border-b border-slate-200 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            <span className="text-xs font-semibold text-[#2C4056]">
              选词填空进度
            </span>
          </div>
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-[#E2EBF2] text-[#2C4056]">
            {answeredCount} / {questions.length} 已填
          </span>
          {isSubmitted && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                correctCount === questions.length
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              得分: {correctCount} / {questions.length} (
              {Math.round((correctCount / (questions.length || 1)) * 100)}%)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            title="清空所有已填单词"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>重置</span>
          </button>

          {!isSubmitted ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={answeredCount === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-[#2C4056] hover:bg-[#1E2D3D] disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <span>提交批阅</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-[#2C4056] hover:bg-[#1E2D3D] text-white text-xs font-medium rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <span>重新做题</span>
            </button>
          )}
        </div>
      </div>

      {/* Complete Word Bank (15 words A-O) */}
      <div className="p-3.5 sm:p-4 bg-[#F0F4F8]/70 border-b border-slate-200/90">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-semibold text-[#2C4056] flex items-center gap-1.5">
            <span>📚 备选词库 (A - O 共 {wordBank.length || 15} 词)</span>
            <span className="text-[11px] font-normal text-slate-500">
              (已被选走的词呈灰色锁定)
            </span>
          </span>
          <span className="text-[11px] text-slate-500">
            剩余可用: {(wordBank.length || 15) - answeredCount} 词
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {wordBank.map((item) => {
            const usingQuestion = usedWordMap.get(item.letter);
            const isUsed = Boolean(usingQuestion);

            return (
              <div
                key={item.letter}
                className={`p-2 rounded-lg border text-xs transition-all flex items-center justify-between gap-1.5 ${
                  isUsed
                    ? 'border-slate-200 bg-slate-100/90 text-slate-400 select-none'
                    : 'border-slate-200 bg-white hover:border-[#2C4056] hover:bg-white text-[#253447] shadow-xs cursor-pointer'
                }`}
                onClick={() => {
                  if (isSubmitted || isUsed) return;
                  // If a blank is focused or there's an active blank, assign to it
                  const targetQ = focusedBlankNumber
                    ? questions.find((q) => Number(q.number) === focusedBlankNumber)
                    : questions.find((q) => !q.userAnswer);

                  if (targetQ) {
                    handleSelectWord(targetQ.id, item.letter);
                  } else if (questions[0]) {
                    handleSelectWord(questions[0].id, item.letter);
                  }
                }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${
                      isUsed
                        ? 'bg-slate-300 text-slate-600'
                        : 'bg-[#2C4056] text-white'
                    }`}
                  >
                    {item.letter}
                  </span>
                  <span className="truncate font-medium">{item.word}</span>
                </div>

                {isUsed && usingQuestion && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 shrink-0">
                    填 {usingQuestion.number || '题'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 10 Blanks list */}
      <div className="divide-y divide-slate-100">
        {questions.map((q, idx) => {
          const blankNum = q.number ? Number(q.number) : 26 + idx;
          const isAnswered = Boolean(q.userAnswer);
          const isCorrect =
            isSubmitted &&
            q.userAnswer?.toUpperCase() === q.answer.toUpperCase();
          const isOpen = openSelectorQId === q.id;
          const isExpOpen = Boolean(showExplanations[q.id]);
          const isFocused = focusedBlankNumber === blankNum;

          // Find current assigned word object
          const currentWordItem = wordBank.find(
            (w) => w.letter.toUpperCase() === q.userAnswer?.toUpperCase()
          );
          const correctWordItem = wordBank.find(
            (w) => w.letter.toUpperCase() === q.answer.toUpperCase()
          );

          return (
            <div
              key={q.id}
              id={`cloze-q-${q.id}`}
              className={`p-3.5 sm:p-4 transition-colors ${
                isFocused
                  ? 'bg-blue-50/50 ring-1 ring-inset ring-blue-300'
                  : isOpen
                  ? 'bg-slate-50/80'
                  : 'hover:bg-slate-50/40'
              }`}
            >
              {/* Question Row Header */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onFocusBlank?.(blankNum)}
                    className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#E2EBF2] text-[#2C4056] hover:bg-[#D5E2EC] cursor-pointer"
                  >
                    第 {blankNum} 题空缺
                  </button>

                  {isAnswered && !isSubmitted && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3 text-emerald-600" /> 已填 [{q.userAnswer}
                      {currentWordItem ? `: ${currentWordItem.word}` : ''}]
                    </span>
                  )}
                </div>

                {isSubmitted && (
                  <div className="flex items-center gap-1.5">
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 正确 [
                        {q.answer}: {correctWordItem?.word}]
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full">
                        <XCircle className="w-3.5 h-3.5" /> 错误 (你的答案:{' '}
                        {q.userAnswer || '未填'}, 正确: [{q.answer}:{' '}
                        {correctWordItem?.word}])
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Blank selection control */}
              <div className="relative flex items-center gap-3">
                <button
                  type="button"
                  disabled={isSubmitted}
                  onClick={() => setOpenSelectorQId(isOpen ? null : q.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    isAnswered
                      ? 'border-[#2C4056] bg-[#E2EBF2]/90 text-[#2C4056] shadow-xs'
                      : 'border-dashed border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-100'
                  } ${isSubmitted ? 'cursor-default opacity-90' : ''}`}
                >
                  <span className="font-mono text-[11px] font-bold">
                    【 {blankNum} 】
                  </span>
                  <span>
                    {isAnswered && currentWordItem
                      ? `${currentWordItem.letter}. ${currentWordItem.word}`
                      : '点击从词库选择填入此空 (A - O)'}
                  </span>
                  {!isSubmitted && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${
                        isOpen ? 'rotate-180 text-[#2C4056]' : 'text-slate-400'
                      }`}
                    />
                  )}
                </button>

                {isAnswered && !isSubmitted && (
                  <button
                    type="button"
                    onClick={(e) => handleClearAnswer(q.id, e)}
                    className="text-[11px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    清空
                  </button>
                )}

                {/* Dropdown for selecting available word */}
                {isOpen && !isSubmitted && (
                  <div className="absolute left-0 top-full mt-2 w-full max-w-lg p-3 bg-white rounded-xl shadow-lg border border-slate-200 z-30 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-slate-500">
                        请为第 {blankNum} 空选择最合适词汇：
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenSelectorQId(null)}
                        className="text-[11px] text-slate-400 hover:text-slate-600"
                      >
                        关闭
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 max-h-56 overflow-y-auto p-0.5">
                      {wordBank.map((item) => {
                        const usingQ = usedWordMap.get(item.letter);
                        const isUsedByOther = usingQ && usingQ.id !== q.id;
                        const isCurrentlyChosen = q.userAnswer === item.letter;

                        return (
                          <button
                            key={item.letter}
                            type="button"
                            disabled={Boolean(isUsedByOther)}
                            onClick={() => handleSelectWord(q.id, item.letter)}
                            className={`p-1.5 rounded-lg flex items-center justify-between gap-1 text-xs transition-all cursor-pointer ${
                              isCurrentlyChosen
                                ? 'bg-[#2C4056] text-white ring-2 ring-[#2C4056] shadow-xs'
                                : isUsedByOther
                                ? 'bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                            }`}
                          >
                            <span className="font-mono font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center bg-black/10">
                              {item.letter}
                            </span>
                            <span className="truncate flex-1 text-left">
                              {item.word}
                            </span>
                            {isUsedByOther && (
                              <span className="text-[9px] text-slate-400 shrink-0">
                                已用
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Explanation */}
              {q.explanation && (
                <div className="mt-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => toggleExplanation(q.id)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-[#5E7080] hover:text-[#2C4056] cursor-pointer transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{isExpOpen ? '收起语法词汇解析' : '查看语法与词汇解析'}</span>
                    {isExpOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {isExpOpen && (
                    <div className="mt-2 p-2.5 rounded-lg bg-[#F0F4F8] text-xs leading-relaxed text-[#36404B] border border-slate-200 animate-in fade-in duration-150">
                      <span className="font-semibold text-[#2C4056] block mb-1">
                        💡 语法逻辑与词汇辨析：
                      </span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
