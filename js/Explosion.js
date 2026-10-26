"use strict";

class Explosion {
  constructor(cells) {
    this.cells = cells;
    this.remaining = CONFIG.FIRE_DURATION;
    this.cellKeys = new Set(cells.map(({ col, row }) => `${col},${row}`));
  }

  contains(col, row) {
    return this.remaining > 0 && this.cellKeys.has(`${col},${row}`);
  }

  update(delta) {
    this.remaining = Math.max(0, this.remaining - delta);
  }

  draw(ctx, time, reducedMotion = false) {
    const size = CONFIG.TILE_SIZE;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.remaining / 0.15);
    for (const { col, row } of this.cells) {
      const x = col * size;
      const y = row * size;
      ctx.fillStyle = '#f39b4433';
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = COLORS.fire;
      ctx.fillRect(x + 3, y + 9, 34, 22);
      ctx.fillRect(x + 9, y + 3, 22, 34);
      ctx.fillStyle = COLORS.fireCore;
      ctx.fillRect(x + 6, y + 16, 28, 8);
      ctx.fillRect(x + 16, y + 6, 8, 28);
      const flicker = reducedMotion ? 0 : Math.sin(time * 35 + col + row) * 2;
      ctx.fillStyle = '#fff5cd';
      ctx.fillRect(x + 16 - flicker, y + 16 - flicker, 8 + flicker * 2, 8 + flicker * 2);
    }
    ctx.restore();
  }
}
