import { useEffect, useRef, useState } from 'react';
import type { Tile } from '../game/tiles';

const TILE_SIZE = 56;
const GAP = 8;
const SLOT_WIDTH = TILE_SIZE + GAP;

interface LetterRackProps {
  tiles: Tile[];
  onReorder: (tiles: Tile[]) => void;
  disabled?: boolean;
}

/**
 * A row of letter tiles the player drags to reorder. Locked tiles (from
 * hints) always sit as a fixed prefix and can't be dragged — see the
 * engine's hint-locking contract in gameEngine.ts.
 *
 * Implemented with the Pointer Events API (not HTML5 drag-and-drop) so the
 * same code path handles mouse and touch. Dragging a tile over another
 * slot swaps it in immediately (a "sortable list" pattern), finalized on
 * pointer up, when the parent is notified via onReorder.
 */
export function LetterRack({ tiles, onReorder, disabled = false }: LetterRackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [localTiles, setLocalTiles] = useState(tiles);
  const [dragId, setDragId] = useState<string | null>(null);

  // Adopt the parent's tile order whenever it changes from the outside
  // (new rung, hint used, resumed from storage) — but not while the player
  // has a drag in flight, or their in-progress move would be clobbered.
  useEffect(() => {
    if (dragId === null) {
      setLocalTiles(tiles);
    }
  }, [tiles, dragId]);

  const lockedCount = localTiles.filter((t) => t.locked).length;

  function handlePointerDown(e: React.PointerEvent, tile: Tile): void {
    if (disabled || tile.locked) return;
    containerRef.current?.setPointerCapture(e.pointerId);
    setDragId(tile.id);
  }

  function handlePointerMove(e: React.PointerEvent): void {
    if (dragId === null || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - containerRect.left;
    const rawIndex = Math.floor(x / SLOT_WIDTH);
    const targetIndex = Math.min(Math.max(rawIndex, lockedCount), localTiles.length - 1);
    const currentIndex = localTiles.findIndex((t) => t.id === dragId);
    if (currentIndex !== -1 && targetIndex !== currentIndex) {
      const next = localTiles.slice();
      const [moved] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, moved!);
      setLocalTiles(next);
    }
  }

  function handlePointerUp(): void {
    if (dragId === null) return;
    setDragId(null);
    onReorder(localTiles);
  }

  return (
    <div
      ref={containerRef}
      className="letter-rack"
      style={{ display: 'flex', gap: GAP, touchAction: 'none' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {localTiles.map((tile) => (
        <div
          key={tile.id}
          onPointerDown={(e) => handlePointerDown(e, tile)}
          className={[
            'letter-tile',
            tile.locked ? 'letter-tile--locked' : '',
            tile.id === dragId ? 'letter-tile--dragging' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ width: TILE_SIZE, height: TILE_SIZE }}
        >
          {tile.letter.toUpperCase()}
        </div>
      ))}
    </div>
  );
}
