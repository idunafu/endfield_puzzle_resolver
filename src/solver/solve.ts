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
  prevSamePieceIndex: number; // 同じピースIDの前のインスタンスのインデックス (-1 if none)
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

// 残りピースで各行/列の残り必要数を満たせるかチェック
function canReachTargets(
  rowOcc: number[],
  colOcc: number[],
  rowTargets: number[],
  colTargets: number[],
  instances: PieceInstance[],
  startIndex: number,
): boolean {
  // 残りピースの総セル数を計算
  let remainingCells = 0;
  for (let i = startIndex; i < instances.length; i += 1) {
    remainingCells += instances[i].piece.cells.length;
  }

  // 残り必要セル数を計算
  let neededCells = 0;
  for (let r = 0; r < rowTargets.length; r += 1) {
    neededCells += rowTargets[r] - rowOcc[r];
  }

  return remainingCells >= neededCells;
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

  // インスタンスを作成し、同じピースIDの前のインスタンスへの参照を設定
  const tempInstances: PieceInstance[] = puzzle.pieces.flatMap((piece) =>
    Array.from({ length: piece.count }, () => ({
      piece,
      placements: placementsById.get(piece.id) ?? [],
      prevSamePieceIndex: -1,
    })),
  );

  // 配置数が少ない順にソート
  tempInstances.sort((a, b) => a.placements.length - b.placements.length);

  // ソート後に、同じピースIDの前のインスタンスへの参照を再設定
  const instances = tempInstances;
  const lastIndexByPieceId = new Map<string, number>();
  for (let i = 0; i < instances.length; i += 1) {
    const pieceId = instances[i].piece.id;
    const prevIndex = lastIndexByPieceId.get(pieceId);
    if (prevIndex !== undefined) {
      instances[i].prevSamePieceIndex = prevIndex;
    }
    lastIndexByPieceId.set(pieceId, i);
  }

  const initialCounts = computeInitialCounts(
    puzzle.fixedMask,
    puzzle.width,
    puzzle.height,
  );
  const rowOcc = [...initialCounts.row];
  const colOcc = [...initialCounts.col];
  let nodes = 0;
  let lastReport = 0;

  // 各インスタンスが選択した配置のインデックスを追跡（重複解防止用）
  const usedPlacementIndices: number[] = Array(instances.length).fill(-1);

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

    // 枝刈り: 残りピースで残り必要数を満たせるかチェック
    if (!canReachTargets(rowOcc, colOcc, puzzle.rowTargets, puzzle.colTargets, instances, index)) {
      return;
    }

    const { placements, prevSamePieceIndex } = instances[index];

    // 同じピースの前のインスタンスがある場合、そのインデックス+1以降から開始（重複解防止）
    const startIdx = prevSamePieceIndex >= 0
      ? usedPlacementIndices[prevSamePieceIndex] + 1
      : 0;

    for (let i = startIdx; i < placements.length; i += 1) {
      const placement = placements[i];
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
      usedPlacementIndices[index] = i;
      dfs(index + 1, occupiedMask | placement.mask, acc);
      usedPlacementIndices[index] = -1;
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
