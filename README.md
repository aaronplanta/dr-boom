# Dr. Boom

A 2D Bomberman-inspired arcade game made with HTML5 Canvas and vanilla JavaScript. All visuals use Canvas shapes and CSS. No dependencies, external assets, installation, or build step.

## Play

Open `index.html` in a modern browser. The ordered `defer` scripts work directly from `file://` as well as from a static server.

Optional local server, from this directory:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Then visit http://127.0.0.1:8000. Stop the server with Ctrl+C.

| Action | Input |
| --- | --- |
| Move | Arrow keys or WASD |
| Place bomb | Space |
| Start / play again | Enter |
| Pause / resume | P or Escape |
| Restart | R |

Touch screens have directional buttons and a bomb button. Switching tabs or leaving the window automatically pauses the game.

Clear three enemies within three minutes. Bombs have a 2.4-second fuse and a two-tile range. You can place two at a time. Fire travels in four directions, stops at solid walls, destroys the first breakable block, and triggers other bombs. Your own fire is dangerous. Destroying a block earns 25 points; defeating an enemy earns 200. Contact with an enemy or fire ends the round.

## Files

| File | Responsibility |
| --- | --- |
| `index.html` | Canvas, HUD, overlays, and controls |
| `style.css` | Responsive dark layout |
| `js/Constants.js` | Grid dimensions, colors, timing, and keys |
| `js/Player.js` | Grid movement and player drawing |
| `js/Bomb.js` | Bomb fuse and drawing |
| `js/Enemy.js` | Enemy patrol/chase behavior and drawing |
| `js/Explosion.js` | Active fire cells, lifetime, and drawing |
| `js/Map.js` | 2D tile array, walls, crates, and blast rays |
| `js/Game.js` | Animation loop, simulation, collisions, scoring, and rendering |
| `js/main.js` | DOM startup, keyboard/touch input, and HUD updates |

The arena is 15×13 with 40px tiles: `0` = empty, `1` = solid wall, `2` = destructible block. Entities occupy integer grid cells; movement is interpolated visually. A capped delta time prevents large simulation jumps. Blast batches use a map snapshot so destruction cannot let another ray pass through a block during the same chain reaction.

## Verify

Node is only needed to run development tests:

```powershell
node --test tests/game.test.cjs
Get-ChildItem js/*.js | ForEach-Object { node --check $_.FullName }
```

Optional browser smoke checks are in `tests/browser-smoke.cjs`. Launch a dedicated Chrome test instance with `--headless=new --remote-debugging-port=9228` and a separate `--user-data-dir`, then run `node tests/browser-smoke.cjs`. The script uses Node's built-in WebSocket support (Node 22+), checks desktop and mobile interactions, and saves screenshots to the ignored `.preview/` directory.
