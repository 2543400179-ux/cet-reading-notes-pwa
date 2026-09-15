import { db } from '../db/database';

/**
 * Extract all [[Note Title]] targets from markdown text
 */
export function extractWikiLinks(content: string): string[] {
  const matches = content.match(/\[\[(.*?)\]\]/g);
  if (!matches) return [];
  const uniqueNames = new Set<string>();
  for (const m of matches) {
    const title = m.slice(2, -2).trim();
    if (title) uniqueNames.add(title);
  }
  return Array.from(uniqueNames);
}

/**
 * Sync extracted wiki links for a note into Dexie noteLinks table
 */
export async function syncNoteLinks(noteId: string, content: string): Promise<void> {
  const targetNames = extractWikiLinks(content);

  // Delete existing links for this note
  await db.noteLinks.where('sourceNoteId').equals(noteId).delete();

  if (targetNames.length > 0) {
    const newLinks = targetNames.map((targetNoteName) => ({
      sourceNoteId: noteId,
      targetNoteName,
    }));
    await db.noteLinks.bulkAdd(newLinks);
  }
}

/**
 * Find backlinks (notes that mention this note's title)
 */
export async function getBacklinksForNote(noteTitle: string): Promise<string[]> {
  const links = await db.noteLinks.where('targetNoteName').equals(noteTitle).toArray();
  const sourceNoteIds = Array.from(new Set(links.map((l) => l.sourceNoteId)));
  return sourceNoteIds;
}
