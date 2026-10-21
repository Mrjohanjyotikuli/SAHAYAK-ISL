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
        '<div class="lg-library-header"><h3 class="lg-library-title">SAHAYAK sign library</h3><p class="lg-library-copy">Choose any label supported by the installed models. Recorded continuous-sign examples play through their saved landmark frames. Static labels are all listed too; if a static recording is not in the deployed data, LEGANG AI will say so rather than invent a pose.</p></div>' +
        '<div class="lg-library-status" data-lg-library-status>Loading every live model label and recording index…</div>' +
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
  function testSignHref(label, category) {
    return "./studio.html?testSign=" + encodeURIComponent(label) + "&signMode=" + encodeURIComponent(category);
  }
  function createTestLink(label, category) {
    const link = document.createElement("a");
    link.className = "lg-sign-btn lg-sign-btn-primary";
    link.href = testSignHref(label, category);
    link.textContent = "Test this sign";
    link.setAttribute("aria-label", "Test " + label + " in SAHAYAK Live Studio");
    return link;
  }
  function addLibrarySection(parent, title, labels, category) {
    const section = document.createElement("section");
    section.className = "lg-library-section";
    const h = document.createElement("h4");
    h.textContent = title + " (" + labels.length + ")";
    const grid = document.createElement("div");
    grid.className = "lg-sign-grid";
    labels.forEach((label) => {
      const card = document.createElement("article");
      card.className = "lg-sign-card";
      const top = document.createElement("div");
      top.className = "lg-sign-card-top";
      const name = document.createElement("strong");
      name.className = "lg-sign-name";
      name.textContent = label;
      const categoryPill = document.createElement("span");
      categoryPill.className = "lg-sign-kind";
      categoryPill.textContent = category === "static" ? "STATIC" : "CONTINUOUS";
      top.append(name, categoryPill);
      const summary = document.createElement("p");
      summary.className = "lg-sign-summary";
      const recordInfo = (libraryData.continuous_recordings_by_label || {})[label];
      const inModel = category === "static"
        ? libraryData.static_labels.includes(label)
        : libraryData.continuous_labels.includes(label);
      if (recordInfo && Number(recordInfo.sample_count) > 0) {
        summary.textContent = category === "static"
          ? "A continuous recording for this label is saved (" + recordInfo.sample_count + " recording(s), " + recordInfo.total_recorded_frames + " frames). It is a sequence example, not a static-training capture."
          : recordInfo.sample_count + " saved recording(s) · " + recordInfo.total_recorded_frames + " recorded frames available to play.";
      } else if (category === "static") {
        summary.textContent = "Available in the static model. No original static landmark recording is included in the deployed repository yet.";
      } else if (!inModel) {
        summary.textContent = "Saved in the sequence database, but not listed in the currently installed continuous model. Test results may not recognize this label.";
      } else {
        summary.textContent = "Available in the continuous model, but no saved database recording is currently available for playback.";
      }
      const actions = document.createElement("div");
      actions.className = "lg-sign-actions";
      if (recordInfo && Number(recordInfo.sample_count) > 0) {
        const view = document.createElement("button");
        view.type = "button";
        view.className = "lg-sign-btn";
        view.textContent = category === "static" ? "View sequence example" : "View recorded frames";
        view.addEventListener("click", () => openPoseForLabel(label, "continuous"));
        actions.appendChild(view);
      } else if (category === "continuous") {
        const unavailable = document.createElement("span");
        unavailable.className = "lg-sign-recording-unavailable";
        unavailable.textContent = "No recording";
        actions.appendChild(unavailable);
      } else {
        const unavailable = document.createElement("span");
        unavailable.className = "lg-sign-recording-unavailable";
        unavailable.textContent = "Static recording not deployed";
        actions.appendChild(unavailable);
      }
      actions.appendChild(createTestLink(label, category));
      card.append(top, summary, actions);
      grid.appendChild(card);
    });
    section.append(h, grid);
    parent.appendChild(section);
  }
  function renderLibrary() {
    if (!libraryData) return;
    const counts = libraryData.continuous_recordings_by_label || {};
    libraryData.examplesByLabel = {};
    (libraryData.continuous_examples || []).forEach((item) => {
      if (item && item.label && !libraryData.examplesByLabel[item.label]) libraryData.examplesByLabel[item.label] = item;
    });
    const totalSamples = Object.values(counts).reduce((sum, item) => sum + Number(item.sample_count || 0), 0);
    const totalFrames = Object.values(counts).reduce((sum, item) => sum + Number(item.total_recorded_frames || 0), 0);
    libraryStatus.textContent = "Loaded " + libraryData.static_labels.length + " static model labels, " +
      libraryData.continuous_labels.length + " continuous model labels, plus " + totalSamples +
      " saved sequence recording(s) containing " + totalFrames + " recorded frames.";
    libraryContent.replaceChildren();
    const staticLabels = libraryData.static_labels.slice().sort();
    const sequenceLabels = Array.from(new Set([
      ...libraryData.continuous_labels,
      ...Object.keys(counts)
    ])).sort();
    addLibrarySection(libraryContent, "Static signs", staticLabels, "static");
    addLibrarySection(libraryContent, "Continuous / moving signs and saved recordings", sequenceLabels, "continuous");
    if (!staticLabels.length && !sequenceLabels.length) {
      const empty = document.createElement("p");
      empty.className = "lg-library-status";
      empty.textContent = "The backend did not return any trained labels. Check the deployed models.";
      libraryContent.appendChild(empty);
    }
  }
  async function openPoseForLabel(label, category) {
    stopPlayback();
    poseDetail.replaceChildren();
    const card = document.createElement("section");
    card.className = "lg-pose-card";
    const title = document.createElement("h4");
    title.textContent = label + " · recorded frame viewer";
    const note = document.createElement("p");
    const testLink = createTestLink(label, category === "static" ? "static" : "continuous");
    if (category === "static") {
      note.textContent = "This is a static model label. The deployed repository does not currently include saved static training-frame recordings, so no static pose is fabricated. You can still test this label in Live Studio." +
        (((libraryData.continuous_recordings_by_label || {})[label]) ? " A separate continuous-sign recording exists for this label; use the continuous-sign card to view that sequence." : "");
      card.append(title, note, testLink);
      poseDetail.appendChild(card);
      card.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
      return;
    }
    note.textContent = "Loading the complete saved landmark recordings for this sign. Each frame is reconstructed from the stored 132 numeric features; it is not the original camera photo or video.";
    const loading = document.createElement("p");
    loading.className = "lg-library-status";
    loading.textContent = "Loading recorded frames…";
    card.append(title, note, loading, testLink);
    poseDetail.appendChild(card);
    card.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
    let data;
    try {
      const response = await fetch(API_BASE + "/api/legang/sign-library/continuous/" + encodeURIComponent(label), {
        method: "GET", cache: "no-store", headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("Backend returned HTTP " + response.status + ".");
      data = await response.json();
    } catch (error) {
      loading.textContent = "Could not load recorded frames right now. " + (error && error.message ? error.message : "The backend is unavailable.");
      return;
    }
    if (!data || !Array.isArray(data.samples) || !data.samples.length) {
      loading.textContent = "No recorded landmark frames are currently stored for " + label + ". The label remains selectable for a Live Studio test.";
      return;
    }
    card.replaceChildren(title, note);
    const selectorLabel = document.createElement("label");
    selectorLabel.className = "lg-recording-select-label";
    selectorLabel.textContent = "Recorded sample";
    let activeSampleIndex = 0;
    const sampleSelect = document.createElement("select");
    sampleSelect.className = "lg-recording-select";
    sampleSelect.setAttribute("aria-label", "Choose a saved recording for " + label);
    data.samples.forEach((sample, index) => {
      const option = document.createElement("option");
      const dateText = sample.created_at ? " · " + new Date(sample.created_at).toLocaleDateString() : "";
      option.value = String(index);
      option.textContent = "Sample #" + sample.sample_id + " · " + (sample.valid_frame_count || (sample.frames || []).length) + " frames" + dateText;
      sampleSelect.appendChild(option);
    });
    selectorLabel.appendChild(sampleSelect);
    const canvas = document.createElement("canvas");
    canvas.className = "lg-pose-canvas";
    canvas.width = 640;
    canvas.height = 480;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Reconstructed hand-landmark skeleton from actual saved SAHAYAK recording frames");
    const controls = document.createElement("div");
    controls.className = "lg-frame-controls";
    const prev = document.createElement("button");
    prev.type = "button"; prev.textContent = "← Prev"; prev.setAttribute("aria-label", "Previous recorded frame");
    const position = document.createElement("div");
    position.className = "lg-frame-position";
    position.setAttribute("aria-live", "polite");
    const next = document.createElement("button");
    next.type = "button"; next.textContent = "Next →"; next.setAttribute("aria-label", "Next recorded frame");
    const play = document.createElement("button");
    play.type = "button"; play.textContent = "▶ Play all frames"; play.dataset.lgPlay = "true";
    controls.append(prev, position, next, play);
    card.append(selectorLabel, canvas, controls, testLink);
    function sampleNow() { return data.samples[activeSampleIndex]; }
    function sampleFrames() { const sample = sampleNow(); return Array.isArray(sample.frames) ? sample.frames : []; }
    function updateFrame() {
      const sample = sampleNow();
      const frames = sampleFrames();
      if (!frames.length) {
        position.textContent = "No valid frames";
        drawPose(canvas, []);
        prev.disabled = true;
        next.disabled = true;
        play.disabled = true;
        return;
      }
      const originalIndex = Array.isArray(sample.frame_indices) ? sample.frame_indices[activeFramePos] : activeFramePos;
      position.textContent = "Frame " + (activeFramePos + 1) + "/" + frames.length +
        " · recorded frame " + (Number(originalIndex) + 1) + "/" + sample.recorded_frame_count;
      drawPose(canvas, frames[activeFramePos]);
      prev.disabled = activeFramePos <= 0;
      next.disabled = activeFramePos >= frames.length - 1;
      play.textContent = playbackTimer === null ? "▶ Play all frames" : "Ⅱ Pause";
      play.disabled = frames.length < 2;
    }
    prev.addEventListener("click", () => {
      stopPlayback();
      activeFramePos = Math.max(0, activeFramePos - 1);
      updateFrame();
    });
    next.addEventListener("click", () => {
      stopPlayback();
      activeFramePos = Math.min(sampleFrames().length - 1, activeFramePos + 1);
      updateFrame();
    });
    sampleSelect.addEventListener("change", () => {
      stopPlayback();
      activeSampleIndex = Number(sampleSelect.value) || 0;
      activeFramePos = 0;
      updateFrame();
    });
    play.addEventListener("click", () => {
      if (playbackTimer !== null) { stopPlayback(); updateFrame(); return; }
      if (reducedMotion) {
        libraryStatus.textContent = "Reduced motion is enabled. Use Next to step through the real recorded frames.";
        return;
      }
      if (sampleFrames().length < 2) {
        libraryStatus.textContent = "This recording contains only one valid frame.";
        return;
      }
      playbackTimer = window.setInterval(() => {
        if (document.hidden || panel.hidden) { stopPlayback(); updateFrame(); return; }
        const frames = sampleFrames();
        activeFramePos = (activeFramePos + 1) % frames.length;
        updateFrame();
      }, 110);
      updateFrame();
    });
    sampleSelect.dispatchEvent(new Event("change"));
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
    if (/what is (sahayak|this project)|tell me about sahayak|project overview|explain sahayak/.test(q)) {
      return { text: "SAHAYAK is a real-time Indian Sign Language recognition website. It contains a camera-based Live Studio, a static two-hand pose model, a continuous/moving-sign model, a phrasebook, and project documentation. Recognition may be uncertain and this development project is not a certified sign-language interpreter." };
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