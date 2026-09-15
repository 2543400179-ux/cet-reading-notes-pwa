import React, { useMemo } from 'react';
import MarkdownIt from 'markdown-it';
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

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

/**
 * Unified Markdown & WYSIWYG Preview Renderer
 * Strictly synchronized with TipTap RichTextEditor rendering:
 * - Identical typography, heading styles, bullet/ordered lists, blockquotes, and code blocks
 * - Pixel-perfect highlight boundaries without bleeding into neighboring text
 * - Continuous, unfragmented rectangular highlights without rounded corners or gaps
 * - Fully stackable bold, italic, strikethrough, text color, and background highlights
 * - Interactive [[WikiLinks]] that navigate in preview mode
 */
export function MarkdownRenderer({
  content,
  onWikiLinkClick,
  knownNoteTitles = [],
  className = '',
}: MarkdownRendererProps) {
  const renderedHtml = useMemo(() => {
    if (!content) return '';

    let text = content;

    // 1. Pre-normalize escaped brackets
    text = text
      .replace(/\\\[\\\[/g, '[[')
      .replace(/\\\]\\\]/g, ']]');

    // 2. Normalize shorthand ==highlight== to <mark>
    text = text.replace(
      /==([\s\S]*?)==/g,
      '<mark style="background-color: #FEF08A; color: inherit;">$1</mark>'
    );

    // 3. Transform [[WikiLink]] into interactive buttons
    const norm = (s: string) => s.replace(/：/g, ':').trim().toLowerCase();

    text = text.replace(/\[\[([^\]\n]+)\]\]/g, (_, rawTitle) => {
      const cleanTitle = rawTitle.replace(/<[^>]+>/g, '').trim();
      const exists = knownNoteTitles.some((t) => norm(t) === norm(cleanTitle));

      const btnClass = exists
        ? 'inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md text-xs font-medium cursor-pointer transition active:scale-95 select-none bg-[#E2EBF2] text-[#2C4056] hover:bg-[#D3E1ED] border border-[#BACCDD] align-baseline shadow-2xs'
        : 'inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md text-xs font-medium cursor-pointer transition active:scale-95 select-none bg-amber-50 text-amber-900 hover:bg-amber-100 border border-dashed border-amber-300 align-baseline shadow-2xs';

      const icon = exists ? '🔗' : '✨';
      const tooltip = exists ? `跳转到笔记《${cleanTitle}》` : `新建并打开笔记《${cleanTitle}》`;

      return `<button type="button" data-wiki-link="${cleanTitle}" title="${tooltip}" class="${btnClass}">${icon} ${cleanTitle}</button>`;
    });

    // 4. Render standard Markdown to rich HTML
    return md.render(text);
  }, [content, knownNoteTitles]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const wikiBtn = target.closest('[data-wiki-link]');
    if (wikiBtn && onWikiLinkClick) {
      e.preventDefault();
      e.stopPropagation();
      const title = wikiBtn.getAttribute('data-wiki-link');
      if (title) {
        onWikiLinkClick(title);
      }
    }
  };

  if (!content) return null;

  return (
    <div
      className={`markdown-body space-y-1 ${className}`}
      onClick={handleContainerClick}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}
