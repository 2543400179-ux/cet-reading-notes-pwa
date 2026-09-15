import React, { useState } from 'react';
import type { Question } from '../types';
import { CheckCircle2, XCircle, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cleanOptionText, extractOptionLetter } from '../utils/mdParser';

interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
  isSubmitted?: boolean;
  onAnswerSelected: (questionId: string, optionLetter: string) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  total,
  isSubmitted = false,
  onAnswerSelected,
}) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const selectedLetter = question.userAnswer;
  const isAnswered = Boolean(selectedLetter);
  const isCorrect = selectedLetter === question.answer;

  const handleSelectOption = (opt: string) => {
    if (isSubmitted) return;
    const letter = extractOptionLetter(opt);
    // Instantaneous single-click answer selection
    onAnswerSelected(question.id, letter);
  };

  return (
    <div
      id={`question-card-${question.id}`}
      data-question-index={index}
      className="w-full bg-white p-3 sm:p-4 border-b border-slate-200/80 last:border-b-0 transition-all select-text"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E2EBF2] text-[#2C4056]">
            第 {question.number ? question.number : index + 1} 题
          </span>
          <span className="text-[11px] text-slate-400">
            ({index + 1}/{total})
          </span>
        </div>
        {isSubmitted && isAnswered && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
              isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}
          >
            {isCorrect ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> 正确
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5" /> 正确答案: {question.answer}
              </>
            )}
          </span>
        )}
      </div>

      {/* Content */}
      <h4 className="text-[14px] sm:text-[15px] font-medium leading-relaxed text-[#253447] mb-2.5">
        {question.content}
      </h4>

      {/* Options */}
      <div className="space-y-1.5">
        {question.options.map((opt, optIdx) => {
          const letter = extractOptionLetter(opt);
          const optionContent = cleanOptionText(opt);
          const isSelected = selectedLetter === letter;
          const isTargetCorrect = isSubmitted && letter === question.answer;

          let optionStyle =
            'border-slate-200/90 bg-slate-50/60 hover:bg-slate-100/80 text-[#253447]';

          if (isSubmitted) {
            if (isTargetCorrect) {
              optionStyle = 'border-emerald-400 bg-emerald-50 text-emerald-900 font-medium';
            } else if (isSelected && !isCorrect) {
              optionStyle = 'border-rose-300 bg-rose-50 text-rose-900';
            } else if (isSelected) {
              optionStyle = 'border-[#2C4056] bg-[#E2EBF2] text-[#2C4056] font-medium';
            }
          } else if (isSelected) {
            optionStyle = 'border-[#2C4056] bg-[#E2EBF2] text-[#2C4056] font-medium shadow-xs';
          }

          return (
            <button
              key={optIdx}
              type="button"
              onClick={() => handleSelectOption(opt)}
              disabled={isSubmitted}
              className={`w-full text-left p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm transition-all flex items-start gap-3 cursor-pointer touch-manipulation active:scale-[0.995] ${optionStyle}`}
            >
              {/* Circular Letter Badge */}
              <span
                className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold transition-transform ${
                  isSelected
                    ? isSubmitted
                      ? isCorrect
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                      : 'bg-[#2C4056] text-white shadow-xs'
                    : isTargetCorrect
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-600 group-hover:border-slate-400'
                }`}
              >
                {letter}
              </span>

              {/* Clean Option Content - No extra brackets or duplicate letters */}
              <span className="pt-0.5 leading-snug flex-1 font-normal">
                {optionContent}
              </span>
            </button>
          );
        })}
      </div>

      {/* Explanation toggle */}
      {question.explanation && (
        <div className="mt-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowExplanation(!showExplanation)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-[#5E7080] hover:text-[#2C4056] cursor-pointer transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showExplanation ? '收起解析' : '查看解析'}</span>
            {showExplanation ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showExplanation && (
            <div className="mt-2 p-2.5 rounded-lg bg-[#F0F4F8] text-xs leading-relaxed text-[#36404B] border border-slate-200/80 animate-in fade-in duration-200">
              <span className="font-semibold text-[#2C4056] block mb-1">💡 命题解析：</span>
              {question.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
