// business_processes.js

document.addEventListener("DOMContentLoaded", function () {
  const table = document.getElementById('bpTable').getElementsByTagName('tbody')[0];
  const addRowBtn = document.getElementById('addRow');
  const buildBtn = document.getElementById('buildDiagram');
  const exportBtn = document.getElementById('exportBPMN');
  const toggleBtn = document.getElementById('toggleMode');
  const saveBtn = document.getElementById('saveBP');
  const sendBtn = document.getElementById('sendToRegulations');
  const bpmnContainer = document.getElementById('bpmnContainer');

  let bpmnModeler = null;
  let isViewer = true;          // "Просмотр" прячет палитру/контекстное меню
  let lastXml = "";

  // ---------------------- Загрузка сохранённых строк ----------------------
  fetch('/get_business_processes')
    .then(res => res.json())
    .then(rows => {
      if (rows && rows.length > 0) {
        while (table.rows.length > 1) table.deleteRow(1);
        rows.forEach((row, idx) => {
          const tr = idx === 0 ? table.rows[0] : table.rows[0].cloneNode(true);
          tr.querySelector('.stepNameField').value = row.name || "";
          tr.querySelector('.stepTypeField').value = row.type || "task";
          tr.querySelector('.roleField').value = row.role || "";
          tr.querySelector('.commentsField').value = row.comment || "";
          tr.querySelector('.rowNum').innerText = row.num || ('N' + (idx + 1));
          if (idx !== 0) table.appendChild(tr);
        });

        updateRowNumbers();
        attachTypeChangeListeners();

        // восстановим "следующие шаги"
        rows.forEach((row, idx) => {
          const tr = table.rows[idx];
          const next = (row.next || '').split(',');
          const selects = tr.querySelectorAll('.nextField');
          if (selects.length === 1 && next[0]) selects[0].value = next[0];
          if (selects.length === 2) {
            if (next[0]) selects[0].value = next[0];
            if (next[1]) selects[1].value = next[1];
          }
        });

        updateRowNumbers();
        attachTypeChangeListeners();
      }
    });

  // ---------------------- Сохранение строк в БД ----------------------
  saveBtn.addEventListener('click', function () {
    const rows = getTableRowsData();
    fetch('/save_business_processes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows })
    })
      .then(res => res.json())
      .then(data => alert(data.message || "Данные сохранены!"))
      .catch(e => alert("Ошибка сохранения: " + e));
  });

  // ---------------------- Вспомогательные функции таблицы ----------------------
  function getTableRowsData() {
    return Array.from(table.rows).map((tr, idx) => {
      const type = tr.querySelector('.stepTypeField').value;
      const selects = tr.querySelectorAll('.nextField');
      let nextVal = '';
      if (type === 'gateway' && selects.length === 2) {
        const val1 = selects[0].value || '';
        const val2 = selects[1].value || '';
        nextVal = [val1, val2].filter(Boolean).join(',');
      } else if (selects.length === 1) {
        nextVal = selects[0].value || '';
      }

      return {
        id: 'N' + (idx + 1),
        num: 'N' + (idx + 1),
        name: tr.querySelector('.stepNameField').value,
        type,
        role: tr.querySelector('.roleField').value,
        next: nextVal,
        conditions: "",
        comment: tr.querySelector('.commentsField').value
      };
    });
  }

  function updateRowNumbers() {
    Array.from(table.rows).forEach((row, idx) => {
      const cell = row.querySelector('.rowNum');
      if (cell) cell.innerText = 'N' + (idx + 1);
    });
    updateNextStepSelects();
  }

  function attachTypeChangeListeners() {
    const selects = document.querySelectorAll('.stepTypeField');
    selects.forEach(sel => {
      sel.removeEventListener('change', handleTypeChange);
      sel.addEventListener('change', handleTypeChange);
    });
  }
  function handleTypeChange() { updateNextStepSelects(); }

  function updateNextStepSelects() {
    const rows = Array.from(table.rows);
    rows.forEach((row, idx) => {
      const type = row.querySelector('.stepTypeField').value;
      const nextCell = row.cells[4];
      const oldValues = Array.from(nextCell.querySelectorAll('select')).map(s => s.value);
      nextCell.innerHTML = '';

      const availableIds = rows.map((_, i) => 'N' + (i + 1)).filter(id => id !== 'N' + (idx + 1));

      function createSelect(index) {
        const select = document.createElement('select');
        select.className = 'nextField';
        const def = document.createElement('option');
        def.value = '';
        def.textContent = '-- выбрать --';
        select.appendChild(def);
        availableIds.forEach(id => {
          const opt = document.createElement('option');
          opt.value = id;
          opt.textContent = id;
          select.appendChild(opt);
        });
        if (oldValues[index]) select.value = oldValues[index];
        return select;
      }

      if (type === 'gateway') {
        const s1 = createSelect(0);
        const s2 = createSelect(1);
        nextCell.appendChild(s1);
        nextCell.appendChild(document.createTextNode(' и '));
        nextCell.appendChild(s2);
      } else {
        nextCell.appendChild(createSelect(0));
      }
    });
  }

  addRowBtn.onclick = function () {
    const row = table.rows[0].cloneNode(true);
    Array.from(row.querySelectorAll('input')).forEach(inp => (inp.value = ""));
    row.querySelector('.stepTypeField').value = 'task';
    table.appendChild(row);

    row.querySelector('.deleteRow').onclick = function () {
      if (table.rows.length > 1) {
        row.remove();
        updateRowNumbers();
      }
    };
    updateRowNumbers();
    attachTypeChangeListeners();
  };

  Array.from(document.getElementsByClassName('deleteRow')).forEach(btn => {
    btn.onclick = function () {
      if (table.rows.length > 1) {
        btn.closest('tr').remove();
        updateRowNumbers();
        attachTypeChangeListeners();
      }
    };
  });

  // ---------------------- Построение/рендер BPMN ----------------------
  buildBtn.onclick = function () {
    const steps = getTableRowsData();
    const xml = buildBPMNxml(steps);
    lastXml = xml;
    renderDiagram(xml);
    exportBtn.disabled = false;
    toggleBtn.disabled = false;
    sendBtn.disabled = false; // активируем отправку после построения
  };

  exportBtn.onclick = function () {
    if (!lastXml) return;
    const blob = new Blob([lastXml], { type: "application/xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "diagram.bpmn";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 50);
  };

  toggleBtn.onclick = function () {
    isViewer = !isViewer;
    toggleBtn.innerText = isViewer ? "Режим: Просмотр" : "Режим: Редактирование";
    if (lastXml) renderDiagram(lastXml);
  };

  function renderDiagram(xml) {
    bpmnContainer.innerHTML = "";
    if (bpmnModeler) {
      try { bpmnModeler.destroy && bpmnModeler.destroy(); } catch (e) {}
      bpmnModeler = null;
    }

    setTimeout(() => {
      // Используем Modeler всегда; режим "Просмотр" просто скрывает палитру/контекст
      bpmnModeler = new window.BpmnJS({ container: "#bpmnContainer" });
      bpmnModeler.importXML(xml).then(() => {
        // Авто-подгон размеров контейнера
        let numRoles = 1;
        let maxTasks = 1;
        if (window.lastSteps) {
          numRoles = window.lastSteps.lanes?.length || 1;
          maxTasks = Math.max(...window.lastSteps.lanes.map(l => l.nodes.length), 1);
        }
        const maxContainerWidth = document.querySelector('.container').clientWidth - 80;
        const width = Math.min(Math.max(800, maxTasks * 140 + 200), maxContainerWidth);
        const height = Math.max(600, numRoles * 130 + 200);

        Object.assign(bpmnContainer.style, {
          width: width + "px",
          minWidth: width + "px",
          height: height + "px",
          minHeight: height + "px",
          margin: "0 auto"
        });

        setTimeout(() => {
          const palette = bpmnContainer.querySelector('.djs-palette');
          const contextPad = bpmnContainer.querySelector('.djs-context-pad');
          if (palette) palette.style.display = isViewer ? 'none' : '';
          if (contextPad) contextPad.style.display = isViewer ? 'none' : '';
        }, 0);
      }).catch(err => {
        bpmnContainer.innerHTML = `<div style="color: red; font-weight:bold;">Ошибка импорта BPMN:<br>${err}</div>`;
      });
    }, 30);
  }

  // ---------- Геометрия и генерация BPMN XML ----------
  function getShapeDims(type) {
    if (type === "start" || type === "end") return { w: 36, h: 36 };
    if (type === "gateway") return { w: 50, h: 50 };
    return { w: 80, h: 60 }; // task, default
  }

  function getConnectionPoints(fromId, toId, fromType, toType, nodeCoords) {
    const from = nodeCoords[fromId];
    const to = nodeCoords[toId];
    const dFrom = getShapeDims(fromType);
    const dTo = getShapeDims(toType);

    if (from.x < to.x) {
      return [{ x: from.x + dFrom.w, y: from.y + dFrom.h / 2 }, { x: to.x, y: to.y + dTo.h / 2 }];
    } else if (from.x > to.x) {
      return [{ x: from.x, y: from.y + dFrom.h / 2 }, { x: to.x + dTo.w, y: to.y + dTo.h / 2 }];
    } else {
      return [{ x: from.x + dFrom.w / 2, y: from.y + dFrom.h }, { x: to.x + dTo.w / 2, y: to.y }];
    }
  }

  function buildBPMNxml(steps) {
    // lanes: роль = дорожка
    const lanes = [];
    const laneMap = {};
    steps.forEach(s => {
      if (!laneMap[s.role]) {
        laneMap[s.role] = "Lane_" + (lanes.length + 1);
        lanes.push({ id: laneMap[s.role], name: s.role || 'Без роли', nodes: [] });
      }
      lanes.find(l => l.id === laneMap[s.role]).nodes.push(s.id);
    });

    // Координаты элементов (lane вертикально, задачи по горизонтали)
    const nodeCoords = {};
    const laneX = 60;
    const firstPad = 60;
    const laneHeight = 120;
    const gapY = 30;
    const blockWidth = 120;
    const blockGap = 8;

    lanes.forEach((lane, i) => {
      const topY = 80 + i * (laneHeight + gapY);
      lane.nodes.forEach((nid, j) => {
        const st = steps.find(x => x.id === nid);
        const dims = getShapeDims(st.type);
        nodeCoords[nid] = { x: laneX + firstPad + j * (blockWidth + blockGap), y: topY + (laneHeight - dims.h) / 2 };
      });
      lane._topY = topY;
      lane._leftX = laneX;
      lane._width = firstPad + (lane.nodes.length - 1) * (blockWidth + blockGap) + blockWidth;
      lane._height = laneHeight;
    });

    // LaneSet XML
    const laneSetXml =
      `<laneSet id="LaneSet_1">` +
      lanes.map(l => `<lane id="${l.id}" name="${l.name}">${l.nodes.map(n => `<flowNodeRef>${n}</flowNodeRef>`).join('')}</lane>`).join('') +
      `</laneSet>`;

    // Узлы
    let nodes = "";
    steps.forEach(step => {
      if (step.type === "start") nodes += `<startEvent id="${step.id}" name="${step.name}"/>`;
      else if (step.type === "end") nodes += `<endEvent id="${step.id}" name="${step.name}"/>`;
      else if (step.type === "gateway") nodes += `<exclusiveGateway id="${step.id}" name="${step.name}"/>`;
      else nodes += `<task id="${step.id}" name="${step.name}"/>`;
    });

    // Потоки
    let flows = "";
    let edges = "";
    steps.forEach(step => {
      if (step.next) {
        step.next.split(',').filter(Boolean).forEach(nxt => {
          const flowId = `Flow_${step.id}_${nxt}`;
          flows += `<sequenceFlow id="${flowId}" sourceRef="${step.id}" targetRef="${nxt}"/>`;
          const [fromPt, toPt] = getConnectionPoints(step.id, nxt, step.type, (steps.find(s => s.id === nxt) || {}).type, nodeCoords);
          edges += `<bpmndi:BPMNEdge id="Edge_${flowId}" bpmnElement="${flowId}">
                      <di:waypoint x="${fromPt.x}" y="${fromPt.y}"/>
                      <di:waypoint x="${toPt.x}" y="${toPt.y}"/>
                    </bpmndi:BPMNEdge>`;
        });
      }
    });

    // Геометрия фигур
    let shapes = "";
    steps.forEach(step => {
      const c = nodeCoords[step.id];
      const d = getShapeDims(step.type);
      shapes += `<bpmndi:BPMNShape id="Shape_${step.id}" bpmnElement="${step.id}">
                   <dc:Bounds x="${c.x}" y="${c.y}" width="${d.w}" height="${d.h}"/>
                 </bpmndi:BPMNShape>`;
    });

    // Геометрия дорожек
    const planeLanes = lanes.map(l => `
      <bpmndi:BPMNShape id="LaneShape_${l.id}" bpmnElement="${l.id}">
        <dc:Bounds x="${l._leftX - 12}" y="${l._topY - 12}" width="${l._width + 60}" height="${l._height + 24}"/>
      </bpmndi:BPMNShape>`).join('');

    // Сохраним для вычисления размеров при рендере
    window.lastSteps = { lanes, steps };

    // Итоговый XML
    return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
 xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
 xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
 xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
 id="Definitions_1"
 targetNamespace="http://bpmn.io/schema/bpmn">
 <process id="Process_1" isExecutable="false">
   ${laneSetXml}
   ${nodes}
   ${flows}
 </process>
 <collaboration id="Collaboration_1">
   <participant id="Participant_1" processRef="Process_1"/>
 </collaboration>
 <bpmndi:BPMNDiagram id="BPMNDiagram_1">
   <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
     ${planeLanes}
     ${shapes}
     ${edges}
   </bpmndi:BPMNPlane>
 </bpmndi:BPMNDiagram>
</definitions>`;
  }

  // ---------------------- Интеграция с «Перечнем регламентов» ----------------------

  // Хелпер: отправка текстового содержимого как файла через /upload_regulation_text
  async function postRegText({ filename, title, content, contentType }) {
    const res = await fetch('/upload_regulation_text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        title,
        content,
        content_type: contentType || 'application/octet-stream'
      })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Ошибка загрузки');
    return data.doc;
  }

  // Отправляем: TXT-выгрузку, BPMN XML и SVG-картинку
  sendBtn.addEventListener('click', async () => {
    try {
      // 1) Если XML ещё не построен — построим сейчас
      if (!lastXml) {
        const steps = getTableRowsData();
        if (!steps.length) { alert('Добавьте хотя бы один шаг.'); return; }
        lastXml = buildBPMNxml(steps);
        renderDiagram(lastXml);
        exportBtn.disabled = false;
        toggleBtn.disabled = false;
      }

      // 2) Заголовок документа
      const defaultTitle = 'BPMN схема — ' + new Date().toLocaleString();
      const title = prompt('Название документа для перечня регламентов:', defaultTitle) || defaultTitle;

      // 3) Читабельная TXT-выгрузка (как раньше)
      const rows = getTableRowsData();
      const lines = [
        'Схема бизнес-процесса (BPMN) — сводная выгрузка',
        '--------------------------------------------------',
        ...rows.map(r =>
          `${r.id}. ${r.name}  [${r.type}]  Роль: ${r.role || '—'}  ` +
          `Далее: ${r.next || '—'}${r.comment ? `  // ${r.comment}` : ''}`
        )
      ];
      await postRegText({
        filename: `bpmn_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.txt`,
        title,
        content: lines.join('\n'),
        contentType: 'text/plain'
      });

      // 4) Исходник схемы — BPMN XML
      await postRegText({
        filename: 'diagram.bpmn',
        title: title + ' (XML)',
        content: lastXml,
        contentType: 'application/xml'
      });

      // 5) Картинка схемы — SVG из bpmn-js (покажется в предпросмотре регламентов)
      if (bpmnModeler && bpmnModeler.saveSVG) {
        const { svg } = await bpmnModeler.saveSVG();
        await postRegText({
          filename: 'diagram.svg',
          title: title + ' (SVG)',
          content: svg,
          contentType: 'image/svg+xml'
        });
      } else {
        alert('Не удалось получить SVG. Постройте схему и повторите.');
        return;
      }

      alert('Готово! TXT, XML и SVG добавлены в «Перечень регламентов». Откроем список.');
      window.location.href = '/regulations_list';
    } catch (e) {
      console.error(e);
      alert('Не удалось отправить в регламенты: ' + e.message);
    }
  });

  // Инициализация
  exportBtn.disabled = true;
  toggleBtn.disabled = true;
  // держим активной: при нажатии сама построит XML, если его ещё нет
  sendBtn.disabled = false;

  updateRowNumbers();
  attachTypeChangeListeners();
});
