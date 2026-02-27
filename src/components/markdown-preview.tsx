'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { cn } from '@/lib/utils';

let mermaidCounter = 0;

function MermaidBlock({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useMemo(() => `mermaid-${++mermaidCounter}`, []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    import('mermaid')
      .then(({ default: mermaid }) => {
        if (cancelled) return;
        mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
        return mermaid.render(id, chart);
      })
      .then((result) => {
        if (cancelled || !result) return;
        if (ref.current) ref.current.innerHTML = result.svg;
      })
      .catch((err) => {
        if (!cancelled && ref.current) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id, chart]);

  if (error) return <div className="my-4 text-red-600">Mermaid error: {error}</div>;
  return <div ref={ref} className="my-4 overflow-x-auto" />;
}

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  return (
    <div className={cn('markdown-preview', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
          h4: ({ children }) => <h4 className="text-base font-bold mb-2 mt-3">{children}</h4>,
          p: ({ children }) => <p className="mb-4">{children}</p>,
          ul: ({ children }) => <ul className="md-ul">{children}</ul>,
          ol: ({ children }) => <ol className="md-ol">{children}</ol>,
          li: ({ children }) => <li className="md-li">{children}</li>,
          blockquote: ({ children }) => <blockquote className="md-quote">{children}</blockquote>,
          hr: () => <hr className="md-hr" />,
          a: ({ href, children }) => (
            <a href={href} className="md-link" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          // Tables (remark-gfm)
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full border-4 border-black text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-black text-white">{children}</thead>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-bold uppercase">{children}</th>
          ),
          td: ({ children }) => <td className="px-3 py-2 border-t-2 border-black">{children}</td>,
          // Code blocks + Mermaid
          code: ({ className: cls, children, ...props }) => {
            const lang = /language-(\w+)/.exec(cls || '')?.[1];
            if (lang === 'mermaid') {
              return <MermaidBlock chart={String(children).trim()} />;
            }
            // Inline code (no language class)
            if (!cls) {
              return (
                <code className="inline-code" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="code-block" data-lang={lang}>
                <code>{children}</code>
              </pre>
            );
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
