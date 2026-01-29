import { useMemo, useState } from "react";
import type { PieceDef } from "../model/types";

type PieceBuilderProps = {
  pieces: PieceDef[];
  onChange: (pieces: PieceDef[]) => void;
  onReset: () => void;
};

const GRID_SIZE = 8;

function safeParseInt(value: string, fallback: number): number {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function createEmptyGrid() {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => false),
  );
}

function gridToCells(grid: boolean[][]) {
  const cells: { x: number; y: number }[] = [];
  grid.forEach((row, y) => {
    row.forEach((active, x) => {
      if (active) cells.push({ x, y });
    });
  });
  return cells;
}

function cellsToGrid(cells: { x: number; y: number }[]) {
  const grid = createEmptyGrid();
  cells.forEach(({ x, y }) => {
    if (grid[y]?.[x] !== undefined) {
      grid[y][x] = true;
    }
  });
  return grid;
}

function countCells(grid: boolean[][]) {
  return grid.reduce(
    (acc, row) => acc + row.filter((value) => value).length,
    0,
  );
}

// ピースが連結しているかチェック (BFS)
function isConnected(cells: { x: number; y: number }[]): boolean {
  if (cells.length <= 1) return true;

  const cellSet = new Set(cells.map((c) => `${c.x},${c.y}`));
  const visited = new Set<string>();
  const queue = [cells[0]];
  visited.add(`${cells[0].x},${cells[0].y}`);

  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { dx, dy } of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;
      if (cellSet.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return visited.size === cells.length;
}

const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
  "#f43f5e", // rose
];

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export default function PieceBuilder({ pieces, onChange, onReset }: PieceBuilderProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("ピース");
  const [count, setCount] = useState(1);
  const [allowRotate, setAllowRotate] = useState(true);
  const [color, setColor] = useState(() => getRandomColor());
  const [grid, setGrid] = useState<boolean[][]>(() => createEmptyGrid());
  const [error, setError] = useState<string | null>(null);

  const selectedPiece = useMemo(
    () => pieces.find((piece) => piece.id === editingId) ?? null,
    [editingId, pieces],
  );

  const cellCount = countCells(grid);
  const cells = useMemo(() => gridToCells(grid), [grid]);
  const connected = useMemo(() => isConnected(cells), [cells]);

  const handleToggleCell = (x: number, y: number) => {
    setError(null);
    setGrid((prev) => {
      const copy = prev.map((row) => row.slice());
      copy[y][x] = !copy[y][x];
      return copy;
    });
  };

  const handleSave = () => {
    if (cells.length === 0) return;
    if (!connected) {
      setError("ピースが連結していません。全てのセルが隣接している必要があります。");
      return;
    }
    setError(null);
    if (selectedPiece) {
      onChange(
        pieces.map((piece) =>
          piece.id === selectedPiece.id
            ? { ...piece, name, count, allowRotate, color, cells }
            : piece,
        ),
      );
    } else {
      const id = crypto.randomUUID();
      onChange([
        ...pieces,
        { id, name, count, allowRotate, color, cells },
      ]);
      // 追加後、すぐに次のピースを編集できるように新規状態にリセット
      setEditingId(null);
      setName("ピース");
      setCount(1);
      setAllowRotate(true);
      setColor(getRandomColor());
      setGrid(createEmptyGrid());
    }
  };

  const handleDelete = () => {
    if (!selectedPiece) return;
    onChange(pieces.filter((piece) => piece.id !== selectedPiece.id));
    setEditingId(null);
    setGrid(createEmptyGrid());
  };

  const handleNew = () => {
    setEditingId(null);
    setName("ピース");
    setCount(1);
    setAllowRotate(true);
    setColor(getRandomColor());
    setGrid(createEmptyGrid());
    setError(null);
  };

  const handleSelect = (piece: PieceDef) => {
    setEditingId(piece.id);
    setName(piece.name);
    setCount(piece.count);
    setAllowRotate(piece.allowRotate);
    setColor(piece.color);
    setGrid(cellsToGrid(piece.cells));
  };

  return (
    <div className="piece-builder">
      <div className="piece-builder__editor">
        <div className="piece-builder__form">
          <label className="control">
            ピース名
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="control">
            個数
            <input
              type="number"
              min={1}
              value={count}
              onChange={(event) =>
                setCount(Math.max(1, safeParseInt(event.target.value, 1)))
              }
            />
          </label>
          <label className="control control--row">
            <input
              type="checkbox"
              checked={allowRotate}
              onChange={(event) => setAllowRotate(event.target.checked)}
            />
            90°回転可
          </label>
          <label className="control control--row">
            色
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </label>
          {error && (
            <div className="piece-builder__error">{error}</div>
          )}
          {!connected && cellCount > 1 && !error && (
            <div className="piece-builder__warning">セルが連結していません</div>
          )}
          <div className="piece-builder__actions">
            <button
              className="primary"
              onClick={handleSave}
              disabled={cellCount === 0}
              type="button"
            >
              {selectedPiece ? "更新" : "追加"}
            </button>
            <button className="secondary" onClick={handleNew} type="button">
              新規・色変更
            </button>
            <button
              className="danger"
              onClick={handleDelete}
              type="button"
              disabled={!selectedPiece}
            >
              削除
            </button>
          </div>
        </div>
        <div className="piece-builder__grid">
          <div
            className="piece-grid"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, 28px)`,
            }}
          >
            {grid.map((row, y) =>
              row.map((active, x) => (
                <button
                  key={`grid-${x}-${y}`}
                  className={`piece-cell ${active ? "is-active" : ""}`}
                  style={active ? { background: color } : undefined}
                  onClick={() => handleToggleCell(x, y)}
                  type="button"
                />
              )),
            )}
          </div>
          <div className="piece-builder__info">
            クリックでセルを追加/削除。現在のセル数: {cellCount}
          </div>
        </div>
      </div>

      <div className="piece-builder__list">
        <div className="piece-builder__list-header">
          <div className="piece-builder__list-title">登録済みピース</div>
          <button
            className="secondary btn-small"
            type="button"
            onClick={onReset}
            disabled={pieces.length === 0}
          >
            全削除
          </button>
        </div>
        {pieces.length === 0 ? (
          <div className="piece-builder__empty">まだピースがありません。</div>
        ) : (
          <div className="piece-builder__cards">
            {pieces.map((piece) => (
              <button
                key={piece.id}
                type="button"
                className={`piece-card ${
                  piece.id === editingId ? "is-active" : ""
                }`}
                onClick={() => handleSelect(piece)}
              >
                <div className="piece-card__name">{piece.name}</div>
                <div className="piece-card__meta">
                  {piece.cells.length}マス / 個数 {piece.count}
                </div>
                <div className="piece-card__meta">
                  {piece.allowRotate ? "回転あり" : "回転なし"}
                </div>
                  <div className="piece-card__preview">
                    {piece.cells.map((cell) => (
                      <span
                        key={`${piece.id}-${cell.x}-${cell.y}`}
                        className="piece-card__dot"
                        style={{
                          left: cell.x * 12 + 4,
                          top: cell.y * 12 + 4,
                          background: piece.color,
                        }}
                      />
                    ))}
                  </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
