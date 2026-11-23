"use client";

import { shortId } from "@/lib/explorer";
import CopyButton from "@/components/CopyButton";

/** Truncated monospace identifier with a copy button; links out when `href` is given. */
export function CopyableCell({ text, href }: { text: string; href?: string }) {
  if (!text) return <span className="text-ide-faint">—</span>;

  const label = shortId(text, 6, 6);
  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={`${text} · view on Stellar Expert`}
          className="font-mono text-xs text-ide-subtle transition-colors hover:text-brand-soft"
        >
          {label}
        </a>
      ) : (
        <code className="font-mono text-xs text-ide-subtle" title={text}>
          {label}
        </code>
      )}
      <CopyButton value={text} showLabel={false} title="Copy full value" />
    </div>
  );
}
