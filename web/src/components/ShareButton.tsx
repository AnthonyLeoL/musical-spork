import { useState } from 'react';

interface ShareButtonProps {
  shareString: string;
}

/** Copies the share string to the clipboard — CLAUDE.md's "score for now
 * just copy pastes the scrambled words in order." */
export function ShareButton({ shareString }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick(): Promise<void> {
    try {
      await navigator.clipboard.writeText(shareString);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied/unavailable — the text is still
      // visible on screen, so this is a soft failure.
    }
  }

  return (
    <button type="button" className="button button--secondary" onClick={handleClick}>
      {copied ? 'Copied!' : 'Share score'}
    </button>
  );
}
