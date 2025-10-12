document.addEventListener('DOMContentLoaded', () => {
  // ---------- DOM ----------
  const form           = document.getElementById('adaptationForm');
  const tasksContainer = document.getElementById('tasksContainer');
  const addBtn         = document.querySelector('.add-task-btn');
  const resetBtn       = document.getElementById('resetToDefault');
  const exportBtn      = document.getElementById('downloadAdaptationPlan');

  // блок должности - теперь используем select вместо input
  const positionSelect     = document.getElementById('positionSelect');
  const createNewPlanBtn   = document.getElementById('createNewPlanBtn');

  // Сайдбар
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
    const pos = (positionSelect.value || '').trim();
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

  // ---------- Шаблонные задачи ----------
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
      const titleOnly  = stripTaskPrefix(legendText);
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
    try {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const employees = await res.json();
      
      const positions = [...new Set(employees
        .map(emp => emp.name)
        .filter(Boolean)
        .sort())];
      
      return positions;
    } catch (error) {
      console.error("Ошибка загрузки должностей:", error);
      return [];
    }
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

  function renderPositionsSelect(positions) {
    const options = ['<option value="">— выберите должность —</option>']
      .concat(positions.map(pos => 
        `<option value="${pos.replace(/"/g, '&quot;')}">${pos}</option>`
      ));
    
    positionSelect.innerHTML = options.join("");
  }

  // ---------- Загрузка должностей и инициализация ----------
  async function loadPositions() {
    try {
      const positions = await fetchPositionsList();
      renderPositionsSelect(positions);
      
      // Восстанавливаем сохраненную позицию если есть
      const savedPosition = getSavedPosition();
      if (savedPosition) {
        positionSelect.value = savedPosition;
        await loadPlanForPosition(savedPosition);
      }
      
    } catch (error) {
      console.error("Ошибка загрузки должностей:", error);
    }
  }

  function getSavedPosition() {
    try {
      // Пробуем найти последнюю использованную позицию
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(DRAFT_NS)) {
          const draft = JSON.parse(localStorage.getItem(key));
          if (draft && draft.position) {
            return draft.position;
          }
        }
      }
    } catch (_) {}
    return null;
  }

  // ---------- Обработчики событий ----------
  tasksContainer.addEventListener('input', saveDraft);

  addBtn?.addEventListener('click', () => {
    addOneTaskByTemplate();
    saveDraft();
  });

  // Обработчик изменения выбора должности
  positionSelect?.addEventListener('change', async function() {
    const pos = (this.value || '').trim();
    if (pos) {
      await loadPlanForPosition(pos);
    } else {
      // Если выбрана пустая опция, очищаем форму
      renderTasks([]);
    }
  });

  createNewPlanBtn?.addEventListener('click', () => {
    const pos = (positionSelect.value || '').trim();
    if (!pos) {
      alert('Выберите должность для нового плана.');
      positionSelect.focus();
      return;
    }
    clearDraft(pos);
    renderTasks(DEFAULT_TASKS);
    alert('Новый план для выбранной должности создан. Заполните и нажмите «Сохранить план».');
  });

  async function loadPlanForPosition(position) {
    const draft = loadDraftFor(position);
    if (draft?.tasks?.length) { 
      renderTasks(draft.tasks); 
      return; 
    }

    const plan = await fetchPlanByPosition(position).catch(() => null);
    if (plan && Array.isArray(plan.tasks) && plan.tasks.length) {
      renderTasks(plan.tasks);
    } else {
      renderTasks(DEFAULT_TASKS);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pos = (positionSelect.value || '').trim();
    if (!pos) { 
      alert('Сначала выберите должность.'); 
      positionSelect.focus(); 
      return; 
    }
    const tasks = collectTasksFromDOM();
    try {
      await upsertPlan(pos, tasks);
      clearDraft(pos);
      alert('План сохранён для должности: ' + pos);
    } catch (err) {
      console.error('SAVE ERROR:', err);
      alert('Не удалось сохранить план.\n' + String(err.message || err));
    }
  });

  resetBtn?.addEventListener('click', () => {
    const pos = (positionSelect.value || '').trim();
    if (!confirm('Вернуть исходный шаблон из 10 задач? Текущий черновик будет очищен' + (pos ? ` для должности «${pos}»` : '') + '.')) return;
    clearDraft(pos);
    renderTasks(DEFAULT_TASKS);
  });

  exportBtn?.addEventListener('click', () => {
    const tasks = collectTasksFromDOM();
    const html  = buildAdaptationPlanDocHTML(tasks, (positionSelect.value||'').trim());
    const datePart = new Date().toISOString().slice(0,10).replaceAll('-', '.');
    const posSlug = (positionSelect.value||'').trim().replace(/[^\w\-]+/g,'_') || 'без_должности';
    downloadDoc(html, `Адаптационный_план_${posSlug}_${datePart}.doc`);
  });

  // ---------- Инициализация ----------
  (async function init() {
    await loadPositions();
    
    // Если нет сохраненной позиции, загружаем шаблон по умолчанию
    if (!positionSelect.value) {
      renderTasks(DEFAULT_TASKS);
    }
  })();

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