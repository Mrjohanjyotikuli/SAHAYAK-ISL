(() => {
  "use strict";
  if (window.__LEGANG_AI_MOUNTED__) return;
  window.__LEGANG_AI_MOUNTED__ = true;

  const reducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const API_BASE = String(window.SAHAYAK_API_BASE || "https://sahayak-backend-krh1.onrender.com").replace(/\/+$/, "");
  const root = document.createElement("div");
  root.id = "legang-ai-root";
  root.dataset.state = "idle";
  root.innerHTML =
    '<button class="lg-restore" type="button" data-lg-restore aria-label="Show LEGANG AI again" title="Show LEGANG AI again" hidden>Show AI</button>' +
    '<button class="lg-launcher" type="button" aria-label="Open Ask LEGANG AI" aria-controls="legang-ai-panel" aria-expanded="false" data-lg-launcher>' +
      '<span class="lg-launcher-art"><img class="lg-avatar-img" src="assets/legang-ai-avatar.webp" alt="" aria-hidden="true" loading="lazy"></span>' +
      '<span class="lg-launcher-dot" aria-hidden="true"></span>' +
    '</button>' +
    '<div class="lg-greeting" data-lg-greeting hidden><span data-lg-greeting-text></span><button type="button" aria-label="Dismiss greeting" data-lg-greeting-close>×</button></div>' +
    '<section class="lg-panel" id="legang-ai-panel" aria-label="Ask LEGANG AI assistant" hidden>' +
      '<header class="lg-panel-header">' +
        '<div class="lg-header-copy"><div class="lg-title">LEGANG AI</div><div class="lg-subtitle">SAHAYAK companion · local FAQ</div><div class="lg-state-label" data-lg-state-label>Ready to help</div><span class="lg-state-meter" aria-hidden="true"><i></i><i></i><i></i><span>Speaking</span></span></div>' +
        '<button class="lg-icon-btn" type="button" data-lg-voice aria-pressed="false" aria-label="Enable spoken answers" title="Enable spoken answers">Voice off</button>' +
        '<button class="lg-icon-btn lg-hide-btn" type="button" data-lg-hide aria-label="Hide LEGANG AI from the page" title="Hide LEGANG AI">Hide AI</button>' +
        '<button class="lg-icon-btn" type="button" data-lg-close aria-label="Minimize LEGANG AI" title="Minimize">×</button>' +
      '</header>' +
      '<div class="lg-chat-view" id="legang-ai-chat" role="tabpanel" data-lg-view="chat">' +
        '<p class="lg-privacy-note">FAQ mode: questions stay in this page. If you ask which signs are supported, labels are checked against the SAHAYAK backend. No AI provider key is configured.</p>' +
        '<div class="lg-chat-messages" data-lg-messages role="log" aria-live="polite" aria-relevant="additions text"></div>' +
        '<div class="lg-suggestions" data-lg-suggestions>' +
          '<button class="lg-chip" type="button" data-lg-ask="How do I use SAHAYAK?">How do I use SAHAYAK?</button>' +
          '<button class="lg-chip" type="button" data-lg-ask="Why was SAHAYAK built?">Why was SAHAYAK built?</button>' +
          '<button class="lg-chip" type="button" data-lg-ask="What signs are supported?">What signs are supported?</button>' +
          '<button class="lg-chip" type="button" data-lg-ask="What is the difference between static and continuous signs?">Static vs continuous</button>' +
          '<button class="lg-chip" type="button" data-lg-ask="My camera is not working. What should I do?">Camera help</button>' +
          '<button class="lg-chip" type="button" data-lg-ask="Tell me about the team members and their roles.">Meet the team</button>' +
          '<button class="lg-chip" type="button" data-lg-ask="How can I contact Johan?">Contact Johan</button>' +
        '</div>' +
      '</div>' +
      '<form class="lg-chat-form" data-lg-form>' +
        '<input class="lg-chat-input" data-lg-input name="question" type="text" autocomplete="off" maxlength="500" placeholder="Ask about SAHAYAK…" aria-label="Ask LEGANG AI a question" required>' +
        '<button class="lg-send-btn" type="submit" data-lg-send>Send</button>' +
      '</form>' +
      '<div class="lg-footer-note" data-lg-footer>Voice is optional and starts only when you tap a Speak button.</div>' +
    '</section>';
  document.body.appendChild(root);

  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => Array.from(root.querySelectorAll(selector));
  const launcher = $("[data-lg-launcher]");
  const restoreButton = $("[data-lg-restore]");
  const panel = $(".lg-panel");
  const greeting = $("[data-lg-greeting]");
  const greetingText = $("[data-lg-greeting-text]");
  const messageHost = $("[data-lg-messages]");
  const chatInput = $("[data-lg-input]");
  const sendButton = $("[data-lg-send]");
  const voiceButton = $("[data-lg-voice]");
  const stateLabel = $("[data-lg-state-label]");
  const dragSurface = $(".lg-panel-header");
  const DRAG_STORAGE_KEY = "sahayak-legang-position-v1";
  let dragOffset = { x: 0, y: 0 };
  let activeDrag = null;
  let suppressClickUntil = 0;

  // Remember the user's preferred floating position without affecting recognition.
  try {
    const savedPosition = JSON.parse(window.localStorage.getItem(DRAG_STORAGE_KEY) || "null");
    if (savedPosition && Number.isFinite(savedPosition.x) && Number.isFinite(savedPosition.y)) {
      dragOffset = { x: savedPosition.x, y: savedPosition.y };
    }
  } catch (_) {
    // Storage may be unavailable in private browsing; dragging still works for this visit.
  }

  function applyDragOffset() {
    root.style.transform = "translate3d(" + dragOffset.x + "px, " + dragOffset.y + "px, 0)";
  }
  function visibleWidgetBounds() {
    const elements = [launcher, restoreButton, greeting, panel].filter((element) =>
      element && !element.hidden && element.getClientRects().length
    );
    if (!elements.length) return null;
    const rects = elements.map((element) => element.getBoundingClientRect());
    return {
      left: Math.min(...rects.map((rect) => rect.left)),
      top: Math.min(...rects.map((rect) => rect.top)),
      right: Math.max(...rects.map((rect) => rect.right)),
      bottom: Math.max(...rects.map((rect) => rect.bottom))
    };
  }
  function saveDragOffset() {
    try { window.localStorage.setItem(DRAG_STORAGE_KEY, JSON.stringify(dragOffset)); } catch (_) {}
  }
  function keepWidgetInViewport() {
    const bounds = visibleWidgetBounds();
    if (!bounds) return;
    const margin = 8;
    let correctionX = 0;
    let correctionY = 0;
    if (bounds.left < margin) correctionX = margin - bounds.left;
    else if (bounds.right > window.innerWidth - margin) correctionX = window.innerWidth - margin - bounds.right;
    if (bounds.top < margin) correctionY = margin - bounds.top;
    else if (bounds.bottom > window.innerHeight - margin) correctionY = window.innerHeight - margin - bounds.bottom;
    if (correctionX || correctionY) {
      dragOffset.x += correctionX;
      dragOffset.y += correctionY;
      applyDragOffset();
      saveDragOffset();
    }
  }
  function beginDrag(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Header buttons must keep their normal click behaviour.
    if (event.currentTarget === dragSurface && event.target.closest("button, a, input, select, textarea")) return;
    activeDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: { x: dragOffset.x, y: dragOffset.y },
      startBounds: visibleWidgetBounds(),
      moved: false,
      surface: event.currentTarget
    };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
  }
  function moveDrag(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId || !activeDrag.startBounds) return;
    const rawX = event.clientX - activeDrag.startX;
    const rawY = event.clientY - activeDrag.startY;
    if (!activeDrag.moved && Math.hypot(rawX, rawY) < 6) return;
    activeDrag.moved = true;
    event.preventDefault();
    root.dataset.dragging = "true";
    const bounds = activeDrag.startBounds;
    const margin = 8;
    const minX = margin - bounds.left;
    const maxX = window.innerWidth - margin - bounds.right;
    const minY = margin - bounds.top;
    const maxY = window.innerHeight - margin - bounds.bottom;
    const dx = minX <= maxX ? Math.min(maxX, Math.max(minX, rawX)) : minX;
    const dy = minY <= maxY ? Math.min(maxY, Math.max(minY, rawY)) : minY;
    dragOffset = {
      x: activeDrag.startOffset.x + dx,
      y: activeDrag.startOffset.y + dy
    };
    applyDragOffset();
  }
  function endDrag(event) {
    if (!activeDrag || (event && event.pointerId !== activeDrag.pointerId)) return;
    const didMove = activeDrag.moved;
    try {
      if (activeDrag.surface.hasPointerCapture(activeDrag.pointerId)) {
        activeDrag.surface.releasePointerCapture(activeDrag.pointerId);
      }
    } catch (_) {}
    activeDrag = null;
    delete root.dataset.dragging;
    if (didMove) {
      suppressClickUntil = Date.now() + 350;
      saveDragOffset();
      keepWidgetInViewport();
    }
  }

  applyDragOffset();
  launcher.title = "Drag to move LEGANG AI · click to open";
  restoreButton.title = "Drag to move LEGANG AI · click to show";
  dragSurface.title = "Drag this header to move LEGANG AI";
  launcher.addEventListener("pointerdown", beginDrag);
  restoreButton.addEventListener("pointerdown", beginDrag);
  dragSurface.addEventListener("pointerdown", beginDrag);
  document.addEventListener("pointermove", moveDrag, { passive: false });
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
  window.addEventListener("resize", keepWidgetInViewport);
  const timers = new Set();
  let voiceEnabled = false;
  let libraryData = null;
  let libraryPromise = null;
  let libraryError = "";
  let currentSection = "SAHAYAK";
  let greetingShown = false;
  let assistantHidden = false;
  let greetingTimer = null;
  let nextNudgeTimer = null;
  let nudgeIndex = 0;
  let playbackTimer = null;
  const nudgeLines = [
    "Kya hua bhai, kuch questions hain toh pooch lo 😄",
    "Itna mat dekho yaar, jaake Live Studio try karo! 😉",
    "Bhai, main yahin hoon—question poochne ka charge nahi hai 😂",
    "Scrolling Olympics chal raha hai kya? SAHAYAK bhi try kar lo 😅",
    "Main chai nahi bana sakta, but SAHAYAK samjha zaroor sakta hoon ☕",
    "Arre bhai, doubt hai toh pooch lo. Main judge nahi karta 😎",
    "Need a quick start? Ask me how to use SAHAYAK.",
    "Tip: keep your hands clearly inside the camera frame for better tracking.",
    "Curious about the project? Ask me why SAHAYAK was built.",
    "A prediction looks wrong? Check the lighting and hand visibility first.",
    "Ready to practise? Open Live Studio whenever you're ready.",
    "Want to contact the developer? I can help you reach Johan."
  ];
  let isThinking = false;
  const speechAvailable = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

  function setState(state, label) {
    root.dataset.state = state;
    stateLabel.textContent = label || ({ idle: "Ready to help", listening: "Listening", thinking: "Checking FAQ", speaking: "Speaking" }[state] || "Ready to help");
  }
  function later(fn, ms) {
    const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
    return id;
  }
  function stopPlayback() {
    if (playbackTimer !== null) window.clearInterval(playbackTimer);
    playbackTimer = null;
  }
  function stopSpeech() {
    if (speechAvailable) window.speechSynthesis.cancel();
    if (root.dataset.state === "speaking") setState("idle");
  }
  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Open Ask LEGANG AI");
    launcher.dataset.active = "false";
    stopPlayback();
    stopSpeech();
    setState("idle");
  }
  function hideAssistant() {
    panel.hidden = true;
    greeting.hidden = true;
    launcher.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.dataset.active = "false";
    assistantHidden = true;
    restoreButton.hidden = false;
    stopPlayback();
    stopSpeech();
    setState("idle");
  }
  function restoreAssistant() {
    assistantHidden = false;
    restoreButton.hidden = true;
    launcher.hidden = false;
    setState("idle");
  }
  function openPanel() {
    panel.hidden = false;
    greeting.hidden = true;
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", "Close Ask LEGANG AI");
    launcher.dataset.active = "true";
    syncContext();
    if (voiceEnabled && speechAvailable) voiceButton.setAttribute("aria-pressed", "true");
    later(() => { if (!panel.hidden) chatInput.focus({ preventScroll: true }); }, 30);
  }
  function togglePanel() {
    if (panel.hidden) openPanel();
    else closePanel();
  }
  function syncContext() {
    const context = $("[data-lg-current-context]");
    if (context) context.textContent = "Currently viewing: " + currentSection;
    const footer = $("[data-lg-footer]");
    if (footer) footer.textContent = "Help for: " + currentSection + " · Voice is optional and starts only when you tap Speak.";
  }
  function appendActionLinks(container, actions) {
    if (!Array.isArray(actions) || !actions.length) return;
    const row = document.createElement("div");
    row.className = "lg-message-actions";
    actions.forEach((action) => {
      if (!action.href) return;
      const link = document.createElement("a");
      link.className = "lg-action-link";
      link.textContent = action.label;
      link.href = action.href;
      if (action.href.startsWith("https://")) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      row.appendChild(link);
    });
    if (row.childElementCount) container.appendChild(row);
  }
  function addMessage(text, type, actions) {
    const row = document.createElement("div");
    row.className = "lg-message" + (type === "user" ? " is-user" : "");
    const meta = document.createElement("div");
    meta.className = "lg-message-meta";
    meta.textContent = type === "user" ? "You" : "LEGANG AI · FAQ";
    const bubble = document.createElement("div");
    bubble.className = "lg-bubble";
    bubble.textContent = text;
    row.append(meta, bubble);
    appendActionLinks(row, actions);
    if (type !== "user" && voiceEnabled && speechAvailable) {
      const speak = document.createElement("button");
      speak.className = "lg-speak-btn";
      speak.type = "button";
      speak.textContent = "▶ Speak answer";
      speak.setAttribute("aria-label", "Speak this LEGANG AI answer");
      speak.addEventListener("click", () => speakText(text, speak));
      row.appendChild(speak);
    }
    messageHost.appendChild(row);
    messageHost.scrollTop = messageHost.scrollHeight;
    return row;
  }
  function formatLabels(labels, max) {
    if (!Array.isArray(labels) || !labels.length) return "The backend did not return any labels. Check that the SAHAYAK models are loaded.";
    const list = labels.slice(0, max || 60);
    return list.join(", ") + (labels.length > list.length ? ", and " + (labels.length - list.length) + " more" : "");
  }
  async function loadLibrary() {
    if (libraryData) return libraryData;
    if (libraryPromise) return libraryPromise;
    libraryPromise = fetch(API_BASE + "/api/legang/sign-library", { method: "GET", cache: "no-store", headers: { Accept: "application/json" } })
      .then(response => {
        if (!response.ok) throw new Error("The backend returned HTTP " + response.status + ".");
        return response.json();
      })
      .then(data => {
        if (!data || !Array.isArray(data.static_labels) || !Array.isArray(data.continuous_labels)) throw new Error("The live model-label response had an unexpected format.");
        libraryData = data;
        libraryError = "";
        return data;
      })
      .catch(error => {
        libraryError = error && error.message ? error.message : "Could not reach the SAHAYAK backend.";
        return null;
      })
      .finally(() => { libraryPromise = null; });
    return libraryPromise;
  }
  async function answerQuestion(question) {
    const text = String(question || "").trim();
    const q = text.toLowerCase();
    const labelsNeed = /sign|label|gesture|alphabet|supported|recogniz|pose|landmark|frame|database|sample/.test(q);
    if (labelsNeed && !libraryData) await loadLibrary();
    if (/^(hi|hello|hey|namaste)\b/.test(q)) {
      return { text: "Hello! I’m LEGANG AI, the SAHAYAK website companion. I can explain how to use SAHAYAK, why it was built, which signs its models support, and how to contact Johan." };
    }
    if (/what is (sahayak|this project)|tell me about sahayak|project overview|explain sahayak/.test(q)) {
      return { text: "SAHAYAK is a real-time Indian Sign Language recognition website. It contains a camera-based Live Studio, a static two-hand pose model, a continuous/moving-sign model, a phrasebook, and project documentation. Recognition may be uncertain and this development project is not a certified sign-language interpreter." };
    }
    if (/why|purpose|built|build|problem|communication gap/.test(q) && /sahayak|build|purpose|problem|gap|why/.test(q)) {
      return { text: "SAHAYAK was built as a real-time Indian Sign Language recognition project to explore a more accessible bridge between sign gestures and on-screen text. It supports static two-hand poses and continuous/moving signs through separate trained models. It is a development project, so recognition can be uncertain and should not be treated as a certified interpreter." };
    }
    // Verified role descriptions copied from the Team section in frontend/index.html.
    if (/shyamantika|pegu/.test(q)) {
      return { text: "Shyamantika Pegu’s role on the SAHAYAK website is listed as “Introduction, Problem & Project Purpose.” Her part of the presentation introduces the communication challenge and explains the project context and purpose. I’ll stick to the role published on the project page rather than guess at unlisted individual coding tasks." };
    }
    if (/barakha|doley/.test(q)) {
      return { text: "Barakha Doley’s role on the SAHAYAK website is listed as “System Design, Technology & Workflow.” Her part covers the system design, the main technology concepts, and how the project workflow fits together. The website does not publish a more detailed individual task log, so I won’t invent one." };
    }
    if (/himanxhu|ghimire/.test(q)) {
      return { text: "Himanxhu V Ghimire’s role on the SAHAYAK website is listed as “Live Demo, Testing & Conclusion.” His part covers demonstrating the system, discussing testing, and presenting the conclusion. I won’t claim specific test results that aren’t published on the website." };
    }
    if (/(team|members|who are|everyone|teammates|group)/.test(q) && /(role|work|member|team|who|responsib|contribut)/.test(q)) {
      return { text: "The project page lists the core team roles as:\\n\\n• Johan Jyoti Kuli — Lead Developer & Project Head; Full-System Design & Integration.\\n• Shyamantika Pegu — Introduction, Problem & Project Purpose.\\n• Barakha Doley — System Design, Technology & Workflow.\\n• Himanxhu V Ghimire — Live Demo, Testing & Conclusion.\\n\\nThese descriptions reflect the roles published on the website. For unlisted individual task details, it’s best to ask the team directly." };
    }
    if (/static.*continuous|continuous.*static|moving sign|motion sign|difference.*sign/.test(q)) {
      return { text: "Static-sign recognition is intended for a held pose; continuous-sign recognition processes a sequence of frames for a moving sign. Choose the matching mode in Live Studio and follow the pose or movement used by the sign you are testing. A label must be present in the deployed model to be recognized." };
    }
    if (/camera.*(not working|doesn't work|doesnt work|problem|fail|black|blocked)|camera help|no camera|webcam|permission/.test(q)) {
      return { text: "Try these steps: (1) Open Live Studio over HTTPS. (2) Tap Allow when the browser requests camera permission. (3) Check that another app isn’t using the camera. (4) Select the correct camera if the page offers a camera selector. (5) Improve lighting and keep the signing hands visible. On a phone, check the browser’s site-permission settings. LEGANG AI itself does not open your camera." , actions: [{ label: "Open Live Studio", href: "./studio.html" }] };
    }
    if (/why.*not.*recogn|wrong prediction|wrong result|low confidence|confidence|accuracy|accurate|mistake|miss.*sign/.test(q)) {
      return { text: "Predictions can vary with lighting, camera angle, hand visibility, signing speed, and how closely two signs resemble one another. Keep your signing hands in frame, use the correct static or continuous mode, and repeat the sign steadily. For a fair assessment, evaluate with held-out examples that were not used for training. I do not have a verified current accuracy score to quote." };
    }
    if (/what is a landmark|landmark.*mean|hand landmark|pose points|skeleton/.test(q)) {
      return { text: "Hand landmarks are points used to describe hand shape and position. SAHAYAK’s saved continuous sequences store numeric landmark features; LEGANG AI does not expose the original camera video in this chat. A feature-based preview is a reconstruction of those coordinates, not the original RGB frame." };
    }
    if (/data privacy|private|what happens.*camera|store.*video|record.*camera|are you watching|watching me|microphone|mic/.test(q)) {
      return { text: "LEGANG AI’s FAQ does not access your camera or microphone, and it does not send your chat text to a generative AI provider. Live Studio is separate: it asks for camera permission and sends frames to SAHAYAK’s recognition backend for prediction. Only enable the camera when you choose to test recognition; this assistant never activates it automatically." };
    }
    if (/train|training|add.*new sign|new sign|update.*model|custom sign|my own sign/.test(q)) {
      return { text: "A new sign is not available just because it was collected locally. The dataset must be labelled and prepared in the format expected by the appropriate model, the model must be trained and tested, and the trained artifact must be deployed with the backend. After deployment, only labels exposed by the active model are available to the live recognizer. Keep a separate test set to check whether the new sign generalizes." };
    }
    if (/developer|project head|johan|who made|creator|who.*built/.test(q)) {
      return { text: "Johan Jyoti Kuli is listed as SAHAYAK’s Lead Developer & Project Head, with the role “Full-System Design & Integration.” You can reach him through the links below.", actions: [
        { label: "Instagram @stk_jubin", href: "https://www.instagram.com/stk_jubin/" },
        { label: "Email Johan", href: "mailto:jubinkuli72@gmail.com" },
        { label: "Call 9678613150", href: "tel:9678613150" }
      ] };
    }
    if (/how.*use|use.*sahayak|start|camera|recogniz|recognise|live studio/.test(q) && !/what signs|labels|pose|frame/.test(q)) {
      return { text: "To try SAHAYAK: open Live Studio, choose static or continuous recognition, allow camera access only when the browser asks, and keep your hands visible inside the camera view. For a static sign, hold the pose steadily; for a continuous sign, perform the full movement. Read the result and confidence, and repeat if the system says it is uncertain. The camera belongs to the recognizer, not to this FAQ chat.", actions: [{ label: "Open Live Studio", href: "./studio.html" }] };
    }
    if (/why.*not|wrong|incorrect|uncertain|accuracy/.test(q)) {
      return { text: "Lighting, camera framing, hand visibility, signing speed, and similarity between labels can affect predictions. Keep both hands in view when needed, perform the complete movement in continuous mode, and test the newly trained signs with examples the model did not use for training. I do not have a verified current accuracy report to quote." };
    }
    if (/pose|landmark|frame|recorded sample|database sample/.test(q)) {
      return { text: "This assistant is focused on chat and does not include a visual sign-library viewer. The backend stores continuous-sign landmark feature frames rather than original camera photos or video; saved static-pose recordings are not currently exposed here. You can ask which signs the active models support, or open Live Studio to test signs with the existing recognizer.", actions: [{ label: "Open Live Studio", href: "./studio.html" }] };
    }
    if (/sign|label|gesture|alphabet|supported|model classes/.test(q)) {
      if (!libraryData) return { text: "I couldn't reach the deployed SAHAYAK backend just now, so I can't verify the current model labels. Please try again when the backend is online." };
      return { text: "The active static model labels (" + libraryData.static_labels.length + "): " + formatLabels(libraryData.static_labels, 70) + "\n\nThe active continuous model labels (" + libraryData.continuous_labels.length + "): " + formatLabels(libraryData.continuous_labels, 70) + "\n\nThese names are read from the deployed models. Open Live Studio to test the recognizer.", actions: [{ label: "Open Live Studio", href: "./studio.html" }] };
    }
    if (/who.*developer|project head|johan|who made|creator/.test(q)) {
      return { text: "SAHAYAK lists Johan Jyoti Kuli as Lead Developer & Project Head. You can contact him using the links below.", actions: [
        { label: "Instagram @stk_jubin", href: "https://www.instagram.com/stk_jubin/" },
        { label: "Email Johan", href: "mailto:jubinkuli72@gmail.com" },
        { label: "Call 9678613150", href: "tel:9678613150" }
      ] };
    }
    if (/contact|connect|instagram|gmail|email|phone|call/.test(q)) {
      return { text: "You can reach Johan Jyoti Kuli through Instagram, Gmail, or phone.", actions: [
        { label: "Instagram @stk_jubin", href: "https://www.instagram.com/stk_jubin/" },
        { label: "jubinkuli72@gmail.com", href: "mailto:jubinkuli72@gmail.com" },
        { label: "Call 9678613150", href: "tel:9678613150" }
      ] };
    }
    if (/voice|speak|audio|talk.*answer|read.*aloud/.test(q)) {
      return { text: "Open Ask LEGANG AI and tap “Voice off” to enable browser speech. Each answer can then show a Speak button; tap it when you want audio. Voices depend on your browser and device. No audio plays automatically, and you can turn voice off or stop speech by closing the assistant." };
    }
    if (/how.*hide|hide.*legang|remove.*assistant|close.*assistant|too much|distract/.test(q)) {
      return { text: "Tap the “Hide AI” control in the chat header to hide the assistant and greeting bubble. A small “Show AI” control remains so you can bring it back whenever you want. The assistant never controls or blocks your page scrolling." };
    }
    if (/internet.*need|need.*internet|works offline|offline mode/.test(q)) {
      return { text: "The FAQ responses work locally in the page. Live recognition, current model labels, and backend-powered predictions need a connection to the SAHAYAK backend. The phrasebook may have offline support on the installed website, but don’t assume the complete live recognizer works offline." };
    }
    if (/offline|internet|online/.test(q)) {
      return { text: "SAHAYAK includes an offline phrasebook on supported browsers once its content is available locally. Live model status, recognition API requests, and the sign-library database require a connection to the deployed backend. LEGANG AI's predefined FAQ matching itself runs in this page, but live sign labels and pose records need the backend." };
    }
    if (/ai|artificial intelligence|legang/.test(q)) {
      return { text: "LEGANG AI is the website companion for SAHAYAK. This initial version uses a verified local FAQ knowledge base plus live read-only model-label and sample-frame data. It doesn't pretend to have a generative model connected. The supplied character image is kept as a branded flat image with subtle idle/listening/speaking indicators; true facial rigging and phoneme-accurate lip-sync require a rigged avatar or compatible external service." };
    }
    return { text: "I don't have a verified answer for that yet, and I won't guess. Try asking how to use SAHAYAK, why it was built, which signs are supported, or how to contact Johan. This FAQ-only version keeps your typed question in the current page and does not send chat messages to an external AI model.", actions: [

      { label: "Contact Johan", href: "mailto:jubinkuli72@gmail.com" }
    ] };
  }
  function speakText(text, button) {
    if (!speechAvailable || !voiceEnabled) return;
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 2500));
    utterance.lang = "en-IN";
    utterance.rate = 0.98;
    utterance.pitch = 1;
    utterance.onstart = () => setState("speaking", "Speaking · browser voice");
    utterance.onend = () => setState("idle", "Ready to help");
    utterance.onerror = () => setState("idle", "Voice unavailable");
    window.speechSynthesis.speak(utterance);
    if (button) button.textContent = "▶ Speaking…";
    later(() => { if (button && button.isConnected) button.textContent = "▶ Speak answer"; }, 4000);
  }
  function sendQuestion(value) {
    const question = String(value || "").trim().slice(0, 500);
    if (!question || isThinking) return;
    addMessage(question, "user");
    const thinking = addMessage("Checking the verified FAQ…", "bot");
    thinking.classList.add("lg-thinking");
    isThinking = true; sendButton.disabled = true;
    setState("thinking", "Checking FAQ");
    later(async () => {
      try {
        const answer = await answerQuestion(question);
        thinking.remove();
        addMessage(answer.text, "bot", answer.actions || []);
      } catch (error) {
        thinking.remove();
        addMessage("I couldn't prepare an answer just now. Please try one of the suggested questions again.", "bot");
      } finally {
        isThinking = false;
        sendButton.disabled = false;
        setState("idle");
        messageHost.scrollTop = messageHost.scrollHeight;
      }
    }, 170);
  }
  function dismissGreeting() {
    if (greeting.hidden) return;
    if (greetingTimer !== null) {
      window.clearTimeout(greetingTimer);
      timers.delete(greetingTimer);
      greetingTimer = null;
    }
    greeting.classList.add("is-closing");
    later(() => {
      greeting.hidden = true;
      greeting.classList.remove("is-closing");
    }, reducedMotion ? 0 : 220);
  }
  function showGreeting(text) {
    if (assistantHidden || document.hidden || !panel.hidden || !greeting.hidden) return;
    greetingShown = true;
    greetingText.textContent = text;
    greeting.classList.remove("is-closing");
    greeting.hidden = false;
    if (greetingTimer !== null) {
      window.clearTimeout(greetingTimer);
      timers.delete(greetingTimer);
    }
    greetingTimer = later(() => {
      greetingTimer = null;
      dismissGreeting();
    }, 6200);
  }
  function scheduleNudge(delayMs) {
    nextNudgeTimer = later(() => {
      nextNudgeTimer = null;
      // Never interrupt an open chat or show popups in a hidden tab / hidden assistant.
      if (!document.hidden && !assistantHidden && panel.hidden && greeting.hidden) {
        const message = nudgeLines[nudgeIndex % nudgeLines.length];
        nudgeIndex += 1;
        showGreeting(message);
      }
      scheduleNudge(70000);
    }, delayMs);
  }

  launcher.addEventListener("click", (event) => {
    if (Date.now() < suppressClickUntil) { event.preventDefault(); return; }
    togglePanel();
  });
  restoreButton.addEventListener("click", (event) => {
    if (Date.now() < suppressClickUntil) { event.preventDefault(); return; }
    restoreAssistant();
  });
  $("[data-lg-close]").addEventListener("click", closePanel);
  $("[data-lg-hide]").addEventListener("click", hideAssistant);
  $("[data-lg-greeting-close]").addEventListener("click", dismissGreeting);
  $$("[data-lg-ask]").forEach((button) => button.addEventListener("click", () => sendQuestion(button.dataset.lgAsk)));
  $("[data-lg-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = chatInput.value;
    chatInput.value = "";
    sendQuestion(value);
  });
  voiceButton.addEventListener("click", () => {
    if (!speechAvailable) {
      voiceButton.textContent = "Voice unavailable";
      voiceButton.disabled = true;
      $("[data-lg-footer]").textContent = "Speech synthesis is not supported by this browser.";
      return;
    }
    voiceEnabled = !voiceEnabled;
    voiceButton.textContent = voiceEnabled ? "Voice on" : "Voice off";
    voiceButton.setAttribute("aria-pressed", voiceEnabled ? "true" : "false");
    voiceButton.setAttribute("aria-label", voiceEnabled ? "Disable spoken answers" : "Enable spoken answers");
    $("[data-lg-footer]").textContent = voiceEnabled ? "Voice is enabled. Tap Speak on an answer to hear it; no audio plays automatically." : "Voice is off. Questions stay in this page; no audio plays automatically.";
    if (!voiceEnabled) stopSpeech();
    if (!panel.hidden) {
      const rows = Array.from(messageHost.children);
      rows.forEach((row) => {
        const speak = row.querySelector(".lg-speak-btn");
        if (voiceEnabled && row.querySelector(".lg-message-meta") && row.querySelector(".lg-message-meta").textContent.startsWith("LEGANG")) {
          if (!speak) {
            const bubble = row.querySelector(".lg-bubble");
            if (bubble) {
              const btn = document.createElement("button");
              btn.className = "lg-speak-btn"; btn.type = "button"; btn.textContent = "▶ Speak answer"; btn.setAttribute("aria-label", "Speak this LEGANG AI answer");
              btn.addEventListener("click", () => speakText(bubble.textContent, btn)); row.appendChild(btn);
            }
          }
        } else if (!voiceEnabled && speak) speak.remove();
      });
    }
  });
  if (speechAvailable) voiceButton.textContent = "Voice off";
  else { voiceButton.disabled = true; voiceButton.textContent = "No voice"; voiceButton.title = "This browser does not support speech synthesis"; }

  const pointerFine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (pointerFine && !reducedMotion) {
    root.querySelectorAll(".lg-avatar-img").forEach((img) => {
      img.addEventListener("pointermove", (event) => {
        if (event.pointerType !== "mouse") return;
        const r = img.getBoundingClientRect();
        const x = (event.clientX - r.left) / Math.max(1, r.width) - .5;
        const y = (event.clientY - r.top) / Math.max(1, r.height) - .5;
        img.style.transform = "perspective(600px) rotateY(" + (x * 3).toFixed(2) + "deg) rotateX(" + (-y * 3).toFixed(2) + "deg)";
      });
      img.addEventListener("pointerleave", () => { img.style.transform = ""; });
    });
  }

  if ("IntersectionObserver" in window) {
    const sectionNodes = Array.from(document.querySelectorAll('section[id^="mod-"], main > section, main > .grid > section, main > footer'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const heading = entry.target.querySelector("h1, h2, h3");
        const headingText = heading ? heading.textContent.trim() : "";
        if (!headingText) return;
        currentSection = headingText.replace(/\s+/g, " ").slice(0, 70);
        syncContext();
        if (!greetingShown && !/home|welcome|recognition system/i.test(currentSection)) {
          showGreeting("Exploring " + currentSection + "? Tap LEGANG AI for a quick guide.");
        }
      });
    }, { threshold: 0.35, rootMargin: "0px 0px -8% 0px" });
    sectionNodes.forEach((node) => observer.observe(node));
    window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { stopPlayback(); stopSpeech(); }
  });
  window.addEventListener("pagehide", () => {
    stopPlayback(); stopSpeech();
    timers.forEach((id) => window.clearTimeout(id));
    timers.clear();
  }, { once: true });
  addMessage("Hi! I’m LEGANG AI. Ask me how to use SAHAYAK, why it was built, which signs the live models support, or how to contact Johan.", "bot", [{ label: "Contact Johan", href: "mailto:jubinkuli72@gmail.com" }]);
  showGreeting("Hello, I’m LEGANG AI. How can I help you?");
  window.requestAnimationFrame(keepWidgetInViewport);
  // First rotating message appears after 45 seconds; further prompts are at least 70 seconds apart.
  scheduleNudge(45000);
})();