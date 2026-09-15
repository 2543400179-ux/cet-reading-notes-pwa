import React, { useState, useEffect } from 'react';
import type { ViewMode, Note } from './types';
import { initializeDatabaseIfEmpty, db } from './db/database';
import { Navbar } from './components/Navbar';
import { ReadingView } from './components/ReadingView';
import { NoteModule } from './components/NoteModule';
import { DirectoryTree } from './components/DirectoryTree';
import { AiAnalysisModal } from './components/AiAnalysisModal';
import { ImportMaterialModal } from './components/ImportMaterialModal';
import { SettingsModal } from './components/SettingsModal';
import { syncNoteLinks } from './utils/markdownHelper';

export default function App() {
  const [activeTab, setActiveTab] = useState<'reading' | 'notes'>('reading');
  const [viewMode, setViewMode] = useState<ViewMode>('floating');
  const [theme, setTheme] = useState<string>('pearl');
  const [dbReady, setDbReady] = useState(false);

  // Sidebar / Directory Tree state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [directoryLibrary, setDirectoryLibrary] = useState<'materials' | 'notes'>('materials');

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [aiModalState, setAiModalState] = useState<{
    isOpen: boolean;
    selectedText: string;
    contextSnippet: string;
    materialId?: string;
  }>({
    isOpen: false,
    selectedText: '',
    contextSnippet: '',
  });

  // Cross-module anchor navigation state
  const [targetMaterialId, setTargetMaterialId] = useState<string | null>(null);
  const [targetAnchorPos, setTargetAnchorPos] = useState<number | null>(null);
  const [activeNoteIdForNotes, setActiveNoteIdForNotes] = useState<string | null>(null);

  // Initialize DB and Theme on load
  useEffect(() => {
    // 1. Theme initialization
    const savedTheme = localStorage.getItem('tidal_reading_theme') || 'pearl';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // 2. View Mode initialization
    const savedViewMode = (localStorage.getItem('tidal_reading_view_mode') as ViewMode) || 'floating';
    setViewMode(savedViewMode);

    // 3. Database initialization
    initializeDatabaseIfEmpty().then(() => {
      setDbReady(true);
    });

    // 4. Default sidebar open on large desktop
    if (typeof window !== 'undefined' && window.innerWidth >= 1280) {
      setIsSidebarOpen(true);
    }

    // 5. Register PWA Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('SW registered with scope:', registration.scope);
          })
          .catch((error) => {
            console.warn('SW registration failed:', error);
          });
      });
    }
  }, []);

  // Sync directory library tab with active navbar tab
  useEffect(() => {
    setDirectoryLibrary(activeTab === 'reading' ? 'materials' : 'notes');
  }, [activeTab]);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('tidal_reading_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleViewModeChange = (newMode: ViewMode) => {
    setViewMode(newMode);
    localStorage.setItem('tidal_reading_view_mode', newMode);
  };

  // Open AI modal
  const handleOpenAiAnalysis = (selectedText: string, contextSnippet: string) => {
    setAiModalState({
      isOpen: true,
      selectedText,
      contextSnippet,
      materialId: targetMaterialId || undefined,
    });
  };

  // Create note directly from reading text selection
  const handleCreateNoteWithAnchor = async (
    snippet: string,
    materialId: string,
    startPos: number,
    endPos: number
  ) => {
    const title = `笔记：${snippet.slice(0, 16).replace(/\n/g, ' ')}...`;
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title,
      markdownContent: `# ${title}\n\n> "${snippet}"\n\n- **考点速记**：\n- **双链延伸**：[[四六级核心抽象名词]]\n`,
      createTime: Date.now(),
      materialId,
      anchorSnippet: snippet.slice(0, 80),
      anchorStartPos: startPos,
      anchorEndPos: endPos,
    };

    await db.notes.add(newNote);
    await syncNoteLinks(newNote.id, newNote.markdownContent);

    setActiveNoteIdForNotes(newNote.id);
    setActiveTab('notes');
  };

  // Jump from note back to reading text anchor
  const handleJumpToMaterial = (materialId: string, anchorPos?: number) => {
    setTargetMaterialId(materialId);
    setTargetAnchorPos(anchorPos ?? null);
    setActiveTab('reading');
  };

  // Select item from Directory Tree
  const handleSelectMaterialFromDirectory = (matId: string) => {
    setTargetMaterialId(matId);
    setActiveTab('reading');
  };

  const handleSelectNoteFromDirectory = (noteId: string) => {
    setActiveNoteIdForNotes(noteId);
    setActiveTab('notes');
  };

  if (!dbReady) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--bg-canvas)] text-[#2C4056] font-serif-cn">
        <div className="w-10 h-10 border-3 border-[#4C6378] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-semibold tracking-wide">潮汐随行 · 正在加载本地真题与双链知识库...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-canvas)] text-[#253447]">
      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setDirectoryLibrary(tab === 'reading' ? 'materials' : 'notes');
        }}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main App Body with Collapsible / Drawer Directory Tree */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Backdrop for Directory Drawer */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-2xs md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Directory Tree Sidebar */}
        <aside
          className={`
            fixed md:relative inset-y-0 left-0 z-40 md:z-10
            w-72 sm:w-80 shrink-0 h-full
            transition-transform duration-200 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:-ml-80'}
          `}
        >
          <DirectoryTree
            currentLibrary={directoryLibrary}
            onSelectLibrary={(lib) => {
              setDirectoryLibrary(lib);
              setActiveTab(lib === 'materials' ? 'reading' : 'notes');
            }}
            selectedMaterialId={targetMaterialId}
            onSelectMaterial={handleSelectMaterialFromDirectory}
            selectedNoteId={activeNoteIdForNotes}
            onSelectNote={handleSelectNoteFromDirectory}
            onCloseSidebar={() => setIsSidebarOpen(false)}
            className="h-full"
          />
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden flex flex-col min-w-0">
          {activeTab === 'reading' ? (
            <ReadingView
              viewMode={viewMode}
              onAiAnalyze={handleOpenAiAnalysis}
              onCreateNoteWithAnchor={handleCreateNoteWithAnchor}
              targetAnchorPos={targetAnchorPos}
              targetMaterialIdProp={targetMaterialId}
              onOpenDirectory={() => setIsSidebarOpen(true)}
              onSelectMaterialId={(id) => setTargetMaterialId(id)}
            />
          ) : (
            <NoteModule
              onJumpToMaterial={handleJumpToMaterial}
              activeNoteIdProp={activeNoteIdForNotes}
              onOpenDirectory={() => setIsSidebarOpen(true)}
            />
          )}
        </main>
      </div>

      {/* AI Parsing Modal */}
      <AiAnalysisModal
        isOpen={aiModalState.isOpen}
        selectedText={aiModalState.selectedText}
        contextSnippet={aiModalState.contextSnippet}
        materialId={aiModalState.materialId}
        onClose={() => setAiModalState((prev) => ({ ...prev, isOpen: false }))}
        onInsertToNote={(_title, _snippet) => {
          // Handled inside modal
        }}
        onNavigateToNotes={() => {
          setActiveTab('notes');
        }}
      />

      {/* Import Material Modal */}
      <ImportMaterialModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onMaterialImported={(matId) => {
          setTargetMaterialId(matId);
          setActiveTab('reading');
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentTheme={theme}
        onThemeChange={handleThemeChange}
        onDatabaseReset={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
// synced
