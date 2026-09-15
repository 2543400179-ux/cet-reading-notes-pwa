import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  Plus,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Edit2,
  Trash2,
  Move,
  ArrowUp,
  ArrowDown,
  Search,
  BookOpen,
  FileCode,
  FolderPlus,
  Check,
  X,
  Layers,
  CornerDownLeft,
  GripVertical,
  Home,
  Archive,
  UploadCloud,
  Loader2,
  CheckSquare,
  Square,
  FolderInput,
  FilePlus,
  Upload,
} from 'lucide-react';
import { db } from '../db/database';
import type { FolderItem, ReadingMaterial, Note } from '../types';
import { processBulkImport } from '../utils/importHelper';

interface DirectoryTreeProps {
  currentLibrary: 'materials' | 'notes';
  onSelectLibrary: (lib: 'materials' | 'notes') => void;
  selectedMaterialId: string | null;
  onSelectMaterial: (id: string) => void;
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCloseSidebar?: () => void;
  className?: string;
}

interface TreeNodeItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parentId: string | null;
  library: 'materials' | 'notes';
  order: number;
  itemData?: ReadingMaterial | Note;
  children?: TreeNodeItem[];
}

export function DirectoryTree({
  currentLibrary,
  onSelectLibrary,
  selectedMaterialId,
  onSelectMaterial,
  selectedNoteId,
  onSelectNote,
  onCloseSidebar,
  className = '',
}: DirectoryTreeProps) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [materials, setMaterials] = useState<ReadingMaterial[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Popovers state
  const [activeMenuNode, setActiveMenuNode] = useState<TreeNodeItem | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [renamingNode, setRenamingNode] = useState<{ id: string; name: string; type: 'folder' | 'file' } | null>(null);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null | false>(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFileParentId, setNewFileParentId] = useState<string | null | false>(false);
  const [newFileName, setNewFileName] = useState('');
  const [moveDialogNode, setMoveDialogNode] = useState<TreeNodeItem | null>(null);

  // Batch management state
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [isBatchMoveModalOpen, setIsBatchMoveModalOpen] = useState(false);

  // Batch import state
  const [isBatchImportModalOpen, setIsBatchImportModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Robust Drag & Drop State & Refs (Desktop + Mobile Touch)
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    id: string; // node.id or '__ROOT__'
    position: 'inside' | 'before' | 'after';
  } | null>(null);

  const dragInfoRef = useRef<{
    draggedItem: TreeNodeItem | null;
    targetItem: TreeNodeItem | null;
    position: 'inside' | 'before' | 'after' | 'root' | null;
  }>({
    draggedItem: null,
    targetItem: null,
    position: null,
  });

  // Mobile Touch Drag State
  const [touchDrag, setTouchDrag] = useState<{
    active: boolean;
    draggedItem: TreeNodeItem;
    currentX: number;
    currentY: number;
    targetName: string | null;
    position: 'inside' | 'before' | 'after' | 'root';
    isLeavingFolder: boolean;
  } | null>(null);

  const touchStartRef = useRef<{
    x: number;
    y: number;
    node: TreeNodeItem;
    time: number;
  } | null>(null);

  const touchDragRef = useRef<typeof touchDrag>(null);
  touchDragRef.current = touchDrag;

  // Load tree data from IndexedDB
  const loadData = async () => {
    const [allFolders, allMaterials, allNotes] = await Promise.all([
      db.folders.toArray(),
      db.readingMaterials.toArray(),
      db.notes.toArray(),
    ]);

    setFolders(allFolders.sort((a, b) => a.order - b.order));
    setMaterials(allMaterials.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    setNotes(allNotes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));

    // Auto expand initial folders if not set
    setExpandedFolders((prev) => {
      const initialExpanded: Record<string, boolean> = { ...prev };
      allFolders.forEach((f) => {
        if (initialExpanded[f.id] === undefined) {
          initialExpanded[f.id] = true;
        }
      });
      return initialExpanded;
    });
  };

  useEffect(() => {
    loadData();
  }, [currentLibrary]);

  // Build recursive tree structure for the active library
  const treeData = useMemo(() => {
    const currentFolders = folders.filter((f) => f.library === currentLibrary);
    const currentFiles = currentLibrary === 'materials' ? materials : notes;

    const buildTree = (parentId: string | null): TreeNodeItem[] => {
      // 1. Get folders at this level
      const folderNodes: TreeNodeItem[] = currentFolders
        .filter((f) => f.parentId === parentId)
        .sort((a, b) => a.order - b.order)
        .map((f) => ({
          id: f.id,
          name: f.name,
          type: 'folder',
          parentId: f.parentId,
          library: f.library,
          order: f.order,
          children: buildTree(f.id),
        }));

      // 2. Get files at this level
      const fileNodes: TreeNodeItem[] = currentFiles
        .filter((file) => (file.folderId ?? null) === parentId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((file) => ({
          id: file.id,
          name: file.title,
          type: 'file',
          parentId: file.folderId ?? null,
          library: currentLibrary,
          order: file.order ?? 0,
          itemData: file,
        }));

      return [...folderNodes, ...fileNodes];
    };

    return buildTree(null);
  }, [folders, materials, notes, currentLibrary]);

  // Count files
  const materialCount = materials.length;
  const noteCount = notes.length;

  const toggleFolder = (folderId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const handleProcessImportFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setImportLoading(true);
    setImportStatus('正在解压/解析并导入真题素材...');
    setImportError(null);

    try {
      const result = await processBulkImport(files, currentLibrary);
      setImportStatus(
        `✅ 导入成功！已生成 ${result.foldersCount} 个分类目录，导入 ${result.materialsCount} 篇真题材料，共 ${result.questionsCount} 道题目。`
      );
      await loadData();
      if (result.firstMaterialId) {
        if (currentLibrary === 'materials') {
          onSelectMaterial(result.firstMaterialId);
        } else {
          onSelectNote(result.firstMaterialId);
        }
      }
      setTimeout(() => {
        setIsBatchImportModalOpen(false);
        setImportStatus(null);
        setImportLoading(false);
      }, 1500);
    } catch (err: any) {
      console.error('Batch import failed:', err);
      setImportError(err?.message || '批量导入失败，请检查文件格式。');
      setImportLoading(false);
    }
  };

  const pickZipFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip,application/x-zip-compressed';
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) handleProcessImportFiles(files);
    };
    input.click();
  };

  const pickFolder = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('webkitdirectory', 'true');
    input.setAttribute('directory', 'true');
    input.setAttribute('multiple', 'true');
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) handleProcessImportFiles(files);
    };
    input.click();
  };

  const pickMdFiles = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,text/markdown';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) handleProcessImportFiles(files);
    };
    input.click();
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    folders.filter((f) => f.library === currentLibrary).forEach((f) => (next[f.id] = true));
    setExpandedFolders(next);
  };

  const collapseAll = () => {
    setExpandedFolders({});
  };

  // Create folder
  const handleCreateFolder = async (parentId: string | null) => {
    if (!newFolderName.trim()) return;
    const currentFoldersAtLevel = folders.filter(
      (f) => f.library === currentLibrary && f.parentId === parentId
    );
    const newFolder: FolderItem = {
      id: `folder-${Date.now()}`,
      name: newFolderName.trim(),
      parentId,
      library: currentLibrary,
      order: currentFoldersAtLevel.length,
      createdAt: Date.now(),
    };

    await db.folders.add(newFolder);
    setNewFolderParentId(false);
    setNewFolderName('');
    // Expand parent and self
    setExpandedFolders((prev) => ({
      ...prev,
      ...(parentId ? { [parentId]: true } : {}),
      [newFolder.id]: true,
    }));
    await loadData();
  };

  // Create file
  const handleCreateFile = async (parentId: string | null) => {
    if (!newFileName.trim()) return;
    const title = newFileName.trim();

    if (currentLibrary === 'materials') {
      const materialsAtLevel = materials.filter((m) => (m.folderId ?? null) === parentId);
      const newMaterial: ReadingMaterial = {
        id: `mat-${Date.now()}`,
        title,
        markdownContent: `# ${title}\n\n在这里编写或粘贴阅读真题原文...\n`,
        createTime: Date.now(),
        category: 'Custom',
        folderId: parentId,
        order: materialsAtLevel.length,
      };
      await db.readingMaterials.add(newMaterial);
      await loadData();
      onSelectMaterial(newMaterial.id);
    } else {
      const notesAtLevel = notes.filter((n) => (n.folderId ?? null) === parentId);
      const newNote: Note = {
        id: `note-${Date.now()}`,
        title,
        markdownContent: `# ${title}\n\n- **双链笔记**：开始记录与链接...\n- **引用**：[[四六级核心抽象名词]]\n`,
        createTime: Date.now(),
        folderId: parentId,
        order: notesAtLevel.length,
      };
      await db.notes.add(newNote);
      await loadData();
      onSelectNote(newNote.id);
    }

    setNewFileParentId(false);
    setNewFileName('');
    if (parentId) {
      setExpandedFolders((prev) => ({ ...prev, [parentId]: true }));
    }
  };

  // Rename node
  const handleSaveRename = async () => {
    if (!renamingNode || !renamingNode.name.trim()) return;
    const newName = renamingNode.name.trim();

    if (renamingNode.type === 'folder') {
      await db.folders.update(renamingNode.id, { name: newName });
    } else {
      if (currentLibrary === 'materials') {
        await db.readingMaterials.update(renamingNode.id, { title: newName });
      } else {
        await db.notes.update(renamingNode.id, { title: newName });
      }
    }
    setRenamingNode(null);
    await loadData();
  };

  // Delete node
  const handleDeleteNode = async (node: TreeNodeItem) => {
    const isFolder = node.type === 'folder';
    const confirmMsg = isFolder
      ? `确定要删除文件夹《${node.name}》吗？其内部的子文件也将被一并移除。`
      : `确定要删除文档《${node.name}》吗？`;

    if (!confirm(confirmMsg)) return;

    if (isFolder) {
      // Find all nested folder IDs
      const getAllDescendantFolderIds = (fid: string): string[] => {
        const sub = folders.filter((f) => f.parentId === fid);
        return [fid, ...sub.flatMap((sf) => getAllDescendantFolderIds(sf.id))];
      };
      const toDeleteFolderIds = getAllDescendantFolderIds(node.id);

      // Delete folders
      for (const fid of toDeleteFolderIds) {
        await db.folders.delete(fid);
      }

      // Delete or unlink files
      if (currentLibrary === 'materials') {
        const mats = materials.filter((m) => m.folderId && toDeleteFolderIds.includes(m.folderId));
        for (const m of mats) {
          await db.readingMaterials.delete(m.id);
          await db.questions.where('materialId').equals(m.id).delete();
        }
      } else {
        const nts = notes.filter((n) => n.folderId && toDeleteFolderIds.includes(n.folderId));
        for (const n of nts) {
          await db.notes.delete(n.id);
          await db.noteLinks.where('sourceNoteId').equals(n.id).delete();
        }
      }
    } else {
      if (currentLibrary === 'materials') {
        await db.readingMaterials.delete(node.id);
        await db.questions.where('materialId').equals(node.id).delete();
      } else {
        await db.notes.delete(node.id);
        await db.noteLinks.where('sourceNoteId').equals(node.id).delete();
      }
    }

    setActiveMenuNode(null);
    setMenuPosition(null);
    await loadData();
  };

  // Reorder node (up / down)
  const handleReorder = async (node: TreeNodeItem, direction: 'up' | 'down') => {
    setActiveMenuNode(null);
    setMenuPosition(null);

    if (node.type === 'folder') {
      const siblings = folders
        .filter((f) => f.library === currentLibrary && f.parentId === node.parentId)
        .sort((a, b) => a.order - b.order);
      const currentIndex = siblings.findIndex((f) => f.id === node.id);
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= siblings.length) return;

      const current = siblings[currentIndex];
      const target = siblings[targetIndex];
      await db.folders.update(current.id, { order: target.order });
      await db.folders.update(target.id, { order: current.order });
    } else {
      const siblings = (currentLibrary === 'materials' ? materials : notes)
        .filter((f) => (f.folderId ?? null) === node.parentId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const currentIndex = siblings.findIndex((f) => f.id === node.id);
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= siblings.length) return;

      const current = siblings[currentIndex];
      const target = siblings[targetIndex];
      const table = currentLibrary === 'materials' ? db.readingMaterials : db.notes;
      await table.update(current.id, { order: target.order ?? targetIndex });
      await table.update(target.id, { order: current.order ?? currentIndex });
    }
    await loadData();
  };

  // Move node to a destination folder (or null for root)
  const handleMoveToFolder = async (node: TreeNodeItem, targetFolderId: string | null) => {
    try {
      if (node.type === 'folder') {
        if (node.id === targetFolderId) return;
        if (targetFolderId && isDescendantFolder(targetFolderId, node.id)) {
          alert('无法将文件夹移动到其自身的子文件夹中');
          return;
        }
        const existingFolders = folders.filter(
          (f) => f.library === currentLibrary && f.parentId === targetFolderId
        );
        await db.folders.update(node.id, {
          parentId: targetFolderId,
          order: existingFolders.length * 10,
        });
      } else {
        const table = currentLibrary === 'materials' ? db.readingMaterials : db.notes;
        const existingFiles = (currentLibrary === 'materials' ? materials : notes).filter(
          (item) => (item.folderId ?? null) === targetFolderId
        );
        await table.update(node.id, {
          folderId: targetFolderId,
          order: existingFiles.length * 10,
        });
      }
      setMoveDialogNode(null);
      if (targetFolderId) {
        setExpandedFolders((prev) => ({ ...prev, [targetFolderId]: true }));
      }
      await loadData();
    } catch (err) {
      console.error('Failed to move item:', err);
    }
  };

  // Helper: check if checkFolderId is the same or a descendant of parentFolderId
  const isDescendantFolder = (checkFolderId: string, parentFolderId: string): boolean => {
    if (checkFolderId === parentFolderId) return true;
    const visited = new Set<string>();
    const queue = [parentFolderId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const subFolders = folders.filter((f) => f.parentId === current);
      for (const sf of subFolders) {
        if (sf.id === checkFolderId) return true;
        queue.push(sf.id);
      }
    }
    return false;
  };

  // Batch operations handlers
  const toggleBatchSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: TreeNodeItem[]) => {
      nodes.forEach((n) => {
        allIds.add(n.id);
        if (n.children) collectIds(n.children);
      });
    };
    collectIds(displayedTree);
    setSelectedNodeIds(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedNodeIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedNodeIds.size === 0) return;
    const count = selectedNodeIds.size;
    if (
      !confirm(
        `确定要批量删除选中的 ${count} 个项目吗？若包含文件夹，其内部子文件也将一并被删除。`
      )
    ) {
      return;
    }

    const selectedIdsArray: string[] = Array.from(selectedNodeIds);
    const selectedFolderIds = new Set<string>();
    const selectedFileIds = new Set<string>();

    const getAllDescendantFolderIds = (fid: string): string[] => {
      const sub = folders.filter((f) => f.parentId === fid);
      return [fid, ...sub.flatMap((sf) => getAllDescendantFolderIds(sf.id))];
    };

    selectedIdsArray.forEach((id: string) => {
      if (folders.some((f) => f.id === id)) {
        getAllDescendantFolderIds(id).forEach((fid) => selectedFolderIds.add(fid));
      } else {
        selectedFileIds.add(id);
      }
    });

    // 1. Delete folders
    for (const fid of selectedFolderIds) {
      await db.folders.delete(fid);
    }

    // 2. Delete materials & associated questions
    if (currentLibrary === 'materials') {
      const allMatIdsToDelete = new Set<string>(selectedFileIds);
      materials
        .filter((m) => m.folderId && selectedFolderIds.has(m.folderId))
        .forEach((m) => allMatIdsToDelete.add(m.id));

      for (const mid of allMatIdsToDelete) {
        await db.readingMaterials.delete(mid);
        await db.questions.where('materialId').equals(mid).delete();
      }
    } else {
      // Notes
      const allNoteIdsToDelete = new Set<string>(selectedFileIds);
      notes
        .filter((n) => n.folderId && selectedFolderIds.has(n.folderId))
        .forEach((n) => allNoteIdsToDelete.add(n.id));

      for (const nid of allNoteIdsToDelete) {
        await db.notes.delete(nid);
        await db.noteLinks.where('sourceNoteId').equals(nid).delete();
      }
    }

    setSelectedNodeIds(new Set());
    setIsBatchMode(false);
    await loadData();
  };

  const handleBatchMove = async (targetFolderId: string | null) => {
    if (selectedNodeIds.size === 0) return;

    const selectedIdsArray: string[] = Array.from(selectedNodeIds);

    for (const id of selectedIdsArray) {
      const folder = folders.find((f) => f.id === id);
      if (folder) {
        if (targetFolderId !== id && (!targetFolderId || !isDescendantFolder(targetFolderId, id))) {
          await db.folders.update(id, { parentId: targetFolderId });
        }
      } else {
        if (currentLibrary === 'materials') {
          await db.readingMaterials.update(id, { folderId: targetFolderId });
        } else {
          await db.notes.update(id, { folderId: targetFolderId });
        }
      }
    }

    setIsBatchMoveModalOpen(false);
    setSelectedNodeIds(new Set());
    setIsBatchMode(false);
    await loadData();
  };

  // Helper: recursively find node in tree structure
  const findNodeInTree = (nodes: TreeNodeItem[], id: string): TreeNodeItem | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children && node.children.length > 0) {
        const found = findNodeInTree(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Unified Move Logic for both Desktop Drag & Mobile Touch Drag
  const executeDropMove = async (
    draggedNode: TreeNodeItem,
    targetNode: TreeNodeItem | null,
    position: 'inside' | 'before' | 'after' | 'root' | null
  ) => {
    try {
      // 1. Move to ROOT (e.g. dragged out of its folder or dropped onto tree root)
      if (!targetNode || position === 'root') {
        if (draggedNode.type === 'folder') {
          const rootFolders = folders.filter(
            (f) => f.library === currentLibrary && f.parentId === null && f.id !== draggedNode.id
          );
          await db.folders.update(draggedNode.id, {
            parentId: null,
            order: rootFolders.length * 10,
          });
        } else {
          const table = currentLibrary === 'materials' ? db.readingMaterials : db.notes;
          const rootFiles = (currentLibrary === 'materials' ? materials : notes).filter(
            (item) => (item.folderId ?? null) === null && item.id !== draggedNode.id
          );
          await table.update(draggedNode.id, {
            folderId: null,
            order: rootFiles.length * 10,
          });
        }
        await loadData();
        return;
      }

      if (draggedNode.id === targetNode.id) return;

      // 2. Drop INSIDE a folder
      if (position === 'inside' && targetNode.type === 'folder') {
        if (draggedNode.type === 'folder') {
          if (isDescendantFolder(targetNode.id, draggedNode.id)) {
            return;
          }
          const existingSubFolders = folders.filter(
            (f) => f.library === currentLibrary && f.parentId === targetNode.id && f.id !== draggedNode.id
          );
          await db.folders.update(draggedNode.id, {
            parentId: targetNode.id,
            order: existingSubFolders.length * 10,
          });
        } else {
          const table = currentLibrary === 'materials' ? db.readingMaterials : db.notes;
          const existingFiles = (currentLibrary === 'materials' ? materials : notes).filter(
            (item) => (item.folderId ?? null) === targetNode.id && item.id !== draggedNode.id
          );
          await table.update(draggedNode.id, {
            folderId: targetNode.id,
            order: existingFiles.length * 10,
          });
        }
        setExpandedFolders((prev) => ({ ...prev, [targetNode.id]: true }));
        await loadData();
        return;
      }

      // 3. Drop BEFORE or AFTER a node (Reordering / Joining folder or root)
      if (draggedNode.type === 'folder') {
        const destParentId = targetNode.parentId;
        if (isDescendantFolder(targetNode.id, draggedNode.id)) {
          return;
        }
        const siblings = folders
          .filter(
            (f) => f.library === currentLibrary && f.parentId === destParentId && f.id !== draggedNode.id
          )
          .sort((a, b) => a.order - b.order);

        let targetIdx = siblings.findIndex((s) => s.id === targetNode.id);
        if (targetIdx === -1) targetIdx = siblings.length;
        const insertIdx = position === 'before' ? Math.max(0, targetIdx) : targetIdx + 1;
        siblings.splice(insertIdx, 0, { id: draggedNode.id } as any);

        for (let i = 0; i < siblings.length; i++) {
          if (siblings[i].id === draggedNode.id) {
            await db.folders.update(draggedNode.id, {
              parentId: destParentId,
              order: i * 10,
            });
          } else {
            await db.folders.update(siblings[i].id, { order: i * 10 });
          }
        }
      } else {
        // File dragged before/after targetNode
        const destFolderId = targetNode.type === 'file' ? targetNode.parentId : targetNode.parentId;
        const table = currentLibrary === 'materials' ? db.readingMaterials : db.notes;
        const allFiles = currentLibrary === 'materials' ? materials : notes;
        const siblings = allFiles
          .filter((f) => (f.folderId ?? null) === destFolderId && f.id !== draggedNode.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        let targetIdx = siblings.findIndex((s) => s.id === targetNode.id);
        if (targetIdx === -1) {
          targetIdx = position === 'before' ? 0 : siblings.length;
        }
        const insertIdx = position === 'before' ? Math.max(0, targetIdx) : targetIdx + 1;
        siblings.splice(insertIdx, 0, { id: draggedNode.id } as any);

        for (let i = 0; i < siblings.length; i++) {
          if (siblings[i].id === draggedNode.id) {
            await table.update(draggedNode.id, {
              folderId: destFolderId,
              order: i * 10,
            });
          } else {
            await table.update(siblings[i].id, { order: i * 10 });
          }
        }
      }
      await loadData();
    } catch (err) {
      console.error('Failed to move item:', err);
    }
  };

  // Mobile Touch Drag: Touch start
  const handleTouchStart = (e: React.TouchEvent, node: TreeNodeItem) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      node,
      time: Date.now(),
    };
  };

  // Mobile Touch Drag: Global window touchmove & touchend listeners
  useEffect(() => {
    const onWindowTouchMove = (e: TouchEvent) => {
      const startInfo = touchStartRef.current;
      if (!startInfo || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dist = Math.hypot(touch.clientX - startInfo.x, touch.clientY - startInfo.y);

      // Drag threshold: 8px
      if (!touchDragRef.current?.active && dist > 8) {
        dragInfoRef.current = {
          draggedItem: startInfo.node,
          targetItem: null,
          position: null,
        };
        setActiveDragId(startInfo.node.id);
      }

      if (dist > 8) {
        if (e.cancelable) {
          e.preventDefault(); // Stop mobile page scroll while dragging item
        }

        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const nodeEl = el?.closest('[data-tree-node-id]') as HTMLElement | null;
        const containerEl = el?.closest('[data-tree-container]') as HTMLElement | null;

        let targetNode: TreeNodeItem | null = null;
        let position: 'inside' | 'before' | 'after' | 'root' = 'root';
        let targetName: string | null = null;

        if (nodeEl) {
          const targetId = nodeEl.getAttribute('data-tree-node-id');
          if (targetId && targetId !== startInfo.node.id) {
            targetNode = findNodeInTree(treeData, targetId);
            if (targetNode) {
              if (startInfo.node.type === 'folder' && isDescendantFolder(targetNode.id, startInfo.node.id)) {
                targetNode = null;
              } else {
                targetName = targetNode.name;
                const rect = nodeEl.getBoundingClientRect();
                const offsetY = touch.clientY - rect.top;
                const height = rect.height || 32;

                if (targetNode.type === 'folder') {
                  if (startInfo.node.type === 'file') {
                    position = 'inside';
                  } else {
                    if (offsetY <= height * 0.2) position = 'before';
                    else if (offsetY >= height * 0.8) position = 'after';
                    else position = 'inside';
                  }
                } else {
                  position = offsetY < height * 0.5 ? 'before' : 'after';
                }
              }
            }
          }
        } else if (containerEl) {
          position = 'root';
        }

        const isLeavingFolder = Boolean(
          startInfo.node.parentId &&
            (position === 'root' || (targetNode && targetNode.parentId === null && position !== 'inside'))
        );

        setTouchDrag({
          active: true,
          draggedItem: startInfo.node,
          currentX: touch.clientX,
          currentY: touch.clientY,
          targetName,
          position,
          isLeavingFolder,
        });

        if (targetNode) {
          setDropIndicator({ id: targetNode.id, position: position as 'inside' | 'before' | 'after' });
          dragInfoRef.current.targetItem = targetNode;
          dragInfoRef.current.position = position as 'inside' | 'before' | 'after';
        } else if (containerEl) {
          setDropIndicator({ id: '__ROOT__', position: 'inside' });
          dragInfoRef.current.targetItem = null;
          dragInfoRef.current.position = 'root';
        } else {
          setDropIndicator(null);
          dragInfoRef.current.targetItem = null;
          dragInfoRef.current.position = null;
        }
      }
    };

    const onWindowTouchEnd = async () => {
      const currentDrag = touchDragRef.current;
      touchStartRef.current = null;

      if (currentDrag?.active) {
        await executeDropMove(
          currentDrag.draggedItem,
          dragInfoRef.current.targetItem,
          dragInfoRef.current.position
        );
      }

      setTouchDrag(null);
      setActiveDragId(null);
      setDropIndicator(null);
      dragInfoRef.current = { draggedItem: null, targetItem: null, position: null };
    };

    window.addEventListener('touchmove', onWindowTouchMove, { passive: false });
    window.addEventListener('touchend', onWindowTouchEnd);
    window.addEventListener('touchcancel', onWindowTouchEnd);

    return () => {
      window.removeEventListener('touchmove', onWindowTouchMove);
      window.removeEventListener('touchend', onWindowTouchEnd);
      window.removeEventListener('touchcancel', onWindowTouchEnd);
    };
  }, [treeData, folders, materials, notes, currentLibrary]);

  // Desktop Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, node: TreeNodeItem) => {
    e.stopPropagation();
    dragInfoRef.current = {
      draggedItem: node,
      targetItem: null,
      position: null,
    };
    try {
      e.dataTransfer.setData('text/plain', node.id);
      e.dataTransfer.setData(
        'application/json',
        JSON.stringify({ id: node.id, type: node.type, library: node.library })
      );
      e.dataTransfer.effectAllowed = 'move';
    } catch {
      // ignore
    }
    requestAnimationFrame(() => {
      setActiveDragId(node.id);
    });
  };

  const handleDragEnd = () => {
    dragInfoRef.current = { draggedItem: null, targetItem: null, position: null };
    setActiveDragId(null);
    setDropIndicator(null);
  };

  const handleDragOverNode = (e: React.DragEvent, targetNode: TreeNodeItem) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const activeDragged = dragInfoRef.current.draggedItem;
    if (!activeDragged || activeDragged.id === targetNode.id) return;

    if (activeDragged.type === 'folder' && isDescendantFolder(targetNode.id, activeDragged.id)) {
      return;
    }

    let pos: 'inside' | 'before' | 'after';

    if (targetNode.type === 'folder') {
      if (activeDragged.type === 'file') {
        pos = 'inside';
      } else {
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const height = rect.height || 32;
        if (offsetY <= height * 0.15) pos = 'before';
        else if (offsetY >= height * 0.85) pos = 'after';
        else pos = 'inside';
      }
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const height = rect.height || 32;
      pos = offsetY < height * 0.5 ? 'before' : 'after';
    }

    dragInfoRef.current.targetItem = targetNode;
    dragInfoRef.current.position = pos;

    setDropIndicator((prev) => {
      if (prev?.id === targetNode.id && prev?.position === pos) return prev;
      return { id: targetNode.id, position: pos };
    });
  };

  const handleDragOverRoot = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const activeDragged = dragInfoRef.current.draggedItem;
    if (!activeDragged) return;

    dragInfoRef.current.targetItem = null;
    dragInfoRef.current.position = 'root';

    setDropIndicator((prev) => {
      if (prev?.id === '__ROOT__' && prev?.position === 'inside') return prev;
      return { id: '__ROOT__', position: 'inside' };
    });
  };

  const handleDrop = async (e: React.DragEvent, directTargetNode?: TreeNodeItem) => {
    e.preventDefault();
    e.stopPropagation();

    const activeDragged = dragInfoRef.current.draggedItem;
    const targetNode = directTargetNode || dragInfoRef.current.targetItem;
    const position = dragInfoRef.current.position;

    handleDragEnd();

    if (!activeDragged) return;
    await executeDropMove(activeDragged, targetNode, position);
  };

  // Open context/action menu
  const openMenu = (e: React.MouseEvent, node: TreeNodeItem) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 180, rect.left);
    const y = Math.min(window.innerHeight - 250, rect.bottom + 4);
    setActiveMenuNode(node);
    setMenuPosition({ x, y });
  };

  // Filter tree when searching
  const filterNodes = (nodes: TreeNodeItem[]): TreeNodeItem[] => {
    if (!searchQuery.trim()) return nodes;
    const query = searchQuery.toLowerCase();

    return nodes.reduce<TreeNodeItem[]>((acc, node) => {
      if (node.type === 'folder') {
        const matchingChildren = filterNodes(node.children || []);
        if (matchingChildren.length > 0 || node.name.toLowerCase().includes(query)) {
          acc.push({ ...node, children: matchingChildren });
        }
      } else {
        if (node.name.toLowerCase().includes(query)) {
          acc.push(node);
        }
      }
      return acc;
    }, []);
  };

  const displayedTree = filterNodes(treeData);

  // Render a single node row (folder or file) recursively
  const renderNode = (node: TreeNodeItem, depth = 0) => {
    const isFolder = node.type === 'folder';
    const isExpanded = expandedFolders[node.id];
    const isSelected =
      !isFolder &&
      (currentLibrary === 'materials'
        ? selectedMaterialId === node.id
        : selectedNoteId === node.id);

    const isBeingDragged = activeDragId === node.id;
    const isDragTarget = dropIndicator?.id === node.id;
    const dragPos = isDragTarget ? dropIndicator.position : null;
    const isBatchSelected = selectedNodeIds.has(node.id);

    let dragClass = '';
    if (isBeingDragged) {
      dragClass = 'opacity-40 ring-1 ring-dashed ring-slate-400 bg-slate-100';
    } else if (isDragTarget) {
      if (dragPos === 'inside') {
        // High-contrast Range Box ("范围框") on target folder
        dragClass = 'bg-blue-50 ring-2 ring-blue-500 border-2 border-blue-500 rounded-xl font-semibold shadow-md scale-[1.01]';
      } else if (dragPos === 'before') {
        dragClass = 'border-t-2 border-blue-500 bg-blue-50/40';
      } else if (dragPos === 'after') {
        dragClass = 'border-b-2 border-blue-500 bg-blue-50/40';
      }
    }

    return (
      <div key={node.id} className="select-none">
        <div
          data-tree-node-id={node.id}
          data-tree-node-type={node.type}
          data-tree-node-parent={node.parentId || ''}
          draggable={!isBatchMode}
          onDragStart={(e) => !isBatchMode && handleDragStart(e, node)}
          onDragOver={(e) => !isBatchMode && handleDragOverNode(e, node)}
          onDragEnd={handleDragEnd}
          onDrop={(e) => !isBatchMode && handleDrop(e, node)}
          onClick={(e) => {
            if (isBatchMode) {
              toggleBatchSelect(node.id, e);
              return;
            }
            if (isFolder) {
              toggleFolder(node.id, e);
            } else {
              if (currentLibrary === 'materials') {
                onSelectMaterial(node.id);
              } else {
                onSelectNote(node.id);
              }
              if (window.innerWidth < 768) {
                onCloseSidebar?.();
              }
            }
          }}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded-xl text-xs transition cursor-pointer select-none ${dragClass} ${
            isBatchMode
              ? isBatchSelected
                ? 'bg-blue-50 text-blue-900 font-semibold ring-1 ring-blue-300'
                : 'text-slate-700 hover:bg-slate-50'
              : isSelected
              ? 'bg-[#E3EAF2] text-[#1E293B] font-semibold shadow-xs'
              : 'text-slate-700 hover:bg-slate-100/80 active:bg-slate-200/60'
          }`}
        >
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {/* Batch mode checkbox OR touch drag grip */}
            {isBatchMode ? (
              <button
                type="button"
                aria-label="选择此项进行批量管理"
                onClick={(e) => toggleBatchSelect(node.id, e)}
                className="p-1 -ml-1 text-blue-600 hover:text-blue-700 transition cursor-pointer shrink-0"
              >
                {isBatchSelected ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-300 hover:text-slate-400" />
                )}
              </button>
            ) : (
              /* Dedicated Left Move Button: ONLY this button triggers mobile touch drag */
              <button
                type="button"
                aria-label="按住拖拽移动排序"
                title="按住拖拽移动排序"
                onTouchStart={(e) => handleTouchStart(e, node)}
                onClick={(e) => e.stopPropagation()}
                className="p-1 -ml-1 text-slate-400 hover:text-slate-700 active:text-blue-600 rounded cursor-grab active:cursor-grabbing touch-none shrink-0 transition flex items-center justify-center pointer-events-auto"
              >
                <GripVertical className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
              </button>
            )}

            {/* Folder Toggle Icon */}
            {isFolder ? (
              <span
                onClick={(e) => toggleFolder(node.id, e)}
                className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition pointer-events-auto cursor-pointer"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>
            ) : (
              <span className="w-3.5 shrink-0" />
            )}

            {/* Icon */}
            {isFolder ? (
              isExpanded ? (
                <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-amber-500/80 shrink-0" />
              )
            ) : currentLibrary === 'materials' ? (
              <BookOpen className="w-3.5 h-3.5 text-[#3D536B] shrink-0" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            )}

            {/* Name / Title */}
            <span className="truncate text-slate-800 font-sans tracking-tight">
              {node.name}
            </span>

            {/* Visual badge when dragging into this folder (Range box label) */}
            {isFolder && isDragTarget && dragPos === 'inside' && (
              <span className="ml-auto text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-md font-medium shrink-0 shadow-xs flex items-center gap-1 animate-pulse">
                <span>移入此文件夹</span>
              </span>
            )}
          </div>

          {/* Quick Actions / More Menu Button: visible on mobile so user can easily tap */}
          {!isBatchMode && (
            <div
              className="flex items-center opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition focus-within:opacity-100 shrink-0 pointer-events-auto gap-0.5"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {isFolder && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewFileParentId(node.id);
                  }}
                  title="在文件夹内新建文档"
                  className="p-1 rounded hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingNode({
                    id: node.id,
                    name: node.name,
                    type: node.type,
                  });
                }}
                title="快速重命名"
                className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition cursor-pointer hidden sm:inline-flex"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => openMenu(e, node)}
                title="更多操作（重命名、删除、移动等）"
                className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-800 transition cursor-pointer"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Children (if folder and expanded) */}
        {isFolder && isExpanded && (
          <div className="space-y-0.5">
            {node.children && node.children.length > 0 ? (
              node.children.map((child) => renderNode(child, depth + 1))
            ) : (
              <div
                style={{ paddingLeft: `${(depth + 1) * 14 + 20}px` }}
                className="py-1 px-2 text-[11px] text-slate-400 italic select-none"
              >
                (空文件夹)
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`h-full flex flex-col bg-white border-r border-slate-200 select-none shadow-xs font-sans ${className}`}
    >
      {/* 1. Root Library Switcher: 【刷题素材库】 vs 【双链笔记库】 */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/50">
        <div className="grid grid-cols-2 p-1 bg-slate-200/70 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => onSelectLibrary('materials')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              currentLibrary === 'materials'
                ? 'bg-white text-[#2C4056] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="truncate">刷题素材库</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-500 font-mono">
              {materialCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectLibrary('notes')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              currentLibrary === 'notes'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span className="truncate">双链笔记库</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-500 font-mono">
              {noteCount}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Search & Tree Controls Toolbar */}
      <div className="px-3 pt-2 pb-1 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`搜索${currentLibrary === 'materials' ? '素材' : '笔记'}...`}
            className="w-full pl-8 pr-3 py-1 bg-slate-100 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#4C6378]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Action Buttons: Pure Icons (New Folder / New Doc / Batch Import / Batch Manage) */}
        <div className="flex items-center justify-between gap-1.5 pt-1">
          <div className="flex items-center gap-1 flex-1">
            {/* 1. 新建文件夹 */}
            <button
              type="button"
              onClick={() => setNewFolderParentId(null)}
              className="flex-1 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-amber-600 flex items-center justify-center transition cursor-pointer"
              title="新建文件夹"
              aria-label="新建文件夹"
            >
              <FolderPlus className="w-4 h-4" />
            </button>

            {/* 2. 新建文档 */}
            <button
              type="button"
              onClick={() => setNewFileParentId(null)}
              className="flex-1 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-blue-600 flex items-center justify-center transition cursor-pointer"
              title={currentLibrary === 'materials' ? '新建真题素材' : '新建笔记文档'}
              aria-label={currentLibrary === 'materials' ? '新建真题素材' : '新建笔记文档'}
            >
              <FilePlus className="w-4 h-4" />
            </button>
            
            {/* 3. 批量导入 */}
            <button
              type="button"
              onClick={() => setIsBatchImportModalOpen(true)}
              className="flex-1 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-emerald-600 flex items-center justify-center transition cursor-pointer"
              title={currentLibrary === 'materials' ? '批量导入真题素材 (ZIP/文件夹)' : '批量导入笔记文档 (ZIP/Markdown)'}
              aria-label="批量导入"
            >
              <Upload className="w-4 h-4" />
            </button>

            {/* 4. 批量管理 */}
            <button
              type="button"
              onClick={() => setIsBatchMode((prev) => !prev)}
              className={`flex-1 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                isBatchMode
                  ? 'bg-[#2C4056] text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700'
              }`}
              title="批量管理文件与文件夹"
              aria-label="批量管理"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          </div>

          {/* Expand / Collapse All Icons */}
          <div className="flex items-center gap-0.5 pl-1 border-l border-slate-200 shrink-0">
            <button
              type="button"
              onClick={expandAll}
              className="w-7 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center transition cursor-pointer"
              title="全部展开"
              aria-label="全部展开"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="w-7 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center transition cursor-pointer"
              title="全部折叠"
              aria-label="全部折叠"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Batch Mode Floating/Sticky Control Bar removed from here */}
      </div>

      {/* 3. Recursive Tree Container */}
      <div
        data-tree-container="true"
        className={`flex-1 overflow-y-auto p-2 space-y-0.5 transition-colors pb-16 ${
          dropIndicator?.id === '__ROOT__'
            ? 'ring-2 ring-dashed ring-blue-400/80 bg-blue-50/20 rounded-xl'
            : ''
        }`}
        onDragOver={(e) => {
          if (e.target === e.currentTarget) {
            handleDragOverRoot(e);
          }
        }}
        onDrop={(e) => {
          if (e.target === e.currentTarget) {
            handleDrop(e);
          }
        }}
      >
        {displayedTree.length === 0 ? (
          <div className="text-center py-10 px-4 text-xs text-slate-400">
            {searchQuery ? '未找到相关文件' : '暂无内容，点击上方按钮创建'}
          </div>
        ) : (
          displayedTree.map((node) => renderNode(node, 0))
        )}
      </div>

      {/* 4. Action Context Menu Popover */}
      {activeMenuNode && menuPosition && (
        <>
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => {
              setActiveMenuNode(null);
              setMenuPosition(null);
            }}
          />
          <div
            style={{ top: `${menuPosition.y}px`, left: `${menuPosition.x}px` }}
            className="fixed z-50 w-44 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 truncate border-b border-slate-100 mb-1">
              {activeMenuNode.name}
            </div>

            {activeMenuNode.type === 'folder' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setNewFolderParentId(activeMenuNode.id);
                    setActiveMenuNode(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-left transition"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
                  <span>新建子文件夹</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewFileParentId(activeMenuNode.id);
                    setActiveMenuNode(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-left transition"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>新建文档</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setRenamingNode({
                  id: activeMenuNode.id,
                  name: activeMenuNode.name,
                  type: activeMenuNode.type,
                });
                setActiveMenuNode(null);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-left transition"
            >
              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
              <span>重命名</span>
            </button>

            <button
              type="button"
              onClick={() => handleReorder(activeMenuNode, 'up')}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-left transition"
            >
              <ArrowUp className="w-3.5 h-3.5 text-slate-500" />
              <span>同级上移</span>
            </button>

            <button
              type="button"
              onClick={() => handleReorder(activeMenuNode, 'down')}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-left transition"
            >
              <ArrowDown className="w-3.5 h-3.5 text-slate-500" />
              <span>同级下移</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMoveDialogNode(activeMenuNode);
                setActiveMenuNode(null);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-left transition"
            >
              <Move className="w-3.5 h-3.5 text-indigo-500" />
              <span>移动归属 / 移入移出文件夹...</span>
            </button>

            <div className="my-1 border-t border-slate-100" />

            <button
              type="button"
              onClick={() => handleDeleteNode(activeMenuNode)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-red-50 text-red-600 text-left transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>删除</span>
            </button>
          </div>
        </>
      )}

      {/* 5. Modal: Create Folder */}
      {newFolderParentId !== false && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-amber-500" />
              <span>新建文件夹</span>
            </h3>
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder(newFolderParentId)}
              placeholder="请输入文件夹名称..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-[#4C6378]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewFolderParentId(false);
                  setNewFolderName('');
                }}
                className="px-3 py-1.5 rounded-xl hover:bg-slate-100 text-slate-600 text-xs font-medium"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => handleCreateFolder(newFolderParentId)}
                className="px-4 py-1.5 rounded-xl bg-[#2C4056] hover:bg-[#3D536B] text-white text-xs font-medium"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Create Markdown File */}
      {newFileParentId !== false && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-blue-600" />
              <span>新建 {currentLibrary === 'materials' ? '真题素材' : '双链笔记'}</span>
            </h3>
            <input
              type="text"
              autoFocus
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFile(newFileParentId)}
              placeholder="请输入文档标题..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-[#4C6378]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewFileParentId(false);
                  setNewFileName('');
                }}
                className="px-3 py-1.5 rounded-xl hover:bg-slate-100 text-slate-600 text-xs font-medium"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => handleCreateFile(newFileParentId)}
                className="px-4 py-1.5 rounded-xl bg-[#2C4056] hover:bg-[#3D536B] text-white text-xs font-medium"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal: Rename Node */}
      {renamingNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-slate-600" />
              <span>重命名《{renamingNode.name}》</span>
            </h3>
            <input
              type="text"
              autoFocus
              value={renamingNode.name}
              onChange={(e) => setRenamingNode({ ...renamingNode, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-[#4C6378]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenamingNode(null)}
                className="px-3 py-1.5 rounded-xl hover:bg-slate-100 text-slate-600 text-xs font-medium"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveRename}
                className="px-4 py-1.5 rounded-xl bg-[#2C4056] hover:bg-[#3D536B] text-white text-xs font-medium"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal: Move to Folder */}
      {moveDialogNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Move className="w-4 h-4 text-indigo-600" />
              <span>移动《{moveDialogNode.name}》归属</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              选择目标位置将文件/文件夹移入，或选择“根目录”移出文件夹：
            </p>
            <div className="max-h-64 overflow-y-auto space-y-1 py-1 text-xs">
              <button
                type="button"
                onClick={() => handleMoveToFolder(moveDialogNode, null)}
                className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition cursor-pointer ${
                  moveDialogNode.parentId === null
                    ? 'bg-blue-50 text-blue-800 font-semibold border border-blue-200'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>根目录（移出所有文件夹）</span>
                </span>
                {moveDialogNode.parentId === null && (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
              </button>

              {folders
                .filter(
                  (f) =>
                    f.library === currentLibrary &&
                    (moveDialogNode.type !== 'folder' ||
                      (f.id !== moveDialogNode.id && !isDescendantFolder(f.id, moveDialogNode.id)))
                )
                .map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => handleMoveToFolder(moveDialogNode, folder.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition cursor-pointer ${
                      moveDialogNode.parentId === folder.id
                        ? 'bg-amber-50 text-amber-900 font-semibold border border-amber-200'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="text-slate-700 flex items-center gap-2 truncate">
                      <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </span>
                    {moveDialogNode.parentId === folder.id && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </button>
                ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setMoveDialogNode(null)}
                className="px-4 py-1.5 rounded-xl hover:bg-slate-100 text-slate-600 text-xs font-medium cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8.5 Modal: Batch Move to Folder */}
      {isBatchMoveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FolderInput className="w-4 h-4 text-indigo-600" />
              <span>批量移动 {selectedNodeIds.size} 项</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              请选择目标归属位置：
            </p>
            <div className="max-h-64 overflow-y-auto space-y-1 py-1 text-xs">
              <button
                type="button"
                onClick={() => handleBatchMove(null)}
                className="w-full text-left px-3 py-2 rounded-xl flex items-center justify-between hover:bg-blue-50 hover:text-blue-800 transition cursor-pointer border border-slate-100"
              >
                <span className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>根目录（移出所有文件夹）</span>
                </span>
              </button>

              {folders
                .filter(
                  (f) =>
                    f.library === currentLibrary &&
                    !selectedNodeIds.has(f.id)
                )
                .map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => handleBatchMove(folder.id)}
                    className="w-full text-left px-3 py-2 rounded-xl flex items-center justify-between hover:bg-amber-50 hover:text-amber-900 transition cursor-pointer border border-slate-100"
                  >
                    <span className="text-slate-700 flex items-center gap-2 truncate">
                      <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </span>
                  </button>
                ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsBatchMoveModalOpen(false)}
                className="px-4 py-1.5 rounded-xl hover:bg-slate-100 text-slate-600 text-xs font-medium cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Import Modal */}
      {isBatchImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 shadow-2xl p-5 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Archive className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">批量导入题库素材</h3>
                  <p className="text-[11px] text-slate-400">保留子文件夹结构与真题题目关联</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!importLoading) {
                    setIsBatchImportModalOpen(false);
                    setImportStatus(null);
                    setImportError(null);
                  }
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 overflow-y-auto">
              {/* Option 1: ZIP (Mobile First) */}
              <div
                onClick={importLoading ? undefined : pickZipFile}
                className="p-3.5 rounded-xl border-2 border-emerald-500/30 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-500 transition cursor-pointer flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5">
                  <Archive className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">上传 ZIP 压缩包</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-600 text-white font-semibold rounded-full">
                      手机端推荐
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    手机浏览器无法直接选择文件夹。在手机「文件」中长按包含题库的文件夹，点击「压缩」生成 .zip 上传，即可 100% 完整保留多级文件夹与真题！
                  </p>
                </div>
              </div>

              {/* Option 2: Folder (Desktop Webkit) */}
              <div
                onClick={importLoading ? undefined : pickFolder}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-300 transition cursor-pointer flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-[#2C4056] text-white shrink-0 mt-0.5">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">选择整个文件夹</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-700 font-medium rounded-full">
                      电脑浏览器
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    电脑端 Chrome/Edge 浏览器原生支持选择整个文件夹导入并解析。
                  </p>
                </div>
              </div>

              {/* Option 3: Multiple Markdown Files */}
              <div
                onClick={importLoading ? undefined : pickMdFiles}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-300 transition cursor-pointer flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0 mt-0.5">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">多选 Markdown 文件</span>
                    <span className="text-[10px] text-slate-400 font-medium">(.md)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    直接选择多个 .md 真题文件批量解析并归类到当前目录下。
                  </p>
                </div>
              </div>

              {/* Status and Error indicators */}
              {importLoading && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 flex items-center gap-2 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                  <span>{importStatus || '正在处理中...'}</span>
                </div>
              )}

              {importStatus && !importLoading && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs leading-relaxed">
                  {importStatus}
                </div>
              )}

              {importError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed">
                  ⚠️ {importError}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                disabled={importLoading}
                onClick={() => {
                  setIsBatchImportModalOpen(false);
                  setImportStatus(null);
                  setImportError(null);
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Touch Drag Floating Follow-Finger Badge */}
      {touchDrag?.active && (
        <div
          style={{
            left: `${touchDrag.currentX}px`,
            top: `${touchDrag.currentY - 48}px`,
          }}
          className="fixed pointer-events-none z-50 -translate-x-1/2 bg-[#2C4056] text-white px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-2 text-xs font-semibold whitespace-nowrap border border-white/20"
        >
          {touchDrag.draggedItem.type === 'folder' ? (
            <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : (
            <FileText className="w-3.5 h-3.5 text-blue-300 shrink-0" />
          )}
          <span className="max-w-[120px] truncate">{touchDrag.draggedItem.name}</span>
          <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-md font-mono">
            {touchDrag.targetName
              ? `移入: ${touchDrag.targetName}`
              : touchDrag.isLeavingFolder
              ? '移出至根目录'
              : touchDrag.position === 'root'
              ? '置于根目录'
              : '排序'}
          </span>
        </div>
      )}

      {/* Batch Mode Floating/Sticky Control Bar (Moved to Bottom) */}
      {isBatchMode && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-blue-50/95 backdrop-blur-sm border-t border-blue-200 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] flex flex-col gap-2 z-20 animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between min-w-0 px-1">
            <span className="font-semibold text-blue-900 whitespace-nowrap text-xs">
              已选 {selectedNodeIds.size} 项
            </span>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-blue-700 hover:text-blue-900 underline cursor-pointer"
              >
                全选
              </button>
              <span className="text-blue-300">|</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-blue-700 hover:text-blue-900 underline cursor-pointer"
              >
                清空
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 shrink-0">
            <button
              type="button"
              disabled={selectedNodeIds.size === 0}
              onClick={() => setIsBatchMoveModalOpen(true)}
              className="flex items-center justify-center gap-1.5 p-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer shadow-sm"
              title="批量移动"
            >
              <FolderInput className="w-4 h-4" />
              <span>移动</span>
            </button>

            <button
              type="button"
              disabled={selectedNodeIds.size === 0}
              onClick={handleBatchDelete}
              className="flex items-center justify-center gap-1.5 p-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer shadow-sm"
              title="批量删除"
            >
              <Trash2 className="w-4 h-4" />
              <span>删除</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsBatchMode(false);
                setSelectedNodeIds(new Set());
              }}
              className="flex items-center justify-center gap-1.5 p-2 bg-[#2C4056] hover:bg-[#1E293B] text-white border border-[#2C4056] rounded-lg text-xs font-medium transition cursor-pointer shadow-sm"
              title="退出批量管理"
            >
              <X className="w-4 h-4" />
              <span>退出</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
// synced
