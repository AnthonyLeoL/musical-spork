import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Tile } from '../game/tiles';

/** Custom properties aren't in React's CSSProperties type, so tile styles that set
 * `--tile-progress` (read by the color-mix/glow rules in styles.css) need this escape hatch. */
type TileStyle = CSSProperties & { '--tile-progress'?: number };

const TILE_SIZE = 56;
const GAP = 10;
const SLOT_WIDTH = TILE_SIZE + GAP;

interface LetterRackProps {
  tiles: Tile[];
  onReorder: (tiles: Tile[]) => void;
  disabled?: boolean;
  /** foundWords / wordsAtRung for the current rung, 0–1. Tiles tint from their
   * normal color toward gold in direct proportion — 1 of 5 words found is 20% of
   * the way there, 1 of 1 is the full, fully-celebratory gold. Drives both the
   * color-mix and the glow/scale intensity in CSS, so "more found" always just
   * *reads* as more done, not a single flip at the end. */
  progress?: number;
  /** True for the instant after a correct guess — triggers a one-shot flash/pop
   * across the rack so finding a word actually feels like something happened. */
  justFound?: boolean;
}

/**
 * A row of letter tiles the player drags to reorder. Locked tiles (from
 * hints) always sit as a fixed prefix and can't be dragged — see the
 * engine's hint-locking contract in gameEngine.ts.
 *
 * Implemented with the Pointer Events API (not HTML5 drag-and-drop) so the
 * same code path handles mouse and touch. Every tile is absolutely
 * positioned via a `left` that's animated with a CSS transition; while
 * dragging, the other tiles' target slots are computed as if the dragged
 * tile weren't in the sequence at all, with a gap reopened wherever the
 * pointer currently is — so they visibly close ranks and part again around
 * the hover point. The actual array order is only finalized on drop, when
 * the parent is notified via onReorder (checking a finished arrangement is
 * a separate, explicit action — see onCheck elsewhere).
 */
export function LetterRack({
  tiles,
  onReorder,
  disabled = false,
  progress = 0,
  justFound = false,
}: LetterRackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const [grabOffset, setGrabOffset] = useState(0);
  const [hoverIndex, setHoverIndex] = useState(0);

  const lockedCount = tiles.filter((t) => t.locked).length;
  const draggedOriginalIndex = dragId === null ? -1 : tiles.findIndex((t) => t.id === dragId);

  function handlePointerDown(e: React.PointerEvent, tile: Tile, index: number): void {
    if (disabled || tile.locked) return;
    const container = containerRef.current;
    if (!container) return;
    container.setPointerCapture(e.pointerId);
    const containerRect = container.getBoundingClientRect();
    const tileLeft = index * SLOT_WIDTH;
    setDragId(tile.id);
    setGrabOffset(e.clientX - containerRect.left - tileLeft);
    setDragX(tileLeft);
    setHoverIndex(index);
  }

  function handlePointerMove(e: React.PointerEvent): void {
    if (dragId === null || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - containerRect.left - grabOffset;
    setDragX(x);

    const rawIndex = Math.round(x / SLOT_WIDTH);
    const clamped = Math.min(Math.max(rawIndex, lockedCount), tiles.length - 1);
    setHoverIndex(clamped);
  }

  function handlePointerUp(): void {
    if (dragId === null) return;
    const fromIndex = tiles.findIndex((t) => t.id === dragId);
    if (fromIndex !== -1 && fromIndex !== hoverIndex) {
      const next = tiles.slice();
      const [moved] = next.splice(fromIndex, 1);
      next.splice(hoverIndex, 0, moved!);
      onReorder(next);
    }
    setDragId(null);
  }

  /** Where tile `index` should sit right now: unaffected while idle; while
   * dragging, every other tile's slot is computed as though the dragged
   * tile had been removed from the sequence, then a gap is reopened at
   * `hoverIndex`. */
  function visualSlot(index: number): number {
    if (dragId === null || index === draggedOriginalIndex) return index;
    const withoutDragged = index < draggedOriginalIndex ? index : index - 1;
    return withoutDragged >= hoverIndex ? withoutDragged + 1 : withoutDragged;
  }

  const width = tiles.length * TILE_SIZE + Math.max(0, tiles.length - 1) * GAP;

  return (
    <div
      ref={containerRef}
      className={['letter-rack', justFound ? 'letter-rack--flash' : ''].filter(Boolean).join(' ')}
      style={{ width, height: TILE_SIZE, touchAction: 'none' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {tiles.map((tile, i) => {
        const isDragging = tile.id === dragId;
        const left = isDragging ? dragX : visualSlot(i) * SLOT_WIDTH;
        return (
          <div
            key={tile.id}
            onPointerDown={(e) => handlePointerDown(e, tile, i)}
            className={[
              'letter-tile',
              progress > 0 ? 'letter-tile--progress' : '',
              progress >= 1 ? 'letter-tile--complete' : '',
              tile.locked ? 'letter-tile--locked' : '',
              isDragging ? 'letter-tile--dragging' : '',
              tile.entering ? 'letter-tile--entering' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={
              {
                width: TILE_SIZE,
                height: TILE_SIZE,
                left,
                '--tile-progress': progress,
              } as TileStyle
            }
          >
            {tile.letter.toUpperCase()}
          </div>
        );
      })}
    </div>
  );
}
