/**
 * Tidal Reading - Type Definitions
 * Dexie schema & application state models
 */

export type ViewMode = 'floating' | 'split' | 'flow';

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null; // null represents root level of that library
  library: 'materials' | 'notes';
  order: number;
  createdAt: number;
}

export interface ReadingMaterial {
  id: string;
  title: string;
  markdownContent: string;
  createTime: number;
  category?: 'CET-4' | 'CET-6' | 'Custom' | string;
  folderId?: string | null;
  order?: number;
  history?: {
    id: string;
    timestamp: number;
    correctCount: number;
    totalCount: number;
  }[];
}

export type ReadingQuestionType = 'choice' | 'match' | 'cloze';

export interface WordBankItem {
  letter: string; // 'A' .. 'O'
  word: string;
}

export interface Question {
  id: string;
  materialId: string;
  content: string;
  options: string[]; // ['A. ...', 'B. ...', 'C. ...', 'D. ...'] or word bank or paragraph letters
  answer: string;    // 'A' | 'B' | 'C' | 'D' | ...
  explanation?: string;
  userAnswer?: string;
  type?: ReadingQuestionType;
  number?: number | string; // e.g. 26..35 for cloze, 36..45 for match, 1..5 for choice
}

export interface Note {
  id: string;
  title: string;
  markdownContent: string;
  createTime: number;
  materialId?: string;
  anchorSnippet?: string;
  anchorStartPos?: number;
  anchorEndPos?: number;
  folderId?: string | null;
  order?: number;
}

export interface Highlight {
  id: string;
  materialId: string;
  startPos: number;
  endPos: number;
  bgColor: string;
  textColor: string;
  text?: string;
}

export interface NoteLink {
  id?: string;
  sourceNoteId: string;
  targetNoteName: string;
}

export interface AiRecord {
  id: string;
  sourceText: string;
  result: string;
  createTime: number;
  noteId?: string;
}

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface TextSelectionInfo {
  text: string;
  startPos: number;
  endPos: number;
  rect?: {
    top: number;
    left: number;
    bottom: number;
    right: number;
    width: number;
    height: number;
  };
}
