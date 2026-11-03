# Six Seven — Camera Game Hub

A single, static, mobile-first website combining two original games:

- **Pose Battle**: two players, 10 original random poses, 10 seconds per round, each player must score >=90% and hold for 400 ms. Win after 3 successful poses, lose after 3 failed rounds.
- **Pump Challenge**: one player, 20 seconds, alternating full-stroke arm movement, score 6 from left wrist and 7 from right wrist, target 200 points. Keeps combo, peak speed and personal best.

## Play locally

Use a local web server (not `file://`):

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

No Node packages or compilation are required for the website. ES Modules are served directly from GitHub Pages.

To run automatic tests with Node 20+:

```bash
npm test
npm run check
```

## Publish on GitHub Pages

1. Create a new **public** repository named `six-seven` on GitHub (or use a repository you already own).
2. Upload **all project files and directories** to the repository root, preserving the `src` folder and `index.html` paths.
3. Open **Settings → Pages**, set **Source: Deploy from a branch**, **Branch: main**, **Folder: /(root)**, then Save.
4. Access the URL shown by GitHub Pages, usually `https://<owner>.github.io/six-seven/`.

Links with `?game=pose` and `?game=pump` open a mode directly. There are no absolute website asset paths, so project subpaths work.

## Camera compatibility

- Camera works only from **HTTPS**, `localhost` or another secure context, after the browser grants camera permission.
- On Android, prefer current Chrome / Samsung Internet. On iPhone / iPad, use a current Safari or Chrome on iOS. Desktop supports modern browsers that implement `getUserMedia`, WebAssembly and MediaPipe.
- On **Pump**, portrait and landscape are supported. On **Pose**, two people must fit in the frame; a landscape prompt appears on phone portrait mode.
- Camera selection, switch front/back and mirror view are available from the **CAM** button during an active game. Changing a camera restarts calibration.
- This app detects poses locally, and does not upload camera frames. MediaPipe JS/WASM/model and Google Fonts load from third-party CDNs and therefore require initial connectivity. Camera privacy depends on your browser permissions.
- Hardware and OS browser restrictions prevent any guarantee of support for every camera.

## Structure

- `index.html` — home and application shell
- `src/main.js` — app router and game switching
- `src/core` — shared CameraManager, PoseEngine, CanvasView, GameLoop and TimerBag
- `src/games/pose` — original pose catalog and scoring, Pose mode and template
- `src/games/pump` — original hand stroke tracker, Pump mode and template
- `src/shared` — single audio manager, snapshots, local storage
- `src/components` — camera configuration UI
- `tests` — Node unit tests for scoring, strokes, timers

## Known limitations

- A front/back camera label may be unavailable or misleading on some devices; use the **mirror** toggle to match your physical view.
- MediaPipe can be slow on low-power phones. Inference is throttled, but rendering and pose inference still happen on the main browser thread.
- Some browsers cannot select another camera or cannot play audio until user interaction; both depend on browser support.
- Pose identity tracking uses position continuity and is not a face-recognition identity system. Players should stand side-by-side and avoid crossing each other.
- No actual cross-device validation is implied by the unit and headless-browser tests. Test with real phone hardware before public promotion.

## Original assets

This repository is refactored from the user-supplied `six-seven-pose(1).html` and `six-seven-pump.html`; gameplay thresholds and the original audiovisual styles are preserved except for explicitly documented compatibility/bug fixes.
