import type { Highlight } from '../types';

export interface TextSegment {
  text: string;
  startPos: number;
  endPos: number;
  highlights?: Highlight[];
}

/**
 * Split text into segments, allowing overlapping highlights.
 */
export function segmentTextWithHighlights(
  rawText: string,
  highlights: Highlight[]
): TextSegment[] {
  if (!highlights || highlights.length === 0) {
    return [{ text: rawText, startPos: 0, endPos: rawText.length, highlights: [] }];
  }

  // Create an array of event points (start or end of a highlight)
  const events: { pos: number; type: 'start' | 'end'; highlight: Highlight }[] = [];
  
  for (const hl of highlights) {
    if (hl.startPos < hl.endPos && hl.startPos < rawText.length) {
      events.push({ pos: Math.max(0, hl.startPos), type: 'start', highlight: hl });
      events.push({ pos: Math.min(rawText.length, hl.endPos), type: 'end', highlight: hl });
    }
  }

  // Sort events primarily by position.
  events.sort((a, b) => a.pos - b.pos);

  const segments: TextSegment[] = [];
  let cursor = 0;
  const activeHighlights = new Set<Highlight>();

  for (const event of events) {
    if (event.pos > cursor) {
      segments.push({
        text: rawText.slice(cursor, event.pos),
        startPos: cursor,
        endPos: event.pos,
        highlights: Array.from(activeHighlights)
      });
      cursor = event.pos;
    }
    
    if (event.type === 'start') {
      activeHighlights.add(event.highlight);
    } else {
      activeHighlights.delete(event.highlight);
    }
  }

  if (cursor < rawText.length) {
    segments.push({
      text: rawText.slice(cursor),
      startPos: cursor,
      endPos: rawText.length,
      highlights: []
    });
  }

  return segments.filter(seg => seg.startPos < seg.endPos);
}

/**
 * Calculate character offset within a container element
 */
export function getSelectionCharOffsets(
  container: HTMLElement,
  range: Range
): { start: number; end: number } | null {
  const preSelectionRange = range.cloneRange();
  preSelectionRange.selectNodeContents(container);
  preSelectionRange.setEnd(range.startContainer, range.startOffset);
  const start = preSelectionRange.toString().length;

  return {
    start,
    end: start + range.toString().length,
  };
}
// synced
