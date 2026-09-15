import type { ReadingQuestionType, WordBankItem } from '../types';

export interface ParsedQuestion {
  content: string;
  options: string[];
  answer: string;
  explanation?: string;
  type: ReadingQuestionType;
  number?: number | string;
}

export interface ParsedMaterial {
  title: string;
  category: string;
  content: string;
  readingType: ReadingQuestionType;
  questions: ParsedQuestion[];
  wordBank?: WordBankItem[];
}

/**
 * Clean option text by removing leading letter, dots, parentheses, brackets, colons, and spaces
 * E.g. "A) Deep reading..." -> "Deep reading..."
 *      "A. Deep reading..." -> "Deep reading..."
 *      "A） Deep reading..." -> "Deep reading..."
 *      "[A] Deep reading..." -> "Deep reading..."
 */
export function cleanOptionText(text: string): string {
  if (!text) return '';
  return text.replace(/^[\[(【]?[A-Za-z][\])）】\.\、:：\-\s]*/, '').trim();
}

/**
 * Extract option letter from string
 * E.g. "A) text" -> "A", "(B) text" -> "B", "[C] text" -> "C"
 */
export function extractOptionLetter(text: string): string {
  if (!text) return 'A';
  const match = text.trim().match(/^[\[(【]?([A-Za-z])[\])）】\.\、\s]/);
  if (match) return match[1].toUpperCase();
  return text.trim().charAt(0).toUpperCase();
}

/**
 * Automatically detect reading question type:
 * - 'cloze': 选词填空 (Banked Cloze)
 * - 'match': 长篇阅读 / 段落匹配 (Paragraph Matching)
 * - 'choice': 仔细阅读 (Careful Reading / Multiple Choice)
 */
export function detectReadingType(
  content: string,
  category?: string,
  title?: string
): ReadingQuestionType {
  const combined = `${title || ''} ${category || ''} ${content}`.toLowerCase();

  // 1. Explicit keyword recognition
  if (
    combined.includes('选词填空') ||
    combined.includes('banked cloze') ||
    combined.includes('15选10') ||
    combined.includes('section a')
  ) {
    return 'cloze';
  }
  if (
    combined.includes('长篇阅读') ||
    combined.includes('段落匹配') ||
    combined.includes('section b') ||
    combined.includes('paragraph matching')
  ) {
    return 'match';
  }
  if (
    combined.includes('仔细阅读') ||
    combined.includes('section c') ||
    combined.includes('reading in depth')
  ) {
    return 'choice';
  }

  // 2. Pattern recognition for Cloze: blanks like **26** or ___26___ and word bank
  const hasBlanks = /\*\*(\d{1,2})\*\*|__+(\d{1,2})__+|\[(\d{1,2})\]/.test(content);
  const hasWordBank =
    /(?:备选词[库汇]|word\s*bank|words\s*bank)/i.test(content) ||
    (/[A-O][\)\.]\s+[a-zA-Z]+/i.test(content) &&
      (content.match(/[A-O][\)\.]\s+[a-zA-Z]+/g) || []).length >= 8);

  if (hasBlanks && hasWordBank) {
    return 'cloze';
  }

  // 3. Pattern recognition for Paragraph Match: paragraph markers [A], [B] or A), B)
  const paragraphLetterMatches =
    content.match(/(?:^|\n)\s*(?:\[[A-O]\]|[A-O][\)\.])/g) || [];
  const hasMatchMarkers = /\[\s*\]|【\s*】|→\s*[\[【]/.test(content);

  if (
    paragraphLetterMatches.length >= 4 ||
    (paragraphLetterMatches.length >= 2 && hasMatchMarkers)
  ) {
    return 'match';
  }

  // Default to choice (仔细阅读)
  return 'choice';
}

/**
 * Extract paragraph letters from passage
 * E.g. [A], [B], [C] -> ['A', 'B', 'C', ...]
 */
export function extractParagraphLetters(text: string): string[] {
  const letters = new Set<string>();
  const matches = text.matchAll(/(?:^|\n)\s*(?:\[([A-O])\]|([A-O])[\)\.])/gi);
  for (const m of matches) {
    const l = (m[1] || m[2])?.toUpperCase();
    if (l) letters.add(l);
  }

  if (letters.size > 0) {
    return Array.from(letters).sort();
  }

  // Default A to O for CET-4 Section B
  return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
}

/**
 * Extract Word Bank (备选词库) items (A-O, 15 words)
 */
export function extractWordBank(text: string): WordBankItem[] {
  const items: WordBankItem[] = [];
  const foundLetters = new Set<string>();

  // Look for word bank section or table or lines
  // Matches "A) abandon" or "A. abandon" or "[A] abandon" or "| A | abandon |"
  const regex = /(?:^|[\n\|;,])\s*[\[(【]?([A-O])[\])）】\.\、:：\-]?\s+([a-zA-Z\-]+)/gi;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    const letter = m[1].toUpperCase();
    const word = m[2].trim().toLowerCase();
    // Exclude common keywords that might follow letter
    if (word && !['the', 'is', 'are', 'was', 'were', 'to', 'in', 'on', 'at'].includes(word) && !foundLetters.has(letter)) {
      items.push({ letter, word });
      foundLetters.add(letter);
    }
  }

  // Sort by letter A-O
  return items.sort((a, b) => a.letter.localeCompare(b.letter));
}

/**
 * Parse summary answer line if available
 * E.g. "答案: 36. B 37. C 38. A" or "36-40: B C A D E" or "26-35: G A F..."
 */
function parseSummaryAnswers(text: string): Map<string, string> {
  const answerMap = new Map<string, string>();

  // Format 1: "36. B 37. C" or "36: B, 37: C" or "26. G 27. A"
  const pairMatches = text.matchAll(/(?:^|\s|[,\n])(\d+)[\.\:、\s]+([A-Oa-o])\b/g);
  for (const m of pairMatches) {
    answerMap.set(m[1], m[2].toUpperCase());
  }

  // Format 2: "36-40: A B C D E"
  const rangeMatches = text.matchAll(/(\d+)\s*[-~]\s*(\d+)\s*[:：]\s*([A-Oa-o\s,]+)/g);
  for (const rm of rangeMatches) {
    const startNum = parseInt(rm[1], 10);
    const letters = rm[3].trim().split(/[\s,]+/).filter((s) => /^[A-Oa-o]$/.test(s));
    letters.forEach((l, idx) => {
      answerMap.set((startNum + idx).toString(), l.toUpperCase());
    });
  }

  return answerMap;
}

/**
 * Universal question parser from markdown content
 */
export function parseQuestionsFromContent(
  fullText: string,
  category?: string,
  title?: string
): ParsedQuestion[] {
  const type = detectReadingType(fullText, category, title);

  // Split into passage and questions section if possible
  const sectionSplit = fullText.split(
    /(?:###?\s*(?:题目面板|题目|试题|练习题|练习|Questions|Tasks|备选词[库汇]|备选词|Words Bank|Directions))/i
  );
  const passageText = sectionSplit[0] || fullText;
  const questionsText = sectionSplit.slice(1).join('\n') || fullText;

  const summaryAnswers = parseSummaryAnswers(fullText);

  // ==========================================
  // TYPE 1: 选词填空 (Cloze)
  // ==========================================
  if (type === 'cloze') {
    const wordBank = extractWordBank(fullText);
    const options = wordBank.map((w) => `${w.letter}. ${w.word}`);

    // Find all blank numbers in text: **26**, **27** etc.
    const blankMatches = fullText.matchAll(/(?:\*\*(\d{1,2})\*\*|__+(\d{1,2})__+|\[(\d{1,2})\])/g);
    const blankNumbers: number[] = [];
    const seen = new Set<number>();

    for (const bm of blankMatches) {
      const num = parseInt(bm[1] || bm[2] || bm[3], 10);
      if (!isNaN(num) && !seen.has(num)) {
        seen.add(num);
        blankNumbers.push(num);
      }
    }

    // Default to 26-35 if no blanks extracted but type is cloze
    if (blankNumbers.length === 0) {
      for (let i = 26; i <= 35; i++) blankNumbers.push(i);
    } else {
      blankNumbers.sort((a, b) => a - b);
    }

    // Parse explanations from questionsText
    const explanationsMap = new Map<number, string>();
    const expMatches = questionsText.matchAll(
      /(?:^|\n)\s*(\d+)[\.\、\s]+(?:[^\n]*\n)?(?:[^\n]*解析[:：]\s*([^\n]+))/gi
    );
    for (const em of expMatches) {
      explanationsMap.set(parseInt(em[1], 10), em[2].trim());
    }

    // Also look for individual "26. 答案: G"
    const individualAnswers = new Map<number, string>();
    const ansMatches = questionsText.matchAll(
      /(?:^|\n)\s*(\d+)[\.\、\s]+(?:[^\n]*答案[:：]\s*([A-Oa-o]))/gi
    );
    for (const am of ansMatches) {
      individualAnswers.set(parseInt(am[1], 10), am[2].toUpperCase());
    }

    return blankNumbers.map((num, idx) => {
      const ans =
        individualAnswers.get(num) ||
        summaryAnswers.get(num.toString()) ||
        wordBank[idx % (wordBank.length || 1)]?.letter ||
        'A';

      const exp =
        explanationsMap.get(num) ||
        `第 ${num} 题选词填空。对应备选词选项 ${ans}。`;

      return {
        content: `第 ${num} 题`,
        options,
        answer: ans,
        explanation: exp,
        type: 'cloze',
        number: num,
      };
    });
  }

  // ==========================================
  // TYPE 2: 长篇阅读 / 段落匹配 (Paragraph Matching)
  // ==========================================
  if (type === 'match') {
    const paragraphLetters = extractParagraphLetters(passageText);
    const questions: ParsedQuestion[] = [];

    // Parse statements: e.g. "36. Statement sentence... [  ]" or "36. Statement... → 【  】"
    // or "36. Statement... [B]"
    const statementChunks = questionsText.split(/\n(?=\s*\d+[\.\、\s]+)/);

    for (const chunk of statementChunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;

      const numMatch = trimmed.match(/^(\d+)[\.\、\s]+/);
      if (!numMatch) continue;

      const num = parseInt(numMatch[1], 10);
      const lines = trimmed.split('\n');

      let statement = lines[0].replace(/^\d+[\.\、\s]+/, '').trim();
      let answer = '';
      let explanation = '';

      // Check if bracket contains answer like "[B]" or "【B】"
      const bracketAnsMatch = statement.match(/[\[【]\s*([A-Oa-o])\s*[\]】]$/);
      if (bracketAnsMatch) {
        answer = bracketAnsMatch[1].toUpperCase();
      }

      // Clean empty bracket markers from statement
      statement = statement
        .replace(/→\s*[\[【][\sA-Za-z]*[\]】]/, '')
        .replace(/[\[【][\sA-Za-z]*[\]】]$/, '')
        .trim();

      // Check remaining lines in chunk
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (/^答案[:：]\s*([A-Oa-o])/i.test(line)) {
          const m = line.match(/^答案[:：]\s*([A-Oa-o])/i);
          if (m) answer = m[1].toUpperCase();
        } else if (/^解析[:：]/i.test(line)) {
          explanation = line.replace(/^解析[:：]\s*/i, '').trim();
        } else if (!answer && !explanation) {
          // Multi-line statement
          statement += ' ' + line;
        }
      }

      // Fallback answer from summary map
      if (!answer && summaryAnswers.has(num.toString())) {
        answer = summaryAnswers.get(num.toString())!;
      }

      if (!answer) {
        answer = paragraphLetters[questions.length % paragraphLetters.length] || 'A';
      }

      if (!explanation) {
        explanation = `本题定位至第 [${answer}] 段。请注意对比原句中的核心同义改写。`;
      }

      questions.push({
        content: statement,
        options: paragraphLetters,
        answer,
        explanation,
        type: 'match',
        number: num,
      });
    }

    if (questions.length > 0) {
      return questions;
    }
  }

  // ==========================================
  // TYPE 3: 仔细阅读 (Choice)
  // ==========================================
  const parsedQuestions: ParsedQuestion[] = [];
  const qChunks = questionsText.split(/\n(?=\s*\d+[\.\、\s]+)/);

  for (let qChunk of qChunks) {
    qChunk = qChunk.trim();
    if (!qChunk) continue;

    const numMatch = qChunk.match(/^(\d+)[\.\、\s]+/);
    const num = numMatch ? parseInt(numMatch[1], 10) : parsedQuestions.length + 1;

    const lines = qChunk.split('\n');
    let qContent = lines[0].replace(/^\d+[\.\、\s]*/, '').trim();

    let answer = 'A';
    let explanation = '';
    const options: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (/^[A-D][\)\.\、\s]|^\[[A-D]\]/i.test(line)) {
        // Keep raw line or clean format, but preserve letter prefix
        const letter = extractOptionLetter(line);
        const text = cleanOptionText(line);
        options.push(`${letter}. ${text}`);
      } else if (/^答案[:：]/i.test(line)) {
        const m = line.match(/^答案[:：]\s*([A-Da-d])/i);
        if (m) answer = m[1].toUpperCase();
      } else if (/^解析[:：]/i.test(line)) {
        explanation = line.replace(/^解析[:：]\s*/i, '').trim();
      } else if (options.length === 0 && !line.startsWith('答案')) {
        qContent += '\n' + line;
      }
    }

    // Check summary answer map if no answer found
    if (summaryAnswers.has(num.toString())) {
      answer = summaryAnswers.get(num.toString())!;
    }

    // Only accept questions with at least 2 options for choice
    if (options.length >= 2) {
      parsedQuestions.push({
        content: qContent,
        options,
        answer,
        explanation: explanation || `本题正确答案为 ${answer}。`,
        type: 'choice',
        number: num,
      });
    }
  }

  return parsedQuestions;
}

/**
 * Main batch markdown parser for importing materials
 */
export function parseBatchMarkdown(markdownText: string): ParsedMaterial[] {
  const materials: ParsedMaterial[] = [];

  // Extract global frontmatter (YAML) if exists
  let category = 'CET-4';
  let remainingText = markdownText;

  const yamlMatch = markdownText.match(/^---\n([\s\S]*?)\n---/);
  if (yamlMatch) {
    const yamlContent = yamlMatch[1];
    remainingText = markdownText.slice(yamlMatch[0].length).trim();

    const categoryMatch = yamlContent.match(/题型:\s*(.+)/);
    const sourceMatch = yamlContent.match(/来源:\s*(.+)/);
    const paperMatch = yamlContent.match(/套卷:\s*(.+)/);

    const tags: string[] = [];
    if (categoryMatch) tags.push(categoryMatch[1].trim());
    if (paperMatch) tags.push(paperMatch[1].trim());
    if (sourceMatch) tags.push(sourceMatch[1].trim());

    if (tags.length > 0) {
      category = tags.join(' | ');
    }
  }

  // Split by ## 阅读材料
  const materialBlocks = remainingText.split(/(?=##\s*阅读材料)/);

  for (const block of materialBlocks) {
    if (!block.trim()) continue;

    // Split block into passage and questions
    const parts = block.split(
      /(?=###?\s*(?:题目面板|题目|试题|练习题|练习|Questions|Tasks|备选词[库汇]|备选词|Words Bank))/i
    );
    const passageText = parts[0];

    // Extract title
    const titleMatch = passageText.match(/##\s*阅读材料[^:]*:\s*(.+)/);
    let title = '未命名阅读材料';
    let content = passageText;

    if (titleMatch) {
      title = titleMatch[1].trim();
      content = passageText.replace(titleMatch[0], '').trim();
    } else {
      const h1Match = passageText.match(/^#\s+(.+)$/m);
      if (h1Match) {
        title = h1Match[1].trim();
      }
    }

    const readingType = detectReadingType(block, category, title);
    const parsedQuestions = parseQuestionsFromContent(block, category, title);
    const wordBank = readingType === 'cloze' ? extractWordBank(block) : undefined;

    materials.push({
      title,
      category,
      content,
      readingType,
      questions: parsedQuestions,
      wordBank,
    });
  }

  return materials;
}
