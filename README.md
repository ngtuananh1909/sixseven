# Six Seven — Camera Game Hub

Ứng dụng web camera gồm hai chế độ:

- **Pose Battle**: 2 người, 10 dáng mẫu, cần >=90% mỗi người và giữ 400 ms; thắng sau 3 lượt đúng, thua sau 3 lượt sai.
- **Pump Challenge**: 1 người, 20 giây, bơm hai tay so le; tay trái nhận 6 điểm, tay phải nhận 7 điểm; mục tiêu 200 điểm.

## Repository structure

| Path | Purpose |
| --- | --- |
| `index.html` | **All-in-one production website**: two modes, shared CameraManager / PoseEngine and game loop. No build required. |
| `source/index.html` | Maintainable development entry point (ES modules). |
| `source/src/` | Shared camera/AI/audio/canvas code, UI components and separate game implementations. |
| `source/tests/` | Unit tests for scoring, motion detection and timers. |
| `pose.html`, `pump.html` | Original standalone game snapshots for comparison, not used by the unified home page. |
| `.nojekyll` | Serve static files without Jekyll processing. |

## GitHub Pages setup

**Repository must support public GitHub Pages.** For simplest publication:

1. Set repo visibility to **Public** under Settings → General → Danger Zone.
2. Open **Settings → Pages**.
3. Choose **Deploy from a branch**, branch **main**, folder **/(root)** and **Save**.
4. When GitHub reports deployment success, open **https://ngtuananh1909.github.io/sixseven/**.

The root `index.html` contains inline CSS and bundled JavaScript, so GitHub Pages does not need Node/Vite. Google Fonts and MediaPipe WASM/model are fetched from external networks.

To develop with the modular version, serve the `source/` folder:

```bash
cd source
python3 -m http.server 8080
npm test
npm run check
```

The development `source/index.html` also works as a static website without a build step.

## Camera notes

- Camera access requires **HTTPS / localhost** and the user's permission.
- Mobile supports portrait for Pump, while Pose works best in landscape for two people.
- Camera selection and switching are available in the **CAM** control of the unified app, subject to browser and hardware support.
- Frames are processed locally. Camera video is not uploaded by the game. The third-party MediaPipe library/model and fonts require network access.
- Browser camera availability, FPS and saving results vary by device. **No guarantee for every camera model**.
- Code-level checks and unit tests passed. **Actual iOS / Android camera performance has not been validated on hardware**.

## Release notes

2026-11-03: Unified mobile-oriented single-page app, shared camera and AI services, separate game modules, camera settings, pause/restart/release handling, scoring compatibility tests. The two original standalone HTML games remain available as references.
