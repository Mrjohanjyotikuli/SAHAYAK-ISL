# LEGANG AI companion

LEGANG AI is an additive, lightweight assistant integrated into the SAHAYAK Vercel frontend and Studio page.

## Included in this build
- Floating companion using the supplied LEGANG AI image as a flat branded visual, with small idle/listening/thinking/speaking state indicators and a responsive chat panel.
- Local, verified FAQ matching. Chat text remains in page memory and is not sent to an AI provider. No AI provider API key is needed.
- Optional browser speech synthesis, enabled by the visitor and played only after they press a Speak button. Browser voices vary.
- Live, read-only model-label and representative continuous landmark-frame data from `/api/legang/sign-library`.
- Accessible keyboard controls, reduced-motion support, no automatic camera/microphone access, and clean teardown for audio, timers, observers, and pose playback.

## Recorded pose data limitation
The current continuous-sign database stores normalized landmark feature vectors (132 numeric features per frame), not the original RGB camera photos or video. LEGANG renders a labelled skeleton preview from actual stored feature frames and identifies the source frame index; it does not claim that reconstruction is the original camera image. The deployed backend has model labels for static signs but does not currently publish static pose-example rows, so the UI states that clearly rather than inventing poses.

## Files
- `frontend/legang-ai.js` — widget, local FAQ, live sign library, landmark renderer, and opt-in speech.
- `frontend/legang-ai.css` — isolated, responsive styles.
- `frontend/assets/legang-ai-avatar.webp` — optimized version of the supplied visual identity.
- `backend/web_app.py` — small read-only endpoint for model labels and capped saved sequence previews.
- `frontend/index.html`, `frontend/studio.html` — load the companion assets.
- `frontend/service-worker.js` — new cache key and precache entries for the companion files.

## Upgrade to generative AI or full facial animation
This version intentionally has no model API key or third-party network chat call. To enable generative answers later, add a server-side Flask route and store provider credentials in Render environment variables—never in frontend JavaScript. The supplied picture is a flat image, not a rigged face. It uses subtle shell animation and truthful speaking/listening indicators, not fake eye or phoneme movements. Realistic face animation and phoneme-level lip sync require a properly rigged 2D/3D avatar or a compatible animation service and its required assets/credentials.


## Sign library update
- The assistant panel header is text-only; the floating launcher keeps the supplied character artwork.
- The sign library shows every static label returned by the active static model and every continuous label returned by the active continuous model, including additional labels found in saved sequence recordings. There is no search box.
- Each label links to Live Studio with a practice prompt. Starting the camera remains a manual, permission-controlled action; the normal Smart Communication recognizer is unchanged.
- Selecting a continuous sign fetches all complete valid stored frames for all database samples under that label. Users can choose a recording, play it frame by frame or automatically, and then test the label in Live Studio.
- **Static recording availability:** the current Git repository does not contain a deployed static-sign frame database or training CSV. Static model labels are all listed and testable, but a genuine static recorded pose cannot be displayed until those existing static landmark records are added to the repository/backend. No pose is fabricated. Where the same label also has a continuous recording, the UI labels it clearly as a sequence example.
