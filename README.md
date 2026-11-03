# Six Seven — Camera Game Hub

Website entry: `index.html` (links to `pose.html` and `pump.html`).

- **Pose Battle:** original two-player, 90% per player, hold 400 ms, 10 seconds/round, three wins to succeed.
- **Pump Challenge:** original one-player arm pumping game, 20 seconds, target 200 points.

## Deployment

1. Make the repository **Public** (Settings → General → Danger Zone → Change repository visibility).
2. Set Settings → Pages → **Deploy from a branch** → `main` → `/(root)` → Save.
3. Open `https://ngtuananh1909.github.io/sixseven/` once GitHub reports deployment success.

Browsers require HTTPS and camera permission. The game uses MediaPipe from external CDNs.

## Source status

This repository currently contains a **working-path deployment of the two original HTML games**, with a responsive landing page, not the full modular refactor. The modular CameraManager / PoseEngine / game component source is provided separately in the `six-seven-game-hub.zip` artifact from the ChatGPT conversation and should replace this initial deployment when transferred.

The original games retain their original mobile limitations (portrait orientation locking, fixed front-facing camera preference and no camera switch UI). They have not been validated on physical iOS/Android devices.
