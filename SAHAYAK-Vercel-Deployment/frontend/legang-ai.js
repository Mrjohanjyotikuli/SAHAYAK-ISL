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
    '<button class="lg-launcher" type="button" aria-label="Open Ask LEGANG AI" aria-controls="legang-ai-panel" aria-expanded="false" data-lg-launcher>' +
      '<span class="lg-launcher-art"><img class="lg-avatar-img" src="assets/legang-ai-avatar.webp" alt="" aria-hidden="true" loading="lazy"></span>' +
      '<span class="lg-launcher-dot" aria-hidden="true"></span>' +
    '</button>' +
    '<div class="lg-greeting" data-lg-greeting hidden><span data-lg-greeting-text></span><button type="button" aria-label="Dismiss greeting" data-lg-greeting-close>×</button></div>' +
    '<section class="lg-panel" id="legang-ai-panel" aria-label="Ask LEGANG AI assistant" hidden>' +
      '<header class="lg-panel-header">' +
        '<div class="lg-header-avatar"><img class="lg-avatar-img" src="assets/legang-ai-avatar.webp" alt="" aria-hidden="true" loading="lazy"></div>' +
        '<div class="lg-header-copy"><div class="lg-title">LEGANG AI</div><div class="lg-subtitle">SAHAYAK companion · local FAQ</div><div class="lg-state-label" data-lg-state-label>Ready to help</div><span class="lg-state-meter" aria-hidden="true"><i></i><i></i><i></i><span>Speaking</span></span></div>' +
        '<button class="lg-icon-btn" type="button" data-lg-voice aria-pressed="false" aria-label="Enable spoken answers" title="Enable spoken answers">Voice off</button>' +
        '<button class="lg-icon-btn" type="button" data-lg-close aria-label="Minimize LEGANG AI" title="Minimize">×</button>' +
      '</header>' +
      '<div class="lg-tabs" role="tablist" aria-label="LEGANG AI sections">' +
        '<button class="lg-tab" type="button" role="tab" aria-selected="true" aria-controls="legang-ai-chat" data-lg-tab="chat">Ask LEGANG AI</button>' +
        '<button class="lg-tab" type="button" role="tab" aria-selected="false" aria-controls="legang-ai-library" data-lg-tab="library">Sign library</button>' +
      '</div>' +
      '<div class="lg-chat-view" id="legang-ai-chat" role="tabpanel" data-lg-view="chat">' +
        '<p class="lg-privacy-note">FAQ mode: questions stay in this page. Current sign labels and sample poses are fetched separately from the SAHAYAK backend; no AI provider key is configured.</p>' +
        '<div class="lg-chat-messages" data-lg-messages role="log" aria-live="polite" aria-relevant="additions text"></div>' +
        '<div class="lg-suggestions" data-lg-suggestions>' +
          '<button class="lg-chip" type="button" data-lg-ask="How do I use SAHAYAK?">How do I use SAHAYAK?</button>' +
          '<button class="lg-chip" type="button" data-lg-ask="Why was SAHAYAK built?">Why was SAHAYAK built?</button>' +
          '<button class="lg-chip" type="button" data-lg-ask="What signs are supported?">What signs are supported?</button>' +
          '<button class="lg-chip" type="button" data-lg-tab="library">Browse sign poses</button>' +
          '<button class="lg-chip" type="button" data-lg-ask="How can I contact Johan?">Contact Johan</button>' +
        '</div>' +
      '</div>' +
      '<div class="lg-library-view" id="legang-ai-library" role="tabpanel" data-lg-view="library" hidden>' +
        '<div class="lg-library-header"><h3 class="lg-library-title">SAHAYAK sign library</h3><p class="lg-library-copy">Labels come from the deployed models. Pose previews use real saved normalized landmark feature frames when available. The current database does not store original RGB camera photos or video.</p><input class="lg-search" type="search" placeholder="Search sign labels…" aria-label="Search sign labels" data-lg-search></div>' +
        '<div class="lg-library-status" data-lg-library-status>Loading live labels and database examples…</div>' +
        '<div data-lg-library-content></div><div data-lg-pose-detail></div>' +
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
  const panel = $(".lg-panel");
  const greeting = $("[data-lg-greeting]");
  const greetingText = $("[data-lg-greeting-text]");
  const messageHost = $("[data-lg-messages]");
  const chatInput = $("[data-lg-input]");
  const sendButton = $("[data-lg-send]");
  const voiceButton = $("[data-lg-voice]");
  const stateLabel = $("[data-lg-state-label]");
  const libraryStatus = $("[data-lg-library-status]");
  const libraryContent = $("[data-lg-library-content]");
  const poseDetail = $("[data-lg-pose-detail]");
  const searchInput = $("[data-lg-search]");
  const timers = new Set();
  let voiceEnabled = false;
  let libraryData = null;
  let libraryPromise = null;
  let libraryError = "";
  let currentSection = "SAHAYAK";
  let greetingShown = false;
  let activeSample = null;
  let activeFramePos = 0;
  let playbackTimer = null;
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
    const playButton = poseDetail.querySelector("[data-lg-play]");
    if (playButton) playButton.textContent = "▶ Play frames";
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
  function setTab(tab) {
    $$(".lg-tab").forEach((button) => {
      const active = button.dataset.lgTab === tab;
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    $$("[data-lg-view]").forEach((view) => { view.hidden = view.dataset.lgView !== tab; });
    if (tab === "library") loadLibrary();
    if (tab === "chat") later(() => chatInput.focus({ preventScroll: true }), 20);
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
      if (action.tab) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "lg-action-link";
        button.textContent = action.label;
        button.addEventListener("click", () => setTab(action.tab));
        row.appendChild(button);
      } else if (action.href) {
        const link = document.createElement("a");
        link.className = "lg-action-link";
        link.textContent = action.label;
        link.href = action.href;
        if (action.href.startsWith("https://")) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        row.appendChild(link);
      }
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
    if (libraryData) { renderLibrary(); return libraryData; }
    if (libraryPromise) return libraryPromise;
    libraryStatus.textContent = "Fetching current labels and saved landmark frames from SAHAYAK…";
    libraryPromise = fetch(API_BASE + "/api/legang/sign-library", { method: "GET", cache: "no-store", headers: { Accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error("The backend returned HTTP " + response.status + ".");
        return response.json();
      })
      .then((data) => {
        if (!data || !Array.isArray(data.static_labels) || !Array.isArray(data.continuous_labels)) {
          throw new Error("The sign-library response had an unexpected format.");
        }
        libraryData = data;
        libraryError = "";
        renderLibrary();
        return data;
      })
      .catch((error) => {
        libraryError = error && error.message ? error.message : "Could not reach the sign library.";
        libraryStatus.textContent = "The live sign library is unavailable right now. " + libraryError;
        libraryContent.replaceChildren();
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "lg-chip";
        retry.textContent = "Retry loading";
        retry.addEventListener("click", () => { libraryPromise = null; loadLibrary(); });
        libraryContent.appendChild(retry);
        return null;
      })
      .finally(() => { libraryPromise = null; });
    return libraryPromise;
  }
  function addLibrarySection(parent, title, labels, category) {
    const section = document.createElement("section");
    section.className = "lg-library-section";
    const h = document.createElement("h4");
    h.textContent = title + " (" + labels.length + ")";
    const list = document.createElement("div");
    list.className = "lg-label-list";
    labels.forEach((label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lg-label-chip" + (libraryData.examplesByLabel[label] ? " has-example" : "");
      button.dataset.lgLabel = label;
      button.dataset.lgCategory = category;
      button.textContent = label;
      button.addEventListener("click", () => openPoseForLabel(label, category));
      list.appendChild(button);
    });
    section.append(h, list);
    parent.appendChild(section);
  }
  function renderLibrary() {
    if (!libraryData) return;
    libraryData.examplesByLabel = {};
    (libraryData.continuous_examples || []).forEach((item) => {
      if (item && item.label && !libraryData.examplesByLabel[item.label]) libraryData.examplesByLabel[item.label] = item;
    });
    libraryStatus.textContent = "Loaded " + libraryData.static_labels.length + " static model labels, " +
      libraryData.continuous_labels.length + " continuous model labels, and " +
      (libraryData.continuous_examples || []).length + " saved sequence previews.";
    libraryContent.replaceChildren();
    const staticLabels = libraryData.static_labels.slice().sort();
    const sequenceLabels = libraryData.continuous_labels.slice().sort();
    addLibrarySection(libraryContent, "Static signs", staticLabels, "static");
    addLibrarySection(libraryContent, "Continuous / moving signs", sequenceLabels, "continuous");
    const sampleLabels = (libraryData.continuous_examples || []).map((sample) => sample.label);
    if (sampleLabels.length) addLibrarySection(libraryContent, "Recorded database samples", sampleLabels, "recorded");
    else {
      const empty = document.createElement("p");
      empty.className = "lg-library-status";
      empty.textContent = "No valid saved continuous landmark samples were returned by the current database.";
      libraryContent.appendChild(empty);
    }
    filterLabels(searchInput.value);
  }
  function filterLabels(term) {
    const needle = String(term || "").trim().toLowerCase();
    $$(".lg-label-chip").forEach((button) => {
      button.hidden = !!needle && !button.textContent.toLowerCase().includes(needle);
    });
  }
  function openPoseForLabel(label, category) {
    stopPlayback();
    poseDetail.replaceChildren();
    const sample = libraryData && libraryData.examplesByLabel ? libraryData.examplesByLabel[label] : null;
    if (!sample || !Array.isArray(sample.frames) || !sample.frames.length) {
      const note = document.createElement("div");
      note.className = "lg-pose-card";
      const h = document.createElement("h4");
      h.textContent = label;
      const p = document.createElement("p");
      p.textContent = category === "static"
        ? "This label is present in the deployed static model, but the current backend does not provide a saved static landmark example for it. LEGANG AI will not invent a pose."
        : "This label has no valid representative recorded sequence in the backend database yet. The label itself is read from the deployed model.";
      note.append(h, p);
      poseDetail.appendChild(note);
      return;
    }
    activeSample = sample;
    activeFramePos = 0;
    const card = document.createElement("section");
    card.className = "lg-pose-card";
    const h = document.createElement("h4");
    h.textContent = label + " · recorded landmark preview";
    const note = document.createElement("p");
    note.textContent = "Using stored normalized feature frame(s) from the continuous-sign database. This is a reconstructed landmark skeleton, not the original camera image or video; static pose examples are not stored in the current backend.";
    const canvas = document.createElement("canvas");
    canvas.className = "lg-pose-canvas";
    canvas.width = 640;
    canvas.height = 480;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Reconstructed hand landmark pose from a saved SAHAYAK sequence frame");
    const controls = document.createElement("div");
    controls.className = "lg-frame-controls";
    const prev = document.createElement("button");
    prev.type = "button"; prev.textContent = "← Prev"; prev.setAttribute("aria-label", "Previous recorded frame");
    const pos = document.createElement("div");
    pos.className = "lg-frame-position";
    pos.setAttribute("aria-live", "polite");
    const next = document.createElement("button");
    next.type = "button"; next.textContent = "Next →"; next.setAttribute("aria-label", "Next recorded frame");
    const play = document.createElement("button");
    play.type = "button"; play.textContent = "▶ Play frames"; play.dataset.lgPlay = "true";
    controls.append(prev, pos, next, play);
    card.append(h, note, canvas, controls);
    poseDetail.appendChild(card);
    function updateFrame() {
      const originalIndex = Array.isArray(sample.frame_indices) ? sample.frame_indices[activeFramePos] : activeFramePos;
      pos.textContent = "Frame " + (activeFramePos + 1) + "/" + sample.frames.length + " · DB frame " + (Number(originalIndex) + 1) + "/" + sample.recorded_frame_count;
      drawPose(canvas, sample.frames[activeFramePos]);
      prev.disabled = activeFramePos <= 0;
      next.disabled = activeFramePos >= sample.frames.length - 1;
      play.textContent = playbackTimer === null ? "▶ Play frames" : "Ⅱ Pause";
    }
    prev.addEventListener("click", () => { stopPlayback(); activeFramePos = Math.max(0, activeFramePos - 1); updateFrame(); });
    next.addEventListener("click", () => { stopPlayback(); activeFramePos = Math.min(sample.frames.length - 1, activeFramePos + 1); updateFrame(); });
    play.addEventListener("click", () => {
      if (playbackTimer !== null) { stopPlayback(); updateFrame(); return; }
      if (reducedMotion) { libraryStatus.textContent = "Reduced motion is enabled. Use Next to step through recorded frames one at a time."; return; }
      if (sample.frames.length < 2) { libraryStatus.textContent = "This saved sample contains only one valid frame."; return; }
      playbackTimer = window.setInterval(() => {
        if (document.hidden || panel.hidden) { stopPlayback(); updateFrame(); return; }
        activeFramePos = (activeFramePos + 1) % sample.frames.length;
        updateFrame();
      }, 850);
      updateFrame();
    });
    updateFrame();
  }
  const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17]];
  function drawPose(canvas, featureFrame) {
    const w = Math.max(260, Math.floor(canvas.clientWidth || 300));
    const h = 248;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#050b15"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(44,78,113,.26)"; ctx.lineWidth = 1;
    for (let x = 12; x < w; x += 24) for (let y = 12; y < h; y += 24) {
      ctx.beginPath(); ctx.arc(x,y,1,0,Math.PI*2); ctx.stroke();
    }
    if (!Array.isArray(featureFrame) || featureFrame.length < 132) {
      ctx.fillStyle = "#b9cce2"; ctx.font = "12px system-ui"; ctx.fillText("No valid landmark frame", 14, 25); return;
    }
    const hands = [];
    for (let handIndex = 0; handIndex < 2; handIndex++) {
      const offset = handIndex * 63;
      const raw = featureFrame.slice(offset, offset + 63);
      if (raw.every((v) => Math.abs(Number(v) || 0) < 0.000001)) continue;
      const pts = [];
      for (let i=0; i<21; i++) pts.push([Number(raw[i*3]) || 0, Number(raw[i*3+1]) || 0]);
      const wristOffset = 126 + handIndex*3;
      const wx = Number(featureFrame[wristOffset]) || 0.5;
      const wy = Number(featureFrame[wristOffset+1]) || 0.5;
      hands.push({ pts, side: handIndex === 0 ? "Left hand" : "Right hand", color: handIndex === 0 ? "#39d8ff" : "#ff7183", wx, wy });
    }
    if (!hands.length) {
      ctx.fillStyle = "#b9cce2"; ctx.font = "12px system-ui"; ctx.fillText("The saved frame contains no visible hand points.", 12, 24); return;
    }
    hands.forEach((hand) => {
      const xs = hand.pts.map(p=>p[0]), ys = hand.pts.map(p=>p[1]);
      const spanX = Math.max(.35, Math.max(...xs)-Math.min(...xs));
      const spanY = Math.max(.35, Math.max(...ys)-Math.min(...ys));
      const scale = Math.min(w*0.22/spanX, h*0.22/spanY, 74);
      const cx = Math.max(54, Math.min(w-54, hand.wx*w));
      const cy = Math.max(65, Math.min(h-44, hand.wy*h));
      const xy = hand.pts.map(p=>[cx+p[0]*scale, cy+p[1]*scale]);
      ctx.strokeStyle = hand.color; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
      CONNECTIONS.forEach((edge) => {
        ctx.beginPath(); ctx.moveTo(xy[edge[0]][0],xy[edge[0]][1]); ctx.lineTo(xy[edge[1]][0],xy[edge[1]][1]); ctx.stroke();
      });
      xy.forEach((p,i) => {
        ctx.beginPath(); ctx.fillStyle = i === 0 ? "#ffffff" : hand.color; ctx.arc(p[0],p[1],i===0?3.8:2.7,0,Math.PI*2); ctx.fill();
        if ([0,4,8,12,16,20].includes(i)) {
          ctx.fillStyle = "#eaf7ff"; ctx.font = "9px ui-monospace,monospace"; ctx.fillText(String(i),p[0]+4,p[1]-4);
        }
      });
      ctx.fillStyle = hand.color; ctx.font = "bold 10px system-ui"; ctx.fillText(hand.side, Math.max(10,Math.min(w-80,cx-34)), 16 + (hand.side === "Right hand" ? 14 : 0));
    });
    ctx.fillStyle = "#869db7"; ctx.font = "9px system-ui"; ctx.fillText("21-point MediaPipe topology · normalized pose features", 10, h-8);
  }
  async function answerQuestion(question) {
    const text = String(question || "").trim();
    const q = text.toLowerCase();
    const labelsNeed = /sign|label|gesture|alphabet|supported|recogniz|pose|landmark|frame|database|sample/.test(q);
    if (labelsNeed && !libraryData) await loadLibrary();
    if (/^(hi|hello|hey|namaste)\b/.test(q)) {
      return { text: "Hello! I’m LEGANG AI, the SAHAYAK website companion. I can guide you through using the recognizer, explain the project, show model labels, and browse recorded landmark examples." };
    }
    if (/why|purpose|built|build|problem|communication gap/.test(q) && /sahayak|build|purpose|problem|gap|why/.test(q)) {
      return { text: "SAHAYAK was built as a real-time Indian Sign Language recognition project to explore a more accessible bridge between sign gestures and on-screen text. It supports static two-hand poses and continuous/moving signs through separate trained models. It is a development project, so recognition can be uncertain and should not be treated as a certified interpreter." };
    }
    if (/how.*use|use.*sahayak|start|camera|recogniz|recognise|live studio/.test(q) && !/what signs|labels|pose|frame/.test(q)) {
      return { text: "To try SAHAYAK: open Live Studio, choose static or continuous recognition, allow camera access only when the browser asks, and keep your hands visible inside the camera view. For a static sign, hold the pose steadily; for a continuous sign, perform the full movement. Read the result and confidence, and repeat if the system says it is uncertain. The camera belongs to the recognizer, not to this FAQ chat.", actions: [{ label: "Open Live Studio", href: "./studio.html" }] };
    }
    if (/why.*not|wrong|incorrect|uncertain|accuracy/.test(q)) {
      return { text: "Lighting, camera framing, hand visibility, signing speed, and similarity between labels can affect predictions. Keep both hands in view when needed, perform the complete movement in continuous mode, and test the newly trained signs with examples the model did not use for training. I do not have a verified current accuracy report to quote." };
    }
    if (/pose|landmark|frame|recorded sample|database sample/.test(q)) {
      return { text: "Open the Sign library tab to see model labels and any saved sequence examples. The deployed continuous-sign database stores numeric landmark feature frames, not the original camera photographs or video. LEGANG AI reconstructs a labelled hand-landmark skeleton from those saved frames. The current backend does not expose recorded static-sign pose examples, so it won't invent them.", actions: [{ label: "Open Sign library", tab: "library" }] };
    }
    if (/sign|label|gesture|alphabet|supported|model classes/.test(q)) {
      if (!libraryData) return { text: "I couldn't reach the deployed SAHAYAK backend just now, so I can't verify the current labels. Open Sign library and try again when the backend is online.", actions: [{ label: "Open Sign library", tab: "library" }] };
      return { text: "The active static model labels (" + libraryData.static_labels.length + "): " + formatLabels(libraryData.static_labels, 70) + "\n\nThe active continuous model labels (" + libraryData.continuous_labels.length + "): " + formatLabels(libraryData.continuous_labels, 70) + "\n\nThese names are read from the deployed models. Open Sign library to inspect saved pose examples when the database has them.", actions: [{ label: "Browse all labels", tab: "library" }] };
    }
    if (/who.*developer|developer|project head|johan|who made|creator/.test(q)) {
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
    if (/offline|internet|online/.test(q)) {
      return { text: "SAHAYAK includes an offline phrasebook on supported browsers once its content is available locally. Live model status, recognition API requests, and the sign-library database require a connection to the deployed backend. LEGANG AI's predefined FAQ matching itself runs in this page, but live sign labels and pose records need the backend." };
    }
    if (/ai|artificial intelligence|legang/.test(q)) {
      return { text: "LEGANG AI is the website companion for SAHAYAK. This initial version uses a verified local FAQ knowledge base plus live read-only model-label and sample-frame data. It doesn't pretend to have a generative model connected. The supplied character image is kept as a branded flat image with subtle idle/listening/speaking indicators; true facial rigging and phoneme-accurate lip-sync require a rigged avatar or compatible external service." };
    }
    return { text: "I don't have a verified answer for that yet, and I won't guess. Try asking how to use SAHAYAK, why it was built, which signs are supported, how landmark previews work, or how to contact Johan. This FAQ-only version keeps your typed question in the current page and does not send chat messages to an external AI model.", actions: [
      { label: "How to use SAHAYAK", tab: "chat" },
      { label: "Browse sign library", tab: "library" },
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
        addMessage("I couldn't prepare an answer just now. Please try a suggested question or open Sign library when the backend is available.", "bot", [{ label: "Open Sign library", tab: "library" }]);
      } finally {
        isThinking = false;
        sendButton.disabled = false;
        setState("idle");
        messageHost.scrollTop = messageHost.scrollHeight;
      }
    }, 170);
  }
  function showGreeting(text) {
    if (greetingShown || reducedMotion || !panel.hidden) return;
    greetingShown = true;
    greetingText.textContent = text;
    greeting.hidden = false;
    later(() => { greeting.hidden = true; }, 7000);
  }
  launcher.addEventListener("click", togglePanel);
  $("[data-lg-close]").addEventListener("click", closePanel);
  $("[data-lg-greeting-close]").addEventListener("click", () => { greeting.hidden = true; });
  $$("[data-lg-tab]").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.lgTab)));
  $$("[data-lg-ask]").forEach((button) => button.addEventListener("click", () => sendQuestion(button.dataset.lgAsk)));
  $("[data-lg-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = chatInput.value;
    chatInput.value = "";
    sendQuestion(value);
  });
  searchInput.addEventListener("input", () => filterLabels(searchInput.value));
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
  addMessage("Hi! I’m LEGANG AI. Ask me how to use SAHAYAK, why it was built, which signs the live models support, or how to contact Johan. You can also open Sign library for saved landmark previews.", "bot", [{ label: "Browse sign library", tab: "library" }, { label: "Contact Johan", href: "mailto:jubinkuli72@gmail.com" }]);
})();