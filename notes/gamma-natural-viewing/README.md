# Gamma during natural viewing

An unlisted research report and two static interactive companions. GitHub Pages
serves the directory directly: no application server or recording-machine
connection is required. The report does not appear in the lab's main navigation
or search index, and each page carries `noindex, nofollow`. This is **public,
unlisted content**, not access control; the source repository is public too.

When merged into the configured Pages source (`main`, repository root), the URL
is `https://yates-lab.github.io/notes/gamma-natural-viewing/`.

## Pages and coverage

- `index.html`: Part 1, with 12 numbered figures (13 images), source citations,
  methods, limitations, two example sessions, and the 30-session summaries.
- `fixations/`: 12 saved fixations, six each from Allen_2022-04-13 and
  Logan_2020-01-07. Two contacts per session, recorded/shank-CAR/cross-shank
  references, 64/128/256 ms windows, two or four DPSS tapers, spectra, band-RMS
  envelopes, and four selectable analytic-phase bands. Gaze, spikes, LFP,
  receptive-field crops and the image cursor share the same time axis.
- `explore/`: all 30 good sessions (14 Allen, 16 Logan), each session and animal
  summary, three references, both shanks and three provisional depth groups.
  Measurements are Ito-style saccade power z-scores, inter-saccade phase
  consistency, and Brunet-style image/pre-image spectral changes.
- `report.pdf`, `report.md`, and two CSVs: downloadable report and coverage/depth
  information. The Markdown is the editable source for the written chapter.

The fixation examples are **not a prevalence sample**. Cloud-image trials are
excluded by filename before duration selection. Logan January 7 replaces the
December 20 browser example because it has clear independently measured RFs.
The written report and its session-level examples retain December 20. For targets of 120, 180,
250, 400, 700 and 1000 ms, selection takes the first non-censored fixation within
15% of that duration, at least 300 ms after trial onset; nearest duration is used
if needed. No LFP, spike response or gaze spectrum selects the examples. Original
trial, within-trial fixation, and session ordinal are retained in the export.
The public arrow keys step through this duration-ordered sample, not through
every fixation chronologically. The same trial can supply several examples.

The browser is an illustration of the measurements, not a detector or a coupling
test. Phase colors use one explicitly selected common contact; per-unit nearby
phase references and full-session STA computation remain in the recording-machine
viewer. Logan uses the original (OSP) spike sorting that generated its RF
archive; Allen uses Kilosort 4. Unit IDs are specific to those sorting sources.
Logan's default is original unit 75, with LFP contact 49 and lateral partner 17.
Original clusters marked “unsorted” have no supplied single-unit quality rating;
a clear RF does not establish spike-isolation quality. Identity was checked
against the archived Gaborium spike counts, not inferred from matching array
sizes. Original template channels were mapped through the saved channel map,
and the default contact was checked against its average raw spike waveform.
A missing RF map is reported explicitly. This export does not synthesize
missing data. The image crops use their existing export sampling; native gaze
and spike timing are retained separately.

## Preview and update

From the repository root, serve the existing files with any static web server,
for example `python -m http.server 8893 --bind 127.0.0.1`. Open
`http://localhost:8893/notes/gamma-natural-viewing/`. Fetching the compressed data
requires HTTP rather than a `file://` URL. Current Chrome, Firefox, Safari and
Edge support the browser's native gzip decoder. No third-party chart service,
CDN or tracking script is used.

To edit the report, update `report.md`, then run `python tools/render_report.py`
from this directory. The renderer needs `markdown`, `beautifulsoup4`, and Pillow.
It preserves the two-panel paper comparison, adds figure enlargement and local
navigation, and uses external, lazy-loaded PNGs. Update the downloadable PDF
separately when the scientific text changes.

To expand or refresh the data, use `jake/gamma_lfp/export_public_gamma.py` in the
VisionCore analysis repository, pointing `--output` at this directory. It imports
the original fixation-browser spectral and phase calculations and the completed
paper-counterpart summary loaders. Export selection and preprocessing are not
reimplemented in JavaScript. Regenerate into a new empty directory when source
data or calculation code changes; existing files are resumable snapshots and
are deliberately not overwritten automatically.

`data/provenance.json.gz` records source hashes. Exported numerical values retain
seven significant digits, after full-precision estimation. Spectra use fixed
window lengths with continuous context; no window is shortened to the fixation.
Repeated eye spectra are shared between reference/contact choices. Numerical
arrays are gzip-compressed, fetched on demand, and never include full continuous
LFP files. Raw data paths and private server URLs are excluded.

## Validation and interpretation

`tools/check_export.py` validates local links, coverage, selection ranges,
timestamp alignment, finite LFP/TF support, phase lengths and finite-value masks.
`validation.json` records the browser and numerical checks made for this snapshot.
Visually review new examples and new report figures before publishing updates.

All public figures use **unnotched** LFP. The blue >30 Hz trace is only a display
filter. Phase uses a separate selected bandpass/Hilbert estimator and is not
inferred from multitaper power. The session maps align to **saccade onset**;
the fixation viewer aligns to **saccade end**. Normalization, averaging and
uncertain depth landmarks are explained on the respective pages.

This chapter establishes event-related field structure and its literature
comparison. It does not establish that eye tremor drives gamma or that phase
carries additional image information. See the report for which published
signatures agree, differ or remain unresolved.

Plotly.js is vendored under its MIT license (`assets/PLOTLY-LICENSE.txt`). Paper
figures retain their authors' attribution and source links; no license to those
figures or to stimulus photographs is asserted by the software license.
