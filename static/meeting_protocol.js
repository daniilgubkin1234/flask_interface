// meeting_protocol.js — версия под разметку meeting_protocol.html
document.addEventListener('DOMContentLoaded', () => {
  // ===== DOM refs (по текущей разметке) =====
  const protocolSelector  = document.getElementById('protocolSelector');
  const newBtn            = document.getElementById('newProtocolBtn');
  const deleteBtn         = document.getElementById('deleteProtocolBtn');
  const exportBtn         = document.getElementById('downloadProtocol');

  const form              = document.getElementById('protocolForm');
  const protocolNameInput = document.getElementById('protocolName');
  const dateInput         = document.getElementById('meetingDate');

  // Участники
  const participantsSection = document.getElementById('participantsSection'); // контейнер
  const addParticipantBtn   = document.getElementById('addParticipant');

  // Результаты обсуждения
  const discussionSection   = document.getElementById('discussionResultsSection');
  const addDiscussionBtn    = document.getElementById('addDiscussionResult');

  // Следующие шаги
  const nextStepsTable      = document.getElementById('nextStepsTable');
  const nextStepsTbody      = nextStepsTable.querySelector('tbody');
  const addNextStepBtn      = document.getElementById('addNextStep');
// === ХЭНДЛЕР ГАМБУРГЕРА/САЙДБАРА ===
const sidebarToggleBtn = document.querySelector('.toggle-sidebar');
const sidebar = document.querySelector('.recommendation-block');

if (sidebarToggleBtn && sidebar) {
  // открыть/закрыть по клику на кнопку
  sidebarToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('show');         // CSS: .recommendation-block.show { left: 0 }
    sidebarToggleBtn.classList.toggle('menu-open'); // CSS сдвигает кнопку вправо и вращает иконку
  });

  // клик вне меню — закрыть
  document.addEventListener('click', (e) => {
    if (!sidebar.classList.contains('show')) return;
    const clickInsideSidebar = sidebar.contains(e.target);
    const clickOnToggle = sidebarToggleBtn.contains(e.target);
    if (!clickInsideSidebar && !clickOnToggle) {
      sidebar.classList.remove('show');
      sidebarToggleBtn.classList.remove('menu-open');
    }
  });

  // ESC — закрыть
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('show')) {
      sidebar.classList.remove('show');
      sidebarToggleBtn.classList.remove('menu-open');
    }
  });
}
  // ===== Глобальные =====
  let protocolsList = [];
  let currentProtocolId = null;
  let isDirty = false;
  let draftTimer = null;

  // ===== Константы =====
  const DRAFT_KEY = 'meeting_protocol_draft';
  const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
  const AUTOSAVE_DEBOUNCE_MS = 1000;

  // ===== Утилиты =====
  const esc = (s) => String(s ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'", '&#39;');

  const formatDateRU = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return esc(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth()+1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  };

  const setDirty = () => {
    if (!isDirty) {
      isDirty = true;
      window.onbeforeunload = () => 'Есть несохранённые изменения.';
    }
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, AUTOSAVE_DEBOUNCE_MS);
  };
  const clearDirty = () => {
    isDirty = false;
    window.onbeforeunload = null;
  };

  // ===== Черновик =====
  function saveDraft() {
    const data = collectProtocolData();
    const payload = { ts: Date.now(), data };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(payload)); } catch(_) {}
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch(_) {} }
  function restoreFromDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const { ts, data } = JSON.parse(raw);
      if (!data || !ts) return;
      if (Date.now() - ts > DRAFT_TTL_MS) { clearDraft(); return; }
      if (confirm('Найден несохранённый черновик протокола. Восстановить?')) {
        fillFormFromData(data);
        setTimeout(() => { isDirty = true; }, 0);
      }
    } catch(_) {}
  }

  // ===== API =====
  async function getProtocolsList() {
    const r = await fetch('/get_meeting_protocols_list');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    return Array.isArray(j.protocols) ? j.protocols : [];
  }
  async function getProtocol(id) {
    const r = await fetch(`/get_meeting_protocol/${encodeURIComponent(id)}`);

    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }
  async function saveProtocol(data) {
    const url = data._id ? '/update_meeting_protocol' : '/save_meeting_protocol';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const text = await r.text();
    if (!r.ok) {
      let reason = text;
      try { const j = JSON.parse(text); reason = j.error || j.message || text; } catch {}
      throw new Error(`${r.status} ${r.statusText} — ${reason}`);
    }
    return text ? JSON.parse(text) : {};
  }
  async function deleteProtocol(id) {
    const r = await fetch(`/delete_meeting_protocol/${encodeURIComponent(id)}`, {
  method: 'DELETE'
});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }

  // ===== Список/селектор =====
  function updateProtocolSelector() {
    // сортируем по updated_at/date убыв., затем по имени
    const by = (p) => {
      const u = p.updated_at ? new Date(p.updated_at).getTime() : 0;
      const d = p.date ? new Date(p.date).getTime() : 0;
      return Math.max(u, d);
    };
    const list = [...protocolsList].sort((a, b) => {
      const da = by(a), db = by(b);
      if (db !== da) return db - da;
      return (a.name || '').localeCompare(b.name || '', 'ru', {sensitivity:'base'});
    });

    // сохраняем первую опцию «-- Создать новый протокол --»
    const first = protocolSelector.querySelector('option[value=""]');
    protocolSelector.innerHTML = '';
    const firstOpt = document.createElement('option');
    firstOpt.value = '';
    firstOpt.textContent = first ? first.textContent : '-- Создать новый протокол --';
    protocolSelector.appendChild(firstOpt);

    for (const p of list) {
      const opt = document.createElement('option');
      opt.value = p._id;
      const label = p.title || p.protocolName || (p.date ? `Протокол от ${formatDateRU(p.date)}` : `Протокол ${String(p._id).slice(-5)}`);

      opt.textContent = label;
      protocolSelector.appendChild(opt);
    }
  }

  async function reloadProtocolsListPreserveSelection(keepId) {
    protocolsList = await getProtocolsList();
    updateProtocolSelector();

    if (keepId && protocolsList.some(p => p._id === keepId)) {
      protocolSelector.value = keepId;
      currentProtocolId = keepId;
    } else {
      currentProtocolId = null;
      protocolSelector.value = '';
    }
    updateDeleteButtonState();
  }

  // ===== Сбор/заполнение формы =====
  function collectProtocolData() {
    // Участники (только имя)
    const participants = [];
    participantsSection.querySelectorAll('.participant').forEach(div => {
      const input = div.querySelector('input[type="text"]');
      const name = input?.value.trim() || '';
      if (name) participants.push({ name });
    });

    // Результаты (textarea)
    const discussionResults = [];
    discussionSection.querySelectorAll('.discussion-result').forEach(div => {
      const ta = div.querySelector('textarea');
      const summary = ta?.value.trim() || '';
      if (summary) discussionResults.push({ summary });
    });

    // Шаги (таблица)
    const nextSteps = [];
    nextStepsTbody.querySelectorAll('tr').forEach((tr, idx) => {
      const goal     = tr.querySelector('input[name^="goal_"]')?.value.trim() || '';
      const event    = tr.querySelector('input[name^="event_"]')?.value.trim() || '';
      const task     = tr.querySelector('textarea[name^="task_"]')?.value.trim() || '';
      const executor = tr.querySelector('input[name^="executor_"]')?.value.trim() || '';
      const deadline = tr.querySelector('input[name^="deadline_"]')?.value || '';
      if (goal || event || task || executor || deadline) {
        nextSteps.push({ order: idx + 1, goal, event, work: task, executor, deadline });
      }
    });

    const data = {
  protocolName: protocolNameInput.value.trim(),
  meetingDate: dateInput.value,
  participants,
  discussionResults,
  nextSteps,
};

    if (currentProtocolId) data._id = currentProtocolId;
    return data;
  }

  function fillFormFromData(data) {
    // Название/дата
    protocolNameInput.value = data?.protocolName || '';
if (data?.meetingDate) dateInput.value = data.meetingDate.substring(0,10); else dateInput.value = '';


    // Участники
    // удаляем все .participant, кроме кнопки добавления
    participantsSection.querySelectorAll('.participant').forEach(el => el.remove());
    const participants = Array.isArray(data?.participants) ? data.participants : [];
    if (participants.length === 0) addParticipantRow();
    else participants.forEach(p => addParticipantRow(p));

    // Результаты
    discussionSection.querySelectorAll('.discussion-result').forEach(el => el.remove());
    const results = Array.isArray(data?.discussionResults) ? data.discussionResults : [];
    if (results.length === 0) addDiscussionRow();
    else results.forEach(r => addDiscussionRow(r));

    // Шаги
    nextStepsTbody.innerHTML = '';
    const steps = Array.isArray(data?.nextSteps) ? data.nextSteps : [];
    if (steps.length === 0) addStepRow();
    else steps.sort((a,b) => (a.order||0)-(b.order||0)).forEach(s => addStepRow(s));

    clearDirty();
  }

  // ===== Добавление/удаление строк (под текущий HTML) =====
  function addParticipantRow(p = {}) {
    const idx = participantsSection.querySelectorAll('.participant').length + 1;
    const wrap = document.createElement('div');
    wrap.className = 'participant';

    const label = document.createElement('label');
    label.setAttribute('for', `participant_${idx}`);
    label.textContent = `Участник ${idx}:`;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `participant_${idx}`;
    input.name = `participant_${idx}`;
    input.placeholder = 'Введите имя участника';
    input.required = true;
    input.value = p.name || '';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-participant';
    remove.textContent = '×';

    wrap.append(label, input, remove);
    // вставляем перед кнопкой "Добавить участника"
    addParticipantBtn.before(wrap);
  }

  function addDiscussionRow(r = {}) {
    const idx = discussionSection.querySelectorAll('.discussion-result').length + 1;
    const wrap = document.createElement('div');
    wrap.className = 'discussion-result';

    const label = document.createElement('label');
    label.setAttribute('for', `discussionResult_${idx}`);
    label.textContent = `Результат ${idx}:`;

    const ta = document.createElement('textarea');
    ta.id = `discussionResult_${idx}`;
    ta.name = `discussionResult_${idx}`;
    ta.rows = 3;
    ta.placeholder = 'Введите результат обсуждения';
    ta.required = true;
    ta.value = r.summary || r.topic || '';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-result';
    remove.textContent = '×';

    wrap.append(label, ta, remove);
    addDiscussionBtn.before(wrap);
  }

  function addStepRow(s = {}) {
    const idx = nextStepsTbody.children.length + 1;
    const tr = document.createElement('tr');

    const tdNum = document.createElement('td');
    tdNum.textContent = String(idx);

    const tdGoal = document.createElement('td');
    const goal = document.createElement('input');
    goal.type = 'text';
    goal.name = `goal_${idx}`;
    goal.placeholder = 'Введите задачу';
    goal.value = s.goal || '';
    tdGoal.appendChild(goal);

    const tdEvent = document.createElement('td');
    const ev = document.createElement('input');
    ev.type = 'text';
    ev.name = `event_${idx}`;
    ev.placeholder = 'Введите мероприятие';
    ev.value = s.event || '';
    tdEvent.appendChild(ev);

    const tdTask = document.createElement('td');
    const task = document.createElement('textarea');
    task.rows = 2;
    task.name = `task_${idx}`;
    task.placeholder = 'Введите работу/поручение';
    task.required = true;
    task.value = s.work || s.task || '';
    tdTask.appendChild(task);

    const tdExec = document.createElement('td');
    const executor = document.createElement('input');
    executor.type = 'text';
    executor.name = `executor_${idx}`;
    executor.placeholder = 'Введите исполнителя';
    executor.required = true;
    executor.value = s.executor || '';
    tdExec.appendChild(executor);

    const tdDeadline = document.createElement('td');
    const deadline = document.createElement('input');
    deadline.type = 'date';
    deadline.name = `deadline_${idx}`;
    deadline.required = true;
    deadline.value = s.deadline || '';
    tdDeadline.appendChild(deadline);

    const tdRemove = document.createElement('td');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-step';
    remove.textContent = '×';
    tdRemove.appendChild(remove);

    tr.append(tdNum, tdGoal, tdEvent, tdTask, tdExec, tdDeadline, tdRemove);
    nextStepsTbody.appendChild(tr);
    renumberSteps();
  }

  function renumberSteps() {
    nextStepsTbody.querySelectorAll('tr').forEach((tr, i) => {
      tr.querySelector('td:first-child').textContent = String(i + 1);
      tr.querySelectorAll('input, textarea').forEach(el => {
        if (el.name.startsWith('goal_'))     el.name = `goal_${i+1}`;
        if (el.name.startsWith('event_'))    el.name = `event_${i+1}`;
        if (el.name.startsWith('task_'))     el.name = `task_${i+1}`;
        if (el.name.startsWith('executor_')) el.name = `executor_${i+1}`;
        if (el.name.startsWith('deadline_')) el.name = `deadline_${i+1}`;
      });
    });
  }

  // ===== Делегирование на удаление строк =====
  participantsSection?.addEventListener('click', (e) => {
    if (e.target.closest('.remove-participant')) {
      e.target.closest('.participant')?.remove();
      // перенумеруем подписи «Участник N»
      participantsSection.querySelectorAll('.participant').forEach((div, i) => {
        const label = div.querySelector('label');
        const input = div.querySelector('input[type="text"]');
        const remove = div.querySelector('.remove-participant');
        const newIdx = i + 1;
        if (label) label.setAttribute('for', `participant_${newIdx}`), label.textContent = `Участник ${newIdx}:`;
        if (input) input.id = `participant_${newIdx}`, input.name = `participant_${newIdx}`;
        if (remove) remove.title = 'Удалить участника';
      });
      setDirty();
    }
  });

  discussionSection?.addEventListener('click', (e) => {
    if (e.target.closest('.remove-result')) {
      e.target.closest('.discussion-result')?.remove();
      // перенумеруем «Результат N»
      discussionSection.querySelectorAll('.discussion-result').forEach((div, i) => {
        const label = div.querySelector('label');
        const ta    = div.querySelector('textarea');
        const newIdx = i + 1;
        if (label) label.setAttribute('for', `discussionResult_${newIdx}`), label.textContent = `Результат ${newIdx}:`;
        if (ta)    ta.id = `discussionResult_${newIdx}`, ta.name = `discussionResult_${newIdx}`;
      });
      setDirty();
    }
  });

  nextStepsTbody?.addEventListener('click', (e) => {
    if (e.target.closest('.remove-step')) {
      e.target.closest('tr')?.remove();
      renumberSteps();
      setDirty();
    }
  });

  // ===== Кнопки добавления =====
  addParticipantBtn?.addEventListener('click', () => { addParticipantRow(); setDirty(); });
  addDiscussionBtn?.addEventListener('click', () => { addDiscussionRow(); setDirty(); });
  addNextStepBtn?.addEventListener('click', () => { addStepRow(); setDirty(); });

  // ===== Селектор/CRUD =====
  protocolSelector?.addEventListener('change', async () => {
  const id = protocolSelector.value || null;
  if (!id) {
    currentProtocolId = null;
    clearForm();
    clearDirty();
    updateDeleteButtonState();   // ← добавь здесь
    return;
  }
  try {
    const data = await getProtocol(id);
    currentProtocolId = id;
    fillFormFromData(data);
  } catch (e) {
    console.error(e);
    alert('Не удалось загрузить протокол.');
  }
  updateDeleteButtonState();     // ← и здесь
});

  newBtn?.addEventListener('click', () => {
    if (isDirty && !confirm('Есть несохранённые изменения. Всё равно создать новый протокол?')) return;
    currentProtocolId = null;
    protocolSelector.value = '';
    clearForm();
    clearDirty();
    setTimeout(() => restoreFromDraft(), 0);
  });

  deleteBtn?.addEventListener('click', async () => {
    if (!currentProtocolId) return;
    if (!confirm('Удалить выбранный протокол?')) return;
    try {
      await deleteProtocol(currentProtocolId);
      currentProtocolId = null;
      await reloadProtocolsListPreserveSelection(null);
      clearForm();
      clearDirty();
    } catch (e) {
      console.error(e);
      alert('Не удалось удалить протокол.');
    }
  });

  // ===== Сохранение/Экспорт =====
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = collectProtocolData();
      const res = await saveProtocol(data);
      if (!currentProtocolId) {
  currentProtocolId = res.protocol_id || res.plan_id || currentProtocolId;
}
      clearDraft();
      clearDirty();
      await reloadProtocolsListPreserveSelection(currentProtocolId);
      alert('Протокол сохранён.');
    } catch (e) {
      console.error(e);
      alert('Не удалось сохранить протокол.\n' + String(e.message || e));
    }
  });

  exportBtn?.addEventListener('click', () => {
    const data = collectProtocolData();
    const html = buildProtocolDocHTML({
  meetingDate: data.meetingDate,
  protocolName: data.protocolName,
  participants: data.participants,
  discussionResults: data.discussionResults,
  nextSteps: data.nextSteps
});
const datePart = (data.meetingDate || new Date().toISOString()).slice(0,10).replaceAll('-', '.');
const nameSlug = (data.protocolName || 'Протокол').trim().replace(/[^\w\-]+/g,'_');
    downloadDoc(html, `${nameSlug}_${datePart}.doc`);
  });

  // общий ввод → dirty + автосейв черновика
  form?.addEventListener('input', setDirty);

  // ===== Инициализация =====
  (async function init() {
    try {
      await reloadProtocolsListPreserveSelection(null);
      // восстановление черновика только для нового (без id)
      setTimeout(() => {
        if (!currentProtocolId) restoreFromDraft();
      }, 400);
    } catch (e) {
      console.error(e);
      alert('Не удалось загрузить список протоколов.');
    }
  })();

  // ===== Вспомогательные =====
  function clearForm() {
    protocolNameInput.value = '';
    dateInput.value = '';

    // участники: удаляем все .participant и добавляем один пустой
    participantsSection.querySelectorAll('.participant').forEach(el => el.remove());
    addParticipantRow();

    // результаты: удаляем все .discussion-result и добавляем один пустой
    discussionSection.querySelectorAll('.discussion-result').forEach(el => el.remove());
    addDiscussionRow();

    // шаги: очищаем tbody и добавляем одну строку
    nextStepsTbody.innerHTML = '';
    addStepRow();

    updateDeleteButtonState();
  }

  function updateDeleteButtonState() {
    deleteBtn.disabled = !currentProtocolId;
  }

  // ===== Экспорт .doc =====
  function buildProtocolDocHTML({ meetingDate, participants, discussionResults, nextSteps, protocolName }) {
    const rowsParticipants = (participants || []).map((p, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${esc(p.name)}</td>
      </tr>`).join('');

    const rowsResults = (discussionResults || []).map((r, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${esc(r.summary || '')}</td>
      </tr>`).join('');

    const rowsSteps = (nextSteps || []).map((s, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${esc(s.goal || '')}</td>
        <td>${esc(s.event || '')}</td>
        <td>${esc(s.work || '')}</td>
        <td>${esc(s.executor || '')}</td>
        <td>${esc(s.deadline || '')}</td>
      </tr>`).join('');

    const titleBlock = `
      <h1>Протокол совещания</h1>
      ${protocolName ? `<p><b>Название:</b> ${esc(protocolName)}</p>` : ''}
      ${meetingDate ? `<p><b>Дата:</b> ${esc(formatDateRU(meetingDate))}</p>` : ''}
    `;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${esc(protocolName || 'Протокол совещания')}</title>
<style>
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.4; }
  h1 { text-align: center; margin: 0 0 10pt; }
  table { width: 100%; border-collapse: collapse; margin: 10pt 0; }
  th, td { border: 1px solid #000; padding: 6pt; vertical-align: top; }
  th { background: #f2f2f2; }
</style>
</head>
<body>
  ${titleBlock}
  <h2>Участники</h2>
  <table>
    <thead><tr><th>#</th><th>ФИО</th></tr></thead>
    <tbody>${rowsParticipants}</tbody>
  </table>

  <h2>Результаты обсуждения</h2>
  <table>
    <thead><tr><th>#</th><th>Результат</th></tr></thead>
    <tbody>${rowsResults}</tbody>
  </table>

  <h2>Следующие шаги</h2>
  <table>
    <thead><tr><th>#</th><th>Задача</th><th>Мероприятие</th><th>Работа/Поручение</th><th>Исполнитель</th><th>Срок</th></tr></thead>
    <tbody>${rowsSteps}</tbody>
  </table>
</body>
</html>`;
  }

  function downloadDoc(htmlString, filename) {
    const blob = new Blob([htmlString], { type: 'application/msword;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
});
