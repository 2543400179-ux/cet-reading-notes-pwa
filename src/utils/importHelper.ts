import { db } from '../db/database';
import { parseBatchMarkdown } from './mdParser';
import JSZip from 'jszip';

export interface ImportResult {
  foldersCount: number;
  materialsCount: number;
  questionsCount: number;
  firstMaterialId?: string | null;
}

/**
 * Process a ZIP archive containing .md files and subdirectories.
 * Highly recommended for mobile browsers where folder selection is restricted.
 */
export async function processZipImport(
  zipFile: File,
  library: 'materials' | 'notes'
): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(zipFile);
  const folderMap = new Map<string, string>(); // path -> folderId

  const fileEntries: { path: string; file: JSZip.JSZipObject }[] = [];

  zip.forEach((relativePath, file) => {
    // Filter out macOS hidden system files and directories
    if (
      relativePath.includes('__MACOSX') ||
      relativePath.startsWith('.') ||
      relativePath.includes('/.') ||
      file.dir
    ) {
      return;
    }
    if (relativePath.toLowerCase().endsWith('.md')) {
      fileEntries.push({ path: relativePath, file });
    }
  });

  if (fileEntries.length === 0) {
    throw new Error('ZIP 压缩包中未检测到任何 .md 文件，请确认压缩包内包含 Markdown 题库文件。');
  }

  // Natural sorting of paths to maintain sequence
  fileEntries.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));

  const foldersToInsert: any[] = [];
  const materialsToInsert: any[] = [];
  const questionsToInsert: any[] = [];
  const notesToInsert: any[] = [];

  const baseTimestamp = Date.now();

  for (let fIdx = 0; fIdx < fileEntries.length; fIdx++) {
    const { path: relativePath, file } = fileEntries[fIdx];
    const pathParts = relativePath.split('/').filter((p) => p.length > 0);
    const fileName = pathParts.pop() || 'material.md';

    let currentParentId: string | null = null;
    let currentPath = '';

    for (const part of pathParts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!folderMap.has(currentPath)) {
        const folderId = `folder-${baseTimestamp}-${foldersToInsert.length}-${Math.random().toString(36).substring(2, 7)}`;
        const newFolder = {
          id: folderId,
          name: part,
          parentId: currentParentId,
          library,
          order: baseTimestamp + foldersToInsert.length * 10,
          createdAt: baseTimestamp,
        };
        foldersToInsert.push(newFolder);
        folderMap.set(currentPath, folderId);
      }
      currentParentId = folderMap.get(currentPath) || null;
    }

    const text = await file.async('text');
    const parsedMaterials = parseBatchMarkdown(text);

    for (let i = 0; i < parsedMaterials.length; i++) {
      const pm = parsedMaterials[i];
      const baseTitle =
        pm.title === '未命名阅读材料' && parsedMaterials.length === 1
          ? fileName.replace(/\.md$/i, '')
          : pm.title;

      const finalTitle =
        parsedMaterials.length > 1 && pm.title === '未命名阅读材料'
          ? `${fileName.replace(/\.md$/i, '')} - 材料 ${i + 1}`
          : baseTitle;

      if (library === 'materials') {
        const materialId = `mat-${baseTimestamp}-${materialsToInsert.length}-${Math.random().toString(36).substring(2, 7)}`;

        materialsToInsert.push({
          id: materialId,
          title: finalTitle,
          markdownContent: pm.content,
          createTime: baseTimestamp + fIdx * 100 + i,
          category: pm.category,
          folderId: currentParentId,
          order: baseTimestamp + fIdx * 100 + i,
        });

        for (let j = 0; j < pm.questions.length; j++) {
          const q = pm.questions[j];
          questionsToInsert.push({
            id: `q-${baseTimestamp}-${questionsToInsert.length}-${Math.random().toString(36).substring(2, 7)}`,
            materialId,
            content: q.content,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
            type: q.type,
            number: q.number,
          });
        }
      } else {
        const noteId = `note-${baseTimestamp}-${notesToInsert.length}-${Math.random().toString(36).substring(2, 7)}`;
        notesToInsert.push({
          id: noteId,
          title: finalTitle,
          markdownContent: pm.content,
          createTime: baseTimestamp + fIdx * 100 + i,
          folderId: currentParentId,
          order: baseTimestamp + fIdx * 100 + i,
        });
      }
    }
  }


  // Fast single bulk transactions
  
  // Overwrite logic: delete existing items with same title and folderId
  for (const f of foldersToInsert) {
    const existing = await db.folders.where('name').equals(f.name).toArray();
    const match = existing.find(e => e.parentId === f.parentId);
    if (match) {
      await db.folders.delete(match.id);
    }
  }
  for (const m of materialsToInsert) {
    const existing = await db.readingMaterials.where('title').equals(m.title).toArray();
    const match = existing.find(e => e.folderId === m.folderId);
    if (match) {
      await db.readingMaterials.delete(match.id);
      // delete associated questions and highlights
      const qs = await db.questions.where('materialId').equals(match.id).toArray();
      await db.questions.bulkDelete(qs.map(q => q.id));
      const hls = await db.highlights.where('materialId').equals(match.id).toArray();
      await db.highlights.bulkDelete(hls.map(h => h.id));
    }
  }
  for (const n of notesToInsert) {
    const existing = await db.notes.where('title').equals(n.title).toArray();
    const match = existing.find(e => e.folderId === n.folderId);
    if (match) {
      await db.notes.delete(match.id);
    }
  }

  if (foldersToInsert.length > 0) await db.folders.bulkAdd(foldersToInsert);
  if (materialsToInsert.length > 0) await db.readingMaterials.bulkAdd(materialsToInsert);
  if (questionsToInsert.length > 0) await db.questions.bulkAdd(questionsToInsert);
  if (notesToInsert.length > 0) await db.notes.bulkAdd(notesToInsert);


  const firstMaterialId = materialsToInsert[0]?.id || null;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('materials-updated', {
        detail: { firstMaterialId, count: materialsToInsert.length },
      })
    );
  }

  return {
    foldersCount: foldersToInsert.length,
    materialsCount: materialsToInsert.length + notesToInsert.length,
    questionsCount: questionsToInsert.length,
    firstMaterialId,
  };
}

/**
 * Process a list of File objects (supports directory uploads via webkitdirectory or multiple .md files).
 */
export async function processBulkFilesImport(
  files: File[],
  library: 'materials' | 'notes'
): Promise<ImportResult> {
  // Check if any file is a ZIP archive
  const zipFile = files.find(
    (f) =>
      f.name.toLowerCase().endsWith('.zip') ||
      f.type === 'application/zip' ||
      f.type === 'application/x-zip-compressed'
  );

  if (zipFile) {
    return processZipImport(zipFile, library);
  }

  const mdFiles = files.filter((f) => f.name.toLowerCase().endsWith('.md'));
  if (mdFiles.length === 0) {
    throw new Error('未选择任何 .md 或 .zip 文件');
  }

  // Sort by relative path or name
  mdFiles.sort((a, b) =>
    (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, undefined, {
      numeric: true,
    })
  );

  const folderMap = new Map<string, string>(); // path -> folderId
  const foldersToInsert: any[] = [];
  const materialsToInsert: any[] = [];
  const questionsToInsert: any[] = [];
  const notesToInsert: any[] = [];
  const baseTimestamp = Date.now();

  for (let fIdx = 0; fIdx < mdFiles.length; fIdx++) {
    const file = mdFiles[fIdx];
    const pathParts = (file.webkitRelativePath || '')
      .split('/')
      .filter((p) => p.length > 0)
      .slice(0, -1);

    let currentParentId: string | null = null;
    let currentPath = '';

    for (const part of pathParts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!folderMap.has(currentPath)) {
        const folderId = `folder-${baseTimestamp}-${foldersToInsert.length}-${Math.random().toString(36).substring(2, 7)}`;
        const newFolder = {
          id: folderId,
          name: part,
          parentId: currentParentId,
          library,
          order: baseTimestamp + foldersToInsert.length * 10,
          createdAt: baseTimestamp,
        };
        foldersToInsert.push(newFolder);
        folderMap.set(currentPath, folderId);
      }
      currentParentId = folderMap.get(currentPath) || null;
    }

    const text = await file.text();
    const parsedMaterials = parseBatchMarkdown(text);

    for (let i = 0; i < parsedMaterials.length; i++) {
      const pm = parsedMaterials[i];
      const baseTitle =
        pm.title === '未命名阅读材料' && parsedMaterials.length === 1
          ? file.name.replace(/\.md$/i, '')
          : pm.title;

      const finalTitle =
        parsedMaterials.length > 1 && pm.title === '未命名阅读材料'
          ? `${file.name.replace(/\.md$/i, '')} - 材料 ${i + 1}`
          : baseTitle;

      if (library === 'materials') {
        const materialId = `mat-${baseTimestamp}-${materialsToInsert.length}-${Math.random().toString(36).substring(2, 7)}`;

        materialsToInsert.push({
          id: materialId,
          title: finalTitle,
          markdownContent: pm.content,
          createTime: baseTimestamp + fIdx * 100 + i,
          category: pm.category,
          folderId: currentParentId,
          order: baseTimestamp + fIdx * 100 + i,
        });

        for (let j = 0; j < pm.questions.length; j++) {
          const q = pm.questions[j];
          questionsToInsert.push({
            id: `q-${baseTimestamp}-${questionsToInsert.length}-${Math.random().toString(36).substring(2, 7)}`,
            materialId,
            content: q.content,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
            type: q.type,
            number: q.number,
          });
        }
      } else {
        const noteId = `note-${baseTimestamp}-${notesToInsert.length}-${Math.random().toString(36).substring(2, 7)}`;
        notesToInsert.push({
          id: noteId,
          title: finalTitle,
          markdownContent: pm.content,
          createTime: baseTimestamp + fIdx * 100 + i,
          folderId: currentParentId,
          order: baseTimestamp + fIdx * 100 + i,
        });
      }
    }
  }


  // Fast single bulk transactions
  
  // Overwrite logic: delete existing items with same title and folderId
  for (const f of foldersToInsert) {
    const existing = await db.folders.where('name').equals(f.name).toArray();
    const match = existing.find(e => e.parentId === f.parentId);
    if (match) {
      await db.folders.delete(match.id);
    }
  }
  for (const m of materialsToInsert) {
    const existing = await db.readingMaterials.where('title').equals(m.title).toArray();
    const match = existing.find(e => e.folderId === m.folderId);
    if (match) {
      await db.readingMaterials.delete(match.id);
      // delete associated questions and highlights
      const qs = await db.questions.where('materialId').equals(match.id).toArray();
      await db.questions.bulkDelete(qs.map(q => q.id));
      const hls = await db.highlights.where('materialId').equals(match.id).toArray();
      await db.highlights.bulkDelete(hls.map(h => h.id));
    }
  }
  for (const n of notesToInsert) {
    const existing = await db.notes.where('title').equals(n.title).toArray();
    const match = existing.find(e => e.folderId === n.folderId);
    if (match) {
      await db.notes.delete(match.id);
    }
  }

  if (foldersToInsert.length > 0) await db.folders.bulkAdd(foldersToInsert);
  if (materialsToInsert.length > 0) await db.readingMaterials.bulkAdd(materialsToInsert);
  if (questionsToInsert.length > 0) await db.questions.bulkAdd(questionsToInsert);
  if (notesToInsert.length > 0) await db.notes.bulkAdd(notesToInsert);


  const firstMaterialId = materialsToInsert[0]?.id || null;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('materials-updated', {
        detail: { firstMaterialId, count: materialsToInsert.length },
      })
    );
  }

  return {
    foldersCount: foldersToInsert.length,
    materialsCount: materialsToInsert.length + notesToInsert.length,
    questionsCount: questionsToInsert.length,
    firstMaterialId,
  };
}

/**
 * Unified batch import entrance supporting ZIP, folders, or multiple files
 */
export async function processBulkImport(
  files: File[],
  library: 'materials' | 'notes'
): Promise<ImportResult> {
  return processBulkFilesImport(files, library);
}
// synced
