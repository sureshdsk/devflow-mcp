"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

// Simple markdown parser for common patterns
function parseMarkdown(text: string): string {
  if (!text) return "";

  let html = text
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Code blocks (before other patterns to preserve content)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre class="code-block" data-lang="${lang}"><code>${code.trim()}</code></pre>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link" target="_blank" rel="noopener">$1</a>')
    // Unordered lists
    .replace(/^[\-\*] (.+)$/gm, '<li class="md-li">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="md-li-ordered">$1</li>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote class="md-quote">$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="md-hr" />')
    // Line breaks (paragraphs)
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br />");

  // Wrap consecutive list items
  html = html.replace(
    /(<li class="md-li">[\s\S]*?<\/li>(\s*<br \/>)?)+/g,
    (match) => `<ul class="md-ul">${match.replace(/<br \/>/g, "")}</ul>`
  );

  html = html.replace(
    /(<li class="md-li-ordered">[\s\S]*?<\/li>(\s*<br \/>)?)+/g,
    (match) => `<ol class="md-ol">${match.replace(/<br \/>/g, "").replace(/md-li-ordered/g, "md-li")}</ol>`
  );

  // Wrap in paragraph
  return `<p>${html}</p>`;
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  const html = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div
      className={cn("markdown-preview", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
