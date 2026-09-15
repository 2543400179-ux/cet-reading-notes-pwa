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
  Trash2,
} from 'lucide-react';
import { db, DEFAULT_USER_COLORS } from '../db/database';
import type { SavedColorItem, TextSelectionInfo } from '../types';
import { ColorMemoryPanel } from './ColorMemoryPanel';

interface BottomSelectionBarProps {
  selectionInfo: TextSelectionInfo | null;
  onAiAnalyze: (text: string) => void;
  onApplyHighlight: (updates: { bgColor?: string; textColor?: string }) => void;
  onDeleteHighlight: (startPos: number, endPos: number) => void;
  onCreateNote: (text: string, startPos: number, endPos: number) => void;
  onClose: () => void;
}

export const PRESET_BG_COLORS = [
  { hex: '#FEF08A', label: '鹅黄' },
  { hex: '#BBF7D0', label: '浅绿' },
  { hex: '#BAE6FD', label: '海蓝' },
  { hex: '#FECDD3', label: '粉桃' },
  { hex: '#FED7AA', label: '暖橙' },
  { hex: '#DDD6FE', label: '淡紫' },
];

export const PRESET_TEXT_COLORS = [
  { hex: '#EF4444', label: '红字' },
  { hex: '#2563EB', label: '蓝字' },
  { hex: '#10B981', label: '绿字' },
  { hex: '#8B5CF6', label: '紫字' },
  { hex: '#F97316', label: '橙字' },
  { hex: '#0F172A', label: '黑字' },
];

export const BottomSelectionBar: React.FC<BottomSelectionBarProps> = ({
  selectionInfo,
  onAiAnalyze,
  onApplyHighlight,
  onDeleteHighlight,
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

  // Get active 6 colors (prefer user saved, fallback to presets)
  const userModeColors = favoriteColors.filter((c) => c.type === activeColorMode);
  const currentPresets =
    userModeColors.length >= 6
      ? userModeColors.slice(0, 6)
      : activeColorMode === 'bg'
      ? PRESET_BG_COLORS
      : PRESET_TEXT_COLORS;

  return (
    <div
      id="bottom-selection-bar"
      className="fixed bottom-3 inset-x-2.5 sm:bottom-5 sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px] z-[9999] transition-all animate-in slide-in-from-bottom-4 duration-200"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Expanded Full Color Memory Panel (for custom additions) */}
      {showFullPalette && (
        <div className="mb-2 shadow-2xl animate-in zoom-in-95 duration-150">
          <ColorMemoryPanel
            defaultTab={activeColorMode}
            onSelectColor={(hex, type) => {
              if (type === 'bg') {
                onApplyHighlight({ bgColor: hex });
              } else {
                onApplyHighlight({ textColor: hex });
              }
              setShowFullPalette(false);
            }}
            onClose={() => setShowFullPalette(false)}
          />
        </div>
      )}

      {/* Main Bottom Fixed Bar Container */}
      <div className="bg-[#1E293B]/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-white/15 p-2 sm:p-2.5 flex flex-col gap-1.5">
        {/* Row 1: Primary Action Buttons */}
        <div className="flex items-center justify-between gap-1 sm:gap-1.5 flex-nowrap whitespace-nowrap overflow-x-auto scrollbar-none">
          {/* 1. AI 解析 (High Priority) */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAiAnalyze(selectionInfo.text);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-900 font-bold text-xs shadow-sm cursor-pointer transition active:scale-95 shrink-0 whitespace-nowrap"
            title="对选中文本进行AI词法与长难句深度解析"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-900 shrink-0" />
            <span>AI解析</span>
          </button>

          {/* Mode Switch: 背景高亮 vs 文字变色 */}
          <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-white/10 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setActiveColorMode('bg')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition whitespace-nowrap ${
                activeColorMode === 'bg'
                  ? 'bg-amber-400 text-slate-900 font-bold shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="切换至背景高亮"
            >
              <Highlighter className="w-3 h-3 shrink-0" />
              <span>背景高亮</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setActiveColorMode('text')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition whitespace-nowrap ${
                activeColorMode === 'text'
                  ? 'bg-amber-400 text-slate-900 font-bold shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="切换至文字变色"
            >
              <Type className="w-3 h-3 shrink-0" />
              <span>文字变色</span>
            </button>
          </div>

          {/* 做笔记 */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCreateNote(selectionInfo.text, selectionInfo.startPos, selectionInfo.endPos);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer transition active:scale-95 shrink-0 whitespace-nowrap"
            title="以此划词作为锚点创建双链笔记"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="hidden xs:inline">做笔记</span>
          </button>

          {/* 复制 */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCopy}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer transition active:scale-95 shrink-0 flex items-center justify-center whitespace-nowrap"
            title="复制选中文本"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Row 2: Pure horizontal line with: 「高亮」标签 + 6个正方形颜色块 + 删除按钮 + 关闭按钮 */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 flex-nowrap whitespace-nowrap overflow-x-auto scrollbar-none pt-1.5 border-t border-slate-700/60">
          {/* 1. 「高亮」或「字色」标签 (横排文字，点击可快捷切换) */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setActiveColorMode((m) => (m === 'bg' ? 'text' : 'bg'))}
            className="text-xs font-bold shrink-0 select-none whitespace-nowrap px-1.5 py-0.5 rounded-md bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-white/10 transition cursor-pointer flex items-center gap-1"
            title="点击切换高亮与字色模式"
            style={{ whiteSpace: 'nowrap' }}
          >
            <span style={{ whiteSpace: 'nowrap' }}>{activeColorMode === 'bg' ? '高亮' : '字色'}</span>
            <span className="text-[10px] text-slate-400">⇄</span>
          </button>

          {/* 2. 6个小正方形颜色块 (大小统一的小正方形) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {currentPresets.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (activeColorMode === 'bg') {
                    onApplyHighlight({ bgColor: item.hex });
                  } else {
                    onApplyHighlight({ textColor: item.hex });
                  }
                }}
                className="w-6 h-6 rounded-md border border-white/40 shadow-xs hover:scale-115 active:scale-90 transition-transform cursor-pointer shrink-0 flex items-center justify-center relative"
                style={{
                  backgroundColor: activeColorMode === 'bg' ? item.hex : '#0F172A',
                }}
                title={`应用${activeColorMode === 'bg' ? '背景高亮' : '文字颜色'}：${item.label}`}
              >
                {activeColorMode === 'text' && (
                  <span className="font-bold text-[11px]" style={{ color: item.hex, whiteSpace: 'nowrap' }}>
                    A
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 3. 删除按钮 (横排显示，不折行) */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDeleteHighlight(selectionInfo.startPos, selectionInfo.endPos);
            }}
            className="flex flex-row items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 active:scale-95 transition cursor-pointer shrink-0 whitespace-nowrap"
            style={{ whiteSpace: 'nowrap' }}
            title="删除所选区域的高亮与颜色"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0 text-rose-300" />
            <span style={{ whiteSpace: 'nowrap' }}>删除</span>
          </button>

          {/* 4. 关闭按钮 (横排显示，不折行) */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="flex flex-row items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 active:scale-95 transition cursor-pointer shrink-0 whitespace-nowrap"
            style={{ whiteSpace: 'nowrap' }}
            title="关闭操作条"
          >
            <X className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span style={{ whiteSpace: 'nowrap' }}>关闭</span>
          </button>

          {/* 调色板扩展 */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowFullPalette(!showFullPalette)}
            className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-amber-300 transition cursor-pointer shrink-0"
            title="展开更多自定义颜色"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
