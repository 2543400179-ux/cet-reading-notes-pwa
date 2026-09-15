import React from 'react';
import type { ViewMode } from '../types';
import {
  BookOpen,
  FileText,
  Settings,
  Download,
  WifiOff,
  FolderTree,
} from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface NavbarProps {
  activeTab: 'reading' | 'notes';
  onTabChange: (tab: 'reading' | 'notes') => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  onOpenSettingsModal: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenSettingsModal,
  isSidebarOpen = false,
  onToggleSidebar,
}) => {
  const isOnline = useOnlineStatus();
  const { isInstallable, install } = usePWAInstall();

  return (
    <header className="w-full bg-white/95 backdrop-blur-md border-b border-[var(--border-hairline)] z-20 shrink-0 sticky top-0">
      <div className="w-full px-2 sm:px-4 h-11 sm:h-12 flex items-center justify-between gap-1.5">
        {/* Left: Directory Tree Toggle + Primary Tab Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 text-xs font-semibold ${
                isSidebarOpen
                  ? 'bg-[#2C4056] text-white border-[#2C4056]'
                  : 'bg-[#EEF4FA] hover:bg-[#E2EBF2] text-[#2C4056] border-[var(--border-hairline)]'
              }`}
              title={isSidebarOpen ? '关闭目录' : '展开素材与双链笔记目录'}
            >
              <FolderTree className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">目录</span>
            </button>
          )}

          {/* Primary Tab Switcher */}
          <div className="bg-[#EEF4FA] p-0.5 rounded-lg flex items-center border border-[var(--border-hairline)] shrink-0">
            <button
              type="button"
              onClick={() => onTabChange('reading')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer whitespace-nowrap ${
                activeTab === 'reading'
                  ? 'bg-white text-[#2C4056] font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#4C6378]" />
              <span>真题阅读</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('notes')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer whitespace-nowrap ${
                activeTab === 'notes'
                  ? 'bg-white text-[#2C4056] font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#4C6378]" />
              <span>双链笔记</span>
            </button>
          </div>
        </div>

        {/* Right Controls: Offline indicator + PWA Install + Settings */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Offline indicator */}
          {!isOnline && (
            <span
              className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-amber-50 text-amber-800 text-[11px]"
              title="离线可用"
            >
              <WifiOff className="w-3 h-3 text-amber-600" />
            </span>
          )}

          {/* PWA Install Button */}
          {isInstallable && (
            <button
              type="button"
              onClick={install}
              className="p-1.5 rounded-md bg-[#E2EBF2] hover:bg-[#D3E1ED] text-[#2C4056] text-xs font-medium transition cursor-pointer flex items-center gap-1"
              title="安装到手机主屏幕"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">安装</span>
            </button>
          )}

          {/* Settings Button */}
          <button
            type="button"
            onClick={onOpenSettingsModal}
            className="p-1.5 sm:p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer shrink-0"
            title="设置与离线备份"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
// synced
