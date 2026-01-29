import type { PuzzleDefinition, Solution } from "../model/types";
import { solvePuzzle } from "./solve";

type StartMessage = {
  type: "start";
  puzzle: PuzzleDefinition;
  maxSolutions: number;
};

type StopMessage = {
  type: "stop";
};

type IncomingMessage = StartMessage | StopMessage;

type ProgressMessage = {
  type: "progress";
  nodes: number;
  solutions: number;
  elapsedMs: number;
};

type SolutionMessage = {
  type: "solution";
  solution: Solution;
};

type DoneMessage = {
  type: "done";
  solutions: number;
  elapsedMs: number;
};

const ctx: Worker = self as unknown as Worker;

let stopRequested = false;

ctx.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const message = event.data;
  if (message.type === "stop") {
    stopRequested = true;
    return;
  }
  if (message.type === "start") {
    stopRequested = false;
    const startTime = performance.now();
    const { puzzle, maxSolutions } = message;
    const solutions = solvePuzzle(puzzle, {
      maxSolutions,
      shouldStop: () => stopRequested,
      onProgress: ({ nodes, solutions, elapsedMs }) => {
        const payload: ProgressMessage = {
          type: "progress",
          nodes,
          solutions,
          elapsedMs,
        };
        ctx.postMessage(payload);
      },
      onSolution: (solution) => {
        const payload: SolutionMessage = { type: "solution", solution };
        ctx.postMessage(payload);
      },
    });
    const elapsedMs = Math.floor(performance.now() - startTime);
    const donePayload: DoneMessage = {
      type: "done",
      solutions: solutions.length,
      elapsedMs,
    };
    ctx.postMessage(donePayload);
  }
};
