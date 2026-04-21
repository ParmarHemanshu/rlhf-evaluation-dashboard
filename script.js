const LS_PREFS = "evalPrefs";
const LS_HISTORY = "history";

let index = 0;
let history = JSON.parse(localStorage.getItem(LS_HISTORY)) || [];

let sessionSection = "ranking";
let sessionDifficulty = "medium";
let evaluationReady = false;
let sessionEndModalOpen = false;

let currentTaskAnswered = false;
let timerInterval = null;
let sectionDeadlineMs = 0;
let sectionTimerStarted = false;
let sectionTimeExhausted = false;
let timerPaused = false;
let pausedRemainingMs = 0;
let taskShownAt = 0;

const rootBackdrop = document.getElementById("root-cause-backdrop");
const rootModal = document.getElementById("root-cause-modal");
const rootInput = document.getElementById("root-cause-input");
const rootFeedback = document.getElementById("root-cause-feedback");
const rootSubmit = document.getElementById("root-cause-submit");
const rootCancel = document.getElementById("root-cause-cancel");

const startBackdrop = document.getElementById("start-backdrop");
const startModal = document.getElementById("start-modal");
const setupStartBtn = document.getElementById("setup-start");
const setupCancelBtn = document.getElementById("setup-cancel");
const setupCountHint = document.getElementById("setup-count-hint");

const DIFFICULTY_DEFAULT = "medium";
/** One minute per question: N questions → N minutes total section time (matches question count). */
const SECTION_MS_PER_QUESTION = 60 * 1000;

function getDifficulty(t) {
  const d = (t && t.difficulty) || DIFFICULTY_DEFAULT;
  return d === "easy" || d === "medium" || d === "hard" ? d : DIFFICULTY_DEFAULT;
}

function getSectionBudgetMs() {
  const n = dataset && dataset.length ? dataset.length : 0;
  return Math.max(SECTION_MS_PER_QUESTION, n * SECTION_MS_PER_QUESTION);
}

function applyQuizFilterFromPrefs() {
  const type = sessionSection === "debug" ? "debug" : "ranking";
  dataset = DATA_BANK.filter((t) => t.type === type && getDifficulty(t) === sessionDifficulty);
}

function updateSetupCountHint() {
  if (!setupCountHint || typeof DATA_BANK === "undefined") return;
  const type = (document.querySelector('input[name="setup-section"]:checked') || {}).value || sessionSection;
  const dif = (document.querySelector('input[name="setup-difficulty"]:checked') || {}).value || sessionDifficulty;
  const t = type === "debug" ? "debug" : "ranking";
  const n = DATA_BANK.filter((q) => q.type === t && getDifficulty(q) === dif).length;
  setupCountHint.textContent =
    n > 0
      ? `${n} question(s) for ${t === "debug" ? "Reason taking" : "Option selection"} · ${dif} only.`
      : `No questions for this combination — pick another difficulty or section.`;
}

function syncSetupRadiosFromSession() {
  document.querySelectorAll('input[name="setup-section"]').forEach((r) => {
    r.checked = r.value === sessionSection;
  });
  document.querySelectorAll('input[name="setup-difficulty"]').forEach((r) => {
    r.checked = r.value === sessionDifficulty;
  });
}

function clearSetupCompletionMarks() {
  document.querySelectorAll(".radio-row--completed").forEach((el) => el.classList.remove("radio-row--completed"));
}

function sectionLabel(sec) {
  return sec === "debug" ? "Reason taking" : "Option selection";
}

function computeRunStats() {
  const total = history.length;
  const correct = history.filter((h) => h.correct === true).length;
  const accStr = total ? ((correct / total) * 100).toFixed(1) : "0.0";
  return { total, correct, accStr };
}

function queueSessionEndDialog(kind) {
  queueMicrotask(() => {
    if (!evaluationReady) return;
    if (!dataset || !dataset.length) return;
    if (sessionEndModalOpen) return;
    sessionEndModalOpen = true;
    showStartModal({ afterSectionComplete: true, sessionEndKind: kind });
  });
}

function showStartModal(options) {
  const opts = options || {};
  const afterComplete = !!opts.afterSectionComplete;
  const endKind = opts.sessionEndKind === "timeout" ? "timeout" : "complete";

  if (!startModal || !startBackdrop) return;

  if (!afterComplete) {
    sessionEndModalOpen = false;
  }

  clearSetupCompletionMarks();

  const titleEl = document.getElementById("start-modal-title");
  const descEl = document.getElementById("setup-modal-desc");
  const banner = document.getElementById("setup-completion-banner");
  const summaryEl = document.getElementById("setup-completion-summary");
  const headingEl = document.getElementById("setup-completion-heading");
  const iconEl = document.getElementById("setup-completion-icon");
  const scoreBlock = document.getElementById("setup-score-block");
  const accPctEl = document.getElementById("setup-accuracy-pct");
  const scoreDetailEl = document.getElementById("setup-score-detail");

  if (titleEl) {
    if (!afterComplete) {
      titleEl.textContent = "Configure evaluation";
    } else if (endKind === "timeout") {
      titleEl.textContent = "Session ended";
    } else {
      titleEl.textContent = "Section complete";
    }
  }
  if (descEl) {
    if (!afterComplete) {
      descEl.textContent =
        "Choose a section and difficulty. Restart clears your run, timer, and charts so you begin fresh.";
    } else if (endKind === "timeout") {
      descEl.textContent =
        "The section timer reached zero. Your score reflects all graded items so far. Pick another mode or difficulty below, then Start a new section — or download results.";
    } else {
      descEl.textContent =
        "Every question in this section has a grade (answered, skipped, or timer lapsed). Scores are below. The ✓ marks what you just finished — choose another combination, then Start — or download results first.";
    }
  }
  if (setupStartBtn) {
    setupStartBtn.textContent = afterComplete ? "Start new section" : "Start";
  }

  if (banner && summaryEl) {
    if (afterComplete) {
      const { total, correct, accStr } = computeRunStats();
      const n = dataset && dataset.length ? dataset.length : 0;

      banner.classList.remove("setup-completion-banner--timeout");
      if (endKind === "timeout") {
        banner.classList.add("setup-completion-banner--timeout");
      }
      if (iconEl) {
        iconEl.textContent = endKind === "timeout" ? "⏱" : "✓";
      }
      if (headingEl) {
        headingEl.textContent =
          endKind === "timeout" ? "Time ran out" : "Section finished";
      }

      if (scoreBlock && accPctEl && scoreDetailEl) {
        scoreBlock.classList.remove("is-hidden");
        accPctEl.textContent = `${accStr}%`;
        scoreDetailEl.textContent = `${total} graded · ${correct} correct · accuracy for this run`;
      }

      if (endKind === "timeout") {
        summaryEl.textContent = `${sectionLabel(sessionSection)} · ${sessionDifficulty} — timer ended with ${total} graded item(s).`;
      } else {
        summaryEl.textContent = `${sectionLabel(sessionSection)} · ${sessionDifficulty} — full section ${n}/${n} graded.`;
      }

      banner.classList.remove("is-hidden");

      document.querySelectorAll('input[name="setup-section"]').forEach((inp) => {
        const row = inp.closest(".radio-row");
        if (row && inp.value === sessionSection) row.classList.add("radio-row--completed");
      });
      document.querySelectorAll('input[name="setup-difficulty"]').forEach((inp) => {
        const row = inp.closest(".radio-row");
        if (row && inp.value === sessionDifficulty) row.classList.add("radio-row--completed");
      });
    } else {
      banner.classList.remove("setup-completion-banner--timeout");
      if (iconEl) iconEl.textContent = "✓";
      if (headingEl) headingEl.textContent = "Section finished";
      if (scoreBlock) scoreBlock.classList.add("is-hidden");
      banner.classList.add("is-hidden");
      summaryEl.textContent = "";
    }
  }

  syncSetupRadiosFromSession();
  updateSetupCountHint();
  startModal.classList.remove("is-hidden");
  startBackdrop.classList.remove("is-hidden");
  document.body.classList.add("modal-open");
}

function hideStartModal() {
  if (!startModal || !startBackdrop) return;
  startModal.classList.add("is-hidden");
  startBackdrop.classList.add("is-hidden");
  document.body.classList.remove("modal-open");
  sessionEndModalOpen = false;
  clearSetupCompletionMarks();
  const banner = document.getElementById("setup-completion-banner");
  if (banner) {
    banner.classList.add("is-hidden");
    banner.classList.remove("setup-completion-banner--timeout");
  }
  const scoreBlock = document.getElementById("setup-score-block");
  if (scoreBlock) scoreBlock.classList.add("is-hidden");
  if (setupStartBtn) setupStartBtn.textContent = "Start";
}

function renderEvaluatePlaceholder() {
  const el = document.getElementById("task");
  if (el) {
    el.innerHTML =
      '<p class="muted task-placeholder">Use <strong>Restart</strong> in the header, choose your section and difficulty, then click <strong>Start</strong>.</p>';
  }
  const pill = document.getElementById("task-type-pill");
  const progress = document.getElementById("task-progress");
  if (pill) pill.textContent = "—";
  if (progress) progress.textContent = "";
  const hint = document.getElementById("timer-budget-hint");
  if (hint) hint.textContent = "";
  const tv = document.getElementById("timer-value");
  if (tv) {
    tv.textContent = "—";
    tv.classList.remove("timer-warn", "timer-critical");
  }
  hideRankingFeedback();
  resetSectionTimerState();
  updateSessionProgressUI();
}

function resetSectionTimerState() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerPaused = false;
  sectionTimerStarted = false;
  sectionTimeExhausted = false;
  sectionDeadlineMs = 0;
  pausedRemainingMs = 0;
  const el = document.getElementById("timer-value");
  if (el) {
    el.textContent = "—";
    el.classList.remove("timer-warn", "timer-critical");
  }
}

function taskTypeLabel(type) {
  return type === "ranking" ? "Ranking" : "Debug trace";
}

function formatQuestionText(t) {
  const head = t.prompt || (t.type === "debug" ? "Debug trace" : "Ranking");
  if (t.type === "ranking") {
    return `${head}\n\nOptions:\n${t.responses.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
  }
  return `${head}\n\nTrace:\n${t.trace.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
}

function getRightAnswerText(t) {
  if (t.type === "ranking") return t.responses[t.correct];
  return `Diagnosis must include keyword: "${t.correct}"`;
}

function keywordRubricPhrase(key) {
  const k = String(key || "").toLowerCase();
  const map = {
    token: "session or auth tokens (expired, wrong scope, or clock skew)",
    callback: "asynchronous callbacks or webhooks updating state after payment",
    syntax: "SQL/schema mismatch such as a wrong column name or migration drift",
    timeout: "upstream latency or gateway timeouts versus healthy services",
    cache: "stale cached configuration or CDN/edge caches serving old values",
    idempotency: "missing idempotency keys so duplicate submits create duplicate effects",
    signature: "webhook or request signing and verification (HMAC, shared secret)",
    memory: "in-process memory pressure, heap size, or oversized caches causing GC load",
    race: "concurrency and lost updates when two workers read-modify-write without locking",
    cors: "browser CORS policy versus same-origin rules (curl can work while the browser blocks)",
    disk: "node or host disk exhaustion and log retention",
    certificate: "TLS trust chain, certificates, or client trust stores",
    query: "database access patterns such as N+1 queries fanning out per row",
  };
  return map[k] || `issues related to “${k}” as hinted in the trace`;
}

function buildAiWrongFeedback(t, givenAnswer, opts) {
  const isTimeout = opts && opts.timeout;
  const isRanking = t.type === "ranking";

  if (isTimeout) {
    return (
      "The shared section timer reached zero before you submitted for this item. " +
      "Budget is one minute per question in the section (total minutes equals question count), so pace yourself across all prompts. " +
      "The rubric answer is still the one supported by the trace—practice spotting decisive signals (status codes, errors, repeats) earlier in the countdown."
    );
  }

  if (isRanking) {
    const best = t.responses[t.correct];
    const picked = givenAnswer;
    return (
      `From an evaluator perspective, the stronger response is the one that adds concrete mechanisms, tradeoffs, or definitions—not just a label. ` +
      `The reference answer emphasizes: “${truncate(best, 160)}”. ` +
      `Your pick (“${truncate(picked, 120)}”) is weaker here because it stays generic or misses those specifics, so it would likely score lower in a human preference model.`
    );
  }

  const rubric = keywordRubricPhrase(t.correct);
  const g = (givenAnswer || "").trim() || "(empty)";
  return (
    `The trace is most consistent with ${rubric}. ` +
    `Your answer (“${truncate(g, 140)}”) does not surface that mechanism, so a grader would mark it incorrect even if parts sound plausible. ` +
    `Try tying each clue in the trace (HTTP codes, retries, partner vs browser behavior) to one concrete failure mode before submitting.`
  );
}

function buildAiCorrectFeedback(t) {
  if (t.type === "ranking") {
    return (
      "Good match: you selected the response that is more specific, actionable, and aligned with how a strong model would explain the concept. " +
      "That kind of preference signal is exactly what RLHF reward models are trained to approximate."
    );
  }
  return (
    "Nice diagnosis: your wording aligns with the rubric keyword the trace was built around, which is what automated checks (and many human graders) use as a proxy for correctness here."
  );
}

function truncate(s, n) {
  const str = String(s);
  if (str.length <= n) return str;
  return str.slice(0, n - 1) + "…";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stopSectionTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay(ms) {
  const el = document.getElementById("timer-value");
  if (!el) return;
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  el.textContent = `${m}:${String(s).padStart(2, "0")}`;
  const warnSec = 60;
  const critSec = 15;
  el.classList.toggle("timer-warn", sec <= warnSec && sec > 0);
  el.classList.toggle("timer-critical", sec <= critSec && sec > 0);
  if (sec > warnSec) {
    el.classList.remove("timer-warn", "timer-critical");
  }
}

function pauseQuestionTimer() {
  if (!sectionTimerStarted || sectionTimeExhausted) return;
  if (timerPaused) return;
  timerPaused = true;
  pausedRemainingMs = Math.max(0, sectionDeadlineMs - Date.now());
}

function resumeQuestionTimer() {
  if (!timerPaused) return;
  timerPaused = false;
  sectionDeadlineMs = Date.now() + pausedRemainingMs;
}

function ensureSectionTimerRunning() {
  if (!evaluationReady) return;

  const hint = document.getElementById("timer-budget-hint");
  if (hint && dataset && dataset.length) {
    hint.textContent = `${dataset.length} min total`;
  }

  if (!dataset || !dataset.length) return;
  if (sectionTimeExhausted) {
    updateTimerDisplay(0);
    return;
  }

  if (!sectionTimerStarted) {
    sectionDeadlineMs = Date.now() + getSectionBudgetMs();
    sectionTimerStarted = true;
    timerPaused = false;
    pausedRemainingMs = 0;
  }

  taskShownAt = Date.now();

  if (timerInterval) {
    const rem = timerPaused ? pausedRemainingMs : Math.max(0, sectionDeadlineMs - Date.now());
    updateTimerDisplay(rem);
    return;
  }

  timerInterval = setInterval(() => {
    const rem = timerPaused ? pausedRemainingMs : Math.max(0, sectionDeadlineMs - Date.now());
    updateTimerDisplay(rem);
    if (!timerPaused && rem <= 0) {
      sectionTimeExhausted = true;
      stopSectionTimerInterval();
      timerPaused = false;
      onTimerExpired();
      const kind =
        dataset.length && history.length >= dataset.length ? "complete" : "timeout";
      queueSessionEndDialog(kind);
    }
  }, 120);

  const rem0 = timerPaused ? pausedRemainingMs : Math.max(0, sectionDeadlineMs - Date.now());
  updateTimerDisplay(rem0);
}

function isCurrentTaskLocked() {
  return currentTaskAnswered;
}

function onTimerExpired() {
  if (!evaluationReady) return;
  if (isCurrentTaskLocked()) return;
  const t = dataset[index];
  const timeMs = Date.now() - taskShownAt;
  const given = "";
  const reason = "Timer lapsed with no option selected and no reason submitted; moved to next question.";
  const aiFeedback = reason;

  saveHistoryRecord({
    correct: false,
    question: formatQuestionText(t),
    rightAnswer: getRightAnswerText(t),
    givenAnswer: given,
    reason,
    aiFeedback,
    difficulty: getDifficulty(t),
    taskType: t.type,
    taskIndex: index,
    timeMs,
    timedOut: true,
    timerLapseSkip: true,
  });

  hideRankingFeedback();
  if (rootModal && !rootModal.classList.contains("is-hidden")) {
    rootModal.classList.add("is-hidden");
    rootBackdrop.classList.add("is-hidden");
    document.body.classList.remove("modal-open");
  }
  rootFeedback?.classList.add("is-hidden");

  updateTimerDisplay(0);
  index = (index + 1) % dataset.length;
  showTask();
}

function setDifficultyBadge(t) {
  const badge = document.getElementById("difficulty-badge");
  if (!badge) return;
  const d = getDifficulty(t);
  badge.textContent = d.charAt(0).toUpperCase() + d.slice(1);
  badge.classList.remove("badge-easy", "badge-medium", "badge-hard");
  badge.classList.add(`badge-${d}`);
}

function updateSessionProgressUI() {
  const total = dataset && dataset.length ? dataset.length : 0;
  const done = history.length;
  const pct = Math.min(100, total ? (done / total) * 100 : 0);
  const fill = document.getElementById("session-progress-fill");
  const track = document.getElementById("session-progress-track");
  const label = document.getElementById("session-progress-label");
  if (fill) fill.style.width = pct + "%";
  if (track) track.setAttribute("aria-valuenow", String(Math.round(pct)));
  if (label) label.textContent = `${done} / ${total} graded`;
}

function showRankingFeedback(isCorrect, text) {
  const panel = document.getElementById("ranking-feedback");
  if (!panel) return;
  panel.classList.remove("is-hidden");
  panel.innerHTML = `
    <div class="ai-feedback-head">${isCorrect ? "Model-style confirmation" : "Model-style critique"}</div>
    <p class="ai-feedback-body">${escapeHtml(text)}</p>
  `;
  panel.classList.toggle("ai-feedback-ok", isCorrect);
  panel.classList.toggle("ai-feedback-bad", !isCorrect);
}

function hideRankingFeedback() {
  const panel = document.getElementById("ranking-feedback");
  if (!panel) return;
  panel.classList.add("is-hidden");
  panel.innerHTML = "";
  panel.classList.remove("ai-feedback-ok", "ai-feedback-bad");
}

function showTask() {
  if (!evaluationReady) {
    renderEvaluatePlaceholder();
    return;
  }

  currentTaskAnswered = false;
  hideRankingFeedback();

  if (!dataset || !dataset.length) {
    const el = document.getElementById("task");
    if (el)
      el.innerHTML =
        '<p class="muted">No questions for this section and difficulty. Open <strong>Restart</strong> and pick another combination.</p>';
    return;
  }

  const t = dataset[index];
  const pill = document.getElementById("task-type-pill");
  const progress = document.getElementById("task-progress");
  if (pill) pill.textContent = taskTypeLabel(t.type);
  if (progress) progress.textContent = `Item ${index + 1} of ${dataset.length}`;
  setDifficultyBadge(t);
  updateSessionProgressUI();

  let html = `<h3 class="task-prompt">${escapeHtml(t.prompt || "Debug trace")}</h3>`;
  if (t.type === "ranking") {
    t.responses.forEach((r, i) => {
      html += `<div class="response" role="button" tabindex="0" data-choice="${i}" onclick="submitAnswer(${i}, this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();submitAnswer(${i}, this);}">${escapeHtml(r)}</div>`;
    });
  } else {
    html += `<ol class="trace-list">`;
    t.trace.forEach((step) => {
      html += `<li class="trace-item"><code>${escapeHtml(step)}</code></li>`;
    });
    html += `</ol>`;
    html += `<button type="button" class="btn btn-primary" onclick="openRootCauseModal()">Submit root cause</button>`;
  }

  document.getElementById("task").innerHTML = html;
  ensureSectionTimerRunning();
}

function submitAnswer(choice, el) {
  if (!evaluationReady) return;
  if (document.querySelector("#task .response.correct, #task .response.wrong")) return;
  const t = dataset[index];
  const correct = choice === t.correct;
  el.classList.add(correct ? "correct" : "wrong");
  document.querySelectorAll("#task .response").forEach((node) => {
    node.setAttribute("tabindex", "-1");
    node.style.pointerEvents = "none";
    const idx = Number(node.getAttribute("data-choice"));
    if (!correct && idx === t.correct) node.classList.add("reveal-correct");
  });

  const given = t.responses[choice];
  const timeMs = Date.now() - taskShownAt;
  const reason = correct ? null : buildAiWrongFeedback(t, given, {});
  const aiFeedback = correct ? buildAiCorrectFeedback(t) : reason;

  if (correct) showRankingFeedback(true, aiFeedback);
  else showRankingFeedback(false, aiFeedback);

  saveHistoryRecord({
    correct,
    question: formatQuestionText(t),
    rightAnswer: getRightAnswerText(t),
    givenAnswer: given,
    reason,
    aiFeedback,
    difficulty: getDifficulty(t),
    taskType: t.type,
    taskIndex: index,
    timeMs,
    timedOut: false,
  });
}

function openRootCauseModal() {
  if (!evaluationReady) return;
  if (isCurrentTaskLocked()) return;
  if (!rootModal || !rootBackdrop) return;
  rootInput.value = "";
  rootFeedback.classList.add("is-hidden");
  rootFeedback.textContent = "";
  rootModal.classList.remove("is-hidden");
  rootBackdrop.classList.remove("is-hidden");
  document.body.classList.add("modal-open");
  pauseQuestionTimer();
  setTimeout(() => rootInput.focus(), 0);
}

function closeRootCauseModal() {
  if (!rootModal || !rootBackdrop) return;
  rootModal.classList.add("is-hidden");
  rootBackdrop.classList.add("is-hidden");
  document.body.classList.remove("modal-open");
  if (!isCurrentTaskLocked()) resumeQuestionTimer();
}

function submitRootCauseFromModal() {
  if (!evaluationReady) return;
  const t = dataset[index];
  const raw = (rootInput && rootInput.value) || "";
  const input = raw.trim();
  const expected = String(t.correct || "").toLowerCase();

  rootFeedback.classList.remove("is-hidden");
  rootFeedback.classList.remove("feedback-ok", "feedback-bad", "feedback-ai");

  if (!input.length) {
    rootFeedback.classList.add("feedback-bad");
    rootFeedback.textContent = "Enter a short root cause before submitting.";
    return;
  }

  const correct = input.toLowerCase().includes(expected);
  const timeMs = Date.now() - taskShownAt;
  const reason = correct ? null : buildAiWrongFeedback(t, input, {});
  const aiFeedback = correct ? buildAiCorrectFeedback(t) : reason;

  rootFeedback.classList.add(correct ? "feedback-ok" : "feedback-bad", "feedback-ai");
  rootFeedback.innerHTML = correct
    ? escapeHtml(aiFeedback)
    : `<strong>Incorrect.</strong> ${escapeHtml(aiFeedback)}`;

  saveHistoryRecord({
    correct,
    question: formatQuestionText(t),
    rightAnswer: getRightAnswerText(t),
    givenAnswer: input,
    reason,
    aiFeedback,
    difficulty: getDifficulty(t),
    taskType: t.type,
    taskIndex: index,
    timeMs,
    timedOut: false,
  });

  rootSubmit.disabled = true;
  setTimeout(() => {
    rootSubmit.disabled = false;
    closeRootCauseModal();
  }, 1400);
}

function saveHistoryRecord(entry) {
  currentTaskAnswered = true;
  const row = {
    correct: entry.correct,
    result: entry.correct,
    question: entry.question,
    rightAnswer: entry.rightAnswer,
    givenAnswer: entry.givenAnswer,
    reason: entry.reason,
    aiFeedback: entry.aiFeedback,
    difficulty: entry.difficulty,
    taskType: entry.taskType,
    taskIndex: entry.taskIndex,
    timeMs: entry.timeMs,
    timedOut: !!entry.timedOut,
    timerLapseSkip: !!entry.timerLapseSkip,
    skipped: !!entry.skipped,
    sessionSection,
    sessionDifficulty,
    at: new Date().toISOString(),
  };
  history.push(row);
  localStorage.setItem(LS_HISTORY, JSON.stringify(history));
  updateAnalytics();
  updateSessionProgressUI();

  if (evaluationReady && dataset.length > 0 && history.length === dataset.length) {
    queueSessionEndDialog("complete");
  }
}

function updateAnalytics() {
  const total = history.length;
  const correct = history.filter((h) => h.correct === true).length;
  const accuracy = total ? ((correct / total) * 100).toFixed(1) : 0;

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };
  setText("total", total);
  setText("correct", correct);
  setText("accuracy", accuracy + "%");
  setText("total-2", total);
  setText("correct-2", correct);
  setText("accuracy-2", accuracy + "%");

  drawChart("chart", 520, 160);
  drawChart("chart-2", 900, 220);
}

function drawChart(canvasId, fallbackW, fallbackH) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !canvas.getContext) return;

  const w = canvas.width || fallbackW;
  const h = canvas.height || fallbackH;
  if (!canvas.width) canvas.width = w;
  if (!canvas.height) canvas.height = h;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const capY = 18;
  ctx.fillStyle = "#64748b";
  ctx.font = "11px DM Sans, system-ui, sans-serif";
  const secLabel =
    sessionSection === "debug" ? "Reason taking" : "Option selection";
  ctx.fillText(
    `Difficulty: ${sessionDifficulty} · Section: ${secLabel}`,
    12,
    capY
  );

  if (!history.length) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px DM Sans, system-ui, sans-serif";
    ctx.fillText("Complete tasks to see accuracy trend", 16, canvas.height / 2 + 6);
    return;
  }

  let correctCount = 0;
  const pts = [];

  const topPad = 28;
  const botPad = 22;

  history.forEach((h, i) => {
    if (h.correct) correctCount++;
    const acc = (correctCount / (i + 1)) * 100;
    const x = ((i + 0.5) / history.length) * (canvas.width - 24) + 12;
    const y =
      topPad + (canvas.height - topPad - botPad) * (1 - acc / 100);
    pts.push({ x, y, acc, ok: !!h.correct });
  });

  const baseY = canvas.height - botPad;
  ctx.strokeStyle = "#c7d2fe";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(12, baseY);
  ctx.lineTo(canvas.width - 12, baseY);
  ctx.stroke();

  if (pts.length > 1) {
    ctx.strokeStyle = "#4f46e5";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  pts.forEach((p) => {
    ctx.fillStyle = p.ok ? "#16a34a" : "#dc2626";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function nextTask() {
  if (!evaluationReady || !dataset || !dataset.length) return;
  if (!isCurrentTaskLocked()) {
    const t = dataset[index];
    saveHistoryRecord({
      correct: false,
      question: formatQuestionText(t),
      rightAnswer: getRightAnswerText(t),
      givenAnswer: "(skipped)",
      reason: "Skipped before answering; counts as incorrect.",
      aiFeedback: "This item was skipped and is scored as incorrect.",
      difficulty: getDifficulty(t),
      taskType: t.type,
      taskIndex: index,
      timeMs: Date.now() - taskShownAt,
      timedOut: false,
      skipped: true,
    });
  }
  index = (index + 1) % dataset.length;
  showTask();
}

function normalizeAttempt(h, i) {
  const result = h.result !== undefined ? h.result : h.correct === true;
  const question = h.question || "—";
  const rightAnswer = h.rightAnswer || "—";
  const givenAnswer = h.givenAnswer !== undefined && h.givenAnswer !== null ? h.givenAnswer : "—";
  let reason = h.reason !== undefined ? h.reason : null;
  if (result === true) reason = null;
  else if (reason == null || reason === "") {
    reason = "No detailed reason stored for this attempt (older export format).";
  }
  return {
    index: i + 1,
    question,
    rightAnswer,
    givenAnswer,
    result,
    reason,
    aiFeedback: h.aiFeedback || reason,
    difficulty: h.difficulty || "—",
    taskType: h.taskType || "—",
    taskIndex: h.taskIndex ?? "—",
    timeMs: h.timeMs ?? null,
    timedOut: !!h.timedOut,
    timerLapseSkip: !!h.timerLapseSkip,
    skipped: !!h.skipped,
    sessionSection: h.sessionSection || "—",
    sessionDifficulty: h.sessionDifficulty || "—",
    at: h.at || null,
  };
}

function downloadResult() {
  exportResults();
}

function exportResults() {
  const attempts = history.map((h, i) => normalizeAttempt(h, i));
  const stats = computeRunStats();
  const payload = {
    exportedAt: new Date().toISOString(),
    datasetSize: dataset && dataset.length ? dataset.length : 0,
    selectedSection: sessionSection,
    selectedDifficulty: sessionDifficulty,
    runAccuracyPercent: stats.accStr,
    runGradedTotal: stats.total,
    runCorrectTotal: stats.correct,
    attempts,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "rlhf-eval-results.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function wireNav() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-view");
      document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      document.getElementById("view-evaluate").classList.toggle("is-hidden", view !== "evaluate");
      document.getElementById("view-analytics").classList.toggle("is-hidden", view !== "analytics");
    });
  });
}

function wireModal() {
  if (rootCancel) rootCancel.addEventListener("click", closeRootCauseModal);
  if (rootBackdrop) rootBackdrop.addEventListener("click", closeRootCauseModal);
  if (rootSubmit) rootSubmit.addEventListener("click", submitRootCauseFromModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && rootModal && !rootModal.classList.contains("is-hidden")) {
      closeRootCauseModal();
    }
    if (e.key === "Escape" && startModal && !startModal.classList.contains("is-hidden")) {
      hideStartModal();
      if (!evaluationReady) {
        renderEvaluatePlaceholder();
      }
    }
  });
}

function wireSetupModal() {
  document.querySelectorAll('input[name="setup-section"]').forEach((r) =>
    r.addEventListener("change", updateSetupCountHint)
  );
  document.querySelectorAll('input[name="setup-difficulty"]').forEach((r) =>
    r.addEventListener("change", updateSetupCountHint)
  );

  setupStartBtn?.addEventListener("click", () => {
    sessionEndModalOpen = false;
    const sec = document.querySelector('input[name="setup-section"]:checked')?.value || "ranking";
    const dif = document.querySelector('input[name="setup-difficulty"]:checked')?.value || "medium";
    sessionSection = sec;
    sessionDifficulty = dif;
    applyQuizFilterFromPrefs();
    try {
      localStorage.setItem(LS_PREFS, JSON.stringify({ section: sessionSection, difficulty: sessionDifficulty }));
    } catch (_) {}

    history = [];
    try {
      localStorage.removeItem(LS_HISTORY);
    } catch (_) {}

    index = 0;
    evaluationReady = true;
    resetSectionTimerState();
    hideStartModal();
    updateAnalytics();
    updateSessionProgressUI();
    showTask();
  });

  setupCancelBtn?.addEventListener("click", () => {
    hideStartModal();
    if (!evaluationReady) {
      renderEvaluatePlaceholder();
    }
  });

  startBackdrop?.addEventListener("click", () => {
    hideStartModal();
    if (!evaluationReady) {
      renderEvaluatePlaceholder();
    }
  });

  document.getElementById("btn-restart")?.addEventListener("click", () => {
    showStartModal();
  });
}

function loadPrefsAndHistory() {
  try {
    const raw = localStorage.getItem(LS_PREFS);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && (p.section === "debug" || p.section === "ranking") && ["easy", "medium", "hard"].includes(p.difficulty)) {
        sessionSection = p.section;
        sessionDifficulty = p.difficulty;
      }
    }
  } catch (_) {}

  applyQuizFilterFromPrefs();

  try {
    const h = localStorage.getItem(LS_HISTORY);
    if (h) {
      const parsed = JSON.parse(h);
      if (Array.isArray(parsed)) history = parsed;
    }
  } catch (_) {
    history = [];
  }

  evaluationReady = true;
}

wireNav();
wireModal();
wireSetupModal();

try {
  const raw = localStorage.getItem(LS_PREFS);
  if (raw) {
    loadPrefsAndHistory();
    index = 0;
    updateAnalytics();
    updateSessionProgressUI();
    showTask();
  } else {
    evaluationReady = false;
    showStartModal();
    updateAnalytics();
    updateSessionProgressUI();
    renderEvaluatePlaceholder();
  }
} catch (_) {
  evaluationReady = false;
  showStartModal();
  updateAnalytics();
  renderEvaluatePlaceholder();
}
