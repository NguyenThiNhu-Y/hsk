'use strict';

// ===== Cấu hình =====
const INTERVALS = [0, 1, 3, 7, 14, 30]; // box -> số ngày tới lần ôn sau
const STORE_KEY = 'hskapp.v1';
const BOOK_NAMES = { hsk3: 'HSK 3', hsk4: 'HSK 4 (Thượng)' };

// ===== Tiện ích =====
const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStr = () => fmt(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
const isHan = c => /[一-鿿]/.test(c);
const hzCore = hz => hz.replace(/[（(][^)）]*[)）]/g, '').replace(/[…\.\s]/g, '');      // 南(方) -> 南
const hzFull = hz => hz.replace(/[（()）]/g, '').replace(/[…\.\s]/g, '');               // 南(方) -> 南方

// ===== Dữ liệu =====
const LESSONS = DATA.lessons.slice().sort((a, b) => a.book.localeCompare(b.book) || a.lesson - b.lesson);
const TEXTS = DATA.texts;
const GRAMMAR = DATA.grammar;
const ALL_WORDS = [];
const seenId = new Set();
DATA.words.slice().sort((a, b) => a.book.localeCompare(b.book) || a.lesson - b.lesson || a.text - b.text || a.no - b.no)
  .forEach(w => {
    const id = `${w.book}|${w.hz}|${w.py}`;
    if (seenId.has(id)) return;
    seenId.add(id);
    ALL_WORDS.push({ ...w, id, core: hzCore(w.hz), full: hzFull(w.hz) });
  });
const WORDS = ALL_WORDS.filter(w => !w.proper);         // từ dùng để học (bỏ tên riêng)
ALL_WORDS.forEach(w => { w.search = fold([w.hz, w.py, w.py.replace(/\s/g, ''), w.vi, w.hv].join(' ')); });
// Câu ví dụ: câu bài khoá chứa từ (ưu tiên cùng bài), sau đó tới ví dụ ngữ pháp
const LINES = TEXTS.flatMap(t => t.lines.map(l => ({ ...l, book: t.book, lesson: t.lesson, text: t.text })));
const GLINES = GRAMMAR.flatMap(g => (g.examples || []).map(e => ({ ...e, book: g.book, lesson: g.lesson })));
function findExample(w) {
  const keys = [w.full, w.core].filter(k => k && k.length);
  const pick = arr => arr.find(l => keys.some(k => l.zh.includes(k)));
  return pick(LINES.filter(l => l.book === w.book && l.lesson === w.lesson)) || pick(LINES.filter(l => l.book === w.book))
    || pick(GLINES.filter(l => l.book === w.book)) || pick(LINES) || null;
}
ALL_WORDS.forEach(w => { w.ex = findExample(w); });
// Chỉ mục chữ -> các từ chứa chữ đó
const CHAR_INDEX = {};
WORDS.forEach(w => new Set([...w.full].filter(isHan)).forEach(c => (CHAR_INDEX[c] ||= []).push(w)));
const lessonsOf = book => LESSONS.filter(l => l.book === book);
const wordsOf = (book, lesson) => WORDS.filter(w => w.book === book && (lesson == null || w.lesson === lesson));

// ===== Lưu trữ =====
let state = load();
function load() {
  let s;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { s = null; }
  s ||= {};
  s.cards ||= {};
  s.settings ||= {};
  s.settings.book ||= 'hsk3';
  s.settings.front ||= 'hz';
  s.settings.rate ||= '0.9';
  s.log ||= [];
  return s;
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
const book = () => state.settings.book;
const card = w => state.cards[w.id];
const ensureCard = w => (state.cards[w.id] ||= { box: 0, due: null, right: 0, wrong: 0, learned: false });
const isLearned = w => !!card(w)?.learned;
const isWeak = w => { const c = card(w); return !!c && c.wrong > 0 && c.box < 4; };
const isDue = w => { const c = card(w); return !!c && c.learned && c.due && c.due <= todayStr(); };
function currentLesson(b = book()) {
  const ls = lessonsOf(b);
  return (ls.find(l => wordsOf(b, l.lesson).some(w => !isLearned(w))) || ls[ls.length - 1] || {}).lesson || 1;
}
function recordAnswer(w, ok) {
  const c = ensureCard(w);
  if (ok) c.right++;
  else { c.wrong++; if (c.learned) { c.box = 1; c.due = todayStr(); } }
}

// ===== Phát âm (tiếng Trung) =====
let zhVoice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  zhVoice = vs.find(v => v.lang === 'zh-CN') || vs.find(v => /^zh/i.test(v.lang) && !/HK|TW/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text, onend) {
  if (!('speechSynthesis' in window)) return toast('Trình duyệt không hỗ trợ đọc phát âm');
  const u = new SpeechSynthesisUtterance(hzFull(text));
  u.lang = 'zh-CN';
  if (zhVoice) u.voice = zhVoice;
  u.rate = Number(state.settings.rate) || 0.9;
  if (onend) u.onend = onend;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 2200);
}

// Tô đậm các từ của bài trong câu (từ dài trước)
function highlight(zh, words) {
  const keys = [...new Set(words.flatMap(w => [w.full, w.core]).filter(k => k && k.length))].sort((a, b) => b.length - a.length);
  const marks = new Array(zh.length).fill(false);
  keys.forEach(k => { let i = zh.indexOf(k); while (i >= 0) { for (let j = i; j < i + k.length; j++) marks[j] = true; i = zh.indexOf(k, i + k.length); } });
  let out = '', open = false;
  [...zh].forEach((ch, i) => {
    if (marks[i] && !open) { out += '<mark>'; open = true; }
    if (!marks[i] && open) { out += '</mark>'; open = false; }
    out += esc(ch);
  });
  return out + (open ? '</mark>' : '');
}
function exampleHtml(ex, w) {
  if (!ex) return '';
  return `<div class="zh">${highlight(ex.zh, [w])} <button class="mini-speak" data-say="${esc(ex.zh)}">🔊</button></div>
    <div class="lpy">${esc(ex.py)}</div><div class="lvi">${esc(ex.vi)}</div>`;
}
// Nút 🔊 dùng chung
document.addEventListener('click', e => {
  const b = e.target.closest('[data-say]');
  if (!b) return;
  e.stopPropagation();
  speak(b.dataset.say);
}, true);

// ===== Điều hướng =====
let currentView = 'home';
function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  $('view-' + name).classList.remove('hidden');
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('#bookSwitch button').forEach(b => b.classList.toggle('active', b.dataset.book === book()));
  if (name === 'home') renderHome();
  if (name === 'lessons') renderLessons();
  if (name === 'list') renderList();
  if (name === 'settings') renderSettings();
  if (name === 'practice') resetPractice();
  window.scrollTo(0, 0);
}
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
$('homeLink').addEventListener('click', () => showView('home'));
document.querySelectorAll('#bookSwitch button').forEach(b => b.addEventListener('click', () => {
  state.settings.book = b.dataset.book;
  save();
  showView(['study', 'lesson'].includes(currentView) ? 'home' : currentView);
}));

// ===== Hôm nay =====
function renderHome() {
  const ws = wordsOf(book());
  const learned = ws.filter(isLearned).length, due = ws.filter(isDue).length, weak = ws.filter(isWeak).length;
  $('statLearned').textContent = learned;
  $('statTotal').textContent = ws.length;
  $('statDue').textContent = due;
  $('statWeak').textContent = weak;
  $('progressBar').style.width = (ws.length ? learned / ws.length * 100 : 0) + '%';
  const exam = state.settings.exam;
  const left = exam ? diffDays(todayStr(), exam) : null;
  $('banner').textContent = `${BOOK_NAMES[book()]} · ${lessonsOf(book()).length} bài · ${ws.length} từ` +
    (left != null ? (left > 0 ? ` · còn ${left} ngày nữa là thi 加油！` : left === 0 ? ' · Hôm nay thi, 加油！' : '') : '');
  const items = [];
  const L = currentLesson();
  const ls = LESSONS.find(l => l.book === book() && l.lesson === L);
  const remain = wordsOf(book(), L).filter(w => !isLearned(w)).length;
  if (ls) items.push(todoItem(`📖 Bài ${L}: <span class="zh">${esc(ls.title_zh)}</span>`,
    `${esc(ls.title_vi)} · ${remain ? remain + ' từ mới chưa học' : 'đã học hết từ mới'}`, 'Vào bài', () => openLesson(L)));
  items.push(todoItem('🔁 Ôn tập', due ? `${due} từ đến hạn ôn hôm nay` : 'Không có từ nào cần ôn — tốt lắm!', 'Ôn', startReview, !due));
  items.push(todoItem('✍️ Luyện tập kiểu đề HSK', weak ? `${weak} từ hay sai đang chờ bạn` : 'Nghĩa, pinyin, nghe, điền từ, sắp xếp câu',
    'Làm', () => showView('practice')));
  $('todoBox').innerHTML = '';
  items.forEach(i => $('todoBox').appendChild(i));
}
function todoItem(title, desc, btnText, onClick, disabled) {
  const el = document.createElement('div');
  el.className = 'todo-item';
  el.innerHTML = `<div><b>${title}</b><p class="muted">${desc}</p></div>`;
  const b = document.createElement('button');
  b.className = 'btn primary';
  b.textContent = btnText;
  b.disabled = !!disabled;
  b.addEventListener('click', onClick);
  el.appendChild(b);
  return el;
}

// ===== Danh sách bài =====
function renderLessons() {
  const cur = currentLesson();
  $('lessonGrid').innerHTML = lessonsOf(book()).map(l => {
    const ws = wordsOf(book(), l.lesson), done = ws.filter(isLearned).length;
    return `<button class="lesson-tile${l.lesson === cur ? ' current' : ''}" data-l="${l.lesson}">
      <b>Bài ${l.lesson}</b><span class="zh">${esc(l.title_zh)}</span><span class="muted">${esc(l.title_vi)}</span>
      <div class="muted">${done}/${ws.length} từ</div><div class="bar"><div style="width:${ws.length ? done / ws.length * 100 : 0}%"></div></div></button>`;
  }).join('');
}
$('lessonGrid').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) openLesson(Number(b.dataset.l)); });

// ===== Chi tiết bài =====
let openL = 1;
function openLesson(n) {
  openL = n;
  const ls = LESSONS.find(l => l.book === book() && l.lesson === n);
  $('lsTitleZh').textContent = `${n}. ${ls.title_zh}`;
  $('lsTitleVi').textContent = `${ls.title_py || ''} — ${ls.title_vi}`;
  const all = ALL_WORDS.filter(w => w.book === book() && w.lesson === n);
  $('lsWords').innerHTML = all.map(w => `<div class="word-row">
      <span class="zh">${esc(w.hz)}</span>
      <div><span class="py">${esc(w.py)}</span> <span class="muted">${esc(w.pos || '')}</span><div class="vi">${esc(w.vi)}${w.proper ? ' <span class="badge b0">tên riêng</span>' : ''}</div>
        <div class="hvs">${esc(w.hv)}</div></div>
      <div>${w.proper ? '' : statusBadge(w)} <button class="mini-speak" data-say="${esc(w.hz)}">🔊</button></div></div>`).join('');
  const lw = all;
  $('lsTextsBody').innerHTML = TEXTS.filter(t => t.book === book() && t.lesson === n).sort((a, b) => a.text - b.text).map(t => `
    <div class="text-block"><h4>课文 ${t.text}　${esc(t.title_zh || '')} <button class="mini-speak" data-play="${t.text}">▶ Nghe cả bài</button></h4>
      <div class="muted">${esc(t.title_vi || '')}</div>
      ${t.lines.map(l => `<div class="line">${l.spk ? `<span class="spk">${esc(l.spk)}：</span>` : ''}<span class="zh">${highlight(l.zh, lw)}</span>
        <button class="mini-speak" data-say="${esc(l.zh)}">🔊</button>
        <div class="lpy">${esc(l.py)}</div><div class="lvi">${esc(l.vi)}</div></div>`).join('')}
    </div>`).join('');
  applyTextToggles();
  $('lsGrammar').innerHTML = GRAMMAR.filter(g => g.book === book() && g.lesson === n).sort((a, b) => a.no - b.no).map(g => `
    <div class="gram"><h4>${g.no}. ${esc(g.title_zh)}</h4><div class="gvi">${esc(g.title_vi)}</div>
      <div>${esc(g.explain).replace(/\n/g, '<br>')}</div>
      ${(g.examples || []).map(e => `<div class="gex"><span class="zh">${esc(e.zh)}</span> <button class="mini-speak" data-say="${esc(e.zh)}">🔊</button>
        <div class="lpy">${esc(e.py)}</div><div class="muted">${esc(e.vi)}</div></div>`).join('')}</div>`).join('') || '<p class="muted">Chưa có dữ liệu ngữ pháp.</p>';
  setTab('words');
  showView('lesson');
}
function setTab(t) {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  $('lsWords').classList.toggle('hidden', t !== 'words');
  $('lsTexts').classList.toggle('hidden', t !== 'texts');
  $('lsGrammar').classList.toggle('hidden', t !== 'grammar');
}
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
function applyTextToggles() {
  document.querySelectorAll('#lsTextsBody .lpy').forEach(e => e.classList.toggle('hidden', !$('showPy').checked));
  document.querySelectorAll('#lsTextsBody .lvi').forEach(e => e.classList.toggle('hidden', !$('showVi').checked));
}
['showPy', 'showVi'].forEach(id => $(id).addEventListener('change', applyTextToggles));
// Nghe cả bài khoá: đọc lần lượt từng câu
$('lsTextsBody').addEventListener('click', e => {
  const b = e.target.closest('[data-play]');
  if (!b) return;
  const t = TEXTS.find(x => x.book === book() && x.lesson === openL && x.text === Number(b.dataset.play));
  let i = 0;
  const next = () => { if (i < t.lines.length) speak(t.lines[i++].zh, next); };
  next();
});
$('backLessons').addEventListener('click', () => showView('lessons'));
$('lsStudy').addEventListener('click', () => startLessonStudy(openL));
$('lsPractice').addEventListener('click', () => { showView('practice'); $('pracScope').value = 'lesson'; $('pracLesson').value = openL; syncScopeUI(); });

// ===== Flashcard =====
let session = null;
function startLessonStudy(n) {
  let ws = wordsOf(book(), n).filter(w => !isLearned(w));
  let title = `Bài ${n} — từ mới`;
  if (!ws.length) { ws = wordsOf(book(), n); title = `Bài ${n} — học lại`; }
  startSession(ws, title);
}
function startReview() {
  const ws = shuffle(wordsOf(book()).filter(isDue));
  if (!ws.length) return toast('Không có từ nào cần ôn hôm nay');
  startSession(ws, 'Ôn tập');
}
function startSession(words, title) {
  session = { queue: words.slice(), total: words.length, done: 0, failed: new Set(), title, history: [], view: null };
  showView('study');
  showCard();
}
function fillCard(w) {
  session.shown = w;
  $('cardCat').textContent = `${BOOK_NAMES[w.book]} · Bài ${w.lesson}${w.pos ? ' · ' + w.pos : ''}`;
  $('cardWord').textContent = w.hz;
  $('cardPyFront').textContent = state.settings.front === 'hzpy' ? w.py : '';
  $('cardPy').textContent = w.py;
  $('cardMean').textContent = w.vi;
  $('cardHV').textContent = w.hv && w.hv !== '-' ? 'Hán Việt: ' + w.hv : '';
  $('cardEx').innerHTML = exampleHtml(w.ex, w);
  $('cardRelated').innerHTML = relatedHtml(w);
}
function relatedHtml(w) {
  return [...new Set([...w.full].filter(isHan))].map(c => {
    const others = (CHAR_INDEX[c] || []).filter(o => o !== w).slice(0, 6);
    return others.length ? `<div><span class="k">${c}</span>${others.map(o => `<span class="chip">${esc(o.hz)} <i>${esc(o.vi.split(/[,;(]/)[0])}</i></span>`).join('')}</div>` : '';
  }).join('');
}
function updateStudyHead() {
  $('studyTitle').textContent = session.title;
  $('studyCount').textContent = `${session.done}/${session.total} · còn ${session.queue.length} thẻ`;
  $('studyBar').style.width = (session.done / session.total * 100) + '%';
  $('prevBtn').disabled = session.view === 0 || !session.history.length;
  $('nextBtn').textContent = session.view === null ? 'Bỏ qua ▶' : 'Sau ▶';
  $('nextBtn').disabled = session.view === null && session.queue.length < 2;
  $('reviewBanner').classList.toggle('hidden', session.view === null);
}
function showCard() {
  const w = session.queue[0];
  if (!w) return finishSession();
  session.view = null;
  session.flipped = false;
  fillCard(w);
  $('cardBack').classList.add('hidden');
  $('flipActions').classList.remove('hidden');
  $('gradeActions').classList.add('hidden');
  updateStudyHead();
}
function showHistoryCard() {
  fillCard(session.history[session.view]);
  $('cardBack').classList.remove('hidden');
  $('flipActions').classList.add('hidden');
  $('gradeActions').classList.add('hidden');
  updateStudyHead();
}
function prevCard() {
  if (!session || !session.history.length) return;
  if (session.view === null) session.view = session.history.length - 1;
  else if (session.view > 0) session.view--;
  else return;
  showHistoryCard();
}
function nextCard() {
  if (!session) return;
  if (session.view !== null) {
    session.view++;
    return session.view >= session.history.length ? showCard() : showHistoryCard();
  }
  if (session.queue.length < 2) return;
  session.queue.push(session.queue.shift());
  toast('Đã bỏ qua — thẻ này sẽ quay lại cuối lượt');
  showCard();
}
function flip() {
  if (!session || session.view !== null || session.flipped) return;
  session.flipped = true;
  $('cardBack').classList.remove('hidden');
  $('flipActions').classList.add('hidden');
  $('gradeActions').classList.remove('hidden');
  if (state.settings.autoSpeak) speak(session.queue[0].hz);
}
function grade(ok) {
  if (!session || session.view !== null || !session.flipped) return;
  const w = session.queue.shift();
  const c = ensureCard(w);
  if (ok) {
    c.box = session.failed.has(w.id) || !c.learned ? 1 : Math.min(c.box + 1, INTERVALS.length - 1);
    c.learned = true;
    c.due = addDays(todayStr(), INTERVALS[c.box]);
    c.right++;
    session.done++;
  } else {
    c.wrong++;
    session.failed.add(w.id);
    session.queue.splice(Math.min(4, session.queue.length), 0, w);
  }
  session.history.push(w);
  save();
  showCard();
}
function finishSession() {
  toast(`Xong ${session.total} thẻ! ${session.failed.size ? session.failed.size + ' từ phải lặp lại — tối nay ôn lại nhé.' : 'Không sai từ nào 🎉'}`);
  session = null;
  showView('home');
}
$('flipBtn').addEventListener('click', flip);
$('card').addEventListener('click', e => { if (!e.target.closest('button')) flip(); });
$('againBtn').addEventListener('click', () => grade(false));
$('goodBtn').addEventListener('click', () => grade(true));
$('prevBtn').addEventListener('click', prevCard);
$('nextBtn').addEventListener('click', nextCard);
$('speakBtn').addEventListener('click', () => session && speak(session.shown.hz));

// ===== Luyện tập =====
// Pinyin: đổi dấu thanh để làm đáp án nhiễu
const TONES = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' };
const TONE_OF = {};
Object.entries(TONES).forEach(([base, t]) => [...t].forEach((c, i) => { TONE_OF[c] = { base, i }; }));
function toneVariants(py) {
  const out = new Set();
  [...py].forEach((ch, i) => {
    const t = TONE_OF[ch];
    if (!t) return;
    [...TONES[t.base], t.base].forEach(alt => { if (alt !== ch) out.add(py.slice(0, i) + alt + py.slice(i + 1)); });
  });
  out.delete(py);
  return [...out];
}
// Tách câu thành cụm từ cho dạng 连词成句 (khớp từ dài nhất theo từ điển)
const EXTRA_WORDS = '我们 你们 他们 她们 什么 怎么 怎么样 为什么 一个 一些 一下 一点儿 一起 没有 可以 已经 因为 所以 但是 虽然 如果 然后 以后 以前 喜欢 知道 时候 现在 今天 明天 昨天 朋友 学生 老师 学校 工作 东西 觉得 这个 那个 这里 那里 这儿 那儿 还是 非常 特别 可能 应该 希望 准备 开始 告诉 问题 时间 地方 电影 电话 中国 汉语 北京 吃饭 睡觉 起床 上班 下班 不是 就是 一定 正在 而且 一直 还有 真的 自己 大家 别人 孩子 妈妈 爸爸 哥哥 姐姐 弟弟 妹妹 丈夫 妻子 医生 医院 商店 飞机 火车 出租车 公司 生日 身体 眼睛 衣服 颜色 天气 下雨 运动 旅游 考试 认识 介绍 帮助 休息 意思 事情 每天 晚上 早上 上午 下午 中午 周末 下次 上次 两个 很多 太多 不错 不要 不用 不会 不能 怎么办 多少 几个 有点儿 有意思 是不是 好不好 一样 比较 最近 刚才 马上 先生 小姐 同学 同事 经理 女儿 儿子 房间 宾馆 机场 饭馆 超市 手机 电脑 电视 水果 苹果 米饭 咖啡 牛奶 鸡蛋 西瓜 面条 学习 练习 回答 回来 回去 出去 进来 进去 起来 下来 上来 过来 过去'.split(' ');
const DICT = new Set([...WORDS.map(w => w.full), ...WORDS.map(w => w.core), ...EXTRA_WORDS].filter(k => k && k.length > 1));
const MAXLEN = Math.max(...[...DICT].map(k => k.length), 2);
function segment(s) {
  const out = [];
  for (let i = 0; i < s.length;) {
    let len = 1;
    for (let L = Math.min(MAXLEN, s.length - i); L > 1; L--) if (DICT.has(s.slice(i, i + L))) { len = L; break; }
    out.push(s.slice(i, i + len));
    i += len;
  }
  return out;
}
function chunkSentence(zh) {
  const body = zh.replace(/[。！？!?…]+$/, '');
  if (/[，、：；“”「」（）。！？!?…\s\d]/.test(body) || body.length < 6 || body.length > 22) return null;
  // Trợ từ / hậu tố dính vào từ đứng trước, không đứng đầu một cụm
  const segs = segment(body).reduce((a, s) => (a.length && /^[儿呢吗吧啊呀]/.test(s) ? a[a.length - 1] += s : a.push(s), a), []);
  const k = Math.max(3, Math.min(5, Math.round(body.length / 3)));
  if (segs.length < k) return null;
  // Chọn k-1 điểm cắt ở ranh giới từ, gần vị trí chia đều nhất
  const bounds = [];
  segs.reduce((pos, s) => { bounds.push(pos + s.length); return pos + s.length; }, 0);
  bounds.pop();
  const cuts = [];
  for (let j = 1; j < k; j++) {
    const ideal = body.length * j / k, last = cuts[cuts.length - 1] || 0;
    const cand = bounds.filter(b => b > last);
    if (!cand.length) break;
    cuts.push(cand.reduce((x, y) => (Math.abs(y - ideal) < Math.abs(x - ideal) ? y : x)));
  }
  const chunks = [0, ...cuts].map((c, j) => body.slice(c, cuts[j] ?? body.length));
  if (chunks.length < 3 || new Set(chunks).size !== chunks.length) return null;
  return { chunks, end: zh.slice(body.length) };
}

let prac = null;
function resetPractice() {
  prac = null;
  $('pracSetup').classList.remove('hidden');
  $('pracRun').classList.add('hidden');
  $('pracDone').classList.add('hidden');
  $('pracMsg').textContent = '';
  $('pracLesson').innerHTML = lessonsOf(book()).map(l => `<option value="${l.lesson}">Bài ${l.lesson}: ${esc(l.title_zh)}</option>`).join('');
  $('pracLesson').value = currentLesson();
  syncScopeUI();
}
function syncScopeUI() { $('pracLessonWrap').classList.toggle('hidden', $('pracScope').value !== 'lesson'); }
$('pracScope').addEventListener('change', syncScopeUI);
function pracPool() {
  const s = $('pracScope').value, ws = wordsOf(book());
  if (s === 'lesson') return { words: wordsOf(book(), Number($('pracLesson').value)), lessons: [Number($('pracLesson').value)] };
  if (s === 'learned') { const w = ws.filter(isLearned); return { words: w, lessons: [...new Set(w.map(x => x.lesson))] }; }
  if (s === 'weak') { const w = ws.filter(isWeak); return { words: w, lessons: [...new Set(w.map(x => x.lesson))] }; }
  return { words: ws, lessons: lessonsOf(book()).map(l => l.lesson) };
}
function distractors(w, n, get, filter = () => true) {
  const out = [], seen = new Set([get(w)]);
  const same = shuffle(WORDS.filter(o => o.book === w.book && o.lesson === w.lesson));
  const other = shuffle(WORDS.filter(o => o.book === w.book));
  for (const o of [...same, ...other, ...shuffle(WORDS.slice())]) {
    if (out.length >= n) break;
    const v = get(o);
    if (o === w || seen.has(v) || !filter(o)) continue;
    seen.add(v);
    out.push(o);
  }
  return out;
}
function makeQuestion(type, w, line) {
  if (type === 'order') {
    const c = chunkSentence(line.zh);
    return c && { type, line, chunks: c.chunks, end: c.end, pool: shuffle(c.chunks.map((t, i) => ({ t, i }))), built: [] };
  }
  const mainVi = x => x.vi.split(/[,;(]/)[0].trim();
  if (type === 'mean') { const ds = distractors(w, 3, mainVi); return { type, w, opts: shuffle([w, ...ds]), label: o => o.vi, cls: '' }; }
  if (type === 'pinyin') {
    const vs = shuffle(toneVariants(w.py)).slice(0, 3);
    const extra = distractors(w, 3 - vs.length, o => o.py, o => o.full.length === w.full.length).map(o => o.py);
    return { type, w, opts: shuffle([w.py, ...vs, ...extra]), label: o => o, ans: w.py, cls: 'py' };
  }
  if (type === 'hanzi' || type === 'listen') {
    const shareChar = o => [...o.full].some(c => w.full.includes(c));
    let ds = distractors(w, 3, o => o.full, o => shareChar(o) && o.full.length === w.full.length);
    if (ds.length < 3) ds = [...ds, ...distractors(w, 3 - ds.length, o => o.full, o => !ds.includes(o) && o.full.length === w.full.length)];
    if (ds.length < 3) ds = [...ds, ...distractors(w, 3 - ds.length, o => o.full, o => !ds.includes(o))];
    return { type, w, opts: shuffle([w, ...ds]), label: o => o.hz, cls: 'zh' };
  }
  if (type === 'fill') {
    if (!w.ex) return null;
    const key = [w.full, w.core].find(k => k && w.ex.zh.includes(k));
    if (!key) return null;
    const ds = distractors(w, 3, o => o.full, o => o.pos === w.pos && !w.ex.zh.includes(o.full));
    const more = ds.length < 3 ? distractors(w, 3 - ds.length, o => o.full, o => !ds.includes(o) && !w.ex.zh.includes(o.full)) : [];
    return { type, w, key, opts: shuffle([w, ...ds, ...more]), label: o => o.hz, cls: 'zh' };
  }
  return null;
}
$('pracStart').addEventListener('click', () => {
  const types = [...document.querySelectorAll('#pracTypes input:checked')].map(i => i.value);
  if (!types.length) return ($('pracMsg').textContent = 'Hãy chọn ít nhất một dạng câu hỏi.');
  const { words, lessons } = pracPool();
  const n = Number($('pracNum').value);
  if (!words.length) return ($('pracMsg').textContent = $('pracScope').value === 'weak' ? 'Chưa có từ hay sai nào — học thêm rồi quay lại nhé!' : 'Chưa có từ nào trong phạm vi này — hãy học vài từ trước.');
  const lines = shuffle(LINES.filter(l => l.book === book() && lessons.includes(l.lesson)));
  const qs = [];
  const wq = shuffle(words.slice());
  let li = 0;
  const nextOrder = () => { while (li < lines.length) { const q = makeQuestion('order', null, lines[li++]); if (q) return q; } return null; };
  for (let i = 0, guard = 0; qs.length < n && guard < n * 20; guard++, i++) {
    const t = types[i % types.length];
    const q = t === 'order' ? nextOrder() : makeQuestion(t, wq[i % wq.length]);
    if (q) qs.push(q);
  }
  if (!qs.length) return ($('pracMsg').textContent = 'Không tạo được câu hỏi cho phạm vi này.');
  prac = { qs: shuffle(qs), i: 0, score: 0, wrong: [] };
  $('pracSetup').classList.add('hidden');
  $('pracRun').classList.remove('hidden');
  showQuestion();
});
const ASK = {
  mean: 'Từ này nghĩa là gì?', pinyin: 'Chọn pinyin đúng (chú ý dấu thanh)', hanzi: 'Chọn chữ Hán đúng',
  listen: '🎧 Nghe và chọn từ bạn nghe được', fill: '选词填空 — Chọn từ điền vào chỗ trống', order: '连词成句 — Sắp xếp thành câu đúng',
};
function showQuestion() {
  const q = prac.qs[prac.i];
  prac.answered = false;
  $('pracProgress').textContent = `Câu ${prac.i + 1}/${prac.qs.length}`;
  $('pracScore').textContent = `Đúng ${prac.score}`;
  $('pracBar').style.width = (prac.i / prac.qs.length * 100) + '%';
  $('qAsk').textContent = ASK[q.type];
  $('qExplain').classList.add('hidden');
  $('qNext').classList.add('hidden');
  $('qSpeak').classList.toggle('hidden', q.type !== 'listen');
  $('qOrder').classList.toggle('hidden', q.type !== 'order');
  $('qChoices').classList.toggle('hidden', q.type === 'order');
  const w = q.w;
  if (q.type === 'mean' || q.type === 'pinyin') $('qBody').innerHTML = `<div class="q-big">${esc(w.hz)}</div>`;
  else if (q.type === 'hanzi') $('qBody').innerHTML = `<div class="py big">${esc(w.py)}</div><div class="meaning">${esc(w.vi)}</div>`;
  else if (q.type === 'listen') { $('qBody').innerHTML = '<div class="q-big">🎧</div><div class="muted">Bấm 🔊 để nghe lại</div>'; speak(w.hz); }
  else if (q.type === 'fill') $('qBody').innerHTML = `<div class="q-sent">${esc(w.ex.zh).replace(esc(q.key), '<span class="blank">（　　）</span>')}</div>`;
  else if (q.type === 'order') {
    $('qBody').innerHTML = `<div class="meaning">“${esc(q.line.vi)}”</div><div class="muted">Bấm lần lượt các cụm từ theo đúng thứ tự (bấm lại cụm đã chọn để bỏ).</div>`;
    renderOrder();
  }
  if (q.type !== 'order') {
    $('qChoices').innerHTML = q.opts.map((o, i) => `<button class="choice ${q.cls}" data-i="${i}">${i + 1}. ${esc(q.label(o))}</button>`).join('');
  }
}
$('qSpeak').addEventListener('click', () => prac && speak(prac.qs[prac.i].w.hz));
$('qChoices').addEventListener('click', e => { const b = e.target.closest('.choice'); if (b) answer(Number(b.dataset.i)); });
function isRight(q, i) { return q.type === 'pinyin' ? q.opts[i] === q.ans : q.opts[i] === q.w; }
function answer(i) {
  if (!prac || prac.answered) return;
  const q = prac.qs[prac.i];
  if (!q || q.type === 'order') return;
  prac.answered = true;
  const ok = isRight(q, i);
  [...$('qChoices').children].forEach((b, j) => { if (isRight(q, j)) b.classList.add('correct'); else if (j === i) b.classList.add('wrong'); });
  finishAnswer(q, ok);
}
function renderOrder() {
  const q = prac.qs[prac.i];
  $('orderBuilt').className = 'order-built';
  $('orderBuilt').innerHTML = q.built.map((p, k) => `<button class="piece" data-b="${k}">${esc(p.t)}</button>`).join('');
  $('orderPool').innerHTML = q.pool.filter(p => !q.built.includes(p)).map(p => `<button class="piece" data-p="${q.pool.indexOf(p)}">${esc(p.t)}</button>`).join('');
}
$('orderPool').addEventListener('click', e => {
  const b = e.target.closest('[data-p]'); if (!b || prac.answered) return;
  prac.qs[prac.i].built.push(prac.qs[prac.i].pool[b.dataset.p]); renderOrder();
});
$('orderBuilt').addEventListener('click', e => {
  const b = e.target.closest('[data-b]'); if (!b || prac.answered) return;
  prac.qs[prac.i].built.splice(Number(b.dataset.b), 1); renderOrder();
});
$('orderReset').addEventListener('click', () => { if (!prac.answered) { prac.qs[prac.i].built = []; renderOrder(); } });
$('orderCheck').addEventListener('click', () => {
  const q = prac.qs[prac.i];
  if (prac.answered) return;
  if (q.built.length < q.chunks.length) return toast('Hãy xếp hết các cụm từ');
  prac.answered = true;
  const ok = q.built.map(p => p.t).join('') === q.chunks.join('');
  $('orderBuilt').classList.add(ok ? 'ok' : 'no');
  finishAnswer(q, ok);
});
function finishAnswer(q, ok) {
  if (ok) prac.score++;
  else prac.wrong.push(q);
  if (q.w) { recordAnswer(q.w, ok); save(); }
  let html = ok ? '✅ Chính xác! ' : '❌ Chưa đúng. ';
  if (q.type === 'order') {
    html += `<div class="zh">${esc(q.line.zh)} <button class="mini-speak" data-say="${esc(q.line.zh)}">🔊</button></div>
      <div class="muted">${esc(q.line.py)}</div><div>${esc(q.line.vi)}</div>`;
  } else {
    const w = q.w;
    html += `<span class="zh">${esc(w.hz)}</span> <b>${esc(w.py)}</b> — ${esc(w.vi)} <button class="mini-speak" data-say="${esc(w.hz)}">🔊</button>
      ${w.hv && w.hv !== '-' ? `<div class="hvs">Hán Việt: ${esc(w.hv)}</div>` : ''}<div class="example">${exampleHtml(w.ex, w)}</div>`;
    if (q.type === 'listen') speak(w.hz);
  }
  $('qExplain').innerHTML = html;
  $('qExplain').classList.remove('hidden');
  $('qNext').classList.remove('hidden');
  $('pracScore').textContent = `Đúng ${prac.score}`;
}
function nextQuestion() {
  if (!prac || !prac.answered) return;
  prac.i++;
  if (prac.i < prac.qs.length) return showQuestion();
  $('pracRun').classList.add('hidden');
  const pct = Math.round(prac.score / prac.qs.length * 100);
  (state.log ||= []).push({ date: todayStr(), book: book(), n: prac.qs.length, score: prac.score });
  state.log = state.log.slice(-30);
  save();
  $('pracDone').innerHTML = `<div class="result-big">${prac.score}/${prac.qs.length} (${pct}%)</div>
    <p style="text-align:center">${pct >= 90 ? '太棒了！Xuất sắc 🎉' : pct >= 70 ? 'Khá tốt, cố thêm chút nữa! 💪' : 'Ôn lại các câu sai rồi làm lại nhé!'}</p>
    ${prac.wrong.length ? '<h3>Các câu làm sai</h3><div class="wrong-list">' + prac.wrong.map(q => q.type === 'order'
      ? `<div><span class="zh">${esc(q.line.zh)}</span> — ${esc(q.line.vi)}</div>`
      : `<div><span class="zh">${esc(q.w.hz)}</span> ${esc(q.w.py)} — ${esc(q.w.vi)}</div>`).join('') + '</div>' : ''}
    <div class="actions">${prac.wrong.length ? '<button class="btn bad" id="pracRetry">Làm lại câu sai</button>' : ''}<button class="btn primary" id="pracAgain">Luyện tiếp</button></div>`;
  $('pracDone').classList.remove('hidden');
  const wrong = prac.wrong;
  $('pracAgain').addEventListener('click', resetPractice);
  if (wrong.length) $('pracRetry').addEventListener('click', () => {
    prac = { qs: shuffle(wrong.map(q => ({ ...q, built: [] }))), i: 0, score: 0, wrong: [] };
    $('pracDone').classList.add('hidden');
    $('pracRun').classList.remove('hidden');
    showQuestion();
  });
}
$('qNext').addEventListener('click', nextQuestion);

// ===== Danh sách từ =====
function statusBadge(w) {
  const c = card(w);
  if (isWeak(w)) return '<span class="badge b1">Hay sai</span>';
  if (!c || !c.learned) return '<span class="badge b0">Chưa học</span>';
  return c.box >= 3 ? '<span class="badge b3">Thuộc</span>' : '<span class="badge b2">Đang học</span>';
}
['search', 'listLesson', 'listFilter'].forEach(id => $(id).addEventListener('input', renderList));
function renderList() {
  const opts = '<option value="">Tất cả bài</option>' + lessonsOf(book()).map(l => `<option value="${l.lesson}">Bài ${l.lesson}</option>`).join('');
  if ($('listLesson').dataset.book !== book()) { $('listLesson').innerHTML = opts; $('listLesson').dataset.book = book(); }
  const q = fold($('search').value.trim()).replace(/\s+/g, ' ');
  const L = $('listLesson').value, f = $('listFilter').value;
  const rows = WORDS.filter(w => w.book === book() && (!L || w.lesson === Number(L)) &&
    (!q || w.search.includes(q) || w.search.includes(q.replace(/\s/g, ''))) &&
    (f === 'all' || (f === 'new' && !isLearned(w)) || (f === 'seen' && isLearned(w)) || (f === 'weak' && isWeak(w))));
  $('listCount').textContent = `${rows.length} từ`;
  let html = '', last = null;
  rows.forEach(w => {
    if (w.lesson !== last) { const ls = LESSONS.find(l => l.book === w.book && l.lesson === w.lesson); html += `<tr class="cat"><td colspan="4">Bài ${w.lesson}: ${esc(ls?.title_zh || '')}</td></tr>`; last = w.lesson; }
    html += `<tr><td class="zh">${esc(w.hz)}<small>${esc(w.py)}</small></td><td>${esc(w.vi)}<br><span class="hvs">${esc(w.hv)}</span></td>
      <td>${statusBadge(w)}</td><td><button data-say="${esc(w.hz)}">🔊</button></td></tr>`;
  });
  $('listBody').innerHTML = html;
}

// ===== Cài đặt =====
function renderSettings() {
  $('setExam').value = state.settings.exam || '';
  $('setFront').value = state.settings.front;
  $('setAutoSpeak').checked = !!state.settings.autoSpeak;
  $('setRate').value = state.settings.rate;
}
$('saveSettings').addEventListener('click', () => {
  state.settings.exam = $('setExam').value || '';
  state.settings.front = $('setFront').value;
  state.settings.autoSpeak = $('setAutoSpeak').checked;
  state.settings.rate = $('setRate').value;
  state.settings.savedAt = Date.now();
  save();
  toast('Đã lưu cài đặt');
});
$('exportBtn').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state)], { type: 'application/json' }));
  a.download = `tien-do-hsk-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$('importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const s = JSON.parse(await file.text());
    if (!s.cards || !s.settings) throw new Error();
    state = typeof mergeStates === 'function' ? mergeStates(s, state) : s;
    save();
    toast('Đã gộp tiến độ từ file');
  } catch (err) { toast('File không hợp lệ'); }
  e.target.value = '';
});
$('resetBtn').addEventListener('click', () => {
  const online = typeof syncUser !== 'undefined' && syncUser;
  if (!confirm(online ? `Xoá toàn bộ tiến độ HSK, cả bản đồng bộ của "${syncUser}"? Không thể hoàn tác.` : 'Xoá toàn bộ tiến độ HSK? Không thể hoàn tác.')) return;
  localStorage.removeItem(STORE_KEY);
  state = load();
  if (online) syncPush(state).catch(() => toast('Không xoá được bản trên mạng'));
  save();
  showView('home');
});

// ===== Phím tắt =====
document.addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (currentView === 'study' && session) {
    if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (session.view !== null) nextCard(); else session.flipped ? grade(true) : flip(); }
    else if (e.key === '1') grade(false);
    else if (e.key === '2') grade(true);
    else if (e.key === 'ArrowLeft') prevCard();
    else if (e.key === 'ArrowRight') nextCard();
  } else if (currentView === 'practice' && prac && !$('pracRun').classList.contains('hidden')) {
    if (/^[1-4]$/.test(e.key)) answer(Number(e.key) - 1);
    else if (e.key === 'Enter') { e.preventDefault(); nextQuestion(); }
  }
});

save();
showView('home');
