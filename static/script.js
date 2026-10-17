(() => {
  "use strict";

  /* ------------------------------------------------------------------
     Config
     Leave apiBase empty when FastAPI serves this page (same origin).
     Set window.APP_CONFIG = { apiBase: "https://..." } in index.html
     only if the UI is hosted somewhere else.
  ------------------------------------------------------------------ */
  const API_BASE = ((window.APP_CONFIG && window.APP_CONFIG.apiBase) || "").replace(/\/$/, "");
  const REQUEST_TIMEOUT_MS = 90000;   // free Render instances can take a while to wake up
  const WAKE_HINT_AFTER_MS = 5000;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (sel, root = document) => root.querySelector(sel);

  /* ---------- Elements ---------- */
  const form = $("#loan-form");
  const f = {
    age: $("#age"), income: $("#income"), emp: $("#emp"), intent: $("#intent"),
    amnt: $("#amnt"), rate: $("#rate"), lti: $("#lti"), hist: $("#hist"),
  };
  const ltiMode = $("#ltiMode");
  const submitBtn = $("#submitBtn");
  const submitLabel = $("#submitLabel");

  const panel = $("#panel");
  const dial = $(".dial");
  const needle = $("#needle");
  const fillArc = $("#fill");
  const cutoff = $("#cutoff");
  const cutoffLine = $("#cutoffLine");
  const badge = $("#badge");
  const pctEl = $("#pct");
  const verdictText = $("#verdictText");
  const statCut = $("#statCut");
  const statMargin = $("#statMargin");
  const statPred = $("#statPred");
  const raw = $("#raw");
  const historyWrap = $("#historyWrap");
  const historyList = $("#history");
  const toastEl = $("#toast");
  const statusEl = $("#status");
  const statusText = $("#statusText");

  /* ---------- Dial geometry ---------- */
  const CX = 160, CY = 170;
  const NS = "http://www.w3.org/2000/svg";

  const pointOnDial = (fraction, radius) => {
    const a = Math.PI * (1 - fraction);
    return { x: CX + radius * Math.cos(a), y: CY - radius * Math.sin(a) };
  };

  function buildTicks() {
    const group = $("#ticks");
    for (let i = 0; i <= 50; i++) {
      const major = i % 5 === 0;
      const a = pointOnDial(i / 50, 137);
      const b = pointOnDial(i / 50, major ? 153 : 145);
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", a.x.toFixed(2));
      line.setAttribute("y1", a.y.toFixed(2));
      line.setAttribute("x2", b.x.toFixed(2));
      line.setAttribute("y2", b.y.toFixed(2));
      line.setAttribute("class", "tick" + (major ? " major" : ""));
      line.style.animationDelay = `${i * 9}ms`;
      group.appendChild(line);
    }
  }

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const setNeedle = (p) => { needle.style.transform = `rotate(${p * 180 - 90}deg)`; };
  const setFill = (p) => { fillArc.style.strokeDashoffset = String(100 - p * 100); };

  function placeCutoff(t) {
    const a = pointOnDial(t, 116);
    const b = pointOnDial(t, 142);
    cutoffLine.setAttribute("x1", a.x.toFixed(2));
    cutoffLine.setAttribute("y1", a.y.toFixed(2));
    cutoffLine.setAttribute("x2", b.x.toFixed(2));
    cutoffLine.setAttribute("y2", b.y.toFixed(2));
    cutoff.classList.add("on");
  }

  /* ---------- Formatting ---------- */
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const pct1 = (p) => `${(p * 100).toFixed(1)}%`;

  /* ---------- Count-up for the big number ---------- */
  let countFrame = 0;
  function countTo(target, duration = 1100) {
    cancelAnimationFrame(countFrame);
    if (reduceMotion) { pctEl.textContent = target.toFixed(1); return; }
    const from = parseFloat(pctEl.dataset.v || "0") || 0;
    const start = performance.now();
    const tick = (now) => {
      const k = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - k, 4);
      pctEl.textContent = (from + (target - from) * eased).toFixed(1);
      if (k < 1) countFrame = requestAnimationFrame(tick);
    };
    countFrame = requestAnimationFrame(tick);
    pctEl.dataset.v = String(target);
  }

  /* ---------- Loan share of income (calculated or manual) ---------- */
  let ltiAuto = true;

  function syncLti() {
    if (!ltiAuto) return;
    const income = parseFloat(f.income.value);
    const amount = parseFloat(f.amnt.value);
    f.lti.value = income > 0 && amount >= 0 ? String(Math.round((amount / income) * 100)) : "";
  }

  function setLtiMode(auto) {
    ltiAuto = auto;
    f.lti.readOnly = auto;
    ltiMode.setAttribute("aria-pressed", String(!auto));
    ltiMode.textContent = auto ? "Calculated" : "Manual";
    syncLti();
  }

  ltiMode.addEventListener("click", () => setLtiMode(!ltiAuto));
  f.income.addEventListener("input", syncLti);
  f.amnt.addEventListener("input", syncLti);

  /* ---------- Reading / writing the form ---------- */
  function collect() {
    return {
      person_age: parseInt(f.age.value, 10),
      person_income: Number(f.income.value),
      person_home_ownership: form.elements.home.value,
      person_emp_length: Number(f.emp.value),
      loan_intent: f.intent.value,
      loan_grade: form.elements.grade.value,
      loan_amnt: Number(f.amnt.value),
      loan_int_rate: Number(f.rate.value),
      loan_percent_income: Number(f.lti.value) / 100,
      cb_person_default_on_file: form.elements.dflt.value,
      cb_person_cred_hist_length: parseInt(f.hist.value, 10),
    };
  }

  function setValues(v) {
    f.age.value = v.person_age;
    f.income.value = v.person_income;
    f.emp.value = v.person_emp_length;
    f.intent.value = v.loan_intent;
    f.amnt.value = v.loan_amnt;
    f.rate.value = v.loan_int_rate;
    f.hist.value = v.cb_person_cred_hist_length;
    form.elements.home.value = v.person_home_ownership;
    form.elements.grade.value = v.loan_grade;
    form.elements.dflt.value = v.cb_person_default_on_file;
    setLtiMode(true);
  }

  const EXAMPLES = {
    steady: {
      person_age: 36, person_income: 92000, person_home_ownership: "MORTGAGE",
      person_emp_length: 9, loan_intent: "HOMEIMPROVEMENT", loan_grade: "A",
      loan_amnt: 9000, loan_int_rate: 7.4, cb_person_default_on_file: "N",
      cb_person_cred_hist_length: 12,
    },
    stretched: {
      person_age: 23, person_income: 27000, person_home_ownership: "RENT",
      person_emp_length: 1, loan_intent: "MEDICAL", loan_grade: "E",
      loan_amnt: 14500, loan_int_rate: 17.9, cb_person_default_on_file: "Y",
      cb_person_cred_hist_length: 2,
    },
  };

  document.querySelectorAll("[data-example]").forEach((btn) => {
    btn.addEventListener("click", () => setValues(EXAMPLES[btn.dataset.example]));
  });

  form.addEventListener("reset", () => {
    setTimeout(() => { setLtiMode(true); resetPanel(); }, 0);
  });

  /* ---------- Panel states ---------- */
  let current = 0; // last probability shown on the dial

  function resetPanel() {
    panel.dataset.state = "idle";
    badge.textContent = "Waiting for input";
    pctEl.textContent = "–";
    pctEl.dataset.v = "0";
    verdictText.textContent = "Fill in the application and select Score application.";
    statCut.textContent = statMargin.textContent = statPred.textContent = "–";
    raw.textContent = "No request sent yet.";
    cutoff.classList.remove("on");
    current = 0;
    setNeedle(0);
    setFill(0);
  }

  function showResult(data) {
    const p = clamp(Number(data.default_probability), 0, 1);
    const t = clamp(Number(data.threshold), 0, 1);
    const high = data.default_prediction === 1;
    const margin = (p - t) * 100;

    panel.dataset.state = high ? "high" : "low";
    badge.textContent = high ? "High risk" : "Low risk";
    verdictText.textContent = high
      ? `Default probability is above the ${pct1(t)} threshold, so this application is flagged as high risk.`
      : `Default probability is below the ${pct1(t)} threshold, so this application is flagged as low risk.`;

    statCut.textContent = pct1(t);
    statMargin.textContent = `${margin >= 0 ? "+" : "−"}${Math.abs(margin).toFixed(1)} points`;
    statPred.textContent = high ? "Default expected" : "No default expected";
    raw.textContent = JSON.stringify(data, null, 2);

    placeCutoff(t);
    setNeedle(p);
    setFill(p);
    countTo(p * 100);
    current = p;
    return { p, high };
  }

  /* ---------- "Scanning" motion while waiting for the API ---------- */
  let scanTimer = 0;
  function startScan() {
    if (reduceMotion) return;
    dial.classList.add("scanning");
    const sweep = () => setNeedle(0.15 + Math.random() * 0.7);
    sweep();
    scanTimer = setInterval(sweep, 520);
  }
  function stopScan() {
    clearInterval(scanTimer);
    dial.classList.remove("scanning");
  }

  /* ---------- Toast ---------- */
  let toastTimer = 0;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 6000);
  }

  /* ---------- API ---------- */
  async function readError(res) {
    try {
      const body = await res.json();
      if (Array.isArray(body.detail)) {
        return body.detail
          .map((d) => `${(d.loc || []).slice(1).join(".") || "input"}: ${d.msg}`)
          .join(" · ");
      }
      if (typeof body.detail === "string") return body.detail;
    } catch (_) { /* not JSON */ }
    return `The server responded with status ${res.status}.`;
  }

  async function requestPrediction(payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const wakeHint = setTimeout(() => { submitLabel.textContent = "Waking the server…"; }, WAKE_HINT_AFTER_MS);
    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await readError(res));
      return await res.json();
    } catch (err) {
      if (err.name === "AbortError") throw new Error("The server took too long to respond. Try again in a moment.");
      if (err instanceof TypeError) throw new Error("Could not reach the server. Check your connection and try again.");
      throw err;
    } finally {
      clearTimeout(timeout);
      clearTimeout(wakeHint);
    }
  }

  function setBusy(busy) {
    submitBtn.setAttribute("aria-busy", String(busy));
    submitLabel.textContent = busy ? "Scoring…" : "Score application";
  }

  /* ---------- History ---------- */
  const history = [];

  function pushHistory(entry) {
    history.unshift(entry);
    if (history.length > 4) history.pop();
    renderHistory();
  }

  function renderHistory() {
    historyList.replaceChildren();
    history.forEach((h) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";

      const left = document.createElement("span");
      const dot = document.createElement("span");
      dot.className = `dot ${h.high ? "high" : "low"}`;
      left.append(dot, `${money.format(h.payload.loan_amnt)} · Grade ${h.payload.loan_grade}`);

      const val = document.createElement("span");
      val.className = "val";
      val.textContent = pct1(h.data.default_probability);

      btn.append(left, val);
      btn.addEventListener("click", () => {
        setValues(h.payload);
        if (!ltiAuto || Math.round(h.payload.loan_percent_income * 100) !== Number(f.lti.value)) {
          setLtiMode(false);
          f.lti.value = String(Math.round(h.payload.loan_percent_income * 100));
        }
        showResult(h.data);
      });
      li.appendChild(btn);
      historyList.appendChild(li);
    });
    historyWrap.hidden = history.length === 0;
  }

  /* ---------- Submit ---------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const payload = collect();
    setBusy(true);
    startScan();

    try {
      const data = await requestPrediction(payload);
      stopScan();
      const { high } = showResult(data);
      pushHistory({ payload, data, high });
      if (window.matchMedia("(max-width: 980px)").matches) {
        panel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      }
    } catch (err) {
      stopScan();
      setNeedle(current);
      toast(err.message);
    } finally {
      setBusy(false);
    }
  });

  /* ---------- Model status ---------- */
  async function checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
      const body = await res.json();
      const ok = res.ok && body.model_loaded;
      statusEl.dataset.state = ok ? "online" : "checking";
      statusText.textContent = ok ? "Model online" : "Model starting";
    } catch (_) {
      statusEl.dataset.state = "offline";
      statusText.textContent = "Server unreachable";
    }
  }

  /* ---------- Start-up ---------- */
  buildTicks();
  setLtiMode(true);
  resetPanel();

  // One gauge self-check on load: sweep to full scale and back to zero.
  if (!reduceMotion) {
    setTimeout(() => setNeedle(1), 650);
    setTimeout(() => setNeedle(0), 1500);
  }

  checkHealth();
  setInterval(checkHealth, 30000);
})();
