const DATA_ROOT = 'https://raw.githubusercontent.com/thuypx09/ielts-source-reading/main';
const STORAGE_KEY = 'reading-room-progress-v1';
const EXAMS = Array.from({ length: 100 }, (_, index) => String(index + 1).padStart(2, '0'));
const app = document.querySelector('#app');
let route = { name: 'home' };
let dataCache = new Map();
let progress = loadProgress();
let timerHandle;
let selectedRange = null;
let selectedQuote = '';

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveProgress() { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
function getRecord(id) { return progress[id] ||= { answers: {}, bookmarks: [], notes: {}, highlights: [], seconds: 0, started: false, completed: false }; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }
function norm(value) { return String(value ?? '').toLowerCase().replace(/[“”‘’'.,!?()]/g, '').replace(/\s+/g, ' ').trim(); }
function answersMatch(user, expected) {
  const actual = norm(user);
  return String(expected).split('/').some(option => norm(option) === actual) || norm(expected) === actual;
}
function answeredCount(record) { return Object.values(record.answers || {}).filter(value => String(value).trim()).length; }
function allAnswersProvided(data, record) { return data.answers.passages.flatMap(item => item.answers || []).every(item => String(record.answers[item.question_number] || '').trim()); }
function answerCountForExam(id) { return dataCache.get(id)?.answers?.passages?.flatMap(item => item.answers || []).length || 40; }
function statusFor(id) { const record = getRecord(id); const total = answerCountForExam(id); const count = answeredCount(record); return count >= total ? 'completed' : count ? 'in-progress' : 'not-started'; }
function titleFor(data, fallback) { return data?.passages?.[0]?.passage_title || `Reading Exam ${fallback}`; }
function iconButton(label, action, extra = '') { return `<button class="icon-btn ${extra}" data-action="${action}" aria-label="${label}" title="${label}">${label}</button>`; }
function shell(content, active = 'home') { return `<div class="app-shell"><header class="topbar"><button class="brand" data-action="home"><img class="brand-image" src="Image.jpg" alt="Mai Linh" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span class="brand-mark" hidden>ML</span><span><strong>Mai Linh đang ôn IELTS</strong><small>IELTS reading practice</small></span></button><div class="top-actions">${active === 'home' ? '<button class="ghost-btn" data-action="export">Export progress</button><button class="primary-btn" data-action="import">Import progress</button><input id="import-file" hidden type="file" accept="application/json" />' : '<button class="ghost-btn" data-action="home">← Archive</button>'}</div></header>${content}</div>`; }
function homeView() {
  const query = route.query || '';
  const filter = route.filter || 'all';
  const visible = EXAMS.filter(id => (`reading exam ${id}`).includes(query.toLowerCase()) && (filter === 'all' || statusFor(id) === filter));
  const finished = EXAMS.filter(id => statusFor(id) === 'completed').length;
  const active = EXAMS.filter(id => statusFor(id) === 'in-progress').length;
  return shell(`<main class="content"><div class="toolbar"><label class="search"><span>⌕</span><input data-search placeholder="Find an exam" value="${escapeHtml(query)}" /></label><div class="filters">${[['all','All sets'],['not-started','Not started'],['in-progress','In progress'],['completed','Completed']].map(([key, label]) => `<button class="filter-btn ${filter === key ? 'active' : ''}" data-filter="${key}">${label}</button>`).join('')}</div></div><section class="exam-grid">${visible.length ? visible.map(examCard).join('') : '<div class="empty">No exam sets match that filter.</div>'}</section></main>`);
}
function examCard(id) {
  const record = getRecord(id); const status = statusFor(id); const total = answerCountForExam(id); const count = answeredCount(record); const title = record.title || `Reading Exam ${id}`;
  return `<button class="exam-card" data-exam="${id}"><div><div class="card-top"><span class="card-index">SET / ${id}</span><span class="status ${status}">${status.replace('-', ' ')}</span></div><h3>${escapeHtml(title)}</h3><p>Three passages · 40 questions · 60 minutes</p></div><div class="card-bottom"><span class="progress-track"><span class="progress-fill" style="width:${Math.min(100, count / total * 100)}%"></span></span><span class="progress-label">${count}/${total}</span></div></button>`;
}
async function loadExam(id) {
  if (dataCache.has(id)) return dataCache.get(id);
  const files = ['answers', 'passages', 'questions'];
  const values = await Promise.all(files.map(file => fetch(`${DATA_ROOT}/${id}%20${file}.json`).then(response => { if (!response.ok) throw new Error(`${file} could not be loaded`); return response.json(); })));
  const data = { answers: values[0], passages: values[1], questions: values[2] }; dataCache.set(id, data); return data;
}
async function detailView(id) {
  app.innerHTML = shell('<main class="content"><div class="empty">Loading the reading set...</div></main>');
  try { const data = await loadExam(id); const record = getRecord(id); record.title = titleFor(data, id); saveProgress(); const total = data.answers.passages.flatMap(item => item.answers || []).length; const count = answeredCount(record); const status = statusFor(id); app.innerHTML = shell(`<main class="content detail-layout"><button class="back-link" data-action="home">← Archive</button><section class="detail-panel"><div class="eyebrow">Reading exam / ${id}</div><h1>${escapeHtml(titleFor(data, id))}</h1><div class="detail-head"><span class="status ${status}">${status.replace('-', ' ')}</span><span class="progress-label">${count} of ${total} answered</span></div><div class="detail-meta"><div class="meta-cell"><span>Passages</span><strong>${data.passages.passages.length}</strong></div><div class="meta-cell"><span>Questions</span><strong>${total}</strong></div><div class="meta-cell"><span>Time limit</span><strong>60 min</strong></div></div><div class="card-bottom"><span class="progress-track"><span class="progress-fill" style="width:${count / total * 100}%"></span></span><span class="progress-label">${Math.round(count / total * 100)}%</span></div><div style="margin-top:26px;display:flex;gap:10px;flex-wrap:wrap"><button class="primary-btn" data-action="start" data-id="${id}">${status === 'in-progress' ? 'Continue exam' : status === 'completed' ? 'Review answers' : 'Start exam'}</button>${status === 'completed' ? '<button class="ghost-btn" data-action="result" data-id="' + id + '">View result</button>' : ''}</div><details class="answer-key"><summary>Show answer key</summary><div class="key-grid">${data.answers.passages.flatMap(item => item.answers || []).map(item => `<div class="key-cell"><b>${item.question_number}</b> ${escapeHtml(item.answer)}</div>`).join('')}</div></details></section></main>`, 'detail'); } catch (error) { app.innerHTML = shell(`<main class="content"><div class="empty">${escapeHtml(error.message)}. Check your connection and try again.</div>`, 'detail'); }
}
function passageFor(data, index) { return data.passages.passages[index] || {}; }
function questionsFor(data, index) { return data.questions.passages[index] || {}; }
function questionNumbersForPassage(data, passageIndex) { return (data.answers.passages[passageIndex]?.answers || []).map(item => item.question_number); }
function renderRegularQuestion(question, groupType, record) {
  const number = question.question_number; if (!number) return '';
  const answer = record.answers[number] || ''; const options = groupType === 'TFNG' ? ['TRUE','FALSE','NOT GIVEN'] : groupType === 'YNNG' ? ['YES','NO','NOT GIVEN'] : [];
  return `<article class="question" data-question="${number}"><div class="question-head"><div class="question-copy">${question.question_content_html || ''}</div><button class="bookmark ${record.bookmarks.includes(number) ? 'active' : ''}" data-bookmark="${number}" aria-label="Bookmark question ${number}">★</button></div>${options.length ? `<div class="radio-row">${options.map(option => `<label><input type="radio" name="q-${number}" data-answer="${number}" value="${option}" ${norm(answer) === norm(option) ? 'checked' : ''}>${option}</label>`).join('')}</div>` : `<div class="question-entry"><input class="answer-input" data-answer="${number}" value="${escapeHtml(answer)}" placeholder="Your answer" /></div>`}</article>`;
}
function renderFillQuestion(question, record) {
  let html = question.question_content_html || ''; const numbers = [...html.matchAll(/<strong>\s*(\d+)\s*<\/strong>/g)].map(match => Number(match[1])).filter(Boolean);
  let index = 0; html = html.replace(/<input\s+type="text"\s*\/?\s*>/g, () => { const number = numbers[index++]; const answer = record.answers[number] || ''; return `<input class="inline-answer" data-answer="${number}" value="${escapeHtml(answer)}" placeholder="answer ${number}" />`; });
  const missingInputs = numbers.slice(index).map(number => `<label class="missing-answer">Answer ${number}<input class="inline-answer" data-answer="${number}" value="${escapeHtml(record.answers[number] || '')}" placeholder="answer ${number}" /></label>`).join('');
  return `<article class="question"><div class="question-head"><div class="question-copy fill-copy">${html}${missingInputs}</div><span class="card-index">FILL</span></div></article>`;
}
function examView(id, passageIndex = 0) {
  const data = dataCache.get(id); const record = getRecord(id); const passage = passageFor(data, passageIndex); const questionData = questionsFor(data, passageIndex); const nums = questionNumbersForPassage(data, passageIndex); const seconds = record.seconds || 0; const timerPercent = Math.max(0, Math.min(100, (3600 - seconds) / 36));
  const groups = (questionData.question_groups || []).map(group => `<section class="question-group"><h2>${escapeHtml(group.group_id)}</h2><div class="instruction">${group.group_instruction_html || ''}</div>${(group.questions || []).map(question => group.group_type === 'fill_in_blank' ? renderFillQuestion(question, record) : renderRegularQuestion(question, group.group_type, record)).join('')}</section>`).join('');
  app.innerHTML = `<div class="exam-screen"><header class="exam-header"><div class="exam-controls"><div class="exam-title">Mai Linh đang làm bài <span class="card-index">/ ${id}</span></div><div class="timer"><strong id="timer-value">${formatTime(seconds)}</strong><span class="progress-track"><span class="progress-fill" style="width:${timerPercent}%"></span></span></div><div class="header-actions"><button class="ghost-btn" data-action="exit" data-id="${id}">Save & exit</button><button class="primary-btn" data-action="finish" data-id="${id}">Finish</button></div></div><nav class="passage-tabs">${data.passages.passages.map((item, index) => `<button class="tab ${index === passageIndex ? 'active' : ''}" data-passage="${index}">Passage ${index + 1} · ${escapeHtml(item.passage_title || '')}</button>`).join('')}</nav><nav class="exam-nav">${nums.map(number => `<button class="jump ${record.answers[number] ? 'answered' : ''} ${record.bookmarks.includes(number) ? 'bookmarked' : ''}" data-jump="${number}">${number}${record.bookmarks.includes(number) ? '<span class="nav-star" aria-hidden="true">★</span>' : ''}</button>`).join('')}</nav></header><main class="exam-body"><section class="passage-pane" id="passage-pane"><div class="passage-content"><div class="section-kicker">Reading passage ${passageIndex + 1}</div>${passage.passage_html || '<div class="empty">No passage content available.</div>'}</div></section><section class="questions-pane" id="questions-pane">${groups || '<div class="empty">No questions found for this passage.</div>'}</section></main><div class="selection-tools" id="selection-tools" aria-hidden="true"><button class="tool-btn" data-action="highlight" data-id="${id}">Highlight</button><button class="tool-btn" data-action="selection-note" data-id="${id}">Add note</button><button class="tool-btn danger-btn" data-action="clear-annotation" data-id="${id}">Clear</button><input id="selection-note-input" class="selection-note-input" placeholder="Note about selected text" /></div></div>`;
  restoreAnnotations(id, passageIndex);
  startTimer(id);
}
function formatTime(seconds) { const mins = Math.floor(seconds / 60).toString().padStart(2, '0'); const secs = Math.floor(seconds % 60).toString().padStart(2, '0'); return `${mins}:${secs}`; }
function startTimer(id) { clearInterval(timerHandle); timerHandle = setInterval(() => { const record = getRecord(id); record.seconds = (record.seconds || 0) + 1; saveProgress(); const timer = document.querySelector('#timer-value'); if (timer) timer.textContent = formatTime(record.seconds); }, 1000); }
function resultView(id) { const data = dataCache.get(id); const record = getRecord(id); const answerItems = data.answers.passages.flatMap(item => item.answers || []); const correct = answerItems.filter(item => answersMatch(record.answers[item.question_number], item.answer)).length; const answered = answerItems.filter(item => String(record.answers[item.question_number] || '').trim()).length; const unanswered = answerItems.length - answered; const incorrect = answered - correct; app.innerHTML = shell(`<main class="content"><div class="detail-layout"><button class="back-link" data-action="detail" data-id="${id}">← Exam details</button><section class="detail-panel"><div class="eyebrow">Review / ${id}</div><h1>${correct}/${answerItems.length}<br><em>answers aligned.</em></h1><p style="color:var(--muted)">Compare every response with the answer key below.</p><div class="result-stats"><div><strong>${correct}</strong><span>Correct</span></div><div><strong>${incorrect}</strong><span>Incorrect</span></div><div><strong>${unanswered}</strong><span>Unanswered</span></div></div><details class="answer-comparison" open><summary>Answer comparison</summary><div class="comparison-head"><span>Question</span><span>Your answer</span><span>Answer key</span><span>Result</span></div><div class="comparison-list">${answerItems.map(item => { const user = record.answers[item.question_number] || ''; const isAnswered = Boolean(user.trim()); const isCorrect = isAnswered && answersMatch(user, item.answer); return `<div class="comparison-row ${isCorrect ? 'correct' : isAnswered ? 'incorrect' : 'unanswered'}"><b>${item.question_number}</b><span>${escapeHtml(user || '—')}</span><span>${escapeHtml(item.answer)}</span><strong>${isCorrect ? 'Correct' : isAnswered ? 'Incorrect' : 'Pending'}</strong></div>`; }).join('')}</div></details></section></div></main>`, 'detail'); }
function render() { if (route.name === 'home') app.innerHTML = homeView(); if (route.name === 'detail') detailView(route.id); if (route.name === 'exam') examView(route.id, route.passage); if (route.name === 'result') resultView(route.id); }
function toast(message) { const node = document.createElement('div'); node.className = 'toast'; node.textContent = message; document.body.append(node); setTimeout(() => node.remove(), 2400); }
function applySelection(kind, note = '') {
  if (!selectedRange || !selectedQuote) return;
  const mark = document.createElement('mark'); mark.className = kind === 'note' ? 'text-note' : 'text-highlight'; if (note) mark.title = note;
  let wrapped = false;
  try { mark.appendChild(selectedRange.extractContents()); selectedRange.insertNode(mark); wrapped = true; } catch { wrapped = false; }
  if (!wrapped) {
    const root = document.querySelector('#passage-pane .passage-content');
    const walker = root && document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: node => node.parentElement?.closest('mark') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let node;
    while (walker && (node = walker.nextNode())) {
      const start = node.nodeValue.indexOf(selectedQuote); if (start < 0) continue;
      const selected = node.splitText(start); selected.splitText(selectedQuote.length); mark.textContent = selected.nodeValue; selected.parentNode.replaceChild(mark, selected); wrapped = true; break;
    }
  }
  if (!wrapped) { toast('Select text within one paragraph.'); return; }
  const record = getRecord(route.id); const item = { quote: selectedQuote, note, kind, passage: route.passage }; record.highlights.push(item); if (note) record.notes[Date.now()] = item; saveProgress(); selectedRange = null; selectedQuote = ''; document.querySelector('#selection-tools')?.setAttribute('aria-hidden', 'true'); toast(kind === 'note' ? 'Note attached to the selected text.' : 'Highlight saved.');
}
function clearSelectionAnnotation() {
  if (!selectedQuote) return;
  const root = document.querySelector('#passage-pane .passage-content');
  root?.querySelectorAll('mark').forEach(mark => { if (mark.textContent.includes(selectedQuote)) mark.replaceWith(document.createTextNode(mark.textContent)); });
  const record = getRecord(route.id);
  record.highlights = (record.highlights || []).filter(saved => { const item = typeof saved === 'string' ? { quote: saved } : saved; return !(item.quote === selectedQuote && (item.passage === undefined || item.passage === route.passage)); });
  Object.keys(record.notes || {}).forEach(key => { const note = record.notes[key]; if (typeof note !== 'string' && note.quote === selectedQuote && (note.passage === undefined || note.passage === route.passage)) delete record.notes[key]; });
  saveProgress(); selectedRange = null; selectedQuote = ''; document.querySelector('#selection-tools')?.setAttribute('aria-hidden', 'true'); toast('Annotation cleared.');
}
function closeSelectionTools() { selectedRange = null; selectedQuote = ''; document.querySelector('#selection-tools')?.setAttribute('aria-hidden', 'true'); }
function restoreAnnotations(id, passageIndex) {
  const record = getRecord(id); const root = document.querySelector('#passage-pane .passage-content'); if (!root) return;
  (record.highlights || []).forEach(saved => {
    const item = typeof saved === 'string' ? { quote: saved, kind: 'highlight' } : saved;
    if (!item.quote || (item.passage !== undefined && item.passage !== passageIndex)) return;
    const existing = [...root.querySelectorAll('mark')].find(mark => mark.textContent.includes(item.quote));
    if (existing) { if (item.kind === 'note') { existing.className = 'text-note'; existing.title = item.note || ''; } return; }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: node => node.parentElement?.closest('mark') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let node;
    while ((node = walker.nextNode())) {
      const start = node.nodeValue.indexOf(item.quote); if (start < 0) continue;
      const selected = node.splitText(start); selected.splitText(item.quote.length); const mark = document.createElement('mark'); mark.className = item.kind === 'note' ? 'text-note' : 'text-highlight'; if (item.note) mark.title = item.note; mark.textContent = selected.nodeValue; selected.parentNode.replaceChild(mark, selected); break;
    }
  });
}

document.addEventListener('click', async event => {
  const target = event.target.closest('[data-action], [data-exam], [data-filter], [data-passage], [data-jump], [data-bookmark]'); if (!target) return;
  if (target.dataset.exam) { route = { name: 'detail', id: target.dataset.exam }; render(); return; }
  if (target.dataset.filter) { route = { name: 'home', filter: target.dataset.filter, query: route.query }; render(); return; }
  if (target.dataset.passage !== undefined) { route.passage = Number(target.dataset.passage); render(); return; }
  if (target.dataset.jump) { const node = document.querySelector(`[data-question="${target.dataset.jump}"]`); node?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (target.dataset.bookmark) { const record = getRecord(route.id); const number = Number(target.dataset.bookmark); record.bookmarks = record.bookmarks.includes(number) ? record.bookmarks.filter(item => item !== number) : [...record.bookmarks, number]; saveProgress(); render(); return; }
  const action = target.dataset.action;
  if (action === 'home') { clearInterval(timerHandle); route = { name: 'home' }; render(); }
  if (action === 'start') { route = { name: 'exam', id: target.dataset.id, passage: 0 }; const record = getRecord(target.dataset.id); record.started = true; saveProgress(); render(); }
  if (action === 'continue') { clearInterval(timerHandle); route = { name: 'exam', id: target.dataset.id, passage: 0 }; getRecord(target.dataset.id).started = true; saveProgress(); render(); }
  if (action === 'exit') { clearInterval(timerHandle); route = { name: 'detail', id: target.dataset.id }; render(); }
  if (action === 'detail') { route = { name: 'detail', id: target.dataset.id }; render(); }
  if (action === 'result') { route = { name: 'result', id: target.dataset.id }; render(); }
  if (action === 'finish') { const record = getRecord(target.dataset.id); record.completed = true; saveProgress(); clearInterval(timerHandle); route = { name: 'result', id: target.dataset.id }; render(); }
  if (action === 'highlight') applySelection('highlight');
  if (action === 'selection-note') applySelection('note', document.querySelector('#selection-note-input')?.value.trim());
  if (action === 'clear-annotation') clearSelectionAnnotation();
  if (action === 'close-selection') closeSelectionTools();
  if (action === 'export') { const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'reading-room-progress.json'; link.click(); URL.revokeObjectURL(link.href); }
  if (action === 'import') document.querySelector('#import-file')?.click();
});
document.addEventListener('input', event => { if (event.target.matches('[data-search]')) { route.query = event.target.value; render(); const search = document.querySelector('[data-search]'); search?.focus(); search?.setSelectionRange(route.query.length, route.query.length); return; } if (event.target.matches('[data-answer]')) { const record = getRecord(route.id); record.answers[event.target.dataset.answer] = event.target.value; record.started = true; saveProgress(); event.target.closest('.question')?.classList.add('answered'); updateAnswerNavigation(event.target.dataset.answer); } });
document.addEventListener('change', event => { if (event.target.matches('[data-answer]')) { const record = getRecord(route.id); record.answers[event.target.dataset.answer] = event.target.value; record.started = true; saveProgress(); updateAnswerNavigation(event.target.dataset.answer); } if (event.target.id === 'import-file') { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { progress = JSON.parse(reader.result); saveProgress(); render(); toast('Progress imported.'); } catch { toast('That file is not valid progress JSON.'); } }; reader.readAsText(file); } });
function updateFinishButton() { const data = dataCache.get(route.id); const actions = document.querySelector('.header-actions'); if (!data || !actions) return; const finish = actions.querySelector('[data-action="finish"]'); const shouldShow = allAnswersProvided(data, getRecord(route.id)); if (shouldShow && !finish) actions.insertAdjacentHTML('beforeend', `<button class="primary-btn" data-action="finish" data-id="${route.id}">Finish</button>`); if (!shouldShow && finish) finish.remove(); }
function updateAnswerNavigation(number) { document.querySelectorAll(`.jump[data-jump="${number}"]`).forEach(button => button.classList.toggle('answered', Boolean(getRecord(route.id).answers[number]?.trim()))); }
document.addEventListener('click', event => { const mark = event.target.closest('#passage-pane mark'); if (!mark || route.name !== 'exam') return; selectedQuote = mark.textContent.trim(); selectedRange = document.createRange(); selectedRange.selectNodeContents(mark); const tools = document.querySelector('#selection-tools'); tools?.setAttribute('aria-hidden', 'false'); const rect = mark.getBoundingClientRect(); if (tools) { tools.style.left = `${Math.max(12, Math.min(window.innerWidth - tools.offsetWidth - 12, rect.left))}px`; tools.style.top = `${Math.min(window.innerHeight - tools.offsetHeight - 12, rect.bottom + 8)}px`; } event.stopPropagation(); });
document.addEventListener('click', event => { if (route.name !== 'exam') return; if (event.target.closest('#selection-tools, #passage-pane mark')) return; closeSelectionTools(); });
function captureSelection() { if (route.name !== 'exam') return; const selection = window.getSelection(); const text = selection?.toString().trim(); const anchor = selection?.anchorNode; if (!text || !anchor || !document.querySelector('#passage-pane')?.contains(anchor)) return; selectedRange = selection.getRangeAt(0).cloneRange(); selectedQuote = text; const tools = document.querySelector('#selection-tools'); tools?.setAttribute('aria-hidden', 'false'); const rect = selectedRange.getBoundingClientRect(); if (tools) { tools.style.left = `${Math.max(12, Math.min(window.innerWidth - tools.offsetWidth - 12, rect.left))}px`; tools.style.top = `${Math.min(window.innerHeight - tools.offsetHeight - 12, rect.bottom + 8)}px`; } }
document.addEventListener('mouseup', () => setTimeout(captureSelection, 0));
document.addEventListener('selectionchange', () => setTimeout(captureSelection, 0));
window.addEventListener('beforeunload', () => { clearInterval(timerHandle); saveProgress(); });
render();
