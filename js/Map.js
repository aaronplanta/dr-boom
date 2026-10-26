"use strict";

// Named GameMap to preserve JavaScript's built-in Map collection.
class GameMap {
  constructor() {
    this.grid = this.createLayout();
  }

  createLayout() {
    // The fixed arena makes restarts fair and keeps every layout solvable.
    // Walls sit on the perimeter and at even/even grid intersections.
    const crates = [
      [5, 1], [7, 1], [10, 1], [3, 2], [7, 2], [11, 2],
      [3, 3], [5, 3], [8, 3], [10, 3], [12, 3],
      [1, 4], [5, 4], [9, 4], [13, 4],
      [2, 5], [3, 5], [6, 5], [8, 5], [11, 5],
      [3, 6], [7, 6], [11, 6],
      [1, 7], [4, 7], [6, 7], [9, 7], [12, 7], [13, 7],
      [5, 8], [9, 8], [11, 8],
      [2, 9], [4, 9], [7, 9], [9, 9], [11, 9],
      [3, 10], [7, 10], [11, 10], [4, 11], [6, 11], [9, 11]
    ];
    const grid = Array.from({ length: CONFIG.ROWS }, (_, row) =>
      Array.from({ length: CONFIG.COLS }, (_, col) => {
        const border = row === 0 || col === 0 || row === CONFIG.ROWS - 1 || col === CONFIG.COLS - 1;
        return border || (row % 2 === 0 && col % 2 === 0) ? TILE.WALL : TILE.EMPTY;
      }));
    for (const [col, row] of crates) grid[row][col] = TILE.BLOCK;
    return grid;
  }

  getTile(col, row, grid = this.grid) {
    return grid[row]?.[col] ?? TILE.WALL;
  }

  isWalkable(col, row) {
    return this.getTile(col, row) === TILE.EMPTY;
  }

  destroyBlock(col, row) {
    if (this.getTile(col, row) !== TILE.BLOCK) return false;
    this.grid[row][col] = TILE.EMPTY;
    return true;
  }

  getBlastCells(col, row, range, grid = this.grid) {
    const cells = [{ col, row }];
    for (const { dx, dy } of DIRECTIONS) {
      for (let distance = 1; distance <= range; distance++) {
        const nextCol = col + dx * distance;
        const nextRow = row + dy * distance;
        const tile = this.getTile(nextCol, nextRow, grid);
        if (tile === TILE.WALL) break;
        cells.push({ col: nextCol, row: nextRow });
        if (tile === TILE.BLOCK) break;
      }
    }
    return cells;
  }

  draw(ctx) {
    const size = CONFIG.TILE_SIZE;
    for (let row = 0; row < CONFIG.ROWS; row++) {
      for (let col = 0; col < CONFIG.COLS; col++) {
        const x = col * size;
        const y = row * size;
        const tile = this.grid[row][col];
        ctx.fillStyle = (col + row) % 2 ? COLORS.floor : COLORS.floorAlt;
        ctx.fillRect(x, y, size, size);
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
        if (tile === TILE.WALL) {
          ctx.fillStyle = '#1f281a';
          ctx.fillRect(x + 2, y + 4, 36, 35);
          ctx.fillStyle = COLORS.wallEdge;
          ctx.fillRect(x + 2, y + 2, 36, 34);
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(x + 3, y + 2, 34, 29);
          ctx.fillStyle = COLORS.wallTop;
          ctx.fillRect(x + 3, y + 2, 34, 3);
          ctx.fillRect(x + 3, y + 5, 2, 25);
          ctx.fillStyle = '#74845b55';
          ctx.fillRect(x + 8, y + 8, 3, 2);
          ctx.fillStyle = '#3c4730';
          ctx.fillRect(x + 32, y + 28, 3, 2);
        } else if (tile === TILE.BLOCK) {
          ctx.fillStyle = '#1a211666';
          ctx.fillRect(x + 3, y + 5, 35, 34);
          ctx.fillStyle = COLORS.crateEdge;
          ctx.fillRect(x + 3, y + 3, 34, 33);
          ctx.fillStyle = COLORS.crate;
          ctx.fillRect(x + 3, y + 3, 34, 29);
          ctx.strokeStyle = COLORS.crateTop;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 6, y + 5, 28, 25);
          ctx.beginPath();
          ctx.moveTo(x + 7, y + 6);
          ctx.lineTo(x + 33, y + 29);
          ctx.moveTo(x + 33, y + 6);
          ctx.lineTo(x + 7, y + 29);
          ctx.stroke();
          ctx.fillStyle = '#dfbb7a';
          for (const [sx, sy] of [[7, 7], [30, 7], [7, 27], [30, 27]]) ctx.fillRect(x + sx, y + sy, 2, 2);
        } else if ((col * 7 + row * 11) % 5 === 0) {
          ctx.fillStyle = '#65744a44';
          ctx.fillRect(x + 12, y + 27, 2, 2);
          ctx.fillRect(x + 27, y + 12, 2, 1);
        }
      }
    }
    // Spawn marker stays subtle underneath the player.
    ctx.strokeStyle = '#8eb4b13d';
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(size + 5, size + 5, size - 10, size - 10);
    ctx.setLineDash([]);
  }
}
