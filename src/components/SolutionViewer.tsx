import { useMemo } from "react";
import type { PieceDef, Solution } from "../model/types";
import { cellToBit } from "../model/bitboard";

type SolutionViewerProps = {
  width: number;
  height: number;
  blockedMask: bigint;
  fixedMask: bigint;
  pieces: PieceDef[];
  solution: Solution | null;
  activeIndex: number;
  totalSolutions: number;
  onChangeIndex: (next: number) => void;
};

export default function SolutionViewer({
  width,
  height,
  blockedMask,
  fixedMask,
  pieces,
  solution,
  activeIndex,
  totalSolutions,
  onChangeIndex,
}: SolutionViewerProps) {
  const colorGrid = useMemo(() => {
    const grid: (string | null)[][] = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => null),
    );
    if (!solution) return grid;
    const colorById = new Map(pieces.map((piece) => [piece.id, piece.color]));
    for (const placement of solution) {
      const color = colorById.get(placement.pieceId) ?? "#7a7a7a";
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const bit = cellToBit(x, y, width);
          if ((placement.mask & bit) !== 0n) {
            grid[y][x] = color;
          }
        }
      }
    }
    return grid;
  }, [height, pieces, solution, width]);

  return (
    <div className="solution-viewer">
      <div className="solution-viewer__header">
        <div className="solution-viewer__title">解の表示</div>
        <div className="solution-viewer__controls">
          <button
            className="secondary"
            type="button"
            disabled={activeIndex <= 0}
            onClick={() => onChangeIndex(Math.max(0, activeIndex - 1))}
          >
            前
          </button>
          <span className="solution-viewer__counter">
            {totalSolutions === 0 ? "0 / 0" : `${activeIndex + 1} / ${totalSolutions}`}
          </span>
          <button
            className="secondary"
            type="button"
            disabled={activeIndex >= totalSolutions - 1}
            onClick={() =>
              onChangeIndex(Math.min(totalSolutions - 1, activeIndex + 1))
            }
          >
            次
          </button>
        </div>
      </div>
      <div
        className="solution-grid"
        style={{
          gridTemplateColumns: `repeat(${width}, 32px)`,
        }}
      >
        {colorGrid.map((row, y) =>
          row.map((color, x) => {
            const bit = cellToBit(x, y, width);
            const isBlocked = (blockedMask & bit) !== 0n;
            const isFixed = (fixedMask & bit) !== 0n;
            return (
              <div
                key={`solution-${x}-${y}`}
                className={`solution-cell ${
                  isBlocked ? "is-blocked" : isFixed ? "is-fixed" : ""
                }`}
                style={color ? { background: color } : undefined}
                title={isFixed ? "固定セル" : undefined}
              >
                {!color && isFixed ? "■" : ""}
              </div>
            );
          }),
        )}
      </div>
      <div className="solution-viewer__hint">
        右側で探索するとここに解が表示されます。
      </div>
    </div>
  );
}
