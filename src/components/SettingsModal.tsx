import React, { useState, useEffect } from 'react';
import {
  getSavedLlmConfig,
  saveLlmConfig,
  DEFAULT_LLM_CONFIG,
} from '../services/aiService';
import { exportDatabaseToJson, importDatabaseFromJson } from '../db/database';
import type { LlmConfig } from '../types';
import {
  Settings,
  X,
  Key,
  Download,
  Upload,
  Palette,
  Smartphone,
  Check,
  AlertCircle,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: string;
  onThemeChange: (theme: string) => void;
  onDatabaseReset: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onThemeChange,
  onDatabaseReset,
}) => {
  const [config, setConfig] = useState<LlmConfig>(DEFAULT_LLM_CONFIG);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  
  const [modelList, setModelList] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const saved = getSavedLlmConfig();
      setConfig(saved);
      if (saved.model) {
        setModelList([saved.model]);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFetchModels = async () => {
    if (!config.baseUrl || !config.apiKey) {
      setFetchError('请先填写 Base URL 和 API Key');
      return;
    }
    
    setIsFetchingModels(true);
    setFetchError(null);
    try {
      const baseUrl = config.baseUrl.replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        const models = data.data.map((m: any) => m.id);
        setModelList(models);
        if (models.length > 0 && !models.includes(config.model)) {
          setConfig(prev => ({ ...prev, model: models[0] }));
        }
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      setFetchError(err.message || '获取模型列表失败');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveLlmConfig(config);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleExportJson = async () => {
    const jsonStr = await exportDatabaseToJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tidal_reading_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = ev.target?.result as string;
      if (!content) return;
      const ok = await importDatabaseFromJson(content);
      if (ok) {
        setImportStatus('备份数据恢复成功！');
        onDatabaseReset();
        setTimeout(() => setImportStatus(null), 3000);
      } else {
        setImportStatus('导入失败：文件格式不符合要求');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl border border-[var(--border-hairline)] overflow-hidden font-sans text-xs">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-[#253447]">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-[16px] text-[#253447]">
                应用设置与本地数据库
              </h3>
              <p className="text-xs text-[#5E7080]">
                OpenAI 兼容模型 · 主题配色 · IndexedDB 备份导出
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          {/* Section 1: LLM Settings */}
          <form onSubmit={handleSaveConfig} className="space-y-3">
            <h4 className="text-sm font-bold text-[#253447] flex items-center gap-1.5">
              <Key className="w-4 h-4 text-[#4C6378]" />
              <span>大模型 AI 接口配置 (OpenAI 兼容)</span>
            </h4>
            <p className="text-slate-500 leading-relaxed">
              支持 DeepSeek、OpenAI、通义千问、Kimi 或本地 Ollama。密钥保存在当前浏览器本地，无需第三方代理。未配置时将使用内置智能模板。
            </p>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">API Base URL</label>
              <input
                type="text"
                value={config.baseUrl}
                onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                placeholder="https://api.deepseek.com/v1"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-[#4C6378] outline-hidden font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">API Key (密钥)</label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-[#4C6378] outline-hidden font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="font-semibold text-slate-700">模型名称 (Model)</label>
                <button
                  type="button"
                  onClick={handleFetchModels}
                  disabled={isFetchingModels}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {isFetchingModels ? '拉取中...' : '刷新模型列表'}
                </button>
              </div>
              <div className="relative">
                <select
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-hidden font-mono text-xs bg-white appearance-none cursor-pointer transition-all shadow-xs"
                >
                  {modelList.length === 0 ? (
                    <option value={config.model}>{config.model || '未选择模型 (手动输入或点击刷新)'}</option>
                  ) : (
                    modelList.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
              {fetchError && (
                <p className="text-red-500 text-[11px] mt-1 bg-red-50 p-1.5 rounded-md border border-red-100">{fetchError}</p>
              )}
            </div>

            <div className="pt-1 flex items-center justify-between">
              {savedSuccess ? (
                <span className="text-emerald-600 flex items-center gap-1 font-medium">
                  <Check className="w-4 h-4" /> 配置已保存到本地
                </span>
              ) : (
                <span className="text-slate-400">点击右侧保存生效</span>
              )}

              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-[#2C4056] text-white font-medium hover:bg-[#3D536B] transition cursor-pointer"
              >
                保存大模型配置
              </button>
            </div>
          </form>

          {/* Section 3: Backup & Restore */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <h4 className="text-sm font-bold text-[#253447] flex items-center gap-1.5">
              <Download className="w-4 h-4 text-[#4C6378]" />
              <span>数据备份与恢复 (IndexedDB 全库)</span>
            </h4>
            <p className="text-slate-500">
              包含所有阅读材料、题目答题记录、高亮位置及双链笔记。支持随时导出为 JSON 离线存档。
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExportJson}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>导出全库为 JSON</span>
              </button>

              <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>恢复 JSON 备份</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJsonFile}
                  className="hidden"
                />
              </label>
            </div>

            {importStatus && (
              <p className="text-xs text-emerald-700 font-medium bg-emerald-50 p-2 rounded-lg">
                {importStatus}
              </p>
            )}
          </div>

          {/* Section 4: PWA info */}
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <h4 className="text-sm font-bold text-[#253447] flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-[#4C6378]" />
              <span>PWA 离线运行与手机安装说明</span>
            </h4>
            <div className="p-3 bg-slate-50 rounded-2xl text-slate-600 space-y-1.5 leading-relaxed text-[11px]">
              <p>• <strong>iPhone / iPad (Safari)</strong>：点击底部“分享”按钮 ➔ 选择“添加到主屏幕”，即可像原生 App 一样全屏无状态栏运行。</p>
              <p>• <strong>Android (Chrome / Edge)</strong>：点击浏览器菜单 ➔ “安装应用”或“添加到桌面”。</p>
              <p>• <strong>离线访问</strong>：已配置 Service Worker 与 Cache Storage，无网络下仍可完全流畅打开并做题复习。</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-hairline)] bg-[#F8FAFC] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl bg-[#2C4056] text-white font-medium hover:bg-[#3D536B] transition cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
