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
 * Pure React, robust parsing:
 * - H1, H2, H3, H4 (handles prefixes like •, -, and cleans up accidental text)
 * - Blockquotes & code blocks
 * - Ordered & unordered lists
 * - Inline bold, italic, strikethrough, inline code
 * - <mark style="...">, <mark data-color="...">, ==highlight==, <span style="color: ...">
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

  // Pre-normalize escaped WikiLinks: \[\[ -> [[, \]\] -> ]]
  const normalizedContent = content
    .replace(/\\\[\\\[/g, '[[')
    .replace(/\\\]\\\]/g, ']]');

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
  const lines = normalizedContent.split('\n');
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
          <div
            key={`code-${i}`}
            className="my-3 rounded-xl overflow-hidden bg-slate-900 text-slate-100 font-mono text-xs shadow-inner"
          >
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

    // 1. Headings (Supports #, ##, ###, ####, even when prefixed by bullets or placeholder text)
    const headingMatch = line.trim().match(/^(?:[-*+•]\s*)?(?:无序列表项\s*)?(#{1,6})\s*(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].replace(/^无序列表项\s*/, '').trim();

      if (level === 1) {
        renderedElements.push(
          <h1
            key={`h1-${i}`}
            className="text-xl sm:text-2xl font-bold text-[#1E293B] mt-5 mb-2 pb-1.5 border-b border-slate-200"
          >
            {renderInlineText(headingText, onWikiLinkClick, knownNoteTitles, `h1-in-${i}`, inlineContext)}
          </h1>
        );
      } else if (level === 2) {
        renderedElements.push(
          <h2
            key={`h2-${i}`}
            className="text-lg sm:text-xl font-bold text-[#2C4056] mt-4 mb-2"
          >
            {renderInlineText(headingText, onWikiLinkClick, knownNoteTitles, `h2-in-${i}`, inlineContext)}
          </h2>
        );
      } else if (level === 3) {
        renderedElements.push(
          <h3
            key={`h3-${i}`}
            className="text-base sm:text-lg font-semibold text-[#3D536B] mt-3 mb-1.5"
          >
            {renderInlineText(headingText, onWikiLinkClick, knownNoteTitles, `h3-in-${i}`, inlineContext)}
          </h3>
        );
      } else {
        renderedElements.push(
          <h4
            key={`h4-${i}`}
            className="text-sm sm:text-base font-semibold text-[#4C6378] mt-2.5 mb-1"
          >
            {renderInlineText(headingText, onWikiLinkClick, knownNoteTitles, `h4-in-${i}`, inlineContext)}
          </h4>
        );
      }
      continue;
    }

    // 2. Horizontal rule
    if (/^(\*\*\*|---|___)$/.test(line.trim())) {
      renderedElements.push(<hr key={`hr-${i}`} className="my-4 border-slate-200" />);
      continue;
    }

    // 3. Blockquote
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

    // 4. Unordered list (Supports -, *, +, • and cleans up any accidental placeholder strings)
    if (/^(\*|-|\+|•)\s/.test(line.trim())) {
      let listText = line.trim().replace(/^(\*|-|\+|•)\s+/, '');
      listText = listText.replace(/^无序列表项\s*/, '');

      renderedElements.push(
        <li key={`ul-${i}`} className="ml-5 list-disc text-sm text-slate-800 leading-relaxed my-1">
          {renderInlineText(listText, onWikiLinkClick, knownNoteTitles, `ul-in-${i}`, inlineContext)}
        </li>
      );
      continue;
    }

    // 5. Ordered list
    if (/^\d+\.\s/.test(line.trim())) {
      const match = line.trim().match(/^(\d+)\.\s(.*)$/);
      if (match) {
        renderedElements.push(
          <div key={`ol-${i}`} className="flex items-start gap-2 ml-1 text-sm text-slate-800 leading-relaxed my-1">
            <span className="shrink-0 w-5 text-right font-medium text-slate-500 font-mono text-xs mt-0.5">
              {match[1]}.
            </span>
            <div className="flex-1">
              {renderInlineText(match[2], onWikiLinkClick, knownNoteTitles, `ol-in-${i}`, inlineContext)}
            </div>
          </div>
        );
        continue;
      }
    }

    // 6. Empty line
    if (!line.trim()) {
      renderedElements.push(<div key={`sp-${i}`} className="h-2" />);
      continue;
    }

    // 7. Standard paragraph
    let pText = line.replace(/^无序列表项\s*/, '');
    renderedElements.push(
      <p key={`p-${i}`} className="text-sm text-slate-800 leading-relaxed my-1.5">
        {renderInlineText(pText, onWikiLinkClick, knownNoteTitles, `p-in-${i}`, inlineContext)}
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
  if (!rawText) return null;

  // Unescape any escaped WikiLink brackets in text
  const cleanRaw = rawText
    .replace(/\\\[\\\[/g, '[[')
    .replace(/\\\]\\\]/g, ']]');

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
  const regex = /(\[\[[\s\S]*?\]\]|<mark[^>]*>[\s\S]*?<\/mark>|<span[^>]*>[\s\S]*?<\/span>|==[\s\S]*?==|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|\[\d+\])/g;
  const parts = cleanRaw.split(regex);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (!part) return null;

    // 1. [[Wiki Link]] (Handles nested tags if user highlighted inside title, normalizes colons)
    if (part.startsWith('[[') && part.endsWith(']]')) {
      const rawTitle = part.slice(2, -2).trim();
      // Strip any inner HTML markup from the target title (e.g. if a mark was placed inside [[ ]])
      const linkTitle = rawTitle.replace(/<[^>]+>/g, '').trim();

      // Normalize Chinese colon '：' and English colon ':' for seamless matching
      const norm = (s: string) => s.replace(/：/g, ':').trim().toLowerCase();
      const exists = knownNoteTitles.some(
        (t) => norm(t) === norm(linkTitle)
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

    // 2. <mark ...>...</mark> (Supports data-color, style background-color, and recursive inner parsing)
    if (part.startsWith('<mark') && part.endsWith('</mark>')) {
      const bgMatch = part.match(/background(?:-color)?:\s*([^;"]+)/i);
      const dataColorMatch = part.match(/data-color=["']([^"']+)["']/i);
      const colorMatch = part.match(/(?:^|;|\s)color:\s*([^;"]+)/i);
      const textMatch = part.match(/<mark[^>]*>([\s\S]*?)<\/mark>/i);
      const inner = textMatch ? textMatch[1] : '';
      
      const bgColor = bgMatch
        ? bgMatch[1].trim()
        : dataColorMatch
        ? dataColorMatch[1].trim()
        : '#FEF08A';
      const textColor = colorMatch ? colorMatch[1].trim() : 'inherit';

      return (
        <mark
          key={key}
          className="px-1 py-0.5 rounded font-medium mx-0.5 inline relative"
          style={{
            backgroundColor: bgColor !== 'transparent' ? bgColor : undefined,
            color: textColor !== 'inherit' ? textColor : undefined,
          }}
        >
          {renderInlineText(inner, onWikiLinkClick, knownNoteTitles, `${key}-in`, context)}
        </mark>
      );
    }

    // 3. <span style="color: ...">...</span> (Supports color and background-color, recursive inner parsing)
    if (part.startsWith('<span') && part.endsWith('</span>')) {
      const colorMatch = part.match(/color:\s*([^;"]+)/i);
      const bgMatch = part.match(/background(?:-color)?:\s*([^;"]+)/i);
      const textMatch = part.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
      const inner = textMatch ? textMatch[1] : '';
      const textColor = colorMatch ? colorMatch[1].trim() : undefined;
      const bgColor = bgMatch ? bgMatch[1].trim() : undefined;

      return (
        <span
          key={key}
          style={{
            color: textColor,
            backgroundColor: bgColor,
          }}
          className="font-medium"
        >
          {renderInlineText(inner, onWikiLinkClick, knownNoteTitles, `${key}-in`, context)}
        </span>
      );
    }

    // 4. ==highlight==
    if (part.startsWith('==') && part.endsWith('==') && part.length >= 4) {
      return (
        <mark key={key} className="bg-amber-200 text-slate-900 px-1 py-0.5 rounded mx-0.5 font-medium">
          {renderInlineText(part.slice(2, -2), onWikiLinkClick, knownNoteTitles, `${key}-in`, context)}
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
          {renderInlineText(part.slice(2, -2), onWikiLinkClick, knownNoteTitles, `${key}-b`, context)}
        </strong>
      );
    }

    // 7. *italic*
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={key} className="italic text-slate-800">
          {renderInlineText(part.slice(1, -1), onWikiLinkClick, knownNoteTitles, `${key}-i`, context)}
        </em>
      );
    }

    // 8. ~~strikethrough~~
    if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
      return (
        <del key={key} className="line-through text-slate-400">
          {renderInlineText(part.slice(2, -2), onWikiLinkClick, knownNoteTitles, `${key}-del`, context)}
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
