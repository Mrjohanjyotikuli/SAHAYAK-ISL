# Deployment verification checklist

- [ ] Backend `/api/status` returns `model_ready: true`.
- [ ] Backend `/api/status` returns `sequence_model_ready: true`.
- [ ] Vercel frontend `config.js` points to the deployed HTTPS API URL.
- [ ] Render CORS origin is restricted to the production Vercel domain.
- [ ] Camera permission works on desktop and mobile.
- [ ] Single-sign predictions match known trained gestures.
- [ ] Continuous-sign predictions match known trained sequences.
- [ ] Hand landmark overlay aligns with camera preview on front and rear cameras.
- [ ] Auto-speech, manual speech, phrasebook, and typed translation are tested.
- [ ] History persists after page refresh on the same browser/device.
- [ ] If online sample collection is used, persistent database storage is configured.
