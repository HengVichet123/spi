// SPI 非言語 iPhone app: browse topics, read worked examples with solutions, tick 「わかる」 per pattern.
// Routes: #/ (topics), #/t/<topicId>, #/p/<patternId>, #/tips. Only the ticks are saved (this device).
"use strict";
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const LETTERS = ["A", "B", "C", "D", "E"];
  const STORE_KEY = "spi-guide-checks-v1";
  const FREQS = [["高", "よく出る"], ["中", "ときどき出る"], ["低", "あまり出ない"]];
  const PATTERNS = new Map();
  GUIDE.forEach((t, ti) => t.patterns.forEach((p) => PATTERNS.set(p.id, { ...p, topic: t, ti })));
  const randSeed = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] >>> 1; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ------------------------------------------------------------ ticks
  let checks = {};
  try { checks = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}; } catch (e) { checks = {}; }
  function setCheck(id, on) {
    if (on) checks[id] = true; else delete checks[id];
    try { localStorage.setItem(STORE_KEY, JSON.stringify(checks)); } catch (e) { /* storage blocked */ }
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const doneIn = (t) => t.patterns.filter((p) => checks[p.id]).length;

  // Extra examples made with 「別の例題」 stay for this session, so going back and forth keeps them.
  const extraSeeds = new Map();

  // ------------------------------------------------------------ screens
  function homeScreen() {
    const total = PATTERNS.size, done = [...PATTERNS.keys()].filter((id) => checks[id]).length;
    const C = 2 * Math.PI * 33;
    const groups = FREQS.map(([f, label]) => {
      const ts = GUIDE.filter((t) => t.freq === f);
      if (!ts.length) return "";
      return `<div class="section-head"><span>頻度 ${f}（${label}）</span></div>
        <ul class="group">${ts.map((t) => {
          const d = doneIn(t), n = t.patterns.length, all = d === n;
          const paperOnly = t.formats.length === 1 && t.formats[0] === "P";
          return `<li><a class="row" href="#/t/${t.id}">
            <div class="row-main"><div class="row-title">${t.name}</div><div class="row-sub">${paperOnly ? `<span class="chip">ペーパーのみ</span>` : ""}${t.en}</div></div>
            ${all ? `<i class="ph-fill ph-check-circle badge-done" aria-label="すべてわかる"></i>` : `<span class="row-detail" aria-label="${n}パターン中${d}わかる">${d}/${n}</span>`}
            <i class="ph ph-caret-right chev" aria-hidden="true"></i></a></li>`;
        }).join("")}</ul>`;
    }).join("");
    return {
      title: "SPI 非言語", tab: "topics",
      html: `<h1 class="large-title" data-large>SPI 非言語</h1>
        <div class="summary">
          <div class="ring" role="img" aria-label="${total}パターン中${done}わかる">
            <svg viewBox="0 0 76 76"><circle class="track" cx="38" cy="38" r="33"/><circle class="bar" cx="38" cy="38" r="33" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - done / total)}"/></svg>
            <b>${Math.round((done / total) * 100)}%</b>
          </div>
          <div class="summary-text"><div class="big">${done} <small>/ ${total} わかる</small></div>
            <p>${done === total ? "すべてのパターンにチェックが入りました。" : `残り ${total - done} パターン。わかったものにチェックを入れましょう。`}</p></div>
        </div>
        ${groups}
        <p class="section-foot">${GUIDE.length} 分野・${total} パターン。例題の答えはすべて計算で確かめてあります。</p>`,
    };
  }

  function topicScreen(id) {
    const t = GUIDE.find((x) => x.id === id);
    if (!t) return notFound();
    const d = doneIn(t);
    const rows = t.patterns.map((p) => {
      const on = !!checks[p.id];
      const n = (p.ex ? p.ex.length : 0) + (p.gen ? 2 : 0);
      return `<li><div class="row pattern-row">
        <button class="check" type="button" role="checkbox" aria-checked="${on}" data-check="${p.id}" aria-label="${esc(p.name)} わかる"><i class="${on ? "ph-fill ph-check-circle" : "ph ph-circle"}" aria-hidden="true"></i></button>
        <a class="row-link" href="#/p/${p.id}"><div class="row-main"><div class="row-title">${p.name}</div><div class="row-sub">${p.en}</div></div>
          <span class="row-detail">${p.gen ? "例題 ∞" : `例題 ${n}`}</span><i class="ph ph-caret-right chev" aria-hidden="true"></i></a>
      </div></li>`;
    }).join("");
    return {
      title: t.name, back: ["分野", "#/"], tab: "topics",
      html: `<h1 class="large-title" data-large>${t.name}</h1><p class="subtitle">${t.en}</p>
        <div class="meta">${t.formats.map((f) => `<span class="tag">${FORMAT_NAMES[f]}</span>`).join("")}<span class="tag freq-${t.freq}">頻度 ${t.freq}</span></div>
        <p class="why">${t.why}<span class="en">${t.why_en}</span></p>
        <div class="section-head"><span>公式・ポイント</span></div>
        <div class="group">${t.formulas.map((f) => `<div class="text-row"><i class="ph-fill ph-diamond dot-i" aria-hidden="true"></i><div>${f}</div></div>`).join("")}</div>
        <div class="section-head"><span>解き方の手順</span></div>
        <div class="group">${t.steps.map(([jp, en], i) => `<div class="text-row"><span class="step-n">${i + 1}</span><div>${jp}<span class="en">${en}</span></div></div>`).join("")}</div>
        <div class="section-head"><span>よくあるミス</span></div>
        <div class="group">${t.traps.map(([jp, en]) => `<div class="text-row"><i class="ph-fill ph-warning trap-i" aria-hidden="true"></i><div>${jp}<span class="en">${en}</span></div></div>`).join("")}</div>
        <div class="section-head"><span>パターン</span><span class="count" id="topic-count">${d}/${t.patterns.length} わかる</span></div>
        <ul class="group">${rows}</ul>
        <p class="section-foot">行をタップで例題と解き方へ。丸をタップで「わかる」。</p>`,
    };
  }

  function exampleHTML(ex, label) {
    const sol = ex.steps || ex.expl;
    return `<article class="example open">
      <div class="ex-label">${label}</div>
      <div class="ex-q">${ex.q}</div>
      <ol class="choices">${ex.choices.map((c, i) => `<li class="${i === ex.answer ? "right" : ""}"><span class="letter">${LETTERS[i]}</span><span>${c}</span><i class="ph-bold ph-check right-mark" aria-hidden="true"></i></li>`).join("")}</ol>
      <div class="sol-inner">
        <div class="sol-head">解き方　<b>正解 ${LETTERS[ex.answer]}</b></div>
        <div class="sol-body">${sol}</div>${ex.en ? `<span class="en">${ex.en}</span>` : ""}
      </div>
    </article>`;
  }

  function patternExamples(p) {
    const out = [];
    if (p.ex) p.ex.forEach((id) => out.push(STATIC_EX[id]));
    if (p.gen) {
      for (let k = 0; k < 2; k++) out.push(makeQuestion(p.gen, 1000 + k * 37 + p.ti * 101));
      (extraSeeds.get(p.id) || []).forEach((s) => out.push(makeQuestion(p.gen, s)));
    }
    return out;
  }

  function patternScreen(id) {
    const p = PATTERNS.get(id);
    if (!p) return notFound();
    const on = !!checks[p.id];
    return {
      title: p.name, back: [p.topic.name, "#/t/" + p.topic.id], tab: null,
      html: `<h1 class="large-title" data-large>${p.name}</h1><p class="subtitle">${p.en}</p>
        <div class="section-head"><span>ポイント（${p.topic.name}）</span></div>
        <div class="group">${p.topic.formulas.map((f) => `<div class="text-row"><i class="ph-fill ph-diamond dot-i" aria-hidden="true"></i><div>${f}</div></div>`).join("")}</div>
        <div class="section-head"><span>例題と解き方</span></div>
        <div id="ex-list">${patternExamples(p).map((ex, i) => exampleHTML(ex, `例題 ${i + 1}`)).join("")}</div>
        ${p.gen ? `<button class="more" type="button" data-more="${p.id}"><i class="ph ph-plus-circle" aria-hidden="true"></i>別の例題を見る</button>` : ""}`,
      actionbar: `<button class="know-btn" type="button" data-know="${p.id}" aria-pressed="${on}">${knowLabel(on)}</button>`,
    };
  }
  const knowLabel = (on) => on ? `<i class="ph-fill ph-check-circle" aria-hidden="true"></i>わかる（チェック済み）` : `<i class="ph ph-circle" aria-hidden="true"></i>わかる にする`;

  function tipsScreen() {
    return {
      title: "本番のコツ", tab: "tips",
      html: `<h1 class="large-title" data-large>本番のコツ</h1>
        <div class="section-head"><span>試験のときに</span></div>
        <div class="group">${EXAM_TIPS.map(([jp, en]) => `<div class="tip-row"><span class="row-icon"><i class="ph-fill ph-lightbulb" aria-hidden="true"></i></span><div>${jp}<span class="en">${en}</span></div></div>`).join("")}</div>
        <div class="section-head"><span>受験方式</span></div>
        <div class="group">${Object.entries(FORMAT_NAMES).map(([k, name]) => {
          const n = GUIDE.filter((t) => t.formats.includes(k)).length;
          return `<div class="row"><div class="row-main"><div class="row-title">${name}</div></div><span class="row-detail">${n} 分野</span></div>`;
        }).join("")}</div>
        <p class="section-foot">「ペーパーのみ」の分野は、テストセンターとWEBテスティングでは出ません。</p>`,
    };
  }

  function notFound() {
    return { title: "", back: ["分野", "#/"], tab: "topics", html: `<div class="empty">ページが見つかりません。<br><a href="#/">分野の一覧へ戻る</a></div>` };
  }

  // ------------------------------------------------------------ graphs used by static examples
  function drawGraphs(root) {
    root.querySelectorAll('.graph[data-graph="g1"]').forEach((el) => {
      if (el.dataset.drawn) return; el.dataset.drawn = "1";
      const W = 300, H = 240, sx = (x) => 150 + x * 40, sy = (y) => 150 - y * 30;
      let par = ""; for (let x = -3; x <= 3.001; x += 0.1) par += `${par ? "L" : "M"}${sx(x).toFixed(1)},${sy(x * x - 1).toFixed(1)}`;
      const lab = (x, y, s) => `<text x="${sx(x)}" y="${sy(y)}" class="g-lab" text-anchor="middle">${s}</text>`;
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="直線と放物線の図"><defs><clipPath id="gc"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs><g clip-path="url(#gc)">
        <line x1="0" y1="${sy(0)}" x2="${W}" y2="${sy(0)}" class="g-ax"/><line x1="${sx(0)}" y1="0" x2="${sx(0)}" y2="${H}" class="g-ax"/>
        <path d="${par}" class="g-par"/><line x1="${sx(-4)}" y1="${sy(-3)}" x2="${sx(4)}" y2="${sy(5)}" class="g-line"/>
        ${lab(0, 2.6, "ア")}${lab(0, -0.2, "イ")}${lab(2.4, 0.8, "ウ")}${lab(-2.3, 2.2, "エ")}
        <text x="${sx(2.6)}" y="${sy(4.1)}" class="g-note">y = x + 1</text><text x="${sx(-3.6)}" y="${sy(4.6)}" class="g-note">y = x² − 1</text>
        <text x="${W - 10}" y="${sy(0) - 6}" class="g-note" text-anchor="end">x</text><text x="${sx(0) + 6}" y="12" class="g-note">y</text></g></svg>`;
    });
  }

  // ------------------------------------------------------------ router
  const view = $("#view"), navbar = $("#navbar"), tabbar = $("#tabbar");
  const scrollMemory = new Map();
  let current = null, currentDepth = 0, titleObserver = null;

  function parse(hash) {
    const m = hash.replace(/^#/, "").split("/").filter(Boolean);
    if (m[0] === "t" && m[1]) return { key: hash, depth: 1, make: () => topicScreen(m[1]) };
    if (m[0] === "p" && m[1]) return { key: hash, depth: 2, make: () => patternScreen(m[1]) };
    if (m[0] === "tips") return { key: "#/tips", depth: 0, make: tipsScreen };
    return { key: "#/", depth: 0, make: homeScreen };
  }

  function render(animate) {
    if (current) scrollMemory.set(current, window.scrollY);
    const r = parse(location.hash || "#/");
    const s = r.make();
    const dir = !animate ? "" : r.depth > currentDepth ? "push" : r.depth < currentDepth ? "pop" : "";
    current = r.key; currentDepth = r.depth;

    view.innerHTML = `<div class="screen ${dir}${s.actionbar ? " has-actionbar" : ""}">${s.html}</div>${s.actionbar ? `<div class="actionbar">${s.actionbar}</div>` : ""}`;
    drawGraphs(view);
    document.title = s.title ? `${s.title} | SPI 非言語` : "SPI 非言語";

    $("#nav-title").textContent = s.title;
    const back = $("#nav-back");
    back.hidden = !s.back;
    if (s.back) { $("#nav-back-label").textContent = s.back[0].length > 6 ? "戻る" : s.back[0]; back.dataset.href = s.back[1]; }
    tabbar.hidden = !s.tab;
    tabbar.querySelectorAll(".tab").forEach((a) => { if (a.dataset.tab === s.tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });

    window.scrollTo(0, dir === "push" ? 0 : (scrollMemory.get(r.key) || 0));
    watchLargeTitle();
  }

  // Compact title + bar material appear once the large title has scrolled under the bar, like iOS.
  function watchLargeTitle() {
    if (titleObserver) titleObserver.disconnect();
    const large = $("[data-large]", view);
    if (!large) { navbar.classList.add("solid"); return; }
    titleObserver = new IntersectionObserver(([e]) => navbar.classList.toggle("solid", !e.isIntersecting), { rootMargin: `-${navbar.offsetHeight}px 0px 0px 0px` });
    titleObserver.observe(large);
  }

  // ------------------------------------------------------------ events
  document.addEventListener("click", (e) => {
    const back = e.target.closest("#nav-back");
    if (back) { goBack(back.dataset.href); return; }

    const chk = e.target.closest("[data-check]");
    if (chk) {
      const on = chk.getAttribute("aria-checked") !== "true";
      setCheck(chk.dataset.check, on);
      chk.setAttribute("aria-checked", String(on));
      chk.firstElementChild.className = on ? "ph-fill ph-check-circle" : "ph ph-circle";
      chk.classList.remove("bump"); void chk.offsetWidth; if (on) chk.classList.add("bump");
      const t = PATTERNS.get(chk.dataset.check).topic, c = $("#topic-count");
      if (c) c.textContent = `${doneIn(t)}/${t.patterns.length} わかる`;
      return;
    }

    const know = e.target.closest("[data-know]");
    if (know) {
      const on = know.getAttribute("aria-pressed") !== "true";
      setCheck(know.dataset.know, on);
      know.setAttribute("aria-pressed", String(on));
      know.innerHTML = knowLabel(on);
      return;
    }

    const more = e.target.closest("[data-more]");
    if (more) {
      const p = PATTERNS.get(more.dataset.more), seed = randSeed();
      extraSeeds.set(p.id, [...(extraSeeds.get(p.id) || []), seed]);
      const list = $("#ex-list"), n = list.children.length + 1;
      list.insertAdjacentHTML("beforeend", exampleHTML(makeQuestion(p.gen, seed), `例題 ${n}`));
      drawGraphs(list);
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      list.lastElementChild.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }
  });

  // Going back uses history when the previous entry is the parent screen, so scroll positions are kept.
  let navCount = 0;
  function goBack(href) {
    if (navCount > 0 && history.length > 1) history.back();
    else location.replace(href);
  }
  window.addEventListener("hashchange", () => { navCount = Math.max(0, navCount + (parse(location.hash).depth > currentDepth ? 1 : -1)); render(true); });

  // Swipe right from the left edge goes back (the home-screen app has no browser back gesture).
  let sx = null, sy0 = 0;
  document.addEventListener("touchstart", (e) => { const t = e.touches[0]; sx = t.clientX < 24 && !$("#nav-back").hidden ? t.clientX : null; sy0 = t.clientY; }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (sx === null) return;
    const t = e.changedTouches[0];
    if (t.clientX - sx > 70 && Math.abs(t.clientY - sy0) < 60) goBack($("#nav-back").dataset.href);
    sx = null;
  }, { passive: true });

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  render(false);
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
