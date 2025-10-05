document.addEventListener('DOMContentLoaded', () => {
  // ---------- DOM ----------
  const form           = document.getElementById('adaptationForm');
  const tasksContainer = document.getElementById('tasksContainer');
  const addBtn         = document.querySelector('.add-task-btn');
  const resetBtn       = document.getElementById('resetToDefault');
  const exportBtn      = document.getElementById('downloadAdaptationPlan');

  // блок должности
  const positionInput        = document.getElementById('positionInput');
  const positionListDatalist = document.getElementById('positionList');
  const createNewPlanBtn     = document.getElementById('createNewPlanBtn');
  const loadSelectedPlanBtn  = document.getElementById('loadSelectedPlanBtn');

  // Сайдбар (если есть)
  const toggleBtn = document.querySelector('.toggle-sidebar');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sidebar = document.querySelector('.recommendation-block');
      sidebar?.classList.toggle('show');
      toggleBtn.classList.toggle('menu-open');
    });
    document.addEventListener('click', (e) => {
      const sidebar = document.querySelector('.recommendation-block');
      if (!sidebar) return;
      if (sidebar.classList.contains('show') &&
          !sidebar.contains(e.target) &&
          !toggleBtn.contains(e.target)) {
        sidebar.classList.remove('show');
        toggleBtn.classList.remove('menu-open');
      }
    });
  }

  // ---------- Утилиты ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])
  );
  const stripTaskPrefix = (s) => String(s || '').replace(/^Задача\s*\d+\s*:\s*/i, '').trim();

  // ---------- Черновики per-должность ----------
  const DRAFT_NS = 'ap_draft_v1';
  const draftKey = (position) => `${DRAFT_NS}:${(position||'').toLowerCase().trim()||'__no_position__'}`;

  function saveDraft() {
    const pos = (positionInput.value || '').trim();
    const tasks = collectTasksFromDOM();
    const payload = { position: pos, tasks, updatedAt: Date.now() };
    try { localStorage.setItem(draftKey(pos), JSON.stringify(payload)); } catch(_) {}
  }
  function loadDraftFor(position) {
    try {
      const raw = localStorage.getItem(draftKey(position));
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (Array.isArray(p?.tasks)) return p;
    } catch(_) {}
    return null;
  }
  function clearDraft(position) {
    try { localStorage.removeItem(draftKey(position)); } catch(_) {}
  }

  // ---------- Шаблонные задачи (без "Задача N:" в тексте) ----------
  const DEFAULT_TASKS = [
    'Оформление на работу',
    'Знакомство с коллективом, офисом, оргтехникой',
    'Изучение информации о компании',
    'Изучение стандартов компании',
    'Участие в планерке',
    'Уточнение адаптационного плана',
    'Формирование плана работы на неделю',
    'Просмотр видео-семинаров',
    'Чтение книг из корпоративной библиотеки',
    'Подведение итогов адаптации'
  ].map(title => ({
    title, time:'', resources:'', customTitle:'', feedbackMentor:'', feedbackEmployee:''
  }));

  // ---------- DOM ↔ данные ----------
  function collectTasksFromDOM() {
    return Array.from(tasksContainer.querySelectorAll('fieldset.task')).map((fs) => {
      const legendText = fs.querySelector('legend')?.textContent?.trim() || '';
      const titleOnly  = stripTaskPrefix(legendText); // читаем фиксированный шаблон из легенды
      return {
        title: titleOnly || 'Без названия',
        customTitle: fs.querySelector('input[name$="_custom_title"]')?.value.trim() || '',
        time:        fs.querySelector('input[name$="_time"]')?.value.trim() || '',
        resources:   fs.querySelector('textarea[name$="_resources"]')?.value.trim() || '',
        feedbackMentor:   fs.querySelector('textarea[name$="_summarize_by_mentor"]')?.value.trim() || '',
        feedbackEmployee: fs.querySelector('textarea[name$="_summarize_by_employee"]')?.value.trim() || '',
      };
    });
  }

  function createTaskFieldset(task, index) {
    const fs = document.createElement('fieldset');
    fs.className = 'task';
    // Легенда ИСКЛЮЧИТЕЛЬНО из шаблонного title (НЕ из customTitle)
    const baseTitle = stripTaskPrefix(task.title || 'Без названия');
    fs.innerHTML = `
      <legend>Задача ${index + 1}: ${esc(baseTitle || 'Без названия')}</legend>

      <label for="task${index}_custom_title">Название задачи:</label>
      <input type="text" id="task${index}_custom_title" name="task${index}_custom_title" placeholder="Введите название задачи" value="${esc(task.customTitle || '')}">

      <label for="task${index}_time">Время на подготовку:</label>
      <input type="text" id="task${index}_time" name="task${index}_time" placeholder="Введите время на подготовку" value="${esc(task.time || '')}" required>

      <label for="task${index}_resources">Ресурсы:</label>
      <textarea id="task${index}_resources" name="task${index}_resources" rows="2" placeholder="Введите ресурсы" required>${esc(task.resources || '')}</textarea>

      <label for="task${index}_summarize_by_mentor">Подведение итогов наставником:</label>
      <textarea id="task${index}_summarize_by_mentor" name="task${index}_summarize_by_mentor" rows="2" placeholder="Введите подведение итогов наставником">${esc(task.feedbackMentor || '')}</textarea>

      <label for="task${index}_summarize_by_employee">Подведение итогов сотрудником:</label>
      <textarea id="task${index}_summarize_by_employee" name="task${index}_summarize_by_employee" rows="2" placeholder="Введите подведение итогов сотрудником">${esc(task.feedbackEmployee || '')}</textarea>

      <button type="button" class="delete-task-btn">Удалить задачу</button>
    `;
    return fs;
  }

  function renderTasks(tasks) {
    tasksContainer.innerHTML = '';
    (tasks || [])
      // фиксируем легенды по нашему дефолтному шаблону по индексу
      .map((t, i) => ({ ...t, title: stripTaskPrefix((DEFAULT_TASKS[i]?.title) || t.title) }))
      .forEach((t, i) => tasksContainer.appendChild(createTaskFieldset(t, i)));
    bindDeleteButtons();

    if (!tasksContainer.querySelector('fieldset.task')) {
      renderEmptyState();
    }
  }

  function bindDeleteButtons() {
    tasksContainer.querySelectorAll('.delete-task-btn').forEach(btn => {
      btn.onclick = () => {
        const fs = btn.closest('fieldset.task');
        if (!fs) return;
        fs.remove();
        renumber();
        saveDraft();
        if (!tasksContainer.querySelector('fieldset.task')) {
          renderEmptyState();
        }
      };
    });
  }

  function renumber() {
    tasksContainer.querySelectorAll('fieldset.task').forEach((fs, i) => {
      const legend = fs.querySelector('legend');
      const currentTitle = stripTaskPrefix(legend?.textContent || '') || 'Без названия';
      if (legend) legend.textContent = `Задача ${i + 1}: ${currentTitle}`;

      fs.querySelectorAll('input, textarea, label').forEach(el => {
        if (el.tagName === 'LABEL' && el.htmlFor?.includes('_')) {
          el.htmlFor = el.htmlFor.replace(/task\d+_/g, `task${i}_`);
        }
        if (el.name?.includes('_')) el.name = el.name.replace(/task\d+_/g, `task${i}_`);
        if (el.id?.includes('_'))   el.id   = el.id.replace(/task\d+_/g, `task${i}_`);
      });
    });
  }

  // ---------- Пустое состояние ----------
  function renderEmptyState() {
    if (tasksContainer.querySelector('fieldset.task') || tasksContainer.querySelector('.empty-state')) return;

    const box = document.createElement('div');
    box.className = 'empty-state';
    box.style.cssText = 'border:1px dashed #cbd5e1;padding:16px;border-radius:8px;margin:12px 0;background:#f8fafc;color:#334155';

    box.innerHTML = `
      <div style="font-weight:600;margin-bottom:8px;">Задач пока нет</div>
      <div style="font-size:14px;margin-bottom:12px;">Вы удалили все задачи. Что дальше?</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" id="emptyAddFirst" class="primary-button">+ Добавить первую задачу</button>
        <button type="button" id="emptyRestoreTemplate" class="secondary">Восстановить шаблон (10 задач)</button>
      </div>
    `;
    tasksContainer.appendChild(box);

    box.querySelector('#emptyAddFirst')?.addEventListener('click', () => {
      addOneTaskByTemplate();
      saveDraft();
      box.remove();
    });
    box.querySelector('#emptyRestoreTemplate')?.addEventListener('click', () => {
      renderTasks(DEFAULT_TASKS);
      saveDraft();
    });
  }
  function removeEmptyState() {
    tasksContainer.querySelector('.empty-state')?.remove();
  }

  function addOneTaskByTemplate() {
    removeEmptyState();
    const index = tasksContainer.querySelectorAll('fieldset.task').length;
    const templateTitle = DEFAULT_TASKS[index]?.title || `Новая задача ${index + 1}`;
    const fs = createTaskFieldset(
      { title: templateTitle, time:'', resources:'', customTitle:'', feedbackMentor:'', feedbackEmployee:'' },
      index
    );
    tasksContainer.appendChild(fs);
    renumber();
    bindDeleteButtons();
  }

  // ---------- API ----------
  async function fetchPositionsList() {
    const res = await fetch('/api/adaptation_plans/positions');
    if (!res.ok) return [];
    const data = await res.json().catch(() => ([]));
    return Array.isArray(data) ? data : [];
  }
  async function fetchPlanByPosition(position) {
    const res = await fetch(`/api/adaptation_plans/by_position?position=${encodeURIComponent(position)}`);
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  }
  async function upsertPlan(position, tasks) {
    const res = await fetch('/api/adaptation_plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position, tasks })
    });
    const text = await res.text();
    if (!res.ok) {
      let reason = text;
      try { const j = JSON.parse(text); reason = j.error || j.message || text; } catch {}
      throw new Error(`${res.status} ${res.statusText} — ${reason}`);
    }
    return text ? JSON.parse(text) : {};
  }
  function renderPositionsDatalist(items) {
    const opts = items.filter(Boolean).map(name => `<option value="${esc(name)}"></option>`).join('');
    positionListDatalist.innerHTML = opts;
  }

  // ---------- Boot ----------
  (async function boot() {
    try { renderPositionsDatalist(await fetchPositionsList()); } catch {}

    const initialPos = (positionInput?.value || '').trim();
    if (initialPos) { await loadPlanForPosition(initialPos); return; }

    const draft = loadDraftFor('');
    if (draft?.tasks?.length) { renderTasks(draft.tasks); return; }

    // fallback к старому API (если ещё используется)
    fetch('/get_adaptation_plan')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(tasks => Array.isArray(tasks) && tasks.length ? tasks : DEFAULT_TASKS)
      .then(tasks => renderTasks(tasks))
      .catch(() => renderTasks(DEFAULT_TASKS));
  })();

  // ---------- Действия ----------
  tasksContainer.addEventListener('input', saveDraft);

  addBtn?.addEventListener('click', () => {
    addOneTaskByTemplate();
    saveDraft();
  });

  createNewPlanBtn?.addEventListener('click', () => {
    const pos = (positionInput.value || '').trim();
    if (!pos) {
      alert('Введите наименование должности для нового плана.');
      positionInput.focus();
      return;
    }
    clearDraft(pos);
    renderTasks(DEFAULT_TASKS);
    alert('Новый план для указанной должности создан как черновик. Заполните и нажмите «Сохранить план».');
  });

  loadSelectedPlanBtn?.addEventListener('click', async () => {
    const pos = (positionInput.value || '').trim();
    if (!pos) { alert('Введите/выберите должность.'); return; }
    await loadPlanForPosition(pos);
  });

  async function loadPlanForPosition(position) {
    const draft = loadDraftFor(position);
    if (draft?.tasks?.length) { renderTasks(draft.tasks); return; }

    const plan = await fetchPlanByPosition(position).catch(() => null);
    if (plan && Array.isArray(plan.tasks) && plan.tasks.length) {
      renderTasks(plan.tasks);
    } else {
      renderTasks(DEFAULT_TASKS);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pos = (positionInput.value || '').trim();
    if (!pos) { alert('Сначала укажите должность.'); positionInput.focus(); return; }
    const tasks = collectTasksFromDOM();
    try {
      await upsertPlan(pos, tasks);
      clearDraft(pos);
      try { renderPositionsDatalist(await fetchPositionsList()); } catch {}
      alert('План сохранён для должности: ' + pos);
    } catch (err) {
      console.error('SAVE ERROR:', err);
      alert('Не удалось сохранить план.\n' + String(err.message || err));
    }
  });

  resetBtn?.addEventListener('click', () => {
    const pos = (positionInput.value || '').trim();
    if (!confirm('Вернуть исходный шаблон из 10 задач? Текущий черновик будет очищен' + (pos ? ` для должности «${pos}»` : '') + '.')) return;
    clearDraft(pos);
    renderTasks(DEFAULT_TASKS);
  });

  exportBtn?.addEventListener('click', () => {
    const tasks = collectTasksFromDOM();
    const html  = buildAdaptationPlanDocHTML(tasks, (positionInput.value||'').trim());
    const datePart = new Date().toISOString().slice(0,10).replaceAll('-', '.');
    const posSlug = (positionInput.value||'').trim().replace(/[^\w\-]+/g,'_') || 'без_должности';
    downloadDoc(html, `Адаптационный_план_${posSlug}_${datePart}.doc`);
  });

  // ---------- Экспорт ----------
  function buildAdaptationPlanDocHTML(tasks, position) {
    const esc2 = s => String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
    const rows = (tasks || []).map((t,i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc2(t.customTitle || t.title)}</td>
        <td>${esc2(t.time)}</td>
        <td>${esc2(t.resources)}</td>
        <td>${esc2(t.feedbackMentor)}</td>
        <td>${esc2(t.feedbackEmployee)}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Адаптационный план${position ? ' — ' + esc2(position) : ''}</title>
<style>
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.35; }
  h1   { text-align:center; font-size:18pt; margin:0 0 12pt; }
  table { width:100%; border-collapse:collapse; margin:8pt 0; }
  th, td { border:1px solid #000; padding:6pt; vertical-align:top; }
  th { text-align:center; }
</style>
</head>
<body>
  <h1>Адаптационный план${position ? ' — ' + esc2(position) : ''}</h1>
  <table>
    <thead>
      <tr>
        <th style="width:40px;">№</th>
        <th>Задача</th>
        <th style="width:15%;">Время на подготовку</th>
        <th>Ресурсы</th>
        <th>Итоги наставником</th>
        <th>Итоги сотрудником</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
  }

  function downloadDoc(htmlString, filename) {
    const blob = new Blob([htmlString], { type: "application/msword;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
});
