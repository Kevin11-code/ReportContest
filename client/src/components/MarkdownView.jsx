import React from 'react';

/**
 * Lightweight, safe offline Markdown / Structured text renderer
 */
export default function MarkdownView({ content, className = '' }) {
  if (!content) return <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No content provided.</p>;

  // Convert markdown to clean structured HTML
  const formatMarkdown = (rawText) => {
    if (!rawText) return '';

    const lines = rawText.split('\n');
    const result = [];
    let inList = false;
    let listType = 'ul'; // 'ul' or 'ol'

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Empty line
      if (!line.trim()) {
        if (inList) {
          result.push(listType === 'ul' ? '</ul>' : '</ol>');
          inList = false;
        }
        continue;
      }

      // Headings
      if (line.startsWith('### ')) {
        if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
        const text = parseInline(line.substring(4));
        result.push(`<h3 class="md-h3">${text}</h3>`);
        continue;
      }
      if (line.startsWith('## ')) {
        if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
        const text = parseInline(line.substring(3));
        result.push(`<h2 class="md-h2">${text}</h2>`);
        continue;
      }
      if (line.startsWith('# ')) {
        if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
        const text = parseInline(line.substring(2));
        result.push(`<h1 class="md-h1">${text}</h1>`);
        continue;
      }

      // Blockquotes / Callout box
      if (line.startsWith('> ')) {
        if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
        const text = parseInline(line.substring(2));
        result.push(`<div class="md-callout">${text}</div>`);
        continue;
      }

      // Unordered list items (- or *)
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        if (!inList || listType !== 'ul') {
          if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>');
          result.push('<ul class="md-list">');
          inList = true;
          listType = 'ul';
        }
        const text = parseInline(line.trim().substring(2));
        result.push(`<li>${text}</li>`);
        continue;
      }

      // Ordered list items (1. 2. etc)
      const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        if (!inList || listType !== 'ol') {
          if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>');
          result.push('<ol class="md-olist">');
          inList = true;
          listType = 'ol';
        }
        const text = parseInline(numMatch[2]);
        result.push(`<li>${text}</li>`);
        continue;
      }

      // Regular paragraph
      if (inList) {
        result.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
      }

      result.push(`<p class="md-p">${parseInline(line)}</p>`);
    }

    if (inList) {
      result.push(listType === 'ul' ? '</ul>' : '</ol>');
    }

    return result.join('\n');
  };

  // Inline styling parser
  const parseInline = (text) => {
    if (!text) return '';
    let parsed = text;

    // Bold + Italic: ***text***
    parsed = parsed.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');

    // Bold: **text**
    parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong class="md-bold">$1</strong>');

    // Italic: *text* or _text_
    parsed = parsed.replace(/\*([^\*]+)\*/g, '<em class="md-italic">$1</em>');
    parsed = parsed.replace(/_([^_]+)_/g, '<em class="md-italic">$1</em>');

    // Code inline: `code`
    parsed = parsed.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');

    return parsed;
  };

  return (
    <div
      className={`markdown-renderer ${className}`}
      dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }}
    />
  );
}
