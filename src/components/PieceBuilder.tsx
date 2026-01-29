import { useMemo, useState } from "react";
import type { PieceDef } from "../model/types";

type PieceBuilderProps = {
  pieces: PieceDef[];
  onChange: (pieces: PieceDef[]) => void;
};

const GRID_SIZE = 6;

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

export default function PieceBuilder({ pieces, onChange }: PieceBuilderProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("ピース");
  const [count, setCount] = useState(1);
  const [allowRotate, setAllowRotate] = useState(true);
  const [color, setColor] = useState("#3a7afe");
  const [grid, setGrid] = useState<boolean[][]>(() => createEmptyGrid());

  const selectedPiece = useMemo(
    () => pieces.find((piece) => piece.id === editingId) ?? null,
    [editingId, pieces],
  );

  const cellCount = countCells(grid);

  const handleToggleCell = (x: number, y: number) => {
    setGrid((prev) => {
      const copy = prev.map((row) => row.slice());
      copy[y][x] = !copy[y][x];
      return copy;
    });
  };

  const handleSave = () => {
    const cells = gridToCells(grid);
    if (cells.length === 0) return;
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
      setEditingId(id);
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
    setColor("#3a7afe");
    setGrid(createEmptyGrid());
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
                setCount(Math.max(1, Number(event.target.value)))
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
              新規
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
        <div className="piece-builder__list-title">登録済みピース</div>
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
                        left: cell.x * 8,
                        top: cell.y * 8,
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
