/* The browser owns trusted gestures, pointer lock, and fullscreen. Python owns play. */
(() => {
  const canvas = document.getElementById('canvas');
  const capture = document.getElementById('capture');
  const quality = document.getElementById('quality');
  const readout = document.getElementById('readout');
  let state = {}, stats = {}, wantCapture = false;
  let dx = 0, dy = 0, pause = false, nextQuality = null;
  const keys = new Set(), taps = new Set();
  let lockError = '';
  const locked = () => document.pointerLockElement === canvas;
  const playing = () => state.mode === 'playing' && !state.map && !state.frozen;
  function refresh() {
    capture.hidden = !playing() || locked();
    capture.querySelector('span').textContent = lockError || 'WASD to move · mouse to look';
    if (state.quality) quality.value = state.quality;
    readout.textContent = `World: ${state.world || 'loading'}\nState: ${state.mode || 'loading'}${state.map ? ' · map' : ''}${state.frozen ? ' · frozen' : ''}\nMouse: ${locked() ? 'captured' : 'released'}\nGhosts: ${state.ghosts ? 'on' : 'off'} (${stats.ghost_count ?? 0} active)\nDetail: ${state.quality || 'fast'}\nCoherence: ${Math.round((state.coherence || 0) * 100)}%\nSeed: ${state.seed ?? '—'}\nFrames: ${stats.frames ?? 0}\nFrame work: ${stats.frame_ms ?? '—'} ms\nPosition: ${stats.x ?? '—'}, ${stats.y ?? '—'}\nAngle: ${stats.angle ?? '—'}\nTime: ${stats.time ?? 0}s\nHealth: ${stats.health ?? '—'}\nFlow retained: ${stats.retained ?? '—'}`;
  }
  function requestCapture() {
    canvas.focus({preventScroll: true});
    try {
      const result = canvas.requestPointerLock();
      if (result?.catch) result.catch(error => {
        lockError = 'Click again with this browser tab in front.';
        console.warn('NOISE mouse capture:', error.message);
        refresh();
      });
    } catch (_) { lockError = 'Open this game in a desktop browser with mouse capture.'; refresh(); }
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (_) { /* The game remains playable in the page. */ }
  }
  window.noiseBridge = {
    locked,
    setCapture(enabled) {
      wantCapture = enabled;
      keys.clear(); taps.clear();
      if (!enabled && locked()) document.exitPointerLock();
      dx = dy = 0;
      refresh();
    },
    poll() {
      const result = JSON.stringify({dx, dy, pause, quality: nextQuality, keys: [...keys], taps: [...taps]});
      dx = dy = 0; pause = false; nextQuality = null;
      taps.clear();
      return result;
    },
    update(value) {
      state = JSON.parse(value);
      document.getElementById('infobox').style.display = 'none';
      refresh();
    },
    report(value) {
      stats = JSON.parse(value);
      document.getElementById('fps').textContent = `${Math.round(stats.fps)} fps`;
      refresh();
    },
  };
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('mousedown', e => {
    canvas.focus({preventScroll: true});
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * 1280 / rect.width;
    const y = (e.clientY - rect.top) * 720 / rect.height;
    const start = (state.starts || []).some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);
    if (wantCapture || (state.mode !== 'playing' && start)) requestCapture();
  });
  capture.addEventListener('click', requestCapture);
  document.addEventListener('mousemove', e => { if (locked()) { dx += e.movementX; dy += e.movementY; } });
  document.addEventListener('pointerlockchange', () => {
    dx = dy = 0;
    lockError = '';
    if (!locked() && wantCapture && playing()) pause = true;
    refresh();
  });
  document.addEventListener('pointerlockerror', refresh);
  document.addEventListener('keydown', e => {
    if (e.target === quality || e.target.tagName === 'INPUT') return;
    if (locked()) { keys.add(e.code); if (!e.repeat) taps.add(e.code); }
    if (e.code === 'KeyF' && !e.repeat) fullscreen();
    if (e.code === 'Enter' && state.mode && state.mode !== 'playing') requestCapture();
    if ((e.code === 'Tab' && state.map) || (e.code === 'Space' && state.frozen)) requestCapture();
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && (locked() || e.target === canvas)) e.preventDefault();
  });
  document.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { if (playing()) pause = true; dx = dy = 0; keys.clear(); taps.clear(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing()) pause = true; });
  quality.addEventListener('change', () => { nextQuality = quality.value; canvas.focus({preventScroll: true}); });
  document.getElementById('fullscreen').addEventListener('click', fullscreen);
})();
