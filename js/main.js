"use strict";

document.addEventListener('DOMContentLoaded', () => {
  const byId = id => document.getElementById(id);
  const ui = {
    canvas: byId('game-canvas'), overlay: byId('game-overlay'),
    score: byId('score'), enemies: byId('enemies'), bombs: byId('bombs'),
    timer: byId('timer'), status: byId('arena-status'), dot: byId('arena-dot'),
    title: byId('overlay-title'), kicker: byId('overlay-kicker'),
    description: byId('overlay-description'), hint: byId('overlay-hint'),
    start: byId('start-button'), startLabel: byId('start-label'),
    pause: byId('pause-button'), restart: byId('restart-button'),
    message: byId('game-message')
  };
  let displayedState = '';
  const setText = (element, value) => {
    if (element.textContent !== value) element.textContent = value;
  };

  function syncUI(current) {
    setText(ui.score, String(current.score).padStart(5, '0'));
    setText(ui.enemies, String(current.enemies.length).padStart(2, '0'));
    ui.bombs.firstChild.nodeValue = String(CONFIG.BOMB_LIMIT - current.bombs.length).padStart(2, '0');
    const seconds = Math.max(0, Math.ceil(CONFIG.ROUND_SECONDS - current.elapsed));
    setText(ui.timer, `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
    ui.timer.parentElement.classList.toggle('urgent', seconds <= 30);
    setText(ui.message, current.message);

    if (displayedState === current.state) return;
    displayedState = current.state;
    ui.overlay.hidden = current.state === 'running';
    ui.pause.disabled = !['running', 'paused'].includes(current.state);
    ui.pause.innerHTML = current.state === 'paused'
      ? '<span aria-hidden="true">▶</span> RESUME <kbd>P</kbd>'
      : '<span aria-hidden="true">Ⅱ</span> PAUSE <kbd>P</kbd>';
    const labels = { ready: 'AWAITING PLAYER', running: 'EXPERIMENT IN PROGRESS', paused: 'EXPERIMENT PAUSED', won: 'SECTOR CLEARED', lost: 'EXPERIMENT CONCLUDED' };
    setText(ui.status, labels[current.state]);
    ui.dot.style.background = current.state === 'lost' ? 'var(--orange)' : 'var(--accent)';
    const screens = {
      ready: { kicker: 'GOOD THINGS COME WITH A SHORT FUSE', title: 'LET’S MAKE<br>SOME ROOM.', description: 'Outsmart the hostiles. Clear the arena.<br>Keep a little distance.', button: 'LET’S PLAY' },
      paused: { kicker: 'EVEN CHAOS NEEDS A COFFEE BREAK', title: 'TAKE A<br>BREATHER.', description: 'Your arena is right where you left it.<br>The fuses can wait.', button: 'BACK TO IT' },
      won: { kicker: 'NOW THAT’S A CLEAN SWEEP', title: 'BEAUTIFULLY<br>EXECUTED.', description: `All hostiles cleared. ${current.score} points earned.<br>Care to make some more room?`, button: 'PLAY AGAIN' },
      lost: { kicker: 'AN EXPERIMENT. A LEARNING EXPERIENCE.', title: current.elapsed >= CONFIG.ROUND_SECONDS ? 'OUT OF<br>TIME.' : 'WELL, THAT<br>WENT BOOM.', description: `${current.score} points. A little wiser.<br>Every great plan takes a few attempts.`, button: 'ONE MORE TRY' }
    };
    const screen = screens[current.state];
    if (screen) {
      setText(ui.kicker, screen.kicker);
      ui.title.innerHTML = screen.title;
      ui.description.innerHTML = screen.description;
      setText(ui.startLabel, screen.button);
      ui.hint.innerHTML = current.state === 'paused'
        ? 'press <kbd>P</kbd> or <kbd>ESC</kbd> to resume'
        : 'or press <kbd>ENTER</kbd> to get started';
      // Keep the next action reachable for keyboard players after the round.
      if (current.state === 'won' || current.state === 'lost') ui.start.focus({ preventScroll: true });
    }
  }

  const game = new Game(ui.canvas, syncUI);
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  game.reducedMotion = motionPreference.matches;
  motionPreference.addEventListener('change', event => { game.reducedMotion = event.matches; });

  function focusArena() { ui.canvas.focus({ preventScroll: true }); }
  function startOrResume() {
    if (game.state === 'paused') game.togglePause();
    else game.reset();
    focusArena();
  }

  ui.start.addEventListener('click', startOrResume);
  ui.restart.addEventListener('click', () => { game.reset(); focusArena(); });
  ui.pause.addEventListener('click', () => {
    game.togglePause();
    if (game.state === 'running') focusArena();
  });
  ui.canvas.addEventListener('pointerdown', focusArena);

  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    // Preserve native Enter/Space activation when a keyboard user focuses a button.
    if (event.target.closest('button, a') && (event.code === 'Enter' || event.code === 'Space')) return;
    const isGameKey = MOVEMENT_KEYS[event.code] || Object.values(INPUT_KEYS).includes(event.code);
    if (!isGameKey) return;
    event.preventDefault();
    if (MOVEMENT_KEYS[event.code]) {
      if (game.state === 'running') game.keys.add(event.code);
      return;
    }
    if (event.repeat) return;
    switch (event.code) {
      case INPUT_KEYS.BOMB:
        if (game.state === 'ready') startOrResume();
        else game.placeBomb();
        break;
      case INPUT_KEYS.START:
        if (game.state !== 'running') startOrResume();
        break;
      case INPUT_KEYS.PAUSE:
      case INPUT_KEYS.ESCAPE:
        game.togglePause();
        break;
      case INPUT_KEYS.RESTART:
        game.reset();
        focusArena();
        break;
    }
  });
  window.addEventListener('keyup', event => game.keys.delete(event.code));

  function suspend() {
    game.keys.clear();
    if (game.state === 'running') game.togglePause();
  }
  window.addEventListener('blur', suspend);
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });

  const touchKeys = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };
  for (const button of document.querySelectorAll('[data-move]')) {
    const code = touchKeys[button.dataset.move];
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (game.state !== 'running') return;
      button.setPointerCapture(event.pointerId);
      game.keys.add(code);
    });
    const release = () => game.keys.delete(code);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    // Keyboard and assistive-technology activation also move a single cell.
    button.addEventListener('click', event => {
      if (event.detail === 0 && game.state === 'running' && game.player.moveTime === 0) {
        const { dx, dy } = MOVEMENT_KEYS[code];
        game.player.tryMove(dx, dy, game);
        game.checkHazards();
      }
    });
  }
  byId('touch-bomb').addEventListener('click', () => game.placeBomb());
  game.startLoop();
});
