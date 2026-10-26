"use strict";

class Bomb {
  constructor(col, row, range = CONFIG.BLAST_RANGE) {
    this.col = col;
    this.row = row;
    this.range = range;
    this.remaining = CONFIG.BOMB_FUSE;
    this.exploded = false;
  }

  update(delta) {
    this.remaining = Math.max(0, this.remaining - delta);
    return this.remaining <= 0;
  }

  draw(ctx, time, reducedMotion = false) {
    const urgency = 1 - this.remaining / CONFIG.BOMB_FUSE;
    const pulse = reducedMotion ? 0 : Math.sin(time * (10 + urgency * 18)) * (0.5 + urgency);
    const x = this.col * CONFIG.TILE_SIZE + 20;
    const y = this.row * CONFIG.TILE_SIZE + 22;
    ctx.save();
    ctx.fillStyle = '#10150c77';
    ctx.beginPath();
    ctx.ellipse(x, y + 11, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b8a67c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, y - 9);
    ctx.quadraticCurveTo(x + 2, y - 21, x + 10, y - 16);
    ctx.stroke();
    ctx.fillStyle = COLORS.bomb;
    ctx.strokeStyle = urgency > 0.75 ? '#bc7242' : COLORS.bombEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 12 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#626b56';
    ctx.beginPath();
    ctx.arc(x - 4, y - 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.fireCore;
    ctx.fillRect(x + 8, y - 19, 4, 4);
    ctx.fillStyle = COLORS.fire;
    ctx.fillRect(x + 7, y - 23, 2, 3);
    ctx.fillRect(x + 13, y - 18, 3, 2);
    // A small fuse gauge makes the remaining time legible at a glance.
    ctx.fillStyle = '#192010';
    ctx.fillRect(x - 12, y + 15, 24, 2);
    ctx.fillStyle = urgency > 0.7 ? COLORS.fire : '#d3ed83';
    ctx.fillRect(x - 12, y + 15, 24 * (1 - urgency), 2);
    ctx.restore();
  }
}
