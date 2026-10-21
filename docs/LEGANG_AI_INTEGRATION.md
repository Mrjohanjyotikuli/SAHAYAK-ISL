# LEGANG AI - Simple Integration Guide

## What LEGANG AI is

LEGANG AI is the small helper that floats on the SAHAYAK website. A visitor can open it and ask questions about the project, how to use Live Studio, common camera problems, the two sign-recognition modes, and the team.

Its answers come from rules and prepared FAQ text in the website code. It is not connected to a generative AI service, so it does not need an AI provider key. If a visitor asks which signs are supported, it can read the current label names from the SAHAYAK backend when that service is reachable.

## What it can do

- Float above the page so users can open the chat while viewing the website.
- Be dragged to a different place on the screen. It supports mouse and touch dragging, keeps the widget on screen, and remembers its position in that browser when storage is available.
- Answer common questions using simple, prepared replies.
- Explain the published roles of Johan Jyoti Kuli, Shyamantika Pegu, Barakha Doley, and Himanxhu V Ghimire.
- Offer optional spoken answers using the browser's speech feature. The user must turn voice on and press a Speak button.
- Hide and show the assistant using its Hide AI and Show AI controls.
- Respect keyboard focus and reduced-motion settings.

## What it does not do

- It does not use a generative AI service or send the chat text to an AI provider.
- It does not open the camera or microphone by itself.
- It is not a full sign-language translator. Its answers are limited to the questions written into the FAQ rules.
- It does not promise that a model prediction is correct.
- It does not make live sign recognition work fully offline.

## How sign recognition and LEGANG AI are different

LEGANG AI is a help chat. The Live Studio recognizer is a separate part of SAHAYAK. Live Studio asks for camera permission, detects hand points in the browser, prepares numbers and sends the required features to the backend. The backend model makes a prediction and sends the result back to the website. The chat does not start that camera workflow.

The current chat panel has no sign-library tab. It can answer questions about supported label names by asking the backend for the active model labels. The backend's sign-library routes may still exist, but the user-facing library screen was removed.

## Files and their jobs

- `frontend/legang-ai.js`: creates the floating assistant, handles dragging, FAQ replies, chat messages and optional speech.
- `frontend/legang-ai.css`: styles the assistant without changing the rest of the website.
- `frontend/assets/legang-ai-avatar.webp`: the image used for the floating button.
- `frontend/index.html` and `frontend/studio.html`: load the assistant on the website pages.
- `frontend/service-worker.js`: saves some website files in the browser cache and uses a cache version to refresh those files.
- `backend/web_app.py`: contains the backend API, including the read-only route used to get the active model labels.

## Model labels and stored data

The assistant reads static and continuous label names from the backend when that request succeeds. Those labels tell the visitor what names are in the active model. A label listed by the model is not a guarantee that every attempt will be correct.

The continuous sample data, where available, contains numeric hand and wrist features for each frame. These numbers are not the original camera photos or video. A drawing made from landmark numbers would be a view of those points, not the original camera image. The current user-facing assistant does not show a sign-library screen.

## Change the FAQ safely

1. Open `frontend/legang-ai.js`.
2. Find the FAQ matching rules and prepared replies.
3. Add or update one answer at a time using clear language.
4. Keep the team roles consistent with the Team section of the website.
5. Check that JavaScript has no syntax errors.
6. Test common questions, camera help, model-label lookup, dragging, Hide AI, Show AI, and optional speech.
7. If the website uses the service worker, update its cache name after changing frontend files.
8. Commit the intended frontend files and check the hosting deployment before assuming the live site has changed.

Do not change the camera-recognition flow just to add an FAQ reply. If the chat only needs new words, the model files and training data should not need to change.

## Keep credentials safe

This version does not need an AI-provider key. If a future version uses an AI provider, call it from the backend and keep the key in the hosting service's private environment settings. Never put a private key in frontend JavaScript.

## Animation and avatar limits

The supplied avatar is a flat image, not a moving 2D or 3D face model. Small interface animations and honest speaking indicators can be shown, but real mouth shapes and matching lip movement need a properly prepared animated avatar or a separate animation service.

## Quick test list

- [ ] The assistant appears and can be opened.
- [ ] Dragging works with a mouse and with touch.
- [ ] The widget stays inside the screen and remembers its place.
- [ ] FAQ replies use simple words.
- [ ] Team-member roles are correct.
- [ ] Supported-label lookup works when the backend is online.
- [ ] Voice starts only after the visitor turns it on and taps Speak.
- [ ] Hide AI and Show AI work.
- [ ] LEGANG AI does not open the camera or microphone.
- [ ] Live Studio recognition still works as before.

