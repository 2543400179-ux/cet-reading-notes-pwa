import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Highlighter,
  Type,
  Copy,
  Check,
  X,
  FileText,
  Palette,
  ChevronDown,
} from 'lucide-react';
import { db, DEFAULT_USER_COLORS } from '../db/database';
import type { SavedColorItem, TextSelectionInfo } from '../types';
import { ColorMemoryPanel } from './ColorMemoryPanel';

interface BottomSelectionBarProps {
  selectionInfo: TextSelectionInfo | null;
  onAiAnalyze: (text: string) => void;
  onApplyHighlight: (bgColor: string, textColor: string) => void;
  onCreateNote: (text: string, startPos: number, endPos: number) => void;
  onClose: () => void;
}

export const BottomSelectionBar: React.FC<BottomSelectionBarProps> = ({
  selectionInfo,
  onAiAnalyze,
  onApplyHighlight,
  onCreateNote,
  onClose,
}) => {
  const [favoriteColors, setFavoriteColors] = useState<SavedColorItem[]>([]);
  const [activeColorMode, setActiveColorMode] = useState<'bg' | 'text'>('bg');
  const [showFullPalette, setShowFullPalette] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load colors from IndexedDB
  useEffect(() => {
    const fetchColors = async () => {
      try {
        const all = await db.userColors.toArray();
        if (all.length > 0) {
          setFavoriteColors(all.sort((a, b) => a.order - b.order));
        } else {
          setFavoriteColors(DEFAULT_USER_COLORS);
        }
      } catch {
        setFavoriteColors(DEFAULT_USER_COLORS);
      }
    };
    fetchColors();
  }, [showFullPalette]);

  if (!selectionInfo || !selectionInfo.text) {
    return null;
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(selectionInfo.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = selectionInfo.text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApplyColorDirectly = (hex: string, mode: 'bg' | 'text', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (mode === 'bg') {
      onApplyHighlight(hex, 'inherit');
    } else {
      onApplyHighlight('transparent', hex);
    }
  };

  const activeModeColors = favoriteColors
    .filter((c) => c.type === activeColorMode)
    .slice(0, 6);

  return (
    <div
      id="bottom-selection-bar"
      className="fixed bottom-3 inset-x-2.5 sm:bottom-5 sm:left-1/2 sm:-translate-x-1/2 sm:w-[540px] z-[9999] transition-all animate-in slide-in-from-bottom-5 duration-200"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Expanded Full Color Memory Panel */}
      {showFullPalette && (
        <div className="mb-2 shadow-2xl animate-in zoom-in-95 duration-150">
          <ColorMemoryPanel
            defaultTab={activeColorMode}
            onSelectColor={(hex, type) => {
              if (type === 'bg') {
                onApplyHighlight(hex, 'inherit');
              } else {
                onApplyHighlight('transparent', hex);
              }
              setShowFullPalette(false);
            }}
            onClose={() => setShowFullPalette(false)}
          />
        </div>
      )}

      {/* Main Bottom Fixed Bar Container */}
      <div className="bg-[#1E293B]/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-white/15 p-2 sm:p-2.5 flex flex-col gap-2">
        {/* Row 1: Primary Action Buttons */}
        <div className="flex items-center justify-between gap-1 sm:gap-1.5 flex-nowrap">
          {/* 1. AI 解析 (High Priority) */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAiAnalyze(selectionInfo.text);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-900 font-bold text-xs shadow-sm cursor-pointer transition active:scale-95 shrink-0"
            title="对选中文本进行AI词法与长难句深度解析"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-900" />
            <span>AI解析</span>
          </button>

          {/* 2. 背景高亮 Tab / Mode Toggle */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setActiveColorMode('bg')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition active:scale-95 ${
              activeColorMode === 'bg'
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="切换至背景高亮颜色"
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">背景高亮</span>
          </button>

          {/* 3. 文字变色 Tab / Mode Toggle */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setActiveColorMode('text')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition active:scale-95 ${
              activeColorMode === 'text'
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="切换至文字颜色"
          >
            <Type className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">文字变色</span>
          </button>

          {/* 4. 双链笔记 */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCreateNote(selectionInfo.text, selectionInfo.startPos, selectionInfo.endPos);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer transition active:scale-95 shrink-0"
            title="以此划词作为锚点创建双链笔记"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">做笔记</span>
          </button>

          {/* 5. 复制 */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCopy}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 cursor-pointer transition active:scale-95 shrink-0 flex items-center justify-center"
            title="复制选中文本"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {/* 6. 关闭 */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition active:scale-95 shrink-0"
            title="关闭操作条"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Row 2: Quick Color Chips directly on the bottom bar */}
        <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-700/60">
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-sans shrink-0">
            <span>{activeColorMode === 'bg' ? '常用高亮:' : '常用字色:'}</span>
          </div>

          {/* Color Chips (1-click application right on the bar) */}
          <div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-none flex-1 justify-center sm:justify-start">
            {activeModeColors.map((color) => (
              <button
                key={color.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => handleApplyColorDirectly(color.hex, activeColorMode, e)}
                className="w-6 h-6 rounded-full border border-white/40 shadow-xs hover:scale-120 active:scale-90 transition-transform cursor-pointer shrink-0 flex items-center justify-center relative"
                style={{
                  backgroundColor: activeColorMode === 'bg' ? color.hex : '#0F172A',
                }}
                title={`点一下立即应用：${color.label}`}
              >
                {activeColorMode === 'text' && (
                  <span className="font-bold text-[11px]" style={{ color: color.hex }}>
                    A
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Expand Full Palette / Custom Color Button */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowFullPalette(!showFullPalette)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer shrink-0 ${
              showFullPalette
                ? 'bg-amber-400 text-slate-900 font-semibold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="展开颜色记忆面板与自定义调色板"
          >
            <Palette className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">更多颜色</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform ${showFullPalette ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
