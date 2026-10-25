'use strict';
// ===== 1) Học từ qua câu ví dụ (danh sách từ vựng HSK 3.0, mỗi từ 1 câu ví dụ) =====
// ===== 2) Bài tập ngữ pháp bổ sung cho từng bài của giáo trình =====
const GROUP = 20;                         // số câu mỗi nhóm
const SENTS = {};                         // book -> [câu]
Object.entries(DATA.vocab || {}).forEach(([bk, rows]) => {
  SENTS[bk] = rows.map(r => {
    const core = r.hz.replace(/（[^）]*）?/g, '').replace(/\([^)]*\)/g, '');
    const keys = [core, ...core.split(/[…｜/、]/)].filter(k => k && k.length);
    return { ...r, id: `S${r.level}|${r.no}`, sent: true, book: bk, core, group: Math.floor((r.no - 1) / GROUP),
      key: keys.find(k => r.ex.zh.includes(k)) || null };
  });
  SENTS[bk].forEach(w => { if (w.core.length > 1) DICT.add(w.core); });
});
const sentItems = () => SENTS[book()] || [];
const levelName = b => (b === 'hsk3' ? 'HSK 3' : 'HSK 4') + ' (chuẩn 3.0)';
// Câu ví dụ, tô đậm từ đang học
function sentMarked(w) {
  const zh = w.ex.zh;
  if (!w.key) return esc(zh);
  const i = zh.indexOf(w.key);
  return esc(zh.slice(0, i)) + `<mark>${esc(w.key)}</mark>` + esc(zh.slice(i + w.key.length));
}
function fillSentCard(w) {
  $('cardCat').textContent = `${levelName(w.book)} · nhóm ${w.group + 1} · từ số ${w.no}`;
  $('cardWord').innerHTML = sentMarked(w);
  $('cardPyFront').textContent = state.settings.front === 'hzpy' ? w.ex.py : '';
  $('cardPy').textContent = w.ex.py;
  $('cardMean').textContent = w.ex.vi;
  $('cardHV').innerHTML = `<span class="zh">${esc(w.hz)}</span> ${esc(w.py)} — ${esc(w.vi)}`;
  $('cardEx').innerHTML = '';
  const inBook = WORDS.filter(o => o.full === w.core);
  $('cardRelated').innerHTML = inBook.length
    ? `<div class="muted">📘 Từ này có trong giáo trình: ${inBook.map(o => `${BOOK_NAMES[o.book]} bài ${o.lesson}`).join(', ')}</div>` : '';
}

// ----- Trang "Câu ví dụ" -----
let sentOpen = null;   // nhóm đang mở
function renderSent() {
  const items = sentItems();
  if (sentOpen && sentOpen.book !== book()) sentOpen = null;
  $('sentHome').classList.toggle('hidden', !!sentOpen);
  $('sentGroup').classList.toggle('hidden', !sentOpen);
  if (sentOpen) return renderSentGroup();
  $('sentLevel').textContent = levelName(book());
  const learned = items.filter(isLearned).length, due = items.filter(isDue).length, weak = items.filter(isWeak).length;
  $('sentStats').textContent = `${items.length} từ, mỗi từ một câu ví dụ · đã học ${learned} câu · cần ôn ${due} · hay sai ${weak}`;
  $('sentBar').style.width = (items.length ? learned / items.length * 100 : 0) + '%';
  const g = nextSentGroup();
  $('sentNextInfo').textContent = g == null ? 'Đã học hết — chuyển sang ôn tập' : `Nhóm ${g + 1}: ${groupLabel(g)}`;
  $('sentReviewInfo').textContent = due ? `${due} câu đến hạn ôn hôm nay` : 'Chưa có câu nào cần ôn';
  const n = Math.ceil(items.length / GROUP);
  $('sentGroups').innerHTML = Array.from({ length: n }, (_, k) => {
    const ws = items.filter(w => w.group === k), done = ws.filter(isLearned).length;
    return `<button class="lesson-tile${k === g ? ' current' : ''}" data-g="${k}"><b>Nhóm ${k + 1}</b>
      <span class="zh">${esc(ws[0].hz)} → ${esc(ws[ws.length - 1].hz)}</span>
      <div class="muted">${done}/${ws.length} câu</div><div class="bar"><div style="width:${done / ws.length * 100}%"></div></div></button>`;
  }).join('');
}
const groupLabel = k => { const ws = sentItems().filter(w => w.group === k); return `${ws[0].hz} → ${ws[ws.length - 1].hz}`; };
function nextSentGroup() {
  const w = sentItems().find(x => !isLearned(x));
  return w ? w.group : null;
}
function renderSentGroup() {
  const ws = sentItems().filter(w => w.group === sentOpen.g);
  $('sentGTitle').textContent = `Nhóm ${sentOpen.g + 1}: ${groupLabel(sentOpen.g)}`;
  $('sentGSub').textContent = `${levelName(book())} · đã học ${ws.filter(isLearned).length}/${ws.length} câu`;
  $('sentList').innerHTML = ws.map(w => `<div class="sent-row">
      <div class="sent-w"><span class="zh">${esc(w.hz)}</span> <span class="py">${esc(w.py)}</span> <span class="muted">— ${esc(w.vi)}</span> ${statusBadge(w)}</div>
      <div class="sent-zh zh">${sentMarked(w)} <button class="mini-speak" data-say="${esc(w.ex.zh)}">🔊</button></div>
      <div class="lpy">${esc(w.ex.py)}</div><div class="lvi">${esc(w.ex.vi)}</div></div>`).join('');
  applySentToggles();
}
function applySentToggles() {
  document.querySelectorAll('#sentList .lpy').forEach(e => e.classList.toggle('hidden', !$('sentShowPy').checked));
  document.querySelectorAll('#sentList .lvi').forEach(e => e.classList.toggle('hidden', !$('sentShowVi').checked));
}
['sentShowPy', 'sentShowVi'].forEach(id => $(id).addEventListener('change', applySentToggles));
$('sentGroups').addEventListener('click', e => {
  const b = e.target.closest('[data-g]');
  if (!b) return;
  sentOpen = { book: book(), g: Number(b.dataset.g) };
  renderSent();
  window.scrollTo(0, 0);
});
$('sentBack').addEventListener('click', () => { sentOpen = null; renderSent(); });
function studySentGroup(k) {
  const ws = sentItems().filter(w => w.group === k);
  const fresh = ws.filter(w => !isLearned(w));
  startSession(fresh.length ? fresh : ws, `Câu ví dụ · nhóm ${k + 1}${fresh.length ? '' : ' (học lại)'}`, 'sent');
}
$('sentGStudy').addEventListener('click', () => studySentGroup(sentOpen.g));
$('sentGTest').addEventListener('click', () => startSentTest(sentItems().filter(w => w.group === sentOpen.g), 20));
$('sentNext').addEventListener('click', () => {
  const g = nextSentGroup();
  if (g == null) return toast('Bạn đã học hết các câu 🎉 — hãy ôn và kiểm tra nhé');
  studySentGroup(g);
});
$('sentReview').addEventListener('click', () => {
  const ws = shuffle(sentItems().filter(isDue));
  if (!ws.length) return toast('Chưa có câu nào cần ôn hôm nay');
  startSession(ws, 'Ôn câu ví dụ', 'sent');
});
$('sentTestBtn').addEventListener('click', () => $('sentTest').classList.toggle('hidden'));
$('sentTestStart').addEventListener('click', () => {
  const sc = $('sentScope').value, items = sentItems();
  const pool = sc === 'learned' ? items.filter(isLearned) : sc === 'weak' ? items.filter(isWeak) : sc === 'due' ? items.filter(isDue) : items;
  if (!pool.length) return ($('sentMsg').textContent = sc === 'all' ? 'Chưa có dữ liệu.' : 'Chưa có câu nào trong phạm vi này — hãy học vài nhóm trước, hoặc chọn “Tất cả các câu”.');
  $('sentMsg').textContent = '';
  startSentTest(pool, Number($('sentNum').value));
});

// ----- Câu hỏi về câu ví dụ -----
function sentDistract(w, n, get, ok = () => true) {
  const items = sentItems(), out = [], seen = new Set([get(w)]);
  for (const o of [...shuffle(items.filter(x => x.group === w.group)), ...shuffle(items.slice())]) {
    if (out.length >= n) break;
    const v = get(o);
    if (o === w || !v || seen.has(v) || !ok(o)) continue;
    seen.add(v);
    out.push(o);
  }
  return out;
}
function sentQuestion(type, w) {
  const explain = `<div class="zh">${sentMarked(w)} <button class="mini-speak" data-say="${esc(w.ex.zh)}">🔊</button></div>
    <div class="lpy">${esc(w.ex.py)}</div><div>${esc(w.ex.vi)}</div>
    <div class="muted">Từ: <span class="zh">${esc(w.hz)}</span> ${esc(w.py)} — ${esc(w.vi)}</div>`;
  const base = { gen: true, type, say: w.ex.zh, explain, onResult: ok => recordAnswer(w, ok),
    wrongHtml: `<span class="zh">${esc(w.ex.zh)}</span> — ${esc(w.ex.vi)}` };
  const pick = (right, wrongs, label, cls) => {
    const opts = shuffle([right, ...wrongs]);
    return { ...base, cls, opts: opts.map(label), ai: opts.indexOf(right) };
  };
  if (type === 'sfill' || type === 'spick') {
    if (!w.key) return null;
    const ds = sentDistract(w, 3, o => o.key, o => o.key && o.key.length === w.key.length && !w.ex.zh.includes(o.key));
    if (ds.length < 3) return null;
    if (type === 'sfill') {
      const i = w.ex.zh.indexOf(w.key);
      return { ...pick(w.key, ds.map(o => o.key), k => `<span class="zh">${esc(k)}</span>`, 'zh'),
        ask: '选词填空 — Điền từ còn thiếu vào câu ví dụ',
        body: `<div class="q-sent">${esc(w.ex.zh.slice(0, i))}<span class="blank">（　　）</span>${esc(w.ex.zh.slice(i + w.key.length))}</div><div class="muted">${esc(w.ex.vi)}</div>` };
    }
    const i = w.ex.zh.indexOf(w.key), mk = k => w.ex.zh.slice(0, i) + k + w.ex.zh.slice(i + w.key.length);
    return { ...pick(mk(w.key), ds.map(o => mk(o.key)), s => `<span class="zh">${esc(s)}</span>`, 'zh sent'),
      ask: 'Câu nào đúng với nghĩa dưới đây?', body: `<div class="meaning">“${esc(w.ex.vi)}”</div>` };
  }
  if (type === 'smean' || type === 'slisten') {
    const ds = sentDistract(w, 3, o => o.ex.vi);
    if (ds.length < 3) return null;
    const q = pick(w.ex.vi, ds.map(o => o.ex.vi), esc, 'vi');
    if (type === 'smean') return { ...q, ask: 'Câu này nghĩa là gì?', body: `<div class="q-sent">${sentMarked(w)}</div>` };
    return { ...q, ask: '🎧 Nghe câu và chọn nghĩa đúng', autoSay: true, body: '<div class="q-big">🎧</div><div class="muted">Bấm 🔊 để nghe lại</div>' };
  }
  if (type === 'sorder') {
    const c = chunkSentence(w.ex.zh);
    if (!c) return null;
    return { ...base, gen: false, type: 'order', hint: `<div class="meaning">“${esc(w.ex.vi)}”</div>`,
      chunks: c.chunks, end: c.end, pool: shuffle(c.chunks.map((t, i) => ({ t, i }))), built: [] };
  }
  return null;
}
function startSentTest(pool, n) {
  const types = [...document.querySelectorAll('#sentTypes input:checked')].map(i => i.value);
  if (!types.length) types.push('sfill', 'smean', 'spick', 'slisten', 'sorder');
  const ws = shuffle(pool.slice()), qs = [];
  for (let i = 0, guard = 0; qs.length < n && guard < n * 10; i++, guard++) {
    const w = ws[i % ws.length];
    const q = sentQuestion(types[i % types.length], w) || sentQuestion(types[(i + 1) % types.length], w);
    if (q) qs.push(q);
  }
  runPractice(shuffle(qs), () => showView('sent'));
}

// ===== Bài tập ngữ pháp bổ sung =====
const GQ = (DATA.gq || []).map(g => ({ ...g, id: `G|${g.book}|${g.lesson}|${g.no}` }));
const gqStat = g => (state.gstats || {})[g.id];
const GQ_ASK = { choice: '选词填空 — Chọn từ / cấu trúc đúng', correct: 'Chọn câu ĐÚNG ngữ pháp (chỉ 1 câu đúng)',
  trans: 'Chọn câu tiếng Trung đúng với nghĩa', order: '连词成句 — Sắp xếp thành câu đúng' };
function gqTag(g) {
  const gp = GRAMMAR.find(x => x.book === g.book && x.lesson === g.lesson && x.no === g.g);
  return gp ? `📌 Bài ${g.lesson} · ${esc(gp.title_zh)} — ${esc(gp.title_vi)}` : `📌 Bài ${g.lesson} · cách dùng thông dụng`;
}
function gqQuestion(g) {
  const onResult = ok => {
    const s = ((state.gstats ||= {})[g.id] ||= { r: 0, w: 0 });
    if (ok) s.r++; else s.w++;
    s.last = ok ? 1 : 0;
  };
  const tag = `<div class="muted gq-tag">${gqTag(g)}</div>`;
  const tail = `<div class="zh">${esc(g.zh)} <button class="mini-speak" data-say="${esc(g.zh)}">🔊</button></div>
    <div class="lpy">${esc(g.py)}</div><div>${esc(g.vi)}</div><div class="gq-why">💡 ${esc(g.why)}</div>`;
  const base = { gen: true, type: 'gq-' + g.type, gq: g, say: g.zh, onResult, ask: GQ_ASK[g.type],
    wrongHtml: `<span class="zh">${esc(g.zh)}</span> — ${esc(g.vi)}` };
  if (g.type === 'order') {
    return { ...base, gen: false, type: 'order', explain: tail + tag, hint: `<div class="meaning">“${esc(g.vi)}”</div>${tag}`,
      chunks: g.chunks, alts: (g.alts || []).map(x => x.replace(/[。？！?!]+$/, '')), end: g.zh.slice(g.chunks.join('').length), pool: shuffle(g.chunks.map((t, i) => ({ t, i }))), built: [] };
  }
  const perm = shuffle([0, 1, 2, 3]);
  const opts = perm.map(j => g.options[j]), xs = perm.map(j => g.opts[j]);
  const ai = perm.indexOf(g.answer - 1);
  const body = g.type === 'choice'
    ? `<div class="q-sent">${esc(g.q).replace('（　）', '<span class="blank">（　　）</span>')}</div>`
    : g.type === 'trans' ? `<div class="meaning">“${esc(g.q)}”</div>` : '';
  return { ...base, body: body + tag, opts: opts.map(o => esc(o)), ai, cls: g.type === 'choice' ? 'zh' : 'zh sent',
    explain: tail + `<ul class="gq-opts">${xs.map((x, j) => `<li class="${j === ai ? 'ok' : ''}"><b>${j + 1}.</b> ${esc(x)}</li>`).join('')}</ul>` + tag };
}
const lessonGq = (b, l) => GQ.filter(g => g.book === b && g.lesson === l);
function runGq(list, back) { runPractice(shuffle(list.slice()).map(gqQuestion), back); }
// Tab "Bài tập" trong trang bài học + nút luyện dưới mỗi điểm ngữ pháp
function renderLessonEx() {
  const all = lessonGq(book(), openL);
  const backTo = tab => () => { openLesson(openL); setTab(tab); };
  if (!all.length) { $('lsEx').innerHTML = '<p class="muted">Chưa có bài tập cho bài này.</p>'; return; }
  const right = all.filter(g => gqStat(g)?.last === 1).length, wrong = all.filter(g => gqStat(g)?.last === 0);
  const gps = GRAMMAR.filter(x => x.book === book() && x.lesson === openL).sort((a, b) => a.no - b.no);
  const rows = [...gps.map(gp => ({ g: gp.no, name: `${gp.no}. ${gp.title_zh}`, vi: gp.title_vi })), { g: 0, name: 'Cách dùng thông dụng', vi: 'Từ và mẫu câu hay gặp trong bài' }]
    .map(r => ({ ...r, qs: all.filter(q => q.g === r.g) })).filter(r => r.qs.length);
  $('lsEx').innerHTML = `<div class="gq-head">
      <p>📝 <b>${all.length} câu bài tập ngữ pháp</b> soạn thêm (không trùng sách): điền từ, chọn câu đúng, dịch Việt → Trung, sắp xếp câu. Mỗi câu có pinyin, bản dịch và giải thích.</p>
      <p class="muted">Lần làm gần nhất: đúng ${right}/${all.length} câu${wrong.length ? ` · ${wrong.length} câu sai cần làm lại` : ''}.</p>
      <div class="actions"><button class="btn primary" data-gx="all">✍️ Làm tất cả (${all.length} câu)</button>
        ${wrong.length ? `<button class="btn bad" data-gx="wrong">🔁 Làm lại câu sai (${wrong.length})</button>` : ''}</div></div>
    ${rows.map(r => `<div class="gq-row"><div><b class="zh">${esc(r.name)}</b><div class="muted">${esc(r.vi)}</div></div>
      <button class="btn small" data-gx="${r.g}">Luyện ${r.qs.length} câu</button></div>`).join('')}`;
  $('lsEx').onclick = e => {
    const b = e.target.closest('[data-gx]');
    if (!b) return;
    const v = b.dataset.gx;
    runGq(v === 'all' ? all : v === 'wrong' ? wrong : all.filter(q => q.g === Number(v)), backTo('ex'));
  };
  // Nút luyện dưới mỗi thẻ ngữ pháp
  document.querySelectorAll('#lsGrammar .gram').forEach((el, i) => {
    const gp = gps[i];
    const n = gp ? all.filter(q => q.g === gp.no).length : 0;
    if (n) el.insertAdjacentHTML('beforeend', `<button class="btn small gq-btn" data-gp="${gp.no}">✍️ Luyện điểm ngữ pháp này (${n} câu)</button>`);
  });
  $('lsGrammar').onclick = e => {
    const b = e.target.closest('[data-gp]');
    if (b) runGq(all.filter(q => q.g === Number(b.dataset.gp)), backTo('grammar'));
  };
}

// ----- Gắn vào app chính -----
const _xOpenLesson = openLesson;
openLesson = function (n) { _xOpenLesson(n); renderLessonEx(); };
const _xShowView = showView;
showView = function (name) {
  _xShowView(name);
  if (name === 'sent') renderSent();
};
const _xRenderHome = renderHome;
renderHome = function () {
  _xRenderHome();
  const items = sentItems();
  if (!items.length) return;
  const due = items.filter(isDue).length, g = nextSentGroup();
  $('todoBox').appendChild(todoItem('💬 Câu ví dụ ' + levelName(book()),
    due ? `${due} câu đến hạn ôn` : g != null ? `Học nhóm ${g + 1}: ${groupLabel(g)} (20 câu)` : 'Đã học hết — làm bài kiểm tra câu nhé',
    due ? 'Ôn' : 'Học', () => { showView('sent'); (due ? $('sentReview') : $('sentNext')).click(); }));
};
if (currentView === 'home') renderHome();
