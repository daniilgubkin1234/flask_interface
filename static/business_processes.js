document.addEventListener('DOMContentLoaded', () => {
  /* ---------- DOM-ссылки ---------- */
  const tableBody   = document.querySelector('#bpTable tbody');
  const addRowBtn   = document.getElementById('addRow');
  const submitBtn   = document.getElementById('submitData');
  const diagramBtn  = document.getElementById('buildDiagram');
  const diagramDiv  = document.getElementById('bpmnDiagram');

  /* ---------- util ---------- */
  const esc = txt => (txt || '').replace(/"/g, '\\"');            // экранируем кавычки

  /* ---------- управление таблицей ---------- */
  const addRow = () => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="objectField"  placeholder="Событие"></td>
      <td><input class="actionField"  placeholder="Действие"></td>
      <td><input class="nextObjectsField" placeholder="N2,N3…"></td>
      <td><input class="sentField"   placeholder="Условие"></td>
      <td><input class="sentByField" placeholder="Кто отвечает"></td>
      <td><input class="commentsField" placeholder="Комментарий"></td>
      <td><button class="deleteRow btn btn-danger">Удалить</button></td>`;
    tableBody.appendChild(tr);
    toggleDiagramBtn();
  };

  const toggleDiagramBtn = () => {
    diagramBtn.disabled = !tableBody.querySelector('tr');
  };

  /* начальная проверка на пустую таблицу */
  toggleDiagramBtn();

  addRowBtn.addEventListener('click', addRow);

  tableBody.addEventListener('click', e => {
    if (e.target.classList.contains('deleteRow')) {
      e.target.closest('tr').remove();
      toggleDiagramBtn();
    }
  });

  /* ---------- отправка данных ---------- */
  submitBtn.addEventListener('click', async () => {
    const rows = [...tableBody.querySelectorAll('tr')];
    if (!rows.length) {
      return alert('Нет строк для отправки.');
    }

    const data = rows.map(row => ({
      event      : row.querySelector('.objectField')?.value.trim(),
      action     : row.querySelector('.actionField')?.value.trim(),
      next       : row.querySelector('.nextObjectsField')?.value.trim(),
      gateway    : row.querySelector('.sentField')?.value.trim(),
      responsible: row.querySelector('.sentByField')?.value.trim(),
      comment    : row.querySelector('.commentsField')?.value.trim()
    }));

    try {
      submitBtn.disabled = true;
      const r   = await fetch('/save_business_processes', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ business_processes: data })
      });
      const res = await r.json();
      alert(res.message || res.error || 'Неизвестный ответ сервера');
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении данных (см. консоль).');
    } finally {
      submitBtn.disabled = false;
    }
  });

  /* ---------- построение схемы ---------- */
  diagramBtn.addEventListener('click', async () => {
    if (!window.mermaid) {
      return alert('Mermaid не загружен!');
    }

    const rows = [...tableBody.querySelectorAll('tr')];
    if (!rows.length) return;

    /* собираем узлы и рёбра */
    const nodes = [];
    const links = [];

    rows.forEach((row, idx) => {
      const id        = `N${idx + 1}`;
      const eventTxt  = esc(row.querySelector('.objectField')?.value.trim()  || `Событие ${idx + 1}`);
      const actionTxt = esc(row.querySelector('.actionField')?.value.trim()  || `Действие ${idx + 1}`);
      const nextTxt   = row.querySelector('.nextObjectsField')?.value.trim();
      const gateTxt   = row.querySelector('.sentField')?.value.trim();

      /* событие и действие */
      nodes.push(`${id}(["${eventTxt}"])`);
      const actId = `${id}a`;
      nodes.push(`${actId}["${actionTxt}"]`);
      links.push(`${id} --> ${actId}`);

      /* соединяющие объекты */
      if (nextTxt) {
        nextTxt.split(',')
               .map(s => s.trim())
               .filter(Boolean)
               .forEach(dest => links.push(`${actId} --> ${dest}`));
      }

      /* условная развилка */
      if (gateTxt) {
        const gateId = `${actId}g`;
        nodes.push(`${gateId}{${esc(gateTxt)}?}`);
        links.push(`${actId} --> ${gateId}`);
      }
    });

    const mermaidTxt = `flowchart TD\n  ${[...nodes, ...links].join('\n  ')}`;

    /* очищаем контейнер и рендерим */
    diagramDiv.innerHTML = '';
    try {
      // уникальный id на каждый рендер, чтобы не конфликтовать
      const renderId = `bpSvg${Date.now()}`;
      const { svg, bindFunctions } = await mermaid.render(renderId, mermaidTxt);
      diagramDiv.innerHTML = svg;
      bindFunctions?.(diagramDiv);              // интерактивность (клик-зумы и т.д.)
    } catch (e) {
      console.error('Mermaid render error:', e);
      diagramDiv.innerHTML = `<pre class="bg-light p-2">${mermaidTxt}</pre>`;
      alert('Mermaid: ошибка синтаксиса — подробности в консоли.');
    }
  });
});