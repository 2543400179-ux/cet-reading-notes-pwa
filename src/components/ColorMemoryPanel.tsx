import React, { useState, useEffect } from 'react';
import { db, DEFAULT_USER_COLORS } from '../db/database';
import type { SavedColorItem } from '../types';
import { Plus, Trash2, RotateCcw, Check, Palette, Type, Highlighter, X } from 'lucide-react';

interface ColorMemoryPanelProps {
  onSelectColor: (hex: string, type: 'bg' | 'text') => void;
  defaultTab?: 'bg' | 'text';
  onClose?: () => void;
  className?: string;
  compact?: boolean;
}

export const ColorMemoryPanel: React.FC<ColorMemoryPanelProps> = ({
  onSelectColor,
  defaultTab = 'bg',
  onClose,
  className = '',
  compact = false,
}) => {
  const [activeTab, setActiveTab] = useState<'bg' | 'text'>(defaultTab);
  const [colors, setColors] = useState<SavedColorItem[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [newColorHex, setNewColorHex] = useState('#3B82F6');
  const [newColorLabel, setNewColorLabel] = useState('');
  const [selectedHex, setSelectedHex] = useState<string | null>(null);

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

  const currentTabColors = colors.filter((c) => c.type === activeTab);

  const handleAddCustomColor = async () => {
    if (!newColorHex) return;
    const label = newColorLabel.trim() || newColorHex.toUpperCase();
    const newColor: SavedColorItem = {
      id: `custom-${activeTab}-${Date.now()}`,
      type: activeTab,
      hex: newColorHex,
      label,
      isCustom: true,
      order: currentTabColors.length,
    };

    await db.userColors.put(newColor);
    setNewColorLabel('');
    await loadColors();
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
    }
  };

  const handleApplyColor = (hex: string) => {
    setSelectedHex(hex);
    onSelectColor(hex, activeTab);
  };

  return (
    <div
      className={`bg-[#1E293B] text-slate-100 rounded-2xl shadow-2xl border border-slate-700/80 p-3 flex flex-col gap-2.5 select-none ${className}`}
    >
      {/* Header Tabs & Close */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-2">
        <div className="flex items-center gap-1 p-0.5 bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('bg')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'bg'
                ? 'bg-amber-400 text-slate-900 font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span>背景高亮</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'text'
                ? 'bg-amber-400 text-slate-900 font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>文字颜色</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
              isEditMode
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title={isEditMode ? '完成编辑' : '管理/添加自定义颜色'}
          >
            <Palette className="w-3 h-3" />
            <span>{isEditMode ? '完成' : '编辑'}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              title="关闭"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Color Grid (Left: Commonly used colors in rows) */}
      <div className="flex flex-col gap-2">
        <div className="text-[11px] text-slate-400 flex items-center justify-between">
          <span>{activeTab === 'bg' ? '常用高亮色 (点击应用)' : '常用文字色 (点击应用)'}</span>
          <span className="text-[10px] text-slate-500">已保存 {currentTabColors.length} 种</span>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
          {currentTabColors.map((color) => {
            const isSelected = selectedHex === color.hex;
            return (
              <div key={color.id} className="relative group flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleApplyColor(color.hex)}
                  className="w-8 h-8 rounded-xl border border-white/20 shadow-xs flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer relative"
                  style={{
                    backgroundColor: activeTab === 'bg' ? color.hex : '#0F172A',
                    color: activeTab === 'text' ? color.hex : '#1E293B',
                  }}
                  title={`${color.label} (${color.hex})`}
                >
                  {activeTab === 'text' && (
                    <span className="font-bold text-sm" style={{ color: color.hex }}>
                      A
                    </span>
                  )}
                  {isSelected && (
                    <Check
                      className={`w-4 h-4 ${
                        activeTab === 'bg' ? 'text-slate-900' : 'text-white'
                      }`}
                    />
                  )}
                </button>

                <span className="text-[10px] text-slate-300 truncate max-w-[48px] text-center">
                  {color.label}
                </span>

                {/* Delete button in edit mode */}
                {isEditMode && color.isCustom && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteColor(color.id, e)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md hover:bg-rose-700 transition cursor-pointer"
                    title="删除此自定义颜色"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right / Edit Mode: Add Custom Color & Reset */}
      {isEditMode && (
        <div className="mt-1 pt-2 border-t border-slate-700/60 flex flex-col gap-2 bg-slate-800/60 p-2.5 rounded-xl">
          <div className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            <span>添加自定义{activeTab === 'bg' ? '背景高亮' : '文字颜色'}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Native Color Picker preview */}
            <div className="relative">
              <input
                type="color"
                value={newColorHex}
                onChange={(e) => setNewColorHex(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
              />
            </div>

            <input
              type="text"
              value={newColorHex}
              onChange={(e) => setNewColorHex(e.target.value)}
              placeholder="#HEX"
              className="w-20 px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono"
            />

            <input
              type="text"
              value={newColorLabel}
              onChange={(e) => setNewColorLabel(e.target.value)}
              placeholder="颜色备注 (如重点词)"
              className="flex-1 px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
            />

            <button
              type="button"
              onClick={handleAddCustomColor}
              className="px-2.5 py-1 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold text-xs rounded-lg transition cursor-pointer shadow-xs whitespace-nowrap"
            >
              保存
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
            <span>自定义颜色将自动永久保存到 IndexedDB 数据库</span>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-1 text-slate-400 hover:text-rose-300 transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>恢复默认</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
