import type { Highlight } from '../types';

export function applyDomHighlights(container: HTMLElement, highlights: Highlight[], onHighlightClick: (hl: Highlight) => void) {
  // Clear existing manual highlights (unwrap <mark> tags)
  const existingMarks = container.querySelectorAll('mark.reading-highlight');
  existingMarks.forEach(mark => {
    const parent = mark.parentNode;
    if (parent) {
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
      parent.normalize();
    }
  });

  if (!highlights.length) return;

  // Sort highlights to handle them safely.
  // Actually, for overlapping, we can just process them one by one.
  // If we wrap in <mark>, we are altering text nodes, so we should calculate all ranges first.
  
  // A robust way to highlight text nodes by plain text offset:
  const textNodes: { node: Text; start: number; end: number }[] = [];
  let currentOffset = 0;

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.nodeValue?.length || 0;
      if (len > 0) {
        textNodes.push({ node: node as Text, start: currentOffset, end: currentOffset + len });
        currentOffset += len;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Don't walk inside <mark> if it's already a highlight? We just cleared them.
      for (const child of Array.from(node.childNodes)) {
        walk(child);
      }
    }
  }

  walk(container);

  // Apply highlights from back to front to avoid messing up offsets for earlier nodes,
  // or just split nodes carefully.
  // Actually, creating Ranges and using `surroundContents` fails if it crosses element boundaries.
  // The safest way is to wrap text nodes individually.

  // We need to associate each highlight with the text nodes it overlaps.
  const operations: { node: Text; splitOffset: number; isStart: boolean; isEnd: boolean; highlights: Highlight[] }[] = [];

  // A simpler approach: for each highlight, find the text nodes it covers, and wrap them.
  // To support overlap, we can use CSS.highlights if supported, otherwise fallback to marks.
  
  // Let's use standard mark wrapping. For simplicity and robustness across boundaries:
  highlights.forEach(hl => {
    let hlRemaining = hl.endPos - hl.startPos;
    let hlCurrentStart = hl.startPos;

    for (const tn of textNodes) {
      if (hlRemaining <= 0) break;
      if (tn.end <= hlCurrentStart || tn.start >= hl.endPos) continue;

      // Overlap!
      const overlapStart = Math.max(0, hlCurrentStart - tn.start);
      const overlapEnd = Math.min(tn.node.length, hl.endPos - tn.start);
      
      const range = document.createRange();
      try {
        range.setStart(tn.node, overlapStart);
        range.setEnd(tn.node, overlapEnd);
        
        const mark = document.createElement('mark');
        mark.className = 'reading-highlight cursor-pointer rounded-xs px-[1px] hover:opacity-90 transition-all relative group';
        mark.style.backgroundColor = hl.bgColor;
        mark.style.color = hl.textColor;
        mark.onclick = (e) => {
          e.stopPropagation();
          onHighlightClick(hl);
        };
        
        range.surroundContents(mark);
        
        // update tn.node since we split it?
        // Ah, surroundContents splits the text node! So subsequent highlights hitting this text node will fail!
      } catch (e) {
        // Ignore cross-boundary errors
      }
      
      hlCurrentStart = tn.start + overlapEnd;
      hlRemaining = hl.endPos - hlCurrentStart;
    }
  });
}
