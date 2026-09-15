import React, { useState, useEffect } from 'react';
import { db, DEFAULT_USER_COLORS } from '../db/database';
import type { SavedColorItem } from '../types';
import { Plus, Trash2, RotateCcw, Check, X, Eraser, Palette, ChevronDown, ChevronUp } from 'lucide-react';

interface ColorMemoryPanelProps {
  onSelectColor: (hex: string, type: 'bg' | 'text') => void;
  onClearColor?: () => void;
  defaultTab?: 'bg' | 'text';
  onClose?: () => void;
  className?: string;
  activeTextColor?: string | null;
  activeHighlightColor?: string | null;
}

export const ColorMemoryPanel: React.FC<ColorMemoryPanelProps> = ({
  onSelectColor,
  onClearColor,
  onClose,
  className = '',
  activeTextColor,
  activeHighlightColor,
}) => {
  const [colors, setColors] = useState<SavedColorItem[]>([]);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customType, setCustomType] = useState<'text' | 'bg'>('text');
  const [newColorHex, setNewColorHex] = useState('#2563EB');
  const [newColorLabel, setNewColorLabel] = useState('');
  const [isManageMode, setIsManageMode] = useState(false);

  const loadColors = async () => {
    try {
      const all = await db.userColors.toArray();
      if (all.length === 0) {
        await db.userColors.bulkPut(DEFAULT_USER_COLORS);
        setColors(DEFAULT_USER_COLORS);
      } else {
        setColors(all.sort((a, b) => a.order - b.order));
      }
    } catch (err) {
      console.error('Failed to load user colors:', err);
      setColors(DEFAULT_USER_COLORS);
    }
  };

  useEffect(() => {
    loadColors();
  }, []);

  const textColors = colors.filter((c) => c.type === 'text');
  const bgColors = colors.filter((c) => c.type === 'bg');

  const handleAddCustomColor = async () => {
    if (!newColorHex) return;
    const label = newColorLabel.trim() || newColorHex.toUpperCase();
    const newColor: SavedColorItem = {
      id: `custom-${customType}-${Date.now()}`,
      type: customType,
      hex: newColorHex,
      label,
      isCustom: true,
      order: (customType === 'text' ? textColors.length : bgColors.length) + 1,
    };

    await db.userColors.put(newColor);
    setNewColorLabel('');
    await loadColors();
    onSelectColor(newColorHex, customType);
    setShowCustomPicker(false);
  };

  const handleDeleteColor = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.userColors.delete(id);
    await loadColors();
  };

  const handleResetDefaults = async () => {
    if (window.confirm('确定要恢复默认预置颜色吗？自定义颜色将被清空。')) {
      await db.userColors.clear();
      await db.userColors.bulkPut(DEFAULT_USER_COLORS);
      await loadColors();
      setIsManageMode(false);
    }
  };

  return (
    <div
      className={`bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-3 flex flex-col gap-2.5 text-slate-800 select-none max-w-sm w-full ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
        <div className="flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-[#2C4056]" />
          <span className="text-xs font-bold text-slate-800">色彩记忆调色板</span>
        </div>

        <div className="flex items-center gap-1">
          {onClearColor && (
            <button
              type="button"
              onClick={onClearColor}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-slate-100 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title="清除选中文本的所有颜色与高亮"
            >
              <Eraser className="w-3 h-3" />
              <span>清除</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              title="关闭调色板"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Row 1: 文字颜色 (一排5个小色块 + 自定义色) */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-500 shrink-0 w-11">文字色</span>
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {textColors.map((color) => {
            const isCurrent = activeTextColor?.toLowerCase() === color.hex.toLowerCase();
            return (
              <div key={color.id} className="relative group">
                <button
                  type="button"
                  onClick={() => onSelectColor(color.hex, 'text')}
                  className={`w-6 h-6 rounded-full border border-black/15 shadow-2xs flex items-center justify-center transition-transform hover:scale-115 active:scale-95 cursor-pointer ${
                    isCurrent ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={`${color.label} (${color.hex})`}
                >
                  {isCurrent && (
                    <Check className="w-3 h-3 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                  )}
                </button>
                {isManageMode && color.isCustom && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteColor(color.id, e)}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs hover:bg-rose-600 transition cursor-pointer"
                    title="删除此颜色"
                  >
                    <Trash2 className="w-2 h-2" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 2: 高亮背景 (一排5个小色块 + 自定义色) */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-500 shrink-0 w-11">高亮色</span>
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {bgColors.map((color) => {
            const isCurrent = activeHighlightColor?.toLowerCase() === color.hex.toLowerCase();
            return (
              <div key={color.id} className="relative group">
                <button
                  type="button"
                  onClick={() => onSelectColor(color.hex, 'bg')}
                  className={`w-6 h-6 rounded-full border border-black/15 shadow-2xs flex items-center justify-center transition-transform hover:scale-115 active:scale-95 cursor-pointer ${
                    isCurrent ? 'ring-2 ring-amber-500 ring-offset-1' : ''
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={`${color.label} (${color.hex})`}
                >
                  {isCurrent && (
                    <Check className="w-3 h-3 text-slate-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]" />
                  )}
                </button>
                {isManageMode && color.isCustom && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteColor(color.id, e)}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs hover:bg-rose-600 transition cursor-pointer"
                    title="删除此颜色"
                  >
                    <Trash2 className="w-2 h-2" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 3: 自定义颜色切换栏 */}
      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => setShowCustomPicker(!showCustomPicker)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#2C4056] font-medium text-[11px] transition cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>自定义颜色</span>
          {showCustomPicker ? (
            <ChevronUp className="w-2.5 h-2.5 ml-0.5" />
          ) : (
            <ChevronDown className="w-2.5 h-2.5 ml-0.5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsManageMode(!isManageMode)}
          className={`text-[11px] transition cursor-pointer px-1.5 py-0.5 rounded ${
            isManageMode ? 'text-rose-600 font-bold bg-rose-50' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {isManageMode ? '完成管理' : '管理色板'}
        </button>
      </div>

      {/* Expanded Custom Color Picker */}
      {showCustomPicker && (
        <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col gap-2 animate-in fade-in-50 duration-150">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">类型:</span>
            <div className="flex p-0.5 bg-slate-200/80 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setCustomType('text')}
                className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                  customType === 'text' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                文字颜色
              </button>
              <button
                type="button"
                onClick={() => setCustomType('bg')}
                className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                  customType === 'bg' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                背景高亮
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newColorHex}
              onChange={(e) => setNewColorHex(e.target.value)}
              className="w-7 h-7 rounded-md cursor-pointer border border-slate-300 p-0.5 bg-white"
            />
            <input
              type="text"
              value={newColorHex}
              onChange={(e) => setNewColorHex(e.target.value)}
              placeholder="#HEX"
              className="w-20 px-2 py-1 text-xs bg-white border border-slate-300 rounded-md text-slate-800 font-mono"
            />
            <input
              type="text"
              value={newColorLabel}
              onChange={(e) => setNewColorLabel(e.target.value)}
              placeholder="备注标签 (可选)"
              className="flex-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded-md text-slate-800"
            />
            <button
              type="button"
              onClick={handleAddCustomColor}
              className="px-2.5 py-1 bg-[#2C4056] hover:bg-[#3D536B] text-white font-semibold text-xs rounded-md shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              保存
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>保存后将自动记忆并持久化</span>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>恢复预设</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

