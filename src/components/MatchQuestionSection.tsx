import React, { useState } from 'react';
import type { Question } from '../types';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, HelpCircle, Check, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';

interface MatchQuestionSectionProps {
  questions: Question[];
  isSubmitted: boolean;
  onAnswerSelected: (questionId: string, paragraphLetter: string) => void;
  onSubmit: () => void;
  onReset?: () => void;
  availableParagraphs?: string[];
}

export const MatchQuestionSection: React.FC<MatchQuestionSectionProps> = ({
  questions,
  isSubmitted,
  onAnswerSelected,
  onSubmit,
  onReset,
  availableParagraphs = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'],
}) => {
  // Track which question has its paragraph picker open
  const [openPickerQId, setOpenPickerQId] = useState<string | null>(null);
  const [showExplanations, setShowExplanations] = useState<Record<string, boolean>>({});

  const answeredCount = questions.filter((q) => Boolean(q.userAnswer)).length;
  const correctCount = questions.filter(
    (q) => q.userAnswer?.toUpperCase() === q.answer.toUpperCase()
  ).length;

  const handleSelectParagraph = (questionId: string, letter: string) => {
    if (isSubmitted) return;
    onAnswerSelected(questionId, letter);
    setOpenPickerQId(null);
  };

  const handleClearAnswer = (questionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSubmitted) return;
    onAnswerSelected(questionId, '');
    setOpenPickerQId(null);
  };

  const toggleExplanation = (qId: string) => {
    setShowExplanations((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleSubmit = () => {
    onSubmit();
    if (correctCount >= questions.length * 0.8 && questions.length > 0) {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
      } catch {
        // Safe fallback
      }
    }
  };

  // Determine all paragraph letters from questions options or default
  const paragraphLetters =
    questions[0]?.options && questions[0].options.length > 0
      ? questions[0].options
      : availableParagraphs;

  return (
    <div className="w-full flex flex-col bg-white">
      {/* Top sticky action and progress bar */}
      <div className="px-4 py-3 bg-[#F8FAFC] border-b border-slate-200 sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2C4056]" />
            <span className="text-xs font-semibold text-[#2C4056]">
              段落匹配进度
            </span>
          </div>
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-[#E2EBF2] text-[#2C4056]">
            {answeredCount} / {questions.length} 已答
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
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              title="清空所有选项"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重置</span>
            </button>
          )}

          {!isSubmitted ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={answeredCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#2C4056] hover:bg-[#1E2D3D] disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <span>提交批阅</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 px-3 py-1 bg-[#2C4056] hover:bg-[#1E2D3D] text-white text-xs font-medium rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <span>重新做题</span>
            </button>
          )}
        </div>
      </div>

      {/* Questions Vertical List */}
      <div className="divide-y divide-slate-100">
        {questions.map((question, idx) => {
          const isAnswered = Boolean(question.userAnswer);
          const isCorrect =
            isSubmitted &&
            question.userAnswer?.toUpperCase() === question.answer.toUpperCase();
          const isOpen = openPickerQId === question.id;
          const isExpOpen = Boolean(showExplanations[question.id]);

          return (
            <div
              key={question.id}
              id={`match-q-${question.id}`}
              className={`p-3.5 sm:p-4 transition-colors ${
                isOpen ? 'bg-slate-50/80' : 'hover:bg-slate-50/40'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#E2EBF2] text-[#2C4056]">
                    第 {question.number ? question.number : idx + 1} 题
                  </span>
                  {isAnswered && !isSubmitted && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3 text-emerald-600" /> 已匹配段落 [
                      {question.userAnswer}]
                    </span>
                  )}
                </div>

                {isSubmitted && (
                  <div className="flex items-center gap-1.5">
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 正确 (段落 [
                        {question.answer}])
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full">
                        <XCircle className="w-3.5 h-3.5" /> 错误 (你选了:{' '}
                        {question.userAnswer || '未选'}, 正确: [{question.answer}])
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Statement text */}
              <p className="text-sm leading-relaxed text-[#253447] font-normal mb-3">
                {question.content}
              </p>

              {/* Matching selector button */}
              <div className="relative flex items-center gap-3">
                <button
                  type="button"
                  disabled={isSubmitted}
                  onClick={() => setOpenPickerQId(isOpen ? null : question.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    isAnswered
                      ? 'border-[#2C4056] bg-[#E2EBF2]/80 text-[#2C4056] shadow-xs'
                      : 'border-dashed border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-100'
                  } ${isSubmitted ? 'cursor-default opacity-90' : ''}`}
                >
                  <span>
                    {isAnswered
                      ? `已选段落: 【 ${question.userAnswer} 】`
                      : '点击选择对应段落 (A - O)'}
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
                    onClick={(e) => handleClearAnswer(question.id, e)}
                    className="text-[11px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    清除
                  </button>
                )}

                {/* Dropdown / Grid Popover */}
                {isOpen && !isSubmitted && (
                  <div className="absolute left-0 top-full mt-2 w-full max-w-md p-3 bg-white rounded-xl shadow-lg border border-slate-200 z-30 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-slate-500">
                        选择对应的文章段落字母：
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenPickerQId(null)}
                        className="text-[11px] text-slate-400 hover:text-slate-600"
                      >
                        关闭
                      </button>
                    </div>

                    <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5">
                      {paragraphLetters.map((pLetter) => {
                        const isSelected =
                          question.userAnswer?.toUpperCase() ===
                          pLetter.toUpperCase();

                        return (
                          <button
                            key={pLetter}
                            type="button"
                            onClick={() =>
                              handleSelectParagraph(question.id, pLetter)
                            }
                            className={`h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#2C4056] text-white ring-2 ring-[#2C4056] ring-offset-1 shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {pLetter}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Explanation Section */}
              {question.explanation && (
                <div className="mt-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => toggleExplanation(question.id)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-[#5E7080] hover:text-[#2C4056] cursor-pointer transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{isExpOpen ? '收起定位解析' : '查看定位与解析'}</span>
                    {isExpOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {isExpOpen && (
                    <div className="mt-2 p-2.5 rounded-lg bg-[#F0F4F8] text-xs leading-relaxed text-[#36404B] border border-slate-200 animate-in fade-in duration-150">
                      <span className="font-semibold text-[#2C4056] block mb-1">
                        💡 段落定位与命题逻辑：
                      </span>
                      {question.explanation}
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
