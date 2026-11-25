// Warung Senja v2 — keyboard + mouse input. One job: turn keys/clicks into intents.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    click: null, // {x, y} in canvas coords, consumed by main.js each frame
    interactPressed: false,
    pausePressed: false,
  };
  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  };
  window.addEventListener('keydown', (e) => {
    if (KEYMAP[e.code]) { input.keys.add(KEYMAP[e.code]); e.preventDefault(); }
    if (e.code === 'KeyE' || e.code === 'Space') { input.interactPressed = true; e.preventDefault(); }
    if (e.code === 'KeyP' || e.code === 'Escape') input.pausePressed = true;
  });
  window.addEventListener('keyup', (e) => {
    if (KEYMAP[e.code]) input.keys.delete(KEYMAP[e.code]);
  });
  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * canvas.width;
    const y = ((e.clientY - r.top) / r.height) * canvas.height;
    input.click = { x, y };
  });
  window.addEventListener('blur', () => input.keys.clear());
  return input;
}

// Movement vector from held keys, normalised.
export function moveVector(input) {
  let x = 0, y = 0;
  if (input.keys.has('left')) x -= 1;
  if (input.keys.has('right')) x += 1;
  if (input.keys.has('up')) y -= 1;
  if (input.keys.has('down')) y += 1;
  if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  return { x, y };
}
