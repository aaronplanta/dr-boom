"use strict";

class Enemy extends Player {
  constructor(col, row, id = 0) {
    super(col, row);
    this.id = id;
    this.stepDuration = CONFIG.ENEMY_STEP + id * 0.035;
    this.moveTime = this.stepDuration;
    this.direction = DIRECTIONS[id % DIRECTIONS.length];
  }

  update(delta, game) {
    this.moveTime = Math.max(0, this.moveTime - delta);
    if (!this.alive || this.moveTime > 0) return;
    const available = DIRECTIONS.filter(({ dx, dy }) => game.canMoveTo(this.col + dx, this.row + dy, this));
    if (!available.length) {
      this.moveTime = this.stepDuration;
      return;
    }
    // Patrol corridors; at intersections occasionally move toward the player.
    let choices = available.filter(({ dx, dy }) => dx !== -this.direction.dx || dy !== -this.direction.dy);
    if (!choices.length) choices = available;
    let next;
    if (Math.random() < 0.35) {
      next = choices.slice().sort((a, b) => {
        const distance = direction => Math.abs(this.col + direction.dx - game.player.col) + Math.abs(this.row + direction.dy - game.player.row);
        return distance(a) - distance(b);
      })[0];
    } else {
      next = choices[Math.floor(Math.random() * choices.length)];
    }
    this.direction = next;
    this.tryMove(next.dx, next.dy, game);
  }

  draw(ctx, time, reducedMotion = false) {
    if (!this.alive) return;
    const { x, y } = this.getDrawPosition(reducedMotion);
    const bob = reducedMotion ? 0 : Math.sin(time * 5 + this.id * 2) * 1.2;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#11180e55';
    ctx.beginPath();
    ctx.ellipse(20, 32, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(0, bob);
    ctx.fillStyle = COLORS.enemyEdge;
    ctx.fillRect(7, 15, 26, 16);
    ctx.fillStyle = COLORS.enemy;
    ctx.beginPath();
    ctx.arc(20, 18, 13, Math.PI, 0);
    ctx.lineTo(33, 28);
    ctx.lineTo(7, 28);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(8, 27, 6, 6);
    ctx.fillRect(17, 27, 6, 5);
    ctx.fillRect(26, 27, 6, 6);
    ctx.fillStyle = COLORS.enemyLight;
    ctx.fillRect(13, 8, 11, 3);
    ctx.fillStyle = '#422b26';
    ctx.fillRect(12 + this.facing.dx, 16, 5, 6);
    ctx.fillRect(23 + this.facing.dx, 16, 5, 6);
    ctx.fillStyle = '#ffe2c7';
    ctx.fillRect(12 + this.facing.dx, 16, 2, 2);
    ctx.fillRect(23 + this.facing.dx, 16, 2, 2);
    ctx.restore();
  }
}
