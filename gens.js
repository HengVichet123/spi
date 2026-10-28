// SPI 非言語 question generators. Every answer is computed here (no hand-written answer keys);
// 推論 puzzles are checked by brute force over all orderings. Same (topic, seed) -> same question.
"use strict";

function rngFrom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const C = (n, r) => { if (r < 0 || r > n) return 0; let x = 1; for (let i = 1; i <= r; i++) x = x * (n - r + i) / i; return Math.round(x); };
const P = (n, r) => { let x = 1; for (let i = 0; i < r; i++) x *= n - i; return x; };
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
const frac = (n, d) => { const g = gcd(n, d); n /= g; d /= g; return d === 1 ? String(n) : `${n}/${d}`; };
const yen = (x) => `${Math.round(x).toLocaleString("ja-JP")}円`;
const dec = (x) => parseFloat(x.toFixed(4));
const fmt1 = (x) => (Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : x.toFixed(1));

function tools(rng) {
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return { ri, pick, shuffle };
}

// 5 choices: the answer, the given distractors (common mistakes first), padded with nearby values.
function choices(t, ans, wrongs, fmtFn, pad, allowZero = false) {
  const seen = new Set([fmtFn(ans)]);
  const out = [fmtFn(ans)];
  for (const w of wrongs) {
    if (out.length >= 5) break;
    if (w === null || w === undefined || Number.isNaN(w)) continue;
    if (typeof w === "number" && ((allowZero ? w < 0 : w <= 0) || !Number.isFinite(w))) continue;
    const s = fmtFn(w);
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  let k = 1, guard = 0;
  while (out.length < 5 && guard++ < 200) {
    const cand = pad(k++);
    if (cand === null || (typeof cand === "number" && cand <= 0)) continue;
    const s = fmtFn(cand);
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  if (out.length < 5) throw new Error("only " + out.length + " distinct choices");
  const order = t.shuffle([0, 1, 2, 3, 4]);
  return { choices: order.map((i) => out[i]), answer: order.indexOf(0) };
}
const padFrac = (D) => (k) => frac(k, D + k);
const nearInt = (ans, step) => (k) => ans + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step;

// ---------------------------------------------------------------- 推論
const PEOPLE = ["P", "Q", "R", "S", "T"];
function perms(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  arr.forEach((x, i) => { for (const p of perms(arr.slice(0, i).concat(arr.slice(i + 1)))) out.push([x].concat(p)); });
  return out;
}
const ALL5 = perms([0, 1, 2, 3, 4]); // ALL5[k][person] = rank index (0 = 1位)
function clueText(c) {
  const X = PEOPLE[c.x], Y = PEOPLE[c.y];
  switch (c.type) {
    case "before": return `${X}は${Y}より順位が上だった。`;
    case "gap": return `${X}と${Y}の間には${c.g}人いた。`;
    case "next": return `${X}のすぐ下の順位は${Y}だった。`;
    case "exact": return `${X}は${c.k + 1}位だった。`;
    case "notEnd": return `${X}は1位でも5位でもなかった。`;
  }
}
function clueHolds(c, pos) {
  switch (c.type) {
    case "before": return pos[c.x] < pos[c.y];
    case "gap": return Math.abs(pos[c.x] - pos[c.y]) - 1 === c.g;
    case "next": return pos[c.y] === pos[c.x] + 1;
    case "exact": return pos[c.x] === c.k;
    case "notEnd": return pos[c.x] !== 0 && pos[c.x] !== 4;
  }
}
function cluePool(t, pos) {
  const pool = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
    if (x === y) continue;
    if (pos[x] < pos[y]) pool.push({ type: "before", x, y });
    if (x < y) { const g = Math.abs(pos[x] - pos[y]) - 1; if (g >= 1) pool.push({ type: "gap", x, y, g }); }
    if (pos[y] === pos[x] + 1) pool.push({ type: "next", x, y });
  }
  for (let x = 0; x < 5; x++) {
    pool.push({ type: "exact", x, k: pos[x] });
    if (pos[x] !== 0 && pos[x] !== 4) pool.push({ type: "notEnd", x });
  }
  return t.shuffle(pool);
}
const consistent = (clues) => ALL5.filter((pos) => clues.every((c) => clueHolds(c, pos)));
const orderStr = (pos) => { const by = []; pos.forEach((r, p) => (by[r] = PEOPLE[p])); return by.join(" → "); };

function gen_suiron_order(t) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const pos = t.pick(ALL5);
    const target = t.ri(0, 4);
    const pool = cluePool(t, pos).filter((c) => !(c.type === "exact" && c.x === target));
    const clues = [];
    for (const c of pool) {
      if (c.type === "exact" && clues.some((d) => d.type === "exact")) continue;
      clues.push(c);
      const cons = consistent(clues);
      const ranks = new Set(cons.map((p) => p[target]));
      if (ranks.size === 1 && clues.length >= 3) {
        if (clues.length > 5) break;
        const k = pos[target];
        const ch = choices(t, k, [0, 1, 2, 3, 4].filter((r) => r !== k), (r) => `${r + 1}位`, () => null, true);
        return {
          q: `<p>P、Q、R、S、Tの5人が競走をした。順位について次のことがわかっている（同着はいない）。</p><ul>${clues.map((c) => `<li>${clueText(c)}</li>`).join("")}</ul><p>このとき、<b>${PEOPLE[target]}</b>は何位か。</p>`,
          ...ch,
          expl: `条件をすべて満たす並び（1位 → 5位）は ${cons.length} 通り：<br>${cons.slice(0, 6).map(orderStr).join("<br>")}${cons.length > 6 ? "<br>…" : ""}<br>どの並びでも ${PEOPLE[target]} は ${k + 1}位。<br><i>Tip: draw 5 boxes and place the strongest clue (exact rank or "just below") first; then test the remaining cases.</i>`,
        };
      }
    }
  }
  throw new Error("suiron_order: no puzzle");
}

function statementText(s) { return s.type === "exact" ? `${PEOPLE[s.x]}は${s.k + 1}位だった` : `${PEOPLE[s.x]}は${PEOPLE[s.y]}より順位が上だった`; }
function statementHolds(s, pos) { return s.type === "exact" ? pos[s.x] === s.k : pos[s.x] < pos[s.y]; }
function gen_suiron_truth(t) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const pos = t.pick(ALL5);
    const pool = cluePool(t, pos);
    const clues = [];
    for (const c of pool) { clues.push(c); if (clues.length >= 3) break; }
    const cons = consistent(clues);
    if (cons.length < 2 || cons.length > 10) continue;
    const mk = () => (t.ri(0, 1) ? { type: "exact", x: t.ri(0, 4), k: t.ri(0, 4) } : (() => { const x = t.ri(0, 4); let y = t.ri(0, 4); while (y === x) y = t.ri(0, 4); return { type: "before", x, y }; })());
    const status = (s) => { const n = cons.filter((p) => statementHolds(s, p)).length; return n === cons.length ? "always" : n === 0 ? "never" : "maybe"; };
    const a = mk(), b = mk();
    if (statementText(a) === statementText(b)) continue;
    const sa = status(a), sb = status(b);
    if (sa === "never" && sb === "never") continue; // keep the question interesting
    const opts = ["アだけ", "イだけ", "アとイの両方", "どちらも必ず正しいとはいえない"];
    const k = sa === "always" && sb === "always" ? 2 : sa === "always" ? 0 : sb === "always" ? 1 : 3;
    const extra = "アもイも誤り（どちらも必ず誤り）";
    const ch = choices(t, k, [0, 1, 2, 3].filter((i) => i !== k).concat([4]), (i) => (i === 4 ? extra : opts[i]), () => null, true);
    // option 4 is a fixed distractor; it is never correct here because "never" for both was excluded above only partially, so check:
    if (sa === "never" && sb === "never") continue;
    const word = { always: "必ず正しい", never: "必ず誤り", maybe: "正しいとは限らない" };
    return {
      q: `<p>P、Q、R、S、Tの5人が競走をした。順位について次のことがわかっている（同着はいない）。</p><ul>${clues.map((c) => `<li>${clueText(c)}</li>`).join("")}</ul><p>次の推論ア、イのうち、<b>必ず正しいもの</b>はどれか。</p><p>ア　${statementText(a)}<br>イ　${statementText(b)}</p>`,
      ...ch,
      expl: `条件を満たす並びは ${cons.length} 通り：<br>${cons.map(orderStr).join("<br>")}<br>ア：${word[sa]}　イ：${word[sb]}<br><i>Tip: list every possible order first; "必ず正しい" means true in ALL of them.</i>`,
    };
  }
  throw new Error("suiron_truth: no puzzle");
}

// ---------------------------------------------------------------- 割合・比
function gen_percent(t) {
  const v = t.ri(1, 3);
  if (v === 1) {
    let N, p;
    do { N = t.ri(5, 60) * 20; p = t.pick([5, 8, 12, 15, 24, 25, 35, 45, 60, 65, 75]); } while ((N * p) % 100);
    const ans = (N * p) / 100;
    return { q: `<p>ある会社の社員${N}人のうち、${p}%が電車で通勤している。電車で通勤している社員は何人か。</p>`,
      ...choices(t, ans, [N - ans, (N * p) / 1000, ans + N / 20, ans - N / 20], (x) => `${x}人`, nearInt(ans, 6)),
      expl: `${N} × ${p}/100 = <b>${ans}人</b><br><i>part = whole × rate.</i>` };
  }
  if (v === 2) {
    let W, p;
    do { W = t.ri(8, 60) * 10; p = t.pick([60, 75, 80, 120, 125, 140, 150]); } while ((W * p) % 100);
    const part = (W * p) / 100;
    return { q: `<p>ある商品の今月の売上は${part}万円で、これは先月の売上の${p}%にあたる。先月の売上は何万円か。</p>`,
      ...choices(t, W, [(part * p) / 100, part + (part * Math.abs(p - 100)) / 100, part - (part * Math.abs(p - 100)) / 100, W + 10], (x) => `${fmt1(x)}万円`, nearInt(W, 20)),
      expl: `先月 = 今月 ÷ 割合 = ${part} ÷ ${p / 100} = <b>${W}万円</b><br><i>whole = part ÷ rate (not part × rate).</i>` };
  }
  let A, pct;
  do { A = t.ri(4, 40) * 100; pct = t.pick([5, 10, 12, 15, 20, 25, 30, 40]); } while ((A * pct) % 100);
  const B = A + (A * pct) / 100;
  const wrongB = Math.round(((B - A) / B) * 1000) / 10;
  return { q: `<p>ある施設の来場者数は、昨年が${A.toLocaleString()}人、今年が${B.toLocaleString()}人だった。今年は昨年より何%増えたか。</p>`,
    ...choices(t, pct, [wrongB, pct * 2, pct + 5, pct - 5], (x) => `${fmt1(x)}%`, nearInt(pct, 3)),
    expl: `増加率 = (今年 − 昨年) ÷ 昨年 = ${B - A} ÷ ${A} = <b>${pct}%</b><br><i>Divide by the OLD value (昨年), not the new one.</i>` };
}

function gen_ratio(t) {
  if (t.ri(0, 1)) {
    let a, b; do { a = t.ri(1, 9); b = t.ri(1, 9); } while (a === b || gcd(a, b) !== 1);
    const k = t.ri(2, 30) * 100;
    const T = (a + b) * k, ans = a * k;
    return { q: `<p>AとBの所持金の比は ${a}:${b} で、2人の合計は${T.toLocaleString()}円である。Aの所持金はいくらか。</p>`,
      ...choices(t, ans, [b * k, T / 2, (T * a) / b, ans + k], yen, nearInt(ans, 100)),
      expl: `A = 合計 × ${a}/(${a}+${b}) = ${T} × ${a}/${a + b} = <b>${yen(ans)}</b>` };
  }
  let a, b, c, d;
  do { a = t.ri(1, 9); b = t.ri(1, 9); c = t.ri(1, 9); d = t.ri(1, 9); } while (a === b || c === d || gcd(a, b) !== 1 || gcd(c, d) !== 1 || b === c);
  const n = a * c, m = b * d, g = gcd(n, m);
  const ans = `${n / g}:${m / g}`;
  const w = (x, y) => { const h = gcd(x, y); return `${x / h}:${y / h}`; };
  const ch = choices(t, ans, [w(a, d), w(a * d, b * c), w(c, b), w(a + c, b + d), w(m, n)], (x) => x, (k) => w(n / g + k, m / g));
  return { q: `<p>A:B = ${a}:${b}、B:C = ${c}:${d} のとき、A:C を最も簡単な整数の比で表すとどれか。</p>`, ...ch,
    expl: `Bをそろえる：A:B = ${a * c}:${b * c}、B:C = ${b * c}:${b * d} → A:C = ${n}:${m} = <b>${ans}</b><br><i>Make B the same number in both ratios (LCM), then read A:C.</i>` };
}

function gen_profit(t) {
  for (let i = 0; i < 500; i++) {
    const Cst = t.ri(8, 60) * 100, m = t.pick([20, 25, 30, 40, 50]), d = t.pick([10, 20, 30]);
    const L = Cst + (Cst * m) / 100, S = (L * (100 - d)) / 100, Pf = S - Cst;
    if (!Number.isInteger(L) || !Number.isInteger(S) || Pf <= 0) continue;
    const v = t.ri(1, 3);
    if (v === 1) return { q: `<p>原価${yen(Cst)}の商品に、原価の${m}%の利益を見込んで定価をつけた。この商品を定価の${d}%引きで売ったときの利益はいくらか。</p>`,
      ...choices(t, Pf, [(Cst * (m - d)) / 100, L - Cst, S, Pf + 100], yen, nearInt(Pf, 50)),
      expl: `定価 = ${Cst} × ${1 + m / 100} = ${L}円<br>売価 = ${L} × ${(100 - d) / 100} = ${S}円<br>利益 = ${S} − ${Cst} = <b>${yen(Pf)}</b><br><i>Don't subtract the percentages (${m}% − ${d}%): the discount applies to the list price, not the cost.</i>` };
    if (v === 2) return { q: `<p>原価${yen(Cst)}の商品に、原価の${m}%増しの定価をつけ、定価の${d}%引きで売った。売値はいくらか。</p>`,
      ...choices(t, S, [L, Cst * (1 + (m - d) / 100), L - d * 10, S + 100], yen, nearInt(S, 50)),
      expl: `定価 ${L}円 × ${(100 - d) / 100} = <b>${yen(S)}</b>` };
    const r = (1 + m / 100) * (1 - d / 100) - 1;
    return { q: `<p>ある商品に原価の${m}%増しの定価をつけたが売れなかったので、定価の${d}%引きで売ったところ、利益は${yen(Pf)}だった。原価はいくらか。</p>`,
      ...choices(t, Cst, [Pf / ((m - d) / 100), Pf / (m / 100), Cst + 100, Cst - 100], yen, nearInt(Cst, 200)),
      expl: `原価を x とすると 売価 = x × ${1 + m / 100} × ${1 - d / 100} = ${dec(1 + r)}x、利益 = ${dec(r)}x<br>${dec(r)}x = ${Pf} → x = ${Pf} ÷ ${dec(r)} = <b>${yen(Cst)}</b>` };
  }
  throw new Error("profit");
}

// ---------------------------------------------------------------- 料金
function gen_discount(t) {
  if (t.ri(0, 1)) {
    const p = t.ri(5, 20) * 100, k = t.pick([10, 15, 20]), d = t.pick([10, 20, 30, 40]), n = k + t.ri(2, 15);
    const tot = k * p + ((n - k) * p * (100 - d)) / 100;
    return { q: `<p>ある施設の入場料は1人${yen(p)}だが、${k}人を超えた分については1人あたり${d}%引きになる。${n}人で入場したときの料金の合計はいくらか。</p>`,
      ...choices(t, tot, [(n * p * (100 - d)) / 100, n * p, k * p + (n - k - 1) * p * (100 - d) / 100, tot + p], yen, nearInt(tot, 100)),
      expl: `${k}人分：${k} × ${p} = ${k * p}円<br>残り${n - k}人：${n - k} × ${p} × ${(100 - d) / 100} = ${tot - k * p}円<br>合計 <b>${yen(tot)}</b><br><i>Only the people beyond ${k} get the discount.</i>` };
  }
  const p = t.ri(5, 15) * 100, d1 = t.pick([10, 20]), d2 = d1 + t.pick([10, 20]), n = 20 + t.ri(1, 10);
  const tot = 10 * p + (10 * p * (100 - d1)) / 100 + ((n - 20) * p * (100 - d2)) / 100;
  return { q: `<p>あるツアーの料金は、10人目までは1人${yen(p)}、11人目から20人目までは${d1}%引き、21人目以降は${d2}%引きである。${n}人で参加するときの料金の合計はいくらか。</p>`,
    ...choices(t, tot, [(n * p * (100 - d2)) / 100, 10 * p + ((n - 10) * p * (100 - d1)) / 100, n * p, tot - p], yen, nearInt(tot, 100)),
    expl: `1〜10人目：${10 * p}円<br>11〜20人目：10 × ${p} × ${(100 - d1) / 100} = ${(10 * p * (100 - d1)) / 100}円<br>21〜${n}人目：${n - 20} × ${p} × ${(100 - d2) / 100} = ${((n - 20) * p * (100 - d2)) / 100}円<br>合計 <b>${yen(tot)}</b>` };
}

function gen_settle(t) {
  if (t.ri(0, 1)) {
    for (let i = 0; i < 500; i++) {
      const x = t.ri(10, 90) * 100, y = t.ri(10, 90) * 100;
      if ((x + y) % 300) continue;
      const s = (x + y) / 3;
      if (x <= s || y <= s) continue;
      return { q: `<p>A、B、Cの3人で旅行をした。宿泊費${yen(x)}をAが、交通費${yen(y)}をBが立て替え、Cは何も払っていない。費用を3人で等しく負担するとき、CはAにいくら支払えばよいか。（CはAとBにそれぞれ支払い、AとBの間では精算しないものとする）</p>`,
        ...choices(t, x - s, [s, y - s, x / 3, (x - y) / 2], yen, nearInt(x - s, 100)),
        expl: `1人の負担 = (${x} + ${y}) ÷ 3 = ${s}円<br>Aは${x}円払ったので、${x} − ${s} = <b>${yen(x - s)}</b> を受け取る（Bは${y - s}円）。<br><i>Find each person's fair share first, then compare with what they paid.</i>` };
    }
  }
  const x = t.ri(20, 120) * 100, y = t.ri(5, 60) * 100;
  const ans = Math.abs(x - y) / 2;
  return { q: `<p>AとBが一緒に買い物をし、Aは${yen(x)}、Bは${yen(y)}を支払った。2人の負担を等しくするには、${x > y ? "B" : "A"}が${x > y ? "A" : "B"}にいくら支払えばよいか。</p>`,
    ...choices(t, ans, [Math.abs(x - y), (x + y) / 2, ans + 100, ans - 100], yen, nearInt(ans, 50)),
    expl: `1人の負担 = (${x} + ${y}) ÷ 2 = ${(x + y) / 2}円 → 差額は ${Math.abs(x - y)}円、その半分 <b>${yen(ans)}</b><br><i>Paying the whole difference over-corrects: it only needs half.</i>` };
}

function gen_installment(t) {
  if (t.ri(0, 1)) {
    const a = t.ri(3, 6), n = t.ri(3, 8);
    return { q: `<p>ある商品を購入し、購入時に総額の1/${a}を支払い、残りを${n}回の均等払いにした。1回の支払額は総額のどれだけか。（手数料はかからない）</p>`,
      ...choices(t, frac(a - 1, a * n), [frac(1, a * n), frac(a - 1, a), frac(1, n), frac(a - 1, n)], (x) => x, padFrac(a * n + 1)),
      expl: `残り = 1 − 1/${a} = ${frac(a - 1, a)}<br>1回分 = ${frac(a - 1, a)} ÷ ${n} = <b>${frac(a - 1, a * n)}</b>` };
  }
  const a = t.ri(3, 6), b = t.ri(2, 5);
  const ans = frac((a - 1) * (b - 1), a * b);
  return { q: `<p>家具を購入し、契約時に頭金として総額の1/${a}を支払った。引き渡し時に残額の1/${b}を支払った。まだ支払っていない額は総額のどれだけか。</p>`,
    ...choices(t, ans, [frac(a * b - b - a, a * b), frac(b - 1, b), frac(1, a * b), frac(a - 1, a)], (x) => x, padFrac(a * b + 1)),
    expl: `頭金後の残額 = ${frac(a - 1, a)}<br>引き渡し時に払う額 = ${frac(a - 1, a)} × 1/${b} = ${frac(a - 1, a * b)}<br>残り = ${frac(a - 1, a)} × ${frac(b - 1, b)} = <b>${ans}</b><br><i>"残額の1/${b}" is a fraction of what is LEFT, not of the total.</i>` };
}

// ---------------------------------------------------------------- 速さ・仕事・濃度
function gen_speed(t) {
  const v = t.ri(1, 3);
  if (v === 1) {
    let sp, mins; do { sp = t.pick([12, 18, 24, 30, 36, 42, 48, 54, 60, 72]); mins = t.ri(2, 18) * 5; } while (((sp * mins) % 30) !== 0);
    const d = (sp * mins) / 60;
    return { q: `<p>時速${sp}kmで${mins}分走ると、何km進むか。</p>`,
      ...choices(t, d, [sp * mins / 100, (sp * mins) / 30, d + 1, d - 1], (x) => `${fmt1(x)}km`, nearInt(d, 1.5)),
      expl: `${mins}分 = ${mins}/60時間 → ${sp} × ${mins}/60 = <b>${fmt1(d)}km</b><br><i>Convert minutes to hours (÷60) before multiplying.</i>` };
  }
  if (v === 2) {
    const [v1, v2] = t.pick([[3, 6], [6, 12], [10, 15], [12, 24], [20, 30], [30, 60], [40, 60], [12, 6], [15, 10], [60, 40], [24, 40]]);
    const avg = (2 * v1 * v2) / (v1 + v2);
    const D = t.ri(1, 4) * v1 * v2 / gcd(v1, v2);
    return { q: `<p>${D}km離れた町まで、行きは時速${v1}km、帰りは時速${v2}kmで往復した。往復の平均の速さは時速何kmか。</p>`,
      ...choices(t, avg, [(v1 + v2) / 2, Math.max(v1, v2) - 1, avg + 2, avg - 2], (x) => `時速${fmt1(x)}km`, nearInt(avg, 1)),
      expl: `行き ${D}/${v1} = ${fmt1(D / v1)}時間、帰り ${D}/${v2} = ${fmt1(D / v2)}時間<br>平均 = 往復の道のり ÷ 合計時間 = ${2 * D} ÷ ${fmt1(D / v1 + D / v2)} = <b>時速${fmt1(avg)}km</b><br><i>Average speed is total distance ÷ total time, not (${v1}+${v2})/2.</i>` };
  }
  const x = t.pick([3, 6, 9, 12, 15, 18, 24, 30, 36, 45, 54, 72]);
  const ans = (x * 1000) / 60;
  return { q: `<p>時速${x}kmは分速何mか。</p>`,
    ...choices(t, ans, [x * 1000 / 100, x * 60, x * 100, ans * 10], (y) => `分速${fmt1(y)}m`, nearInt(ans, 10)),
    expl: `${x}km = ${x * 1000}m、1時間 = 60分 → ${x * 1000} ÷ 60 = <b>分速${fmt1(ans)}m</b>` };
}

function gen_travel(t) {
  const v = t.ri(1, 3);
  for (let i = 0; i < 500; i++) {
    if (v === 1) {
      const a = t.ri(5, 20) * 10, b = t.ri(5, 20) * 10, L = (a + b) * t.ri(3, 15);
      const ans = L / (a + b);
      return { q: `<p>周囲${L.toLocaleString()}mの池のまわりを、AとBが同じ地点から同時に反対方向へ歩き始めた。Aは分速${a}m、Bは分速${b}mで歩く。2人が初めて出会うのは何分後か。</p>`,
        ...choices(t, ans, [L / Math.abs(a - b) || null, L / a, L / b, ans + 2], (x) => `${fmt1(x)}分後`, nearInt(ans, 1)),
        expl: `反対方向 → 2人の距離は毎分 ${a} + ${b} = ${a + b}m 縮まる。<br>${L} ÷ ${a + b} = <b>${ans}分後</b><br><i>Opposite directions: add the speeds. Same direction: subtract.</i>` };
    }
    if (v === 2) {
      const b = t.ri(5, 15) * 10, a = b + t.ri(1, 6) * 10, L = (a - b) * t.ri(5, 20);
      const ans = L / (a - b);
      return { q: `<p>周囲${L.toLocaleString()}mのトラックを、AとBが同じ地点から同時に同じ方向へ走り始めた。Aは分速${a}m、Bは分速${b}mで走る。AがBにはじめて1周差をつけて追いつくのは何分後か。</p>`,
        ...choices(t, ans, [L / (a + b), L / b, L / a, ans * 2], (x) => `${fmt1(x)}分後`, nearInt(ans, 2)),
        expl: `同じ方向 → 差は毎分 ${a} − ${b} = ${a - b}m 開く。1周 (${L}m) 差がつくのは ${L} ÷ ${a - b} = <b>${ans}分後</b>` };
    }
    const a = t.ri(6, 10) * 10, b = a + t.ri(4, 20) * 10, tm = t.ri(5, 20);
    if ((a * tm) % (b - a)) continue;
    const ans = (a * tm) / (b - a);
    return { q: `<p>兄が分速${a}mで家を出発した。その${tm}分後に、弟が自転車で分速${b}mで兄を追いかけた。弟が兄に追いつくのは、弟が出発してから何分後か。</p>`,
      ...choices(t, ans, [ans + tm, (a * tm) / b, (b * tm) / (b - a), ans + 1], (x) => `${fmt1(x)}分後`, nearInt(ans, 1)),
      expl: `弟の出発時、兄は ${a} × ${tm} = ${a * tm}m 先にいる。差は毎分 ${b} − ${a} = ${b - a}m 縮む。<br>${a * tm} ÷ ${b - a} = <b>${fmt1(ans)}分後</b>` };
  }
  throw new Error("travel");
}

const WORK_PAIRS = (() => { const out = []; for (let x = 2; x <= 60; x++) for (let y = x + 1; y <= 60; y++) if ((x * y) % (x + y) === 0) out.push([x, y]); return out; })();
function gen_work(t) {
  const v = t.ri(1, 3);
  if (v !== 2) {
    const [x, y] = t.pick(WORK_PAIRS);
    const T = (x * y) / (x + y);
    const unit = v === 1 ? "日" : "分";
    const q = v === 1
      ? `<p>ある仕事をAだけで行うと${x}日、Bだけで行うと${y}日かかる。この仕事をAとBの2人で一緒に行うと何日かかるか。</p>`
      : `<p>ある水槽を満水にするのに、給水管Aだけでは${x}分、給水管Bだけでは${y}分かかる。AとBを同時に使うと、満水になるまで何分かかるか。</p>`;
    return { q, ...choices(t, T, [(x + y) / 2, y - x, Math.round((x + y) / 4), T + 1], (n) => `${fmt1(n)}${unit}`, nearInt(T, 1)),
      expl: `全体を1とすると、1${unit}あたり A は 1/${x}、B は 1/${y}。<br>2人で 1/${x} + 1/${y} = ${frac(x + y, x * y)}<br>1 ÷ ${frac(x + y, x * y)} = <b>${T}${unit}</b><br><i>Tip: set the total work = LCM(${x}, ${y}) units to avoid fractions.</i>` };
  }
  for (let i = 0; i < 500; i++) {
    const x = t.ri(6, 30), y = t.ri(6, 30), k = t.ri(1, x - 1);
    const rem = ((x - k) * y) / x;
    if (!Number.isInteger(rem) || rem <= 0) continue;
    return { q: `<p>ある仕事をAだけで行うと${x}日、Bだけで行うと${y}日かかる。はじめにAが${k}日働き、残りをBだけで仕上げた。Bは何日働いたか。</p>`,
      ...choices(t, rem, [y - k, (k * y) / x, x - k, rem + 1], (n) => `${fmt1(n)}日`, nearInt(rem, 1)),
      expl: `Aが${k}日で終える量 = ${k}/${x}。残り = ${frac(x - k, x)}<br>Bは1日 1/${y} → ${frac(x - k, x)} ÷ 1/${y} = <b>${rem}日</b>` };
  }
  throw new Error("work");
}

function gen_conc(t) {
  const v = t.ri(1, 3);
  for (let i = 0; i < 2000; i++) {
    if (v === 1) {
      const a = t.ri(1, 10) * 50, b = t.ri(1, 10) * 50, p = t.ri(2, 20), q = t.ri(2, 20);
      if (p === q) continue;
      const r = (a * p + b * q) / (a + b);
      if (Math.abs(r * 10 - Math.round(r * 10)) > 1e-9) continue;
      return { q: `<p>${p}%の食塩水${a}gと${q}%の食塩水${b}gを混ぜると、何%の食塩水になるか。</p>`,
        ...choices(t, r, [(p + q) / 2, (a * p + b * q) / 100, r + 1, r - 1], (x) => `${fmt1(x)}%`, nearInt(r, 0.5)),
        expl: `食塩の量：${a} × ${p}% = ${fmt1((a * p) / 100)}g、${b} × ${q}% = ${fmt1((b * q) / 100)}g<br>合計 ${fmt1((a * p + b * q) / 100)}g ÷ ${a + b}g = <b>${fmt1(r)}%</b><br><i>Add the amounts of salt, not the percentages.</i>` };
    }
    if (v === 2) {
      const a = t.ri(2, 12) * 50, p = t.ri(4, 20), w = t.ri(1, 10) * 50;
      const r = (a * p) / (a + w);
      if (Math.abs(r * 10 - Math.round(r * 10)) > 1e-9) continue;
      return { q: `<p>${p}%の食塩水${a}gに水を${w}g加えると、何%の食塩水になるか。</p>`,
        ...choices(t, r, [(p * w) / (a + w), p / 2, p - (w / 100), r + 1], (x) => `${fmt1(x)}%`, nearInt(r, 0.5)),
        expl: `食塩 = ${a} × ${p}% = ${fmt1((a * p) / 100)}g（水を加えても変わらない）<br>${fmt1((a * p) / 100)} ÷ ${a + w} = <b>${fmt1(r)}%</b>` };
    }
    const a = t.ri(2, 12) * 50, p = t.ri(2, 15), q = p + t.ri(2, 10);
    const x = (a * (q - p)) / (100 - q);
    if (!Number.isInteger(x) || x <= 0) continue;
    return { q: `<p>${p}%の食塩水${a}gに食塩を何g加えると、${q}%の食塩水になるか。</p>`,
      ...choices(t, x, [(a * (q - p)) / 100, (a * q) / 100, x + 5, x - 5], (y) => `${fmt1(y)}g`, nearInt(x, 5)),
      expl: `加える食塩を x g とすると (${fmt1((a * p) / 100)} + x) ÷ (${a} + x) = ${q}/100<br>→ x = ${a} × (${q} − ${p}) ÷ (100 − ${q}) = <b>${x}g</b><br><i>Adding salt also increases the total weight.</i>` };
  }
  throw new Error("conc");
}

// ---------------------------------------------------------------- 集合・場合の数・確率
function gen_sets(t) {
  for (let i = 0; i < 500; i++) {
    const N = t.ri(5, 30) * 10, x = t.ri(Math.floor(N * 0.3), Math.floor(N * 0.8)), y = t.ri(Math.floor(N * 0.3), Math.floor(N * 0.8));
    const z = t.ri(Math.max(0, x + y - N), Math.min(x, y));
    const neither = N - x - y + z;
    if (neither < 1 || z < 1) continue;
    const v = t.ri(1, 3);
    if (v === 1) return { q: `<p>${N}人にアンケートを行った。犬を飼っている人は${x}人、猫を飼っている人は${y}人、両方飼っている人は${z}人だった。どちらも飼っていない人は何人か。</p>`,
      ...choices(t, neither, [N - x - y + 2 * z, N - x - y + z + z, Math.abs(N - x - y), neither + z], (n) => `${n}人`, nearInt(neither, 3)),
      expl: `少なくとも一方 = ${x} + ${y} − ${z} = ${x + y - z}人<br>どちらもない = ${N} − ${x + y - z} = <b>${neither}人</b><br><i>Draw a Venn diagram; the overlap is counted twice in x + y.</i>` };
    if (v === 2) return { q: `<p>${N}人にアンケートを行った。犬を飼っている人は${x}人、猫を飼っている人は${y}人、どちらも飼っていない人は${neither}人だった。両方飼っている人は何人か。</p>`,
      ...choices(t, z, [x + y - N, N - neither - x, z + neither, Math.abs(x - y)], (n) => `${n}人`, nearInt(z, 2)),
      expl: `少なくとも一方 = ${N} − ${neither} = ${N - neither}人<br>両方 = ${x} + ${y} − ${N - neither} = <b>${z}人</b>` };
    return { q: `<p>${N}人にアンケートを行った。犬を飼っている人は${x}人、猫を飼っている人は${y}人、両方飼っている人は${z}人だった。犬だけを飼っている人は何人か。</p>`,
      ...choices(t, x - z, [x, x - y + z, y - z, x + y - 2 * z], (n) => `${n}人`, nearInt(x - z, 2)),
      expl: `犬だけ = 犬 − 両方 = ${x} − ${z} = <b>${x - z}人</b>` };
  }
  throw new Error("sets");
}

function gen_comb(t) {
  const v = t.ri(1, 4);
  if (v === 1) {
    const n = t.ri(5, 10), r = t.ri(2, 4);
    const ans = C(n, r);
    return { q: `<p>${n}人の中から${r}人の委員を選ぶ。選び方は何通りあるか。</p>`,
      ...choices(t, ans, [P(n, r), n * r, C(n, r - 1), C(n + 1, r)], (x) => `${x}通り`, nearInt(ans, 5)),
      expl: `順番を区別しないので組合せ：<sub>${n}</sub>C<sub>${r}</sub> = ${P(n, r)} ÷ ${fact(r)} = <b>${ans}通り</b><br><i>Order doesn't matter → C. Order matters (roles) → P.</i>` };
  }
  if (v === 2) {
    const n = t.ri(4, 9), r = t.ri(2, 3);
    const roles = r === 2 ? "委員長と副委員長を1人ずつ" : "委員長・副委員長・書記を1人ずつ";
    const ans = P(n, r);
    return { q: `<p>${n}人の中から${roles}選ぶ。選び方は何通りあるか。</p>`,
      ...choices(t, ans, [C(n, r), n ** r, P(n, r) / 2, ans + n], (x) => `${x}通り`, nearInt(ans, 6)),
      expl: `役職を区別するので順列：<sub>${n}</sub>P<sub>${r}</sub> = <b>${ans}通り</b>` };
  }
  if (v === 3) {
    const n = t.ri(4, 6);
    const ans = fact(n - 1) * 2;
    return { q: `<p>A、Bを含む${n}人が1列に並ぶ。AとBが隣り合う並び方は何通りあるか。</p>`,
      ...choices(t, ans, [fact(n - 1), fact(n), fact(n) - ans, fact(n - 2) * 2], (x) => `${x}通り`, nearInt(ans, 12)),
      expl: `AとBをひとまとめにして ${n - 1} 個を並べる：${n - 1}! = ${fact(n - 1)}通り<br>まとまりの中で AB / BA の 2 通り → ${fact(n - 1)} × 2 = <b>${ans}通り</b>` };
  }
  const m = t.ri(3, 6), w = t.ri(2, 5), r = t.ri(2, 3);
  const ans = C(m + w, r) - C(m, r);
  return { q: `<p>男子${m}人、女子${w}人の中から${r}人を選ぶ。女子が少なくとも1人含まれる選び方は何通りあるか。</p>`,
    ...choices(t, ans, [C(m + w, r), w * C(m + w - 1, r - 1), C(w, r), ans - C(m, r)], (x) => `${x}通り`, nearInt(ans, 4)),
    expl: `全体 <sub>${m + w}</sub>C<sub>${r}</sub> = ${C(m + w, r)} から、男子だけの <sub>${m}</sub>C<sub>${r}</sub> = ${C(m, r)} を引く → <b>${ans}通り</b><br><i>"少なくとも1人" → total − none.</i>` };
}

function gen_prob(t) {
  const v = t.ri(1, 4);
  if (v === 1) {
    const s = t.ri(3, 11);
    let cnt = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === s) cnt++;
    return { q: `<p>大小2つのサイコロを同時に投げるとき、出た目の和が${s}になる確率はどれか。</p>`,
      ...choices(t, frac(cnt, 36), [frac(cnt + 1, 36), frac(cnt, 12), frac(Math.max(cnt - 1, 1), 36), frac(1, s), frac(cnt, 21)], (x) => x, padFrac(37)),
      expl: `目の出方は全部で 6 × 6 = 36 通り。和が${s}になるのは ${cnt} 通り → <b>${frac(cnt, 36)}</b><br><i>Big and small dice are different: (1,2) and (2,1) both count.</i>` };
  }
  if (v === 2) {
    const r = t.ri(3, 7), w = t.ri(2, 6), n = r + w;
    return { q: `<p>袋の中に赤玉${r}個、白玉${w}個が入っている。同時に2個取り出すとき、2個とも赤玉である確率はどれか。</p>`,
      ...choices(t, frac(C(r, 2), C(n, 2)), [frac(r * r, n * n), frac(r, n), frac(r * w, C(n, 2)), frac(C(w, 2), C(n, 2)), frac(r - 1, n - 1)], (x) => x, padFrac(C(n, 2) + 1)),
      expl: `${r}/${n} × ${r - 1}/${n - 1} = <b>${frac(C(r, 2), C(n, 2))}</b>（または <sub>${r}</sub>C<sub>2</sub> ÷ <sub>${n}</sub>C<sub>2</sub>）<br><i>Without replacement: the second draw has one fewer ball.</i>` };
  }
  if (v === 3) {
    const n = t.ri(2, 5);
    return { q: `<p>1枚の硬貨を${n}回投げるとき、少なくとも1回表が出る確率はどれか。</p>`,
      ...choices(t, frac(2 ** n - 1, 2 ** n), [frac(1, 2 ** n), frac(n, 2 ** n), frac(1, 2), frac(2 ** n - 2, 2 ** n), frac(n - 1, n)], (x) => x, padFrac(2 ** n + 1)),
      expl: `「少なくとも1回」は 1 − (すべて裏) = 1 − 1/${2 ** n} = <b>${frac(2 ** n - 1, 2 ** n)}</b>` };
  }
  const r = t.ri(2, 6), w = t.ri(2, 6), n = r + w;
  return { q: `<p>袋の中に赤玉${r}個、白玉${w}個が入っている。同時に2個取り出すとき、赤玉と白玉が1個ずつである確率はどれか。</p>`,
    ...choices(t, frac(r * w, C(n, 2)), [frac(r * w, n * n), frac(r * w, n * (n - 1)), frac(2 * r * w, n * n), frac(C(r, 2), C(n, 2)), frac(1, 2)], (x) => x, padFrac(C(n, 2) + 1)),
    expl: `組合せ：${r} × ${w} = ${r * w} 通り ÷ <sub>${n}</sub>C<sub>2</sub> = ${C(n, 2)} → <b>${frac(r * w, C(n, 2))}</b><br><i>Order-based: 赤→白 + 白→赤 = 2 × ${r}/${n} × ${w}/${n - 1}, same answer.</i>` };
}

// ---------------------------------------------------------------- 表・平均
function gen_average(t) {
  const v = t.ri(1, 3);
  for (let i = 0; i < 2000; i++) {
    if (v === 1) {
      const n = t.ri(4, 12), m = t.ri(55, 80), k = t.ri(30, 100);
      const s = n * m + k;
      if (s % (n + 1)) continue;
      const ans = s / (n + 1);
      if (ans === m) continue;
      return { q: `<p>${n}人のテストの平均点は${m}点だった。ここに${k}点の人が1人加わると、平均点は何点になるか。</p>`,
        ...choices(t, ans, [(m + k) / 2, m + (k - m) / n, ans + 1, ans - 1], (x) => `${fmt1(x)}点`, nearInt(ans, 1)),
        expl: `合計 = ${n} × ${m} + ${k} = ${s}点<br>平均 = ${s} ÷ ${n + 1} = <b>${ans}点</b>` };
    }
    if (v === 2) {
      const m = t.ri(60, 80), m2 = m + t.ri(1, 4);
      const x = 5 * m2 - 4 * m;
      if (x > 100) continue;
      return { q: `<p>Aさんの4回のテストの平均点は${m}点である。5回目のテストで何点を取れば、5回の平均点が${m2}点になるか。</p>`,
        ...choices(t, x, [m2 + (m2 - m), 4 * m2 - 3 * m, x - 5, x + 5], (y) => `${y}点`, nearInt(x, 2)),
        expl: `5回の合計 = ${m2} × 5 = ${5 * m2}点、4回の合計 = ${m} × 4 = ${4 * m}点<br>5回目 = ${5 * m2} − ${4 * m} = <b>${x}点</b>` };
    }
    const n1 = t.ri(10, 40), n2 = t.ri(10, 40), a1 = t.ri(55, 85), a2 = t.ri(55, 85);
    const s = n1 * a1 + n2 * a2;
    if (s % (n1 + n2) || a1 === a2) continue;
    const ans = s / (n1 + n2);
    return { q: `<p>1組${n1}人の平均点は${a1}点、2組${n2}人の平均点は${a2}点だった。2つの組を合わせた平均点は何点か。</p>`,
      ...choices(t, ans, [(a1 + a2) / 2, ans + 1, ans - 1, ans + 2], (x) => `${fmt1(x)}点`, nearInt(ans, 1)),
      expl: `合計 = ${n1} × ${a1} + ${n2} × ${a2} = ${s}点<br>平均 = ${s} ÷ ${n1 + n2} = <b>${ans}点</b><br><i>Weight each class by its size; (${a1}+${a2})/2 is only right when the classes are equal.</i>` };
  }
  throw new Error("average");
}

function gen_table(t) {
  const stores = ["A店", "B店", "C店"], months = ["6月", "7月", "8月"];
  const data = stores.map(() => months.map(() => t.ri(12, 98) * 10));
  const head = `<table class="dt"><thead><tr><th>売上（万円）</th>${months.map((m) => `<th>${m}</th>`).join("")}</tr></thead><tbody>${stores.map((s, i) => `<tr><th>${s}</th>${data[i].map((x) => `<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const total = data.flat().reduce((a, b) => a + b, 0);
  const v = t.ri(1, 2);
  if (v === 1) {
    const si = t.ri(0, 2);
    const st = data[si].reduce((a, b) => a + b, 0);
    const ans = Math.round((st / total) * 100);
    return { q: `<p>次の表は、ある会社の3店舗の売上を示している。</p>${head}<p>3か月の合計で、${stores[si]}の売上は全店の売上の何%か。（小数点以下を四捨五入）</p>`,
      ...choices(t, ans, [Math.round((data[si][0] / total) * 100), Math.round((st / (total - st)) * 100), ans + 3, ans - 3], (x) => `${x}%`, nearInt(ans, 2)),
      expl: `${stores[si]}の合計 = ${data[si].join(" + ")} = ${st}<br>全店の合計 = ${total}<br>${st} ÷ ${total} = ${(st / total * 100).toFixed(1)}% → <b>${ans}%</b><br><i>Estimate first (about 1/3 = 33%), then pick the choice closest to your estimate.</i>` };
  }
  const m6 = data.reduce((a, r) => a + r[0], 0), m8 = data.reduce((a, r) => a + r[2], 0);
  const ans = Math.round((m8 / m6) * 10) / 10;
  return { q: `<p>次の表は、ある会社の3店舗の売上を示している。</p>${head}<p>全店の8月の売上は、6月の売上の何倍か。（小数第2位を四捨五入）</p>`,
    ...choices(t, ans, [Math.round((m6 / m8) * 10) / 10, ans + 0.2, ans - 0.2, ans + 0.1], (x) => `${x.toFixed(1)}倍`, nearInt(ans, 0.3)),
    expl: `6月の全店 = ${m6}、8月の全店 = ${m8}<br>${m8} ÷ ${m6} = ${(m8 / m6).toFixed(3)} → <b>${ans.toFixed(1)}倍</b>` };
}


// ---------------------------------------------------------------- added for the study guide
function gen_suiron_avg(t) {
  for (let i = 0; i < 2000; i++) {
    const n = t.ri(3, 5), avg = t.ri(55, 85), k = n - 1, avg2 = avg + t.ri(-8, 8);
    const x = n * avg - k * avg2;
    if (avg2 === avg || x < 20 || x > 100) continue;
    const names = PEOPLE.slice(0, n), last = names[n - 1];
    return { q: `<p>${names.join("、")}の${n}人のテストの平均点は${avg}点で、${names.slice(0, k).join("、")}の${k}人の平均点は${avg2}点だった。${last}の得点は何点か。</p>`,
      ...choices(t, x, [avg - (avg2 - avg), avg2, n * avg - avg2, x + k], (y) => `${y}点`, nearInt(x, 3)),
      expl: `${n}人の合計 = ${avg} × ${n} = ${n * avg}点<br>${k}人の合計 = ${avg2} × ${k} = ${k * avg2}点<br>${last} = ${n * avg} − ${k * avg2} = <b>${x}点</b><br><i>Averages → totals. Subtract the totals, never the averages.</i>` };
  }
  throw new Error("suiron_avg");
}

function gen_tsurukame(t) {
  for (let i = 0; i < 2000; i++) {
    const a = t.ri(5, 15) * 10, b = a + t.ri(2, 10) * 10, N = t.ri(8, 25), nb = t.ri(1, N - 1);
    const T = nb * b + (N - nb) * a;
    return { q: `<p>1個${a}円のりんごと1個${b}円のなしを合わせて${N}個買ったところ、代金は${yen(T)}だった。なしは何個買ったか。</p>`,
      ...choices(t, nb, [N - nb, Math.round(T / b), Math.round(T / (a + b)), nb + 1], (x) => `${x}個`, nearInt(nb, 1)),
      expl: `全部りんごだとすると ${N} × ${a} = ${N * a}円。実際との差 ${T} − ${N * a} = ${T - N * a}円<br>1個をなしに替えるごとに ${b} − ${a} = ${b - a}円増える → ${T - N * a} ÷ ${b - a} = <b>${nb}個</b><br><i>Assume everything is the cheaper item, then trade one at a time.</i>` };
  }
  throw new Error("tsurukame");
}

function gen_age(t) {
  for (let i = 0; i < 3000; i++) {
    const c = t.ri(3, 15), k = t.ri(2, 4), x = t.ri(1, 20), f = k * (c + x) - x;
    if (f > 60 || f - c < 18) continue;
    return { q: `<p>現在、父は${f}歳、子は${c}歳である。父の年齢が子の年齢のちょうど${k}倍になるのは何年後か。</p>`,
      ...choices(t, x, [Math.round((f - c) / k), Math.abs(f - k * c), x + 1, x + 2], (y) => `${y}年後`, nearInt(x, 2)),
      expl: `x年後に ${f} + x = ${k}(${c} + x) → ${f} + x = ${k * c} + ${k}x → ${f - k * c} = ${k - 1}x → x = <b>${x}年後</b><br><i>Both ages increase by the same x; the age difference (${f - c}) never changes.</i>` };
  }
  throw new Error("age");
}

function gen_flow(t) {
  const r = () => t.pick([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
  const v = t.ri(1, 2);
  if (v === 1) {
    const a = r(), b = r(), c = r();
    const opts = [`W = ${dec(a * c)}X + ${dec(b * c)}Y`, `W = ${dec(a + c)}X + ${dec(b + c)}Y`, `W = ${dec(a * c)}X + ${dec(b)}Y`, `W = ${dec(c)}(X + Y)`, `W = ${dec(a * b * c)}(X + Y)`];
    const uniq = [...new Set(opts)];
    if (uniq.length < 5) return gen_flow(t);
    const ch = choices(t, 0, [1, 2, 3, 4], (i) => opts[i], () => null, true);
    return { q: `<p>ある物資が次の経路で運ばれる。矢印の数字は、送り元の量のうち送り先に運ばれる割合を表す。</p><p class="flow">X ──${a}──▶ Z<br>Y ──${b}──▶ Z<br>Z ──${c}──▶ W</p><p>Wに届く量を X と Y で表した式はどれか。</p>`, ...ch,
      expl: `Z = ${a}X + ${b}Y<br>W = ${c} × Z = ${c}(${a}X + ${b}Y) = <b>${dec(a * c)}X + ${dec(b * c)}Y</b><br><i>Along one path multiply the ratios; where paths meet, add.</i>` };
  }
  const a = r(), b = r(), X = t.ri(2, 20) * 100;
  const W = Math.round(X * a * b);
  return { q: `<p>物資が X ──${a}──▶ Y ──${b}──▶ Z の経路で運ばれる（数字は送り元の量のうち次へ運ばれる割合）。Xから${X}個送り出したとき、Zに届くのは何個か。</p>`,
    ...choices(t, W, [Math.round(X * (a + b)), Math.round(X * a), Math.round(X * b), W + 10], (y) => `${y}個`, nearInt(W, 10)),
    expl: `Z = ${a} × ${b} × X = ${dec(a * b)} × ${X} = <b>${W}個</b>` };
}

function gen_blackbox(t) {
  const dev = [
    { n: "P", d: "入力された2つの数の和を出力する", f: (x, y) => x + y },
    { n: "Q", d: "入力された2つの数のうち大きいほうを出力する", f: (x, y) => Math.max(x, y) },
    { n: "R", d: "入力された2つの数の積を出力する", f: (x, y) => x * y },
    { n: "S", d: "入力された2つの数の差（大きいほうから小さいほうを引いた数）を出力する", f: (x, y) => Math.abs(x - y) },
  ];
  const d1 = t.pick(dev); let d2 = t.pick(dev); while (d2 === d1) d2 = t.pick(dev);
  const a = t.ri(1, 9), b = t.ri(1, 9), c = t.ri(1, 9);
  const mid = d1.f(a, b), out = d2.f(mid, c);
  if (out <= 0) return gen_blackbox(t);
  return { q: `<p>装置${d1.n}は${d1.d}。装置${d2.n}は${d2.d}。</p><p>装置${d1.n}に ${a} と ${b} を入力し、その出力と ${c} を装置${d2.n}に入力した。</p><p class="flow">(${a}, ${b}) → [${d1.n}] → □ ;　(□, ${c}) → [${d2.n}] → ？</p><p>最後に出力される数はいくつか。</p>`,
    ...choices(t, out, [d1.f(d2.f(a, b), c), d2.f(a, b) + c, mid, out + 1], (y) => String(y), nearInt(out, 2)),
    expl: `${d1.n}(${a}, ${b}) = ${mid}<br>${d2.n}(${mid}, ${c}) = <b>${out}</b><br><i>Work left to right; write each device's output on the diagram.</i>` };
}

function gen_zenka(t) {
  const P0 = t.ri(5, 30) * 1000, r = t.pick([5, 10, 20]), add = t.ri(1, 10) * 100, n = t.ri(2, 3);
  let p = P0; const steps = [];
  for (let k = 1; k <= n; k++) { const np = p * (1 + r / 100) + add; steps.push(`${k}年後 = ${fmt1(p)} × ${1 + r / 100} + ${add} = ${fmt1(np)}`); p = np; }
  if (Math.abs(p - Math.round(p)) > 1e-9) return gen_zenka(t);
  const wrong1 = P0 * (1 + (r * n) / 100) + add * n;
  return { q: `<p>ある町の人口は、毎年「前年の人口の${r}%増加し、さらに${add}人の転入がある」とする。今年の人口が${P0.toLocaleString()}人のとき、${n}年後の人口は何人か。</p>`,
    ...choices(t, p, [wrong1, P0 * (1 + r / 100) ** n, p - add, p + add], (y) => `${Math.round(y).toLocaleString()}人`, nearInt(p, 100)),
    expl: `${steps.join("<br>")}<br>→ <b>${Math.round(p).toLocaleString()}人</b><br><i>Apply the rule one year at a time; the % growth also applies to last year's new arrivals.</i>` };
}

function gen_region_count(t) {
  for (let i = 0; i < 2000; i++) {
    const pa = t.ri(1, 3) * 100, pb = t.ri(2, 5) * 100, B = t.ri(8, 20) * 100, mx = t.ri(1, 3), my = t.ri(1, 2);
    let cnt = 0;
    for (let x = mx; x <= 50; x++) for (let y = my; y <= 50; y++) if (pa * x + pb * y <= B) cnt++;
    if (cnt < 3 || cnt > 25) continue;
    return { q: `<p>1個${pa}円の商品Aと1個${pb}円の商品Bを、合計${yen(B)}以内で買う。Aは${mx}個以上、Bは${my}個以上買うとき、買い方（Aの個数とBの個数の組み合わせ）は何通りあるか。</p>`,
      ...choices(t, cnt, [cnt + 1, cnt - 1, cnt + 2, cnt + 3], (y) => `${y}通り`, nearInt(cnt, 1)),
      expl: `条件：${pa}x + ${pb}y ≤ ${B}、x ≥ ${mx}、y ≥ ${my}<br>${(() => { const rows = []; for (let y = my; y <= 50; y++) { const xs = []; for (let x = mx; x <= 50; x++) if (pa * x + pb * y <= B) xs.push(x); if (!xs.length) break; rows.push(`y = ${y}：x = ${xs[0]}〜${xs[xs.length - 1]}（${xs.length}通り）`); } return rows.join("<br>"); })()}<br>合計 <b>${cnt}通り</b><br><i>Fix one variable (B's count) and count the other; this is what the region in the graph means.</i>` };
  }
  throw new Error("region_count");
}

function gen_comb2(t) {
  const v = t.ri(1, 3);
  if (v === 1) {
    const n = t.ri(4, 7), ans = fact(n - 1);
    return { q: `<p>${n}人が円形のテーブルに座る。座り方は何通りあるか（回転して同じになる座り方は1通りと数える）。</p>`,
      ...choices(t, ans, [fact(n), fact(n - 1) / 2, fact(n - 2), ans * 2], (x) => `${x}通り`, nearInt(ans, 6)),
      expl: `1人の位置を固定し、残り${n - 1}人を並べる：(${n} − 1)! = <b>${ans}通り</b><br><i>Circle: fix one person, then line up the rest.</i>` };
  }
  if (v === 2) {
    const k = t.ri(2, 5), r = t.ri(2, 4), ans = k ** r;
    return { q: `<p>${k}種類の記号から、同じものをくり返し使ってよいものとして、${r}個並べて暗号を作る。暗号は何通りできるか。</p>`,
      ...choices(t, ans, [P(k, Math.min(r, k)) || k * r, k * r, r ** k === ans ? null : r ** k, C(k + r - 1, r)], (x) => `${x}通り`, nearInt(ans, 4)),
      expl: `各位置に${k}通りずつ：${k}<sup>${r}</sup> = <b>${ans}通り</b><br><i>Repetition allowed → multiply the same number each time.</i>` };
  }
  const n = t.ri(5, 8), a = t.ri(2, Math.floor(n / 2));
  const b = n - a, eq = a === b;
  const ans = eq ? C(n, a) / 2 : C(n, a);
  return { q: `<p>${n}人を${a}人のグループと${b}人のグループに分ける。分け方は何通りあるか。${eq ? "（2つのグループは区別しない）" : ""}</p>`,
    ...choices(t, ans, [eq ? C(n, a) : C(n, a) * 2, P(n, a), C(n, a) + C(n, b), ans + n], (x) => `${x}通り`, nearInt(ans, 5)),
    expl: `${a}人を選べば残りが自動的にもう一方：<sub>${n}</sub>C<sub>${a}</sub> = ${C(n, a)}${eq ? `<br>同じ人数のグループは区別しないので ÷ 2 → <b>${ans}通り</b>` : `通り → <b>${ans}通り</b>`}<br><i>Choosing one group fixes the other; equal-size groups are counted twice, so halve.</i>` };
}

const TOPICS = [
  { id: "suiron_order", name: "推論（順位）", group: "推論", gen: gen_suiron_order, note: "Place exact clues first (〜位だった, すぐ下). Then branch on the remaining cases and cross out impossible ones. Draw boxes 1〜5." },
  { id: "suiron_truth", name: "推論（正誤）", group: "推論", gen: gen_suiron_truth, note: "List every order that fits. 必ず正しい = true in ALL orders; one counter-example makes it 「とは限らない」." },
  { id: "percent", name: "割合", group: "割合・比", gen: gen_percent, note: "part = whole × rate. whole = part ÷ rate. 増加率 = (new − old) ÷ old." },
  { id: "ratio", name: "比", group: "割合・比", gen: gen_ratio, note: "A = total × a/(a+b). To join A:B and B:C, make B equal using the LCM." },
  { id: "profit", name: "損益算", group: "割合・比", gen: gen_profit, note: "定価 = 原価 × (1 + 利益率). 売価 = 定価 × (1 − 割引率). 利益 = 売価 − 原価. Never add/subtract the percentages directly." },
  { id: "discount", name: "料金の割引", group: "料金", gen: gen_discount, note: "Split people into bands (full price / discounted) and add each band separately." },
  { id: "settle", name: "代金の精算", group: "料金", gen: gen_settle, note: "Fair share = total ÷ people. Each person's balance = paid − share. Two people: the payer gives half the difference." },
  { id: "installment", name: "分割払い", group: "料金", gen: gen_installment, note: "Work in fractions of the total (= 1). 「残額の1/n」 is a fraction of what is left." },
  { id: "speed", name: "速さ", group: "速さ・仕事", gen: gen_speed, note: "距離 = 速さ × 時間. Convert units first: 時速 x km = 分速 x×1000/60 m. Round-trip average = total distance ÷ total time." },
  { id: "travel", name: "旅人算", group: "速さ・仕事", gen: gen_travel, note: "Opposite directions: gap closes at a + b. Same direction: gap changes at a − b. Time = gap ÷ (closing speed)." },
  { id: "work", name: "仕事算", group: "速さ・仕事", gen: gen_work, note: "Total work = 1 (or the LCM of the days). Per-day rates add: 1/x + 1/y. Time = 1 ÷ combined rate." },
  { id: "conc", name: "濃度算", group: "速さ・仕事", gen: gen_conc, note: "食塩 = 食塩水 × 濃度. Add amounts of salt, then ÷ total weight. Water changes the weight only; added salt changes both." },
  { id: "sets", name: "集合", group: "集合・場合", gen: gen_sets, note: "A or B = A + B − both. Neither = total − (A or B). Draw the Venn diagram." },
  { id: "comb", name: "場合の数", group: "集合・場合", gen: gen_comb, note: "Order matters (roles, lines) → nPr. Order doesn't (committees) → nCr. 「少なくとも」 → total − none. Neighbours → glue them as one block, ×2." },
  { id: "prob", name: "確率", group: "集合・場合", gen: gen_prob, note: "Probability = favourable ÷ all. 「少なくとも1回」 = 1 − (never). Without replacement: the denominator shrinks." },
  { id: "average", name: "平均", group: "表・平均", gen: gen_average, note: "Work with totals: total = average × count. Combined average = combined total ÷ combined count." },
  { id: "table", name: "表の読み取り", group: "表・平均", gen: gen_table, note: "Find exactly which cells the question needs. Estimate before computing; choices are often far apart." },
  { id: "suiron_avg", name: "推論（平均）", group: "推論", gen: gen_suiron_avg, note: "" },
  { id: "tsurukame", name: "鶴亀算", group: "特殊算", gen: gen_tsurukame, note: "" },
  { id: "age", name: "年齢算", group: "特殊算", gen: gen_age, note: "" },
  { id: "flow", name: "物の流れと比率", group: "ペーパー", gen: gen_flow, note: "" },
  { id: "blackbox", name: "ブラックボックス", group: "ペーパー", gen: gen_blackbox, note: "" },
  { id: "zenka", name: "漸化式（増え方のルール）", group: "ペーパー", gen: gen_zenka, note: "" },
  { id: "region_count", name: "条件と領域", group: "ペーパー", gen: gen_region_count, note: "" },
  { id: "comb2", name: "場合の数（円・重複・組分け）", group: "集合・場合", gen: gen_comb2, note: "" },
];

function makeQuestion(topicId, seed) {
  const topic = TOPICS.find((x) => x.id === topicId);
  const t = tools(rngFrom(seed));
  const q = topic.gen(t);
  return { topic: topicId, seed, ...q };
}

