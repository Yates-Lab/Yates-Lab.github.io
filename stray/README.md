# Stray

Unlisted web demos for students and lab discussion:

- `/stray/`: collection index.
- `/stray/moving-retina/`: AOSLO stimulus and M/P response movies.
- `/stray/moving-retina/primer.html`: the five-lesson concept primer.
- The LFP entry links to the existing `/notes/gamma-natural-viewing/` pages so their URLs and data remain unchanged.

These are public static pages on GitHub Pages. They require no login. They are deliberately absent from the lab site's main navigation and search data. The new HTML pages include `noindex, nofollow`; this discourages search indexing and does not make the URLs private.

To add a thought, put its static demo in a descriptive subdirectory, add an entry to `index.html`, and add a relative link back to `../` within the demo. Keep all asset and worker paths relative to the demo. Do not add entries to the global site navigation or search index unless asked.

The Moving Retina demo was copied from the existing validated static build (source commit `adba82dece498dee78acd2c9184924bf8dff4c2d`). Its numerical model and UI scripts are unchanged; this copy adds collection navigation and indexing metadata. It has no build step, external runtime dependencies, or API keys. The planned AI tutor is not included: live chat requires a separate server endpoint and API project.

For local preview, serve the repository root over HTTP. Opening the HTML as a local file will prevent the simulation worker from loading in some browsers.

The repository publishes its `main` branch root directly with `.nojekyll`. Preserve `stray/` if replacing the generated lab-site output in the future.
