# SAHAYAK — Vercel frontend + Python API backend

This package keeps the actual camera-based recognition UI and backend. The uploaded UI/UX prototype is preserved under `docs/`; its Live Studio uses simulated gesture buttons, so it is not used as the live recognition page. The functional page adopts the reference's saffron/gold brand accents while retaining the existing recognition controls.

## Layout
- `frontend/`: static website for Vercel (real camera UI, single/continuous modes, local history, speech and phrasebook).
- `backend/`: Flask API, original trained models, feature code and continuous-sample database.
- `docs/ui-ux-reference-prototype.html`: provided visual reference.

## Deploy backend first (Render)
1. Push this folder to a private Git repository.
2. In Render, create a Web Service from that repository and set **Root Directory** to `backend`.
3. Build command: `pip install -r requirements.txt`
4. Start command: `gunicorn web_app:app --bind 0.0.0.0:$PORT --workers 1 --timeout 120`
5. Set `PYTHON_VERSION=3.11.11`.
6. Deploy and open `https://YOUR-API.onrender.com/api/status`. Confirm `model_ready` and `sequence_model_ready` are both `true`.

## Deploy frontend (Vercel)
1. Import the same repository into Vercel.
2. Leave Root Directory at repository root.
3. `vercel.json` sets the output directory to `frontend`.
4. Edit `frontend/config.js` and set `window.SAHAYAK_API_BASE` to the deployed Render URL, with no trailing slash, e.g. `https://your-api.onrender.com`.
5. Redeploy Vercel.
6. In Render, replace `SAHAYAK_FRONTEND_ORIGIN` with the exact Vercel production origin (e.g. `https://your-project.vercel.app`) for tighter CORS. If using a custom domain, include its origin instead.

## Important deployment limitations
- Vercel hosts the frontend; the Flask + MediaPipe + scikit-learn inference backend runs on Render. A static Vercel deployment alone cannot run this Flask application.
- Render free instances can sleep and have limited memory/CPU; first request may be slow, and camera frames are processed server-side.
- Recognition history is stored in the browser's localStorage, per browser/device. The continuous-sign sample database is included, but new SQLite writes on a free ephemeral backend may not persist through instance replacement/redeploy. Use persistent storage or a managed database if you need permanent server-side sample collection.
- Camera access requires HTTPS (Vercel provides it) or localhost during local development. Phone camera permissions must be granted in the browser.
- Speech uses the browser's Web Speech API and installed voices; availability differs by device.
- The provided design-reference prototype is preserved separately because its camera studio simulates predictions instead of calling the trained model.

## Local test
Backend:
```powershell
cd backend
python -m pip install -r requirements.txt
python web_app.py
```
Frontend: serve `frontend/` on localhost using a static server and set `frontend/config.js` to `http://127.0.0.1:5000`.

Before a public release, verify `/api/status` reports both models ready, test camera access on desktop and mobile, and test one known single sign and one trained sequence end-to-end.
