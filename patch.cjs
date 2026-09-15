const fs = require('fs');
const content = fs.readFileSync('src/utils/importHelper.ts', 'utf-8');

const replacement = `
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
`;

let newContent = content.replace(
  /  \/\/ Fast single bulk transactions\n  if \(foldersToInsert\.length > 0\) await db\.folders\.bulkAdd\(foldersToInsert\);\n  if \(materialsToInsert\.length > 0\) await db\.readingMaterials\.bulkAdd\(materialsToInsert\);\n  if \(questionsToInsert\.length > 0\) await db\.questions\.bulkAdd\(questionsToInsert\);\n  if \(notesToInsert\.length > 0\) await db\.notes\.bulkAdd\(notesToInsert\);/g,
  replacement
);

fs.writeFileSync('src/utils/importHelper.ts', newContent);
