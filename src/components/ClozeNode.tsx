import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';

export const ClozeNode = Node.create({
  name: 'cloze',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      blankNumber: { default: '1' }
    }
  },

  parseHTML() {
    return [{ tag: 'cloze[data-blank]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['cloze', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer((props) => {
      // For now, just render a styled box. The actual Cloze logic requires Context or we can just render the placeholder here.
      // Wait, ReadingView handles Cloze input.
      return (
        <NodeViewWrapper as="span" className="inline-block mx-1">
          <span className="px-2 py-0.5 bg-slate-200 rounded text-xs text-slate-700">
            [{props.node.attrs.blankNumber}]
          </span>
        </NodeViewWrapper>
      )
    })
  }
})
