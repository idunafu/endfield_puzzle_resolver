export function cellToBit(x: number, y: number, width: number): bigint {
  return 1n << BigInt(y * width + x);
}

export function cellsToMask(
  cells: { x: number; y: number }[],
  width: number,
): bigint {
  return cells.reduce((mask, cell) => mask | cellToBit(cell.x, cell.y, width), 0n);
}

export function maskHas(mask: bigint, x: number, y: number, width: number) {
  return (mask & cellToBit(x, y, width)) !== 0n;
}

export function countBits(mask: bigint): number {
  let count = 0;
  let working = mask;
  while (working !== 0n) {
    count += 1;
    working &= working - 1n;
  }
  return count;
}
