import React from 'react';
import { Link as LinkIcon, Sparkles } from 'lucide-react';
import { ClozeBlankInline } from './ClozeBlankInline';
import type { Question, WordBankItem } from '../types';

interface MarkdownRendererProps {
  content: string;
  onWikiLinkClick?: (title: string) => void;
  knownNoteTitles?: string[];
  className?: string;
  readingType?: 'cloze' | 'choice' | 'match';
  questions?: Question[];
  wordBank?: WordBankItem[];
  isSubmitted?: boolean;
  onClozeSelectWord?: (questionId: string, letter: string) => void;
  onClozeClearWord?: (questionId: string) => void;
}

/**
 * Custom High-Fidelity Markdown & WikiLink & HTML Highlight Renderer
 * Pure React, zero heavy external parser quirks, supports:
 * - H1, H2, H3, H4
 * - Blockquotes & code blocks
 * - Ordered & unordered lists
 * - Inline bold, italic, strikethrough, inline code
 * - <mark style="...">, ==highlight==, <span style="color: ...">
 * - Interactive [[Wiki Links]] with auto existence detection & click handling
 */
export function MarkdownRenderer({
  content,
  onWikiLinkClick,
  knownNoteTitles = [],
  className = '',
  readingType,
  questions,
  wordBank,
  isSubmitted,
  onClozeSelectWord,
  onClozeClearWord,
}: MarkdownRendererProps) {
  if (!content) return null;

  // Context for inline rendering
  const inlineContext = {
    readingType,
    questions,
    wordBank,
    isSubmitted,
    onClozeSelectWord,
    onClozeClearWord,
  };

  // Split into lines
  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // Close code block
        renderedElements.push(
          <div key={`code-${i}`} className="my-3 rounded-xl overflow-hidden bg-slate-900 text-slate-100 font-mono text-xs shadow-inner">
            {codeBlockLang && (
              <div className="px-3 py-1 bg-slate-800 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-700/50">
                {codeBlockLang}
              </div>
            )}
            <pre className="p-3 overflow-x-auto leading-relaxed">
              <code>{codeBlockBuffer.join('\n')}</code>
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeBlockBuffer = [];
        codeBlockLang = '';
      } else {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
        codeBlockBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(line);
      continue;
    }

    // Headings
    if (/^#\s+/.test(line) || /^#([^#\s].*)$/.test(line)) {
      const match = line.match(/^#\s*(.*)$/);
      renderedElements.push(
        <h1 key={`h1-${i}`} className="text-xl sm:text-2xl font-bold text-[#1E293B] mt-5 mb-2 pb-1.5 border-b border-slate-200">
          {renderInlineText(match ? match[1] : line.slice(1), onWikiLinkClick, knownNoteTitles, `h1-in-${i}`, inlineContext)}
        </h1>
      );
      continue;
    }
    if (/^##\s+/.test(line) || /^##([^#\s].*)$/.test(line)) {
      const match = line.match(/^##\s*(.*)$/);
      renderedElements.push(
        <h2 key={`h2-${i}`} className="text-lg sm:text-xl font-bold text-[#2C4056] mt-4 mb-2">
          {renderInlineText(match ? match[1] : line.slice(2), onWikiLinkClick, knownNoteTitles, `h2-in-${i}`, inlineContext)}
        </h2>
      );
      continue;
    }
    if (/^###\s+/.test(line) || /^###([^#\s].*)$/.test(line)) {
      const match = line.match(/^###\s*(.*)$/);
      renderedElements.push(
        <h3 key={`h3-${i}`} className="text-base sm:text-lg font-semibold text-[#3D536B] mt-3 mb-1.5">
          {renderInlineText(match ? match[1] : line.slice(3), onWikiLinkClick, knownNoteTitles, `h3-in-${i}`, inlineContext)}
        </h3>
      );
      continue;
    }
    if (/^####\s+/.test(line) || /^####([^#\s].*)$/.test(line)) {
      const match = line.match(/^####\s*(.*)$/);
      renderedElements.push(
        <h4 key={`h4-${i}`} className="text-sm sm:text-base font-semibold text-[#4C6378] mt-2.5 mb-1">
          {renderInlineText(match ? match[1] : line.slice(4), onWikiLinkClick, knownNoteTitles, `h4-in-${i}`, inlineContext)}
        </h4>
      );
      continue;
    }

    // Horizontal rule
    if (/^(\*\*\*|---|___)$/.test(line.trim())) {
      renderedElements.push(<hr key={`hr-${i}`} className="my-4 border-slate-200" />);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      renderedElements.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-4 border-[#4C6378] pl-3.5 py-1.5 my-2.5 bg-slate-50/80 rounded-r-lg text-slate-700 italic text-sm leading-relaxed"
        >
          {renderInlineText(line.slice(2), onWikiLinkClick, knownNoteTitles, `quote-in-${i}`, inlineContext)}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^(\*|-|\+)\s/.test(line)) {
      const listText = line.replace(/^(\*|-|\+)\s/, '');
      renderedElements.push(
        <li key={`ul-${i}`} className="ml-5 list-disc text-sm text-slate-800 leading-relaxed my-1">
          {renderInlineText(listText, onWikiLinkClick, knownNoteTitles, `ul-in-${i}`, inlineContext)}
        </li>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        renderedElements.push(
          <div key={`ol-${i}`} className="flex items-start gap-2 ml-1 text-sm text-slate-800 leading-relaxed my-1">
            <span className="shrink-0 w-5 text-right font-medium text-slate-500 font-mono text-xs mt-0.5">{match[1]}.</span>
            <div className="flex-1">{renderInlineText(match[2], onWikiLinkClick, knownNoteTitles, `ol-in-${i}`, inlineContext)}</div>
          </div>
        );
        continue;
      }
    }

    // Empty line
    if (!line.trim()) {
      renderedElements.push(<div key={`sp-${i}`} className="h-2" />);
      continue;
    }

    // Standard paragraph
    renderedElements.push(
      <p key={`p-${i}`} className="text-sm text-slate-800 leading-relaxed my-1.5">
        {renderInlineText(line, onWikiLinkClick, knownNoteTitles, `p-in-${i}`, inlineContext)}
      </p>
    );
  }

  return <div className={`markdown-body space-y-0.5 ${className}`}>{renderedElements}</div>;
}

/**
 * Render inline tokens: WikiLinks [[...]], HTML <mark>, <span style="color:...">, ==highlight==, bold, italic, strikethrough, code
 */
export function renderInlineText(
  rawText: string,
  onWikiLinkClick?: (title: string) => void,
  knownNoteTitles: string[] = [],
  keyPrefix = 'inline',
  context?: {
    readingType?: 'cloze' | 'choice' | 'match';
    questions?: Question[];
    wordBank?: WordBankItem[];
    isSubmitted?: boolean;
    onClozeSelectWord?: (questionId: string, letter: string) => void;
    onClozeClearWord?: (questionId: string) => void;
  }
): React.ReactNode {
  // Regex to match:
  // 1. [[Wiki Links]]
  // 2. <mark ...>...</mark>
  // 3. <span ...>...</span>
  // 4. ==highlight==
  // 5. `inline code`
  // 6. **bold**
  // 7. *italic*
  // 8. ~~strikethrough~~
  // 9. [26] for cloze blanks
  
  const regex = /(\[\[.*?\]\]|<mark[^>]*>[\s\S]*?<\/mark>|<span[^>]*>[\s\S]*?<\/span>|==[\s\S]*?==|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|\[\d+\])/g;
  const parts = rawText.split(regex);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (!part) return null;

    // 1. [[Wiki Link]]
    if (part.startsWith('[[') && part.endsWith(']]')) {
      const linkTitle = part.slice(2, -2).trim();
      const exists = knownNoteTitles.some(
        (t) => t.trim().toLowerCase() === linkTitle.toLowerCase()
      );

      return (
        <button
          key={key}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onWikiLinkClick?.(linkTitle);
          }}
          title={exists ? `跳转到笔记《${linkTitle}》` : `新建并打开笔记《${linkTitle}》`}
          className={`inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md text-xs font-medium cursor-pointer transition active:scale-95 select-none ${
            exists
              ? 'bg-[#E2EBF2] text-[#2C4056] hover:bg-[#D3E1ED] border border-[#BACCDD]'
              : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-dashed border-amber-300'
          }`}
        >
          <LinkIcon className="w-3 h-3 opacity-70" />
          <span>{linkTitle}</span>
          {!exists && <Sparkles className="w-2.5 h-2.5 text-amber-600" />}
        </button>
      );
    }

    // 2. <mark ...>...</mark>
    if (part.startsWith('<mark') && part.endsWith('</mark>')) {
      const bgMatch = part.match(/background(?:-color)?:\s*([^;"]+)/i);
      const colorMatch = part.match(/(?:^|;|\s)color:\s*([^;"]+)/i);
      const textMatch = part.match(/<mark[^>]*>(.*?)<\/mark>/s);
      const inner = textMatch ? textMatch[1] : '';
      const bgColor = bgMatch ? bgMatch[1].trim() : '#FEF08A';
      const textColor = colorMatch ? colorMatch[1].trim() : 'inherit';

      return (
        <mark
          key={key}
          className="px-1 py-0.5 rounded text-inherit font-medium mx-0.5"
          style={{ backgroundColor: bgColor, color: textColor }}
        >
          {inner}
        </mark>
      );
    }

    // 3. <span style="color: ...">...</span>
    if (part.startsWith('<span') && part.endsWith('</span>')) {
      const colorMatch = part.match(/color:\s*([^;"]+)/i);
      const textMatch = part.match(/<span[^>]*>(.*?)<\/span>/s);
      const inner = textMatch ? textMatch[1] : '';
      const textColor = colorMatch ? colorMatch[1].trim() : '#1E293B';

      return (
        <span key={key} style={{ color: textColor }} className="font-medium">
          {inner}
        </span>
      );
    }

    // 4. ==highlight==
    if (part.startsWith('==') && part.endsWith('==') && part.length >= 4) {
      return (
        <mark key={key} className="bg-amber-200 text-slate-900 px-1 py-0.5 rounded mx-0.5 font-medium">
          {part.slice(2, -2)}
        </mark>
      );
    }

    // 5. `inline code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={key} className="px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-100 text-slate-800 font-mono text-xs border border-slate-200">
          {part.slice(1, -1)}
        </code>
      );
    }

    // 6. **bold**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={key} className="font-bold text-[#1E293B]">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // 7. *italic*
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={key} className="italic text-slate-800">
          {part.slice(1, -1)}
        </em>
      );
    }

    // 8. ~~strikethrough~~
    if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
      return (
        <del key={key} className="line-through text-slate-400">
          {part.slice(2, -2)}
        </del>
      );
    }

    // 9. Cloze blanks e.g. [26]
    if (context?.readingType === 'cloze' && part.match(/^\[\d+\]$/)) {
      const num = parseInt(part.slice(1, -1), 10);
      const question = context.questions?.find((q) => Number(q.number) === num);
      
      return (
        <ClozeBlankInline
          key={key}
          blankNumber={num}
          question={question}
          wordBank={context.wordBank || []}
          isSubmitted={context.isSubmitted || false}
          onSelectWord={context.onClozeSelectWord || (() => {})}
          onClearWord={context.onClozeClearWord || (() => {})}
          allQuestions={context.questions || []}
        />
      );
    }

    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}
// synced
