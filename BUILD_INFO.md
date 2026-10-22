# SAHAYAK package build information

- Package purpose: local training and evaluation for static and continuous signs, using the current unified website UI/UX.
- UI: synchronized from the current `SAHAYAK-Vercel-Deployment/frontend` source, including current Live Studio, logo assets, service worker refresh, and team-card role captions.
- Local API: synchronized to the corresponding backend that supports `/api/predict-features` and `/api/sequence/predict`.
- Local website API config: `website/config.js` targets `http://127.0.0.1:5000`.
- Deployment reference: `deployment/SAHAYAK-Vercel-Deployment/frontend/config.js` remains pointed at `https://sahayak-backend-krh1.onrender.com`.
- The `.venv` folder is intentionally excluded; create it using `README.md` / `WINDOWS_SETUP.md`.
- Existing datasets, active models, legacy databases and `Code/` files came from the user's uploaded ZIP and were preserved. The new sign `WHAT_IS_YOUR_NAME` has not been collected or inserted into the model; this package prepares the workflow to collect it safely.
- Sequence training was hardened: without `--promote`, it creates a candidate model; explicit promotion backs up the current model before replacing it.
- See `TEST_REPORT.md` for checks and limitations.
