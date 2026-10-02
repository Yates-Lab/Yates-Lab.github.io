# Noise game — motion-defined structure

Static browser distribution of NOISE, linked from the Stray collection. Open
`index.html` through an HTTP server, not directly as a local file. GitHub Pages
serves it at `/stray/noise-game/` without a backend.

Use a desktop keyboard and mouse. Choose **Motion World** on the launch screen
for motion-defined structure; **Classic** provides a textured comparison.
WASD moves, the mouse looks, Shift sprints, Esc pauses, Tab shows the map, and
Space freezes the scene. Ghosts can be disabled on the launch or pause screen.

The build uses Pygbag 0.9.3 and its Python 3.12 WebAssembly runtime. The first visit
downloads Python, NumPy, and Pygame from `https://pygame-web.github.io/cdn/`.
Preferences are stored locally in the visitor's browser. No account is required.

`stage.tar.gz` contains the Python sources under `assets/`; `stage.apk` is the
equivalent ZIP archive used by the Pygbag loader on itch.io. `bridge.js` handles
browser mouse capture, fullscreen, and input. `style.css` styles the game shell;
`stray-nav.css` and the header in `index.html` add the return link to Stray.
The loader's `can_close: 1` avoids intrusive leave-page confirmation prompts.

To update from the NOISE development project, run `python tools/build_web.py`
in its `noise-game` environment and copy `index.html`, `bridge.js`, `style.css`,
`stage.tar.gz`, and `stage.apk` from `web-build/stage/build/web/`. Preserve this
page's title, noindex metadata, icon, `can_close: 1`, and Stray navigation when replacing the
generated HTML. Keep the Python source and both archives in sync. The existing
desktop and browser game share their simulation and rendering code.
