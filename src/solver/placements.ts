import type { PieceDef, Placement } from "../model/types";
import { cellToBit } from "../model/bitboard";

type Cell = { x: number; y: number };

function normalizeCells(cells: Cell[]): Cell[] {
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  const normalized = cells.map((cell) => ({
    x: cell.x - minX,
    y: cell.y - minY,
  }));
  normalized.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  return normalized;
}

function rotate90(cells: Cell[]): Cell[] {
  return cells.map((cell) => ({ x: cell.y, y: -cell.x }));
}

function shapeKey(cells: Cell[]): string {
  return cells.map((cell) => `${cell.x},${cell.y}`).join(";");
}

function uniqueRotations(cells: Cell[], allowRotate: boolean): Cell[][] {
  const rotations: Cell[][] = [];
  let current = cells;
  const maxRotations = allowRotate ? 4 : 1;
  for (let i = 0; i < maxRotations; i += 1) {
    const normalized = normalizeCells(current);
    const key = shapeKey(normalized);
    if (!rotations.some((shape) => shapeKey(shape) === key)) {
      rotations.push(normalized);
    }
    current = rotate90(current);
  }
  return rotations;
}

export function generatePlacementsForPiece(
  piece: PieceDef,
  width: number,
  height: number,
  blockedMask: bigint,
): Placement[] {
  const placements: Placement[] = [];
  const rotations = uniqueRotations(piece.cells, piece.allowRotate);
  rotations.forEach((shape) => {
    const maxX = Math.max(...shape.map((cell) => cell.x));
    const maxY = Math.max(...shape.map((cell) => cell.y));
    const limitX = width - (maxX + 1);
    const limitY = height - (maxY + 1);
    for (let offsetY = 0; offsetY <= limitY; offsetY += 1) {
      for (let offsetX = 0; offsetX <= limitX; offsetX += 1) {
        let mask = 0n;
        const rowDelta = Array.from({ length: height }, () => 0);
        const colDelta = Array.from({ length: width }, () => 0);
        let valid = true;
        for (const cell of shape) {
          const x = cell.x + offsetX;
          const y = cell.y + offsetY;
          const bit = cellToBit(x, y, width);
          if ((blockedMask & bit) !== 0n) {
            valid = false;
            break;
          }
          mask |= bit;
          rowDelta[y] += 1;
          colDelta[x] += 1;
        }
        if (!valid) continue;
        placements.push({
          pieceId: piece.id,
          mask,
          rowDelta,
          colDelta,
        });
      }
    }
  });
  return placements;
}
