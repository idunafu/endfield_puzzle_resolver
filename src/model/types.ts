export type CellState = "empty" | "blocked" | "fixed";

export type PieceCell = { x: number; y: number };

export type PieceDef = {
  id: string;
  name: string;
  count: number;
  cells: PieceCell[];
  allowRotate: boolean;
  color: string;
};

export type PuzzleDefinition = {
  width: number;
  height: number;
  rowTargets: number[];
  colTargets: number[];
  blockedMask: bigint;
  fixedMask: bigint;
  pieces: PieceDef[];
};

export type Placement = {
  pieceId: string;
  mask: bigint;
  rowDelta: number[];
  colDelta: number[];
};

export type Solution = Placement[];
