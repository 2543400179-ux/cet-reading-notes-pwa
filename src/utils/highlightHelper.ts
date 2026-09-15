import type { Highlight } from '../types';

export interface TextSegment {
  text: string;
  startPos: number;
  endPos: number;
  highlights?: Highlight[];
}

/**
 * Apply a highlight update (background and/or text color) to existing highlights
 * in an interval-based manner so that:
 * 1. Text color and background color can overlay on the same text.
 * 2. Applying the same color replaces rather than endlessly stacking duplicate layers.
 * 3. Clearing/deleting removes highlights cleanly across the range.
 */
export function applyHighlightToIntervals(
  existing: Highlight[],
  range: { start: number; end: number },
  updates: { bgColor?: string; textColor?: string },
  materialId: string
): Highlight[] {
  if (range.start >= range.end) return existing;

  const points = new Set<number>([range.start, range.end]);
  for (const h of existing) {
    points.add(Math.max(0, h.startPos));
    points.add(Math.max(0, h.endPos));
  }

  const sortedPoints = Array.from(points).sort((a, b) => a - b);
  const slices: { startPos: number; endPos: number; bgColor: string; textColor: string }[] = [];

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const s = sortedPoints[i];
    const e = sortedPoints[i + 1];
    if (s >= e) continue;

    // Find style from existing highlight at this slice
    const prev = existing.find((h) => h.startPos <= s && h.endPos >= e);
    let bg = prev ? prev.bgColor : 'transparent';
    let text = prev ? prev.textColor : 'inherit';

    // If slice intersects the target range, apply updates
    if (s >= range.start && e <= range.end) {
      if (updates.bgColor !== undefined) bg = updates.bgColor;
      if (updates.textColor !== undefined) text = updates.textColor;
    }

    const hasBg = bg && bg !== 'transparent' && bg !== '';
    const hasText = text && text !== 'inherit' && text !== '';

    if (hasBg || hasText) {
      slices.push({
        startPos: s,
        endPos: e,
        bgColor: hasBg ? bg : 'transparent',
        textColor: hasText ? text : 'inherit',
      });
    }
  }

  // Merge adjacent slices with identical styling
  const merged: Highlight[] = [];
  for (const sl of slices) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.endPos === sl.startPos &&
      last.bgColor === sl.bgColor &&
      last.textColor === sl.textColor
    ) {
      last.endPos = sl.endPos;
    } else {
      merged.push({
        id: `hl-${materialId}-${sl.startPos}-${sl.endPos}-${Date.now()}`,
        materialId,
        startPos: sl.startPos,
        endPos: sl.endPos,
        bgColor: sl.bgColor,
        textColor: sl.textColor,
      });
    }
  }

  return merged;
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
