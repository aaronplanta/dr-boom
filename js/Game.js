"use strict";

class Game {
  constructor(canvas, onChange = () => {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('This browser does not support a 2D Canvas context.');
    this.onChange = onChange;
    this.keys = new Set();
    this.animationId = null;
    this.lastTime = null;
    this.reducedMotion = false;
    this.frame = this.frame.bind(this);
    this.reset('ready');
  }

  reset(state = 'running') {
    this.map = new GameMap();
    this.player = new Player(1, 1);
    this.enemies = [new Enemy(13, 1, 0), new Enemy(13, 11, 1), new Enemy(1, 11, 2)];
    this.bombs = [];
    this.explosions = [];
    this.particles = [];
    this.keys.clear();
    this.score = 0;
    this.elapsed = 0;
    this.visualTime = 0;
    this.shakeTime = 0;
    this.lastTime = null;
    this.state = state;
    this.message = state === 'ready'
      ? 'A fresh arena. A clean slate. What could possibly go wrong?'
      : 'Make an exit plan. Your bombs are just as dangerous to you.';
    this.onChange(this);
  }

  startLoop() {
    if (this.animationId !== null) return;
    this.animationId = requestAnimationFrame(this.frame);
  }

  frame(timestamp) {
    const delta = this.lastTime === null ? 0 : Math.min((timestamp - this.lastTime) / 1000, CONFIG.MAX_DELTA);
    this.lastTime = timestamp;
    this.update(delta);
    this.render();
    this.animationId = requestAnimationFrame(this.frame);
  }

  canMoveTo(col, row, actor) {
    if (!this.map.isWalkable(col, row)) return false;
    if (this.bombs.some(bomb => !bomb.exploded && bomb.col === col && bomb.row === row)) return false;
    // Enemies do not stack; entering the player's cell is resolved as contact.
    if (actor instanceof Enemy && this.enemies.some(enemy => enemy !== actor && enemy.col === col && enemy.row === row)) return false;
    return true;
  }

  placeBomb() {
    if (this.state !== 'running' || !this.player.alive) return false;
    const { col, row } = this.player;
    if (this.bombs.some(bomb => bomb.col === col && bomb.row === row)) return false;
    if (this.bombs.length >= CONFIG.BOMB_LIMIT) {
      this.message = 'Both bombs are in play. Wait for a little room in your inventory.';
      this.onChange(this);
      return false;
    }
    const bomb = new Bomb(col, row);
    this.bombs.push(bomb);
    if (this.isOnFire(col, row)) {
      this.detonateBombs([bomb]);
      this.checkHazards();
    }
    this.onChange(this);
    return true;
  }

  detonateBombs(initialBombs) {
    // All rays in this batch see the same walls and blocks. Apply destruction
    // after tracing the entire chain, so array order cannot change shielding.
    const snapshot = this.map.grid.map(row => row.slice());
    const queue = initialBombs.slice();
    const destroyed = new Set();
    let detonated = false;
    for (let index = 0; index < queue.length; index++) {
      const bomb = queue[index];
      if (bomb.exploded) continue;
      bomb.exploded = true;
      detonated = true;
      const cells = this.map.getBlastCells(bomb.col, bomb.row, bomb.range, snapshot);
      const fire = new Explosion(cells);
      this.explosions.push(fire);
      for (const { col, row } of cells) {
        if (this.map.getTile(col, row, snapshot) === TILE.BLOCK) destroyed.add(`${col},${row}`);
      }
      for (const other of this.bombs) {
        if (!other.exploded && fire.contains(other.col, other.row)) queue.push(other);
      }
    }
    for (const cell of destroyed) {
      const [col, row] = cell.split(',').map(Number);
      if (this.map.destroyBlock(col, row)) {
        this.score += CONFIG.CRATE_SCORE;
        this.addParticles(col, row, COLORS.crateTop, 6);
      }
    }
    this.bombs = this.bombs.filter(bomb => !bomb.exploded);
    if (detonated) this.shakeTime = 0.12;
  }

  isOnFire(col, row) {
    return this.explosions.some(fire => fire.contains(col, row));
  }

  checkHazards() {
    if (this.state !== 'running') return;
    const hitByFire = this.isOnFire(this.player.col, this.player.row);
    const hitByEnemy = this.enemies.some(enemy => enemy.col === this.player.col && enemy.row === this.player.row);
    this.enemies = this.enemies.filter(enemy => {
      if (!this.isOnFire(enemy.col, enemy.row)) return true;
      enemy.alive = false;
      this.score += CONFIG.ENEMY_SCORE;
      this.addParticles(enemy.col, enemy.row, COLORS.enemy, 9);
      return false;
    });
    // Survival is required even when the last enemy dies in the same frame.
    if (hitByFire || hitByEnemy) {
      this.player.alive = false;
      this.addParticles(this.player.col, this.player.row, COLORS.player, 12);
      this.finish('lost', hitByFire
        ? 'A little too close to the action. Next time, leave yourself an exit.'
        : 'A hostile got a little too friendly. Keep your distance.');
    } else if (this.enemies.length === 0) {
      this.finish('won', 'Clean sweep. All three hostiles cleared. Beautifully calculated chaos.');
    }
  }

  finish(state, message) {
    this.state = state;
    this.message = message;
    this.keys.clear();
    this.onChange(this);
  }

  togglePause() {
    if (this.state !== 'running' && this.state !== 'paused') return;
    this.state = this.state === 'running' ? 'paused' : 'running';
    this.keys.clear();
    this.lastTime = null;
    this.onChange(this);
  }

  update(delta) {
    if (this.state !== 'running') return;
    this.elapsed += delta;
    this.visualTime += delta;
    if (this.elapsed >= CONFIG.ROUND_SECONDS) {
      this.elapsed = CONFIG.ROUND_SECONDS;
      this.finish('lost', 'Time’s up. The hostiles are still standing. Give it another shot.');
      return;
    }

    this.shakeTime = Math.max(0, this.shakeTime - delta);
    for (const particle of this.particles) {
      particle.life -= delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 180 * delta;
    }
    this.particles = this.particles.filter(particle => particle.life > 0);
    for (const fire of this.explosions) fire.update(delta);
    this.explosions = this.explosions.filter(fire => fire.remaining > 0);

    const due = [];
    for (const bomb of this.bombs) {
      if (bomb.update(delta) || this.isOnFire(bomb.col, bomb.row)) due.push(bomb);
    }
    if (due.length) this.detonateBombs(due);
    this.checkHazards();
    if (this.state !== 'running') return;

    this.player.update(delta, this);
    this.checkHazards();
    if (this.state !== 'running') return;
    for (const enemy of this.enemies.slice()) {
      enemy.update(delta, this);
      this.checkHazards();
      if (this.state !== 'running') return;
    }
    this.onChange(this);
  }

  addParticles(col, row, color, count) {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 85;
      this.particles.push({
        x: (col + 0.5) * CONFIG.TILE_SIZE,
        y: (row + 0.5) * CONFIG.TILE_SIZE,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 0.25 + Math.random() * 0.3,
        color
      });
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    if (!this.reducedMotion && this.shakeTime > 0 && this.state === 'running') {
      ctx.translate(Math.sin(this.visualTime * 130) * 1.5, Math.cos(this.visualTime * 110) * 1.5);
    }
    this.map.draw(ctx);
    for (const bomb of this.bombs) bomb.draw(ctx, this.visualTime, this.reducedMotion);
    for (const enemy of this.enemies) enemy.draw(ctx, this.visualTime, this.reducedMotion);
    this.player.draw(ctx, this.visualTime, this.reducedMotion);
    for (const fire of this.explosions) fire.draw(ctx, this.visualTime, this.reducedMotion);
    for (const particle of this.particles) {
      ctx.globalAlpha = Math.min(1, particle.life / 0.15);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    }
    ctx.restore();
  }
}
