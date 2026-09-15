import React from 'react';
import { Sparkles, FileText, Copy, Check } from 'lucide-react';
import type { TextSelectionInfo } from '../types';

interface TextSelectionPopoverProps {
  selectionInfo: TextSelectionInfo | null;
  onAiAnalyze: (text: string) => void;
  onAddHighlight: (bgColor: string, textColor: string) => void;
  onCreateNoteFromSelection: (text: string, startPos: number, endPos: number) => void;
  onClose: () => void;
}

const HIGHLIGHT_PRESETS = [
  { label: '鹅黄', bg: '#FEF08A', text: '#1E293B' },
  { label: '浅绿', bg: '#BBF7D0', text: '#14532D' },
  { label: '海蓝', bg: '#BAE6FD', text: '#0369A1' },
  { label: '粉桃', bg: '#FECDD3', text: '#881337' },
  { label: '淡紫', bg: '#DDD6FE', text: '#4C1D95' },
];

export const TextSelectionPopover: React.FC<TextSelectionPopoverProps> = ({
  selectionInfo,
  onAiAnalyze,
  onAddHighlight,
  onCreateNoteFromSelection,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!selectionInfo || !selectionInfo.rect || !selectionInfo.text.trim()) {
    return null;
  }

  const rect = selectionInfo.rect;
  // Position above or below selection, clamped within screen
  const isNearTop = rect.top < 90;
  const topPos = isNearTop ? rect.bottom + 10 : Math.max(56, rect.top - 52);
  const popoverWidth = Math.min(typeof window !== 'undefined' ? window.innerWidth - 24 : 340, 350);
  const idealLeft = rect.left + rect.width / 2 - popoverWidth / 2;
  const maxLeft = typeof window !== 'undefined' ? window.innerWidth - popoverWidth - 12 : 200;
  const leftPos = Math.max(12, Math.min(maxLeft, idealLeft));

  const handleCopy = () => {
    navigator.clipboard.writeText(selectionInfo.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: `${topPos}px`,
        left: `${leftPos}px`,
        zIndex: 9999,
        maxWidth: 'calc(100vw - 24px)',
      }}
      className="bg-[#2C4056] text-white rounded-2xl shadow-xl border border-white/10 px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 animate-in fade-in zoom-in-95 duration-150 select-none overflow-x-auto"
    >
      {/* AI Parse Button */}
      <button
        type="button"
        onClick={() => {
          onAiAnalyze(selectionInfo.text);
          onClose();
        }}
        className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 text-[#1E293B] font-semibold text-xs hover:brightness-105 active:scale-95 transition cursor-pointer shadow-xs whitespace-nowrap shrink-0"
        title="调用大模型解析长难句、语法主干与四六级考点搭配"
      >
        <Sparkles className="w-3.5 h-3.5 fill-amber-700 text-amber-700 shrink-0" />
        <span className="hidden xs:inline">AI解析句型&搭配</span>
        <span className="xs:hidden">AI解析</span>
      </button>

      {/* Vertical separator */}
      <div className="w-[1px] h-4 bg-white/20 shrink-0" />

      {/* Highlighter colors */}
      <div className="flex items-center gap-1 shrink-0">
        {HIGHLIGHT_PRESETS.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              onAddHighlight(preset.bg, preset.text);
              onClose();
            }}
            title={`标记高亮 (${preset.label})`}
            className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-white/40 hover:scale-120 active:scale-95 transition cursor-pointer shrink-0"
            style={{ backgroundColor: preset.bg }}
          />
        ))}
      </div>

      {/* Vertical separator */}
      <div className="w-[1px] h-4 bg-white/20 shrink-0" />

      {/* Note Link button */}
      <button
        type="button"
        onClick={() => {
          onCreateNoteFromSelection(selectionInfo.text, selectionInfo.startPos, selectionInfo.endPos);
          onClose();
        }}
        className="p-1 sm:p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition cursor-pointer shrink-0"
        title="绑定此段落到双链笔记"
      >
        <FileText className="w-3.5 h-3.5" />
      </button>

      {/* Copy */}
      <button
        type="button"
        onClick={handleCopy}
        className="p-1 sm:p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition cursor-pointer shrink-0"
        title="复制选中文字"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};
