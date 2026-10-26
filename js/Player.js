"use strict";

class Player {
  constructor(col = 1, row = 1) {
    this.col = col;
    this.row = row;
    this.previousCol = col;
    this.previousRow = row;
    this.moveTime = 0;
    this.stepDuration = CONFIG.PLAYER_STEP;
    this.facing = { dx: 0, dy: 1 };
    this.alive = true;
  }

  tryMove(dx, dy, game) {
    this.facing = { dx, dy };
    if (!game.canMoveTo(this.col + dx, this.row + dy, this)) return false;
    this.previousCol = this.col;
    this.previousRow = this.row;
    this.col += dx;
    this.row += dy;
    this.moveTime = this.stepDuration;
    return true;
  }

  update(delta, game) {
    this.moveTime = Math.max(0, this.moveTime - delta);
    if (!this.alive || this.moveTime > 0) return;
    // The last held direction wins, so turns never create diagonal movement.
    const code = Array.from(game.keys).reverse().find(key => MOVEMENT_KEYS[key]);
    if (code) {
      const { dx, dy } = MOVEMENT_KEYS[code];
      this.tryMove(dx, dy, game);
    }
  }

  getDrawPosition(reducedMotion = false) {
    // Collision always uses integer cells; interpolation is purely visual.
    const progress = reducedMotion ? 1 : 1 - Math.min(1, this.moveTime / this.stepDuration);
    const eased = 1 - (1 - progress) ** 3;
    return {
      x: (this.previousCol + (this.col - this.previousCol) * eased) * CONFIG.TILE_SIZE,
      y: (this.previousRow + (this.row - this.previousRow) * eased) * CONFIG.TILE_SIZE
    };
  }

  draw(ctx, time, reducedMotion = false) {
    if (!this.alive) return;
    const { x, y } = this.getDrawPosition(reducedMotion);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#11180e55';
    ctx.beginPath();
    ctx.ellipse(20, 32, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.playerEdge;
    ctx.fillRect(8, 9, 24, 24);
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(8, 6, 24, 23);
    ctx.fillStyle = COLORS.playerLight;
    ctx.fillRect(10, 7, 20, 3);
    ctx.fillRect(8, 10, 3, 14);
    ctx.fillStyle = '#24415e';
    ctx.fillRect(13 + this.facing.dx, 16 + this.facing.dy, 4, 5);
    ctx.fillRect(23 + this.facing.dx, 16 + this.facing.dy, 4, 5);
    ctx.fillStyle = '#d9ecff';
    ctx.fillRect(17, 24, 7, 2);
    ctx.fillStyle = '#345a80';
    ctx.fillRect(10, 30, 7, 4);
    ctx.fillRect(24, 30, 7, 4);
    ctx.restore();
  }
}
