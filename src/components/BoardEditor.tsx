import type { CellState } from "../model/types";

type BoardEditorProps = {
  width: number;
  height: number;
  cells: CellState[][];
  rowTargets: number[];
  colTargets: number[];
  onResize: (width: number, height: number) => void;
  onCellChange: (x: number, y: number, next: CellState) => void;
  onRowTargetChange: (row: number, value: number) => void;
  onColTargetChange: (col: number, value: number) => void;
};

const MIN_SIZE = 4;
const MAX_SIZE = 8;

const CELL_LABEL: Record<CellState, string> = {
  empty: "",
  blocked: "×",
  fixed: "■",
};

function nextCellState(state: CellState): CellState {
  if (state === "empty") return "blocked";
  if (state === "blocked") return "fixed";
  return "empty";
}

export default function BoardEditor({
  width,
  height,
  cells,
  rowTargets,
  colTargets,
  onResize,
  onCellChange,
  onRowTargetChange,
  onColTargetChange,
}: BoardEditorProps) {
  return (
    <div className="board-editor">
      <div className="board-editor__controls">
        <label className="control">
          横
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={width}
            onChange={(event) =>
              onResize(Number(event.target.value), height)
            }
          />
        </label>
        <label className="control">
          縦
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={height}
            onChange={(event) =>
              onResize(width, Number(event.target.value))
            }
          />
        </label>
        <div className="legend">
          <span className="legend__item">
            <span className="legend__chip legend__chip--empty" />
            空
          </span>
          <span className="legend__item">
            <span className="legend__chip legend__chip--blocked" />
            障害物
          </span>
          <span className="legend__item">
            <span className="legend__chip legend__chip--fixed" />
            固定(カウント)
          </span>
        </div>
      </div>

      <div className="board-grid">
        <div
          className="board-grid__inner"
          style={{
            gridTemplateColumns: `repeat(${width + 1}, 40px)`,
            gridTemplateRows: `repeat(${height + 1}, 40px)`,
          }}
        >
          <div className="corner-cell" />
          {colTargets.map((value, col) => (
            <input
              key={`col-${col}`}
              className="target-input"
              type="number"
              min={0}
              max={height}
              value={value}
              onChange={(event) =>
                onColTargetChange(col, Number(event.target.value))
              }
            />
          ))}
          {cells.map((rowCells, row) => (
            <div key={`row-${row}`} className="board-grid__row">
              <input
                className="target-input"
                type="number"
                min={0}
                max={width}
                value={rowTargets[row]}
                onChange={(event) =>
                  onRowTargetChange(row, Number(event.target.value))
                }
              />
              {rowCells.map((cell, col) => (
                <button
                  key={`cell-${row}-${col}`}
                  className={`grid-cell grid-cell--${cell}`}
                  onClick={() => onCellChange(col, row, nextCellState(cell))}
                  type="button"
                >
                  {CELL_LABEL[cell]}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
