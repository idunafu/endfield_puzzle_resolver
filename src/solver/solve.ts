import type { PieceDef, Placement, PuzzleDefinition, Solution } from "../model/types";
import { generatePlacementsForPiece } from "./placements";

export type SolveOptions = {
  maxSolutions?: number;
  onProgress?: (info: { nodes: number; solutions: number; elapsedMs: number }) => void;
  onSolution?: (solution: Solution) => void;
  shouldStop?: () => boolean;
};

type PieceInstance = {
  piece: PieceDef;
  placements: Placement[];
};

function computeInitialCounts(
  mask: bigint,
  width: number,
  height: number,
): { row: number[]; col: number[] } {
  const row = Array.from({ length: height }, () => 0);
  const col = Array.from({ length: width }, () => 0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const bit = 1n << BigInt(y * width + x);
      if ((mask & bit) !== 0n) {
        row[y] += 1;
        col[x] += 1;
      }
    }
  }
  return { row, col };
}

export function solvePuzzle(
  puzzle: PuzzleDefinition,
  options: SolveOptions = {},
): Solution[] {
  const { maxSolutions = 100, onProgress, onSolution, shouldStop } = options;
  const startTime = performance.now();
  const solutions: Solution[] = [];
  const placementsById = new Map<string, Placement[]>();

  const blockedOrFixed = puzzle.blockedMask | puzzle.fixedMask;
  puzzle.pieces.forEach((piece) => {
    placementsById.set(
      piece.id,
      generatePlacementsForPiece(piece, puzzle.width, puzzle.height, blockedOrFixed),
    );
  });

  const instances: PieceInstance[] = puzzle.pieces.flatMap((piece) =>
    Array.from({ length: piece.count }, () => ({
      piece,
      placements: placementsById.get(piece.id) ?? [],
    })),
  );

  instances.sort((a, b) => a.placements.length - b.placements.length);

  const initialCounts = computeInitialCounts(
    puzzle.fixedMask,
    puzzle.width,
    puzzle.height,
  );
  const rowOcc = [...initialCounts.row];
  const colOcc = [...initialCounts.col];
  let nodes = 0;
  let lastReport = 0;

  const dfs = (index: number, occupiedMask: bigint, acc: Placement[]) => {
    if (shouldStop?.()) return;
    nodes += 1;

    const now = performance.now();
    if (onProgress && now - lastReport > 100) {
      lastReport = now;
      onProgress({
        nodes,
        solutions: solutions.length,
        elapsedMs: Math.floor(now - startTime),
      });
    }

    if (index === instances.length) {
      if (
        rowOcc.every((value, i) => value === puzzle.rowTargets[i]) &&
        colOcc.every((value, i) => value === puzzle.colTargets[i])
      ) {
        const solution = [...acc];
        solutions.push(solution);
        onSolution?.(solution);
      }
      return;
    }

    if (solutions.length >= maxSolutions) return;

    const { placements } = instances[index];

    for (const placement of placements) {
      if ((placement.mask & occupiedMask) !== 0n) {
        continue;
      }
      let invalid = false;
      for (let r = 0; r < puzzle.height; r += 1) {
        const next = rowOcc[r] + placement.rowDelta[r];
        if (next > puzzle.rowTargets[r]) {
          invalid = true;
          break;
        }
      }
      if (invalid) continue;
      for (let c = 0; c < puzzle.width; c += 1) {
        const next = colOcc[c] + placement.colDelta[c];
        if (next > puzzle.colTargets[c]) {
          invalid = true;
          break;
        }
      }
      if (invalid) continue;

      for (let r = 0; r < puzzle.height; r += 1) {
        rowOcc[r] += placement.rowDelta[r];
      }
      for (let c = 0; c < puzzle.width; c += 1) {
        colOcc[c] += placement.colDelta[c];
      }
      acc.push(placement);
      dfs(index + 1, occupiedMask | placement.mask, acc);
      acc.pop();
      for (let r = 0; r < puzzle.height; r += 1) {
        rowOcc[r] -= placement.rowDelta[r];
      }
      for (let c = 0; c < puzzle.width; c += 1) {
        colOcc[c] -= placement.colDelta[c];
      }

      if (solutions.length >= maxSolutions) return;
    }
  };

  dfs(0, puzzle.fixedMask, []);
  return solutions;
}
