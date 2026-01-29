import { useEffect, useMemo, useRef, useState } from "react";
import BoardEditor from "./components/BoardEditor";
import PieceBuilder from "./components/PieceBuilder";
import SolutionViewer from "./components/SolutionViewer";
import type { CellState, PieceDef, PuzzleDefinition, Solution } from "./model/types";
import { cellToBit } from "./model/bitboard";

const DEFAULT_WIDTH = 4;
const DEFAULT_HEIGHT = 4;
const MIN_SIZE = 4;
const MAX_SIZE = 8;

function clampSize(value: number) {
  return Math.max(MIN_SIZE, Math.min(MAX_SIZE, value));
}

function createCells(width: number, height: number): CellState[][] {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => "empty"),
  );
}

function createTargets(length: number): number[] {
  return Array.from({ length: length }, () => 0);
}

export default function App() {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [cells, setCells] = useState<CellState[][]>(() =>
    createCells(DEFAULT_WIDTH, DEFAULT_HEIGHT),
  );
  const [rowTargets, setRowTargets] = useState<number[]>(() =>
    createTargets(DEFAULT_HEIGHT),
  );
  const [colTargets, setColTargets] = useState<number[]>(() =>
    createTargets(DEFAULT_WIDTH),
  );
  const [pieces, setPieces] = useState<PieceDef[]>([]);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [activeSolutionIndex, setActiveSolutionIndex] = useState(0);
  const [progress, setProgress] = useState({
    nodes: 0,
    solutions: 0,
    elapsedMs: 0,
    running: false,
  });
  const workerRef = useRef<Worker | null>(null);
  const MAX_SOLUTIONS = 200;

  const validation = useMemo(() => {
    const errors: string[] = [];
    const rowSum = rowTargets.reduce((acc, value) => acc + value, 0);
    const colSum = colTargets.reduce((acc, value) => acc + value, 0);
    let fixedTotal = 0;
    let blockedTotal = 0;

    if (rowSum !== colSum) {
      errors.push("行ターゲット合計と列ターゲット合計が一致しません。");
    }

    cells.forEach((rowCells, row) => {
      const blockedCount = rowCells.filter((cell) => cell === "blocked").length;
      const fixedCount = rowCells.filter((cell) => cell === "fixed").length;
      blockedTotal += blockedCount;
      fixedTotal += fixedCount;
      const available = width - blockedCount;
      if (rowTargets[row] > available) {
        errors.push(
          `行${row + 1}のターゲットが空きマス数(${available})を超えています。`,
        );
      }
      if (rowTargets[row] < fixedCount) {
        errors.push(
          `行${row + 1}のターゲットが固定マス数(${fixedCount})未満です。`,
        );
      }
    });

    for (let col = 0; col < width; col += 1) {
      let blockedCount = 0;
      let fixedCount = 0;
      for (let row = 0; row < height; row += 1) {
        if (cells[row][col] === "blocked") blockedCount += 1;
        if (cells[row][col] === "fixed") fixedCount += 1;
      }
      const available = height - blockedCount;
      if (colTargets[col] > available) {
        errors.push(
          `列${col + 1}のターゲットが空きマス数(${available})を超えています。`,
        );
      }
      if (colTargets[col] < fixedCount) {
        errors.push(
          `列${col + 1}のターゲットが固定マス数(${fixedCount})未満です。`,
        );
      }
    }

    const totalAvailable = width * height - blockedTotal;
    if (rowSum > totalAvailable) {
      errors.push("ターゲット合計が空きマス数を超えています。");
    }

    const pieceTotal = pieces.reduce(
      (acc, piece) => acc + piece.cells.length * piece.count,
      0,
    );
    const requiredFromPieces = rowSum - fixedTotal;
    if (requiredFromPieces < 0) {
      errors.push("固定マス数がターゲット合計を超えています。");
    } else if (pieceTotal !== requiredFromPieces) {
      errors.push(
        `ピース総数(${pieceTotal})が必要マス数(${requiredFromPieces})と一致しません。`,
      );
    }

    return errors;
  }, [cells, colTargets, pieces, rowTargets, width, height]);

  const handleResize = (nextWidth: number, nextHeight: number) => {
    const normalizedWidth = clampSize(nextWidth);
    const normalizedHeight = clampSize(nextHeight);
    setWidth(normalizedWidth);
    setHeight(normalizedHeight);
    setCells(createCells(normalizedWidth, normalizedHeight));
    setRowTargets(createTargets(normalizedHeight));
    setColTargets(createTargets(normalizedWidth));
  };

  const handleCellChange = (x: number, y: number, next: CellState) => {
    setCells((prev) => {
      const copy = prev.map((row) => row.slice());
      copy[y][x] = next;
      return copy;
    });
  };

  const handleRowTargetChange = (row: number, value: number) => {
    const normalized = Math.max(0, Math.min(width, value));
    setRowTargets((prev) => {
      const copy = [...prev];
      copy[row] = normalized;
      return copy;
    });
  };

  const handleColTargetChange = (col: number, value: number) => {
    const normalized = Math.max(0, Math.min(height, value));
    setColTargets((prev) => {
      const copy = [...prev];
      copy[col] = normalized;
      return copy;
    });
  };

  const handleBoardReset = () => {
    setCells(createCells(width, height));
    setRowTargets(createTargets(height));
    setColTargets(createTargets(width));
    setSolutions([]);
    setActiveSolutionIndex(0);
  };

  const handlePiecesReset = () => {
    setPieces([]);
    setSolutions([]);
    setActiveSolutionIndex(0);
  };

  useEffect(() => {
    const worker = new Worker(new URL("./solver/worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    worker.onmessage = (event) => {
      const message = event.data as
        | {
            type: "progress";
            nodes: number;
            solutions: number;
            elapsedMs: number;
          }
        | { type: "solution"; solution: Solution }
        | { type: "done"; solutions: number; elapsedMs: number };
      if (message.type === "progress") {
        setProgress((prev) => ({
          ...prev,
          nodes: message.nodes,
          solutions: message.solutions,
          elapsedMs: message.elapsedMs,
        }));
      }
      if (message.type === "solution") {
        setSolutions((prev) => [...prev, message.solution]);
      }
      if (message.type === "done") {
        setProgress((prev) => ({
          ...prev,
          running: false,
          elapsedMs: message.elapsedMs,
          solutions: message.solutions,
        }));
      }
    };
    return () => {
      // クリーンアップ時に停止メッセージを送ってから終了
      worker.postMessage({ type: "stop" });
      worker.terminate();
    };
  }, []);

  useEffect(() => {
    if (activeSolutionIndex >= solutions.length) {
      setActiveSolutionIndex(Math.max(0, solutions.length - 1));
    }
  }, [activeSolutionIndex, solutions.length]);

  const puzzleDefinition = useMemo<PuzzleDefinition>(() => {
    let blockedMask = 0n;
    let fixedMask = 0n;
    cells.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell === "blocked") blockedMask |= cellToBit(x, y, width);
        if (cell === "fixed") fixedMask |= cellToBit(x, y, width);
      });
    });
    return {
      width,
      height,
      rowTargets,
      colTargets,
      blockedMask,
      fixedMask,
      pieces,
    };
  }, [cells, colTargets, pieces, rowTargets, width, height]);

  const canSearch =
    validation.length === 0 && pieces.length > 0 && !progress.running;

  const activeSolution =
    solutions.length > 0 ? solutions[activeSolutionIndex] : null;

  const handleStartSearch = () => {
    if (!workerRef.current) return;
    setSolutions([]);
    setActiveSolutionIndex(0);
    setProgress({ nodes: 0, solutions: 0, elapsedMs: 0, running: true });
    workerRef.current.postMessage({
      type: "start",
      puzzle: puzzleDefinition,
      maxSolutions: MAX_SOLUTIONS,
    });
  };

  const handleStopSearch = () => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: "stop" });
    setProgress((prev) => ({ ...prev, running: false }));
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>ポリオミノ敷き詰めパズル</h1>
        <p>盤面条件とピースを作成して探索します。</p>
      </header>
      <main className="app__main">
        <section className="panel panel--left">
          <h2>盤面エディタ</h2>
          <div className="panel__content">
            <BoardEditor
              width={width}
              height={height}
              cells={cells}
              rowTargets={rowTargets}
              colTargets={colTargets}
              onResize={handleResize}
              onCellChange={handleCellChange}
              onRowTargetChange={handleRowTargetChange}
              onColTargetChange={handleColTargetChange}
              onReset={handleBoardReset}
            />
            <div className="validation">
              <div className="validation__title">入力チェック</div>
              {validation.length === 0 ? (
                <div className="validation__ok">問題ありません。</div>
              ) : (
                <ul className="validation__list">
                  {validation.map((error, index) => (
                    <li key={`error-${index}`}>{error}</li>
                  ))}
                </ul>
              )}
              <div className="validation__hint">
                セルをクリックすると 空 → 障害物 → 固定(カウント) の順で切り替わります。
              </div>
            </div>
          </div>
        </section>
        <section className="panel panel--right">
          <h2>ピースビルダー</h2>
          <div className="panel__content">
            <PieceBuilder pieces={pieces} onChange={setPieces} onReset={handlePiecesReset} />
            <SolutionViewer
              width={width}
              height={height}
              blockedMask={puzzleDefinition.blockedMask}
              fixedMask={puzzleDefinition.fixedMask}
              pieces={pieces}
              solution={activeSolution}
              activeIndex={activeSolutionIndex}
              totalSolutions={solutions.length}
              onChangeIndex={setActiveSolutionIndex}
            />
          </div>
          <div className="panel__footer">
            <div className="solver-status">
              <div>探索ノード: {progress.nodes.toLocaleString()}</div>
              <div>解の数: {solutions.length}</div>
              <div>経過: {progress.elapsedMs}ms</div>
            </div>
            {progress.running ? (
              <button className="danger" onClick={handleStopSearch} type="button">
                停止
              </button>
            ) : (
              <button
                className="primary"
                onClick={handleStartSearch}
                disabled={!canSearch}
              >
                探索開始
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
