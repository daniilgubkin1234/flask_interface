// business_processes.js

document.addEventListener("DOMContentLoaded", function () {
  const table = document.getElementById('bpTable').getElementsByTagName('tbody')[0];
  const addRowBtn = document.getElementById('addRow');
  const buildBtn = document.getElementById('buildDiagram');
  const exportBtn = document.getElementById('exportBPMN');
  const toggleBtn = document.getElementById('toggleMode');
  const saveBtn = document.getElementById('saveBP');
  const bpmnContainer = document.getElementById('bpmnContainer');
  let bpmnModeler = null;
  let isViewer = true;
  let lastXml = "";


   // --- ДОБАВЛЕНО: кнопка для ручного сохранения бизнес-процессов ---
   
 
   // --- ДОБАВЛЕНО: автоматическая загрузка бизнес-процессов пользователя при загрузке страницы ---
   fetch('/get_business_processes')
     .then(res => res.json())
     .then(rows => {
       if (rows && rows.length > 0) {
         // Очищаем таблицу и наполняем строками из БД
         while (table.rows.length > 1) table.deleteRow(1);
         rows.forEach((row, idx) => {
           let tr = idx === 0 ? table.rows[0] : table.rows[0].cloneNode(true);
           // Заполняем поля из объекта row — ЧЕТКО ПО КЛАССАМ input/select
           tr.querySelector('.rowNum').innerText = row.num || ('N' + (idx + 1));
           tr.querySelector('.stepNameField').value = row.name || "";
           tr.querySelector('.stepTypeField').value = row.type || "task";
           tr.querySelector('.roleField').value = row.role || "";
           tr.querySelector('.nextField').value = row.next || "";
           tr.querySelector('.conditionField').value = row.conditions || "";
           tr.querySelector('.commentsField').value = row.comment || "";
           if (idx !== 0) {
             table.appendChild(tr);
             // Кнопка удаления строки для новых строк
             tr.querySelector('.deleteRow').onclick = function () {
               if (table.rows.length > 1) {
                 tr.remove();
                 updateRowNumbers();
               }
             };
           }
         });
         updateRowNumbers();
       }
     });
 
   // --- ДОБАВЛЕНО: функция для преобразования таблицы в массив объектов (для сохранения) ---
   function getTableRowsData() {
     return Array.from(table.rows).map((tr, idx) => {
       return {
         num: tr.querySelector('.rowNum').innerText,
         name: tr.querySelector('.stepNameField').value,
         type: tr.querySelector('.stepTypeField').value,
         role: tr.querySelector('.roleField').value,
         next: tr.querySelector('.nextField').value,
         conditions: tr.querySelector('.conditionField').value,
         comment: tr.querySelector('.commentsField').value
       };
     });
   }
 
   // --- ДОБАВЛЕНО: обработчик на кнопку "Сохранить бизнес-процессы" ---
   saveBtn.addEventListener('click', function () {
     const rows = getTableRowsData();
     fetch('/save_business_processes', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ rows: rows })
     })
     .then(res => res.json())
     .then(data => alert(data.message || "Данные сохранены!"))
     .catch(e => alert("Ошибка сохранения: " + e));
   });
 
  function updateRowNumbers() {
    Array.from(table.rows).forEach((row, idx) => {
      let cell = row.querySelector('.rowNum');
      if (cell) cell.innerText = 'N' + (idx + 1);
    });
    updateNextStepSelects();
  }

  function updateNextStepSelects() {
    const rows = Array.from(table.rows);
    rows.forEach((row, idx) => {
      const select = row.querySelector('.nextField');
      if (!select) return;
      // Сохраним текущее значение перед обновлением
      const oldValue = select.value;
      // Очистим опции и добавим пустую
      select.innerHTML = '<option value="">—</option>';
      // Добавим актуальные номера (N1, N2, ...), кроме текущего
      rows.forEach((otherRow, i2) => {
        if (i2 !== idx) {
          const id = 'N' + (i2 + 1);
          const option = document.createElement('option');
          option.value = id;
          option.text = id;
          select.appendChild(option);
        }
      });
      // Если старое значение ещё существует — восстановим выбор, иначе — очистим
      if (oldValue && Array.from(select.options).some(o => o.value === oldValue)) {
        select.value = oldValue;
      } else {
        select.value = "";
      }
    });
  }

  addRowBtn.onclick = function () {
    const row = table.rows[0].cloneNode(true);
    Array.from(row.querySelectorAll('input')).forEach(inp => inp.value = "");
    table.appendChild(row);
    row.querySelector('.deleteRow').onclick = function () {
      if (table.rows.length > 1) {
        row.remove();
        updateRowNumbers();
      }
    };
    updateRowNumbers();
  };

  Array.from(document.getElementsByClassName('deleteRow')).forEach(btn => {
    btn.onclick = function () {
      if (table.rows.length > 1) {
        btn.closest('tr').remove();
        updateRowNumbers();
      }
    };
  });

  toggleBtn.onclick = function () {
    isViewer = !isViewer;
    toggleBtn.innerText = isViewer ? "Режим: Просмотр" : "Режим: Редактирование";
    if (lastXml) renderDiagram(lastXml);
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

  buildBtn.onclick = function () {
    const steps = getTableData();
    const xml = buildBPMNxml(steps);
    lastXml = xml;
    renderDiagram(xml);
    exportBtn.disabled = false;
    toggleBtn.disabled = false;
  };

  function getTableData() {
    const arr = [];
    Array.from(table.rows).forEach((tr, i) => {
      const tds = tr.cells;
      const type = tds[2].querySelector('select').value;
      arr.push({
        id: "N" + (i + 1),
        name: tds[1].querySelector('input').value || ("Шаг " + (i + 1)),
        type: type,
        role: tds[3].querySelector('input').value.trim() || 'Без роли',
        next: tds[4].querySelector('select').value,
        conditions: tds[5].querySelector('input').value,
        comment: tds[6].querySelector('input').value
      });
    });
    return arr;
  }


  // ---------- Новый участок: расчет точек входа/выхода для стрелок ----------
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
    // Слева направо
    if (from.x < to.x) {
      // Правая точка from, левая точка to
      const fromPt = { x: from.x + dFrom.w, y: from.y + dFrom.h / 2 };
      const toPt = { x: to.x, y: to.y + dTo.h / 2 };
      return [fromPt, toPt];
    } else if (from.x > to.x) {
      // Слева from, справа to
      const fromPt = { x: from.x, y: from.y + dFrom.h / 2 };
      const toPt = { x: to.x + dTo.w, y: to.y + dTo.h / 2 };
      return [fromPt, toPt];
    } else {
      // Вертикально: снизу from, сверху to
      const fromPt = { x: from.x + dFrom.w / 2, y: from.y + dFrom.h };
      const toPt = { x: to.x + dTo.w / 2, y: to.y };
      return [fromPt, toPt];
    }
  }
  // ------------------------------------------------------------------------

  function buildBPMNxml(steps) {
    // Вычислим laneSet (роль = lane)
    let lanes = [];
    let laneMap = {};
    steps.forEach(s => {
      if (!laneMap[s.role]) {
        laneMap[s.role] = "Lane_" + (lanes.length + 1);
        lanes.push({ id: laneMap[s.role], name: s.role, nodes: [] });
      }
      lanes.find(l => l.id === laneMap[s.role]).nodes.push(s.id);
    });

    // Расположим элементы "по сетке"
    let nodeCoords = {};

    // "Повернутая" разметка: lane вертикально, задачи горизонтально
    let laneX = 60;                  // отступ от левого края контейнера
    let firstBlockPad = 60;          // дополнительный отступ только для первого блока
    let laneHeight = 120;            // высота одной lane
    let gapY = 30;                   // вертикальный отступ между lanes
    let blockWidth = 120;            // ширина одного блока задачи (можно 140)
    let blockGap = 8;                // маленький горизонтальный отступ между задачами

    lanes.forEach((lane, i) => {
      let yLaneTop = 80 + i * (laneHeight + gapY);
      lane.nodes.forEach((nid, j) => {
        let step = steps.find(x => x.id === nid);
        let dims = getShapeDims(step.type);
        nodeCoords[nid] = {
          x: laneX + firstBlockPad + j * (blockWidth + blockGap),
          y: yLaneTop + (laneHeight - dims.h) / 2
        };
      });
      lane._topY = yLaneTop;
      lane._leftX = laneX;
      lane._width = firstBlockPad + (lane.nodes.length - 1) * (blockWidth + blockGap) + blockWidth;
      lane._height = laneHeight;
    });




    // Lanes XML
    let laneSetXml = `<laneSet id="LaneSet_1">` + lanes.map(lane =>
      `<lane id="${lane.id}" name="${lane.name}">` +
      lane.nodes.map(nid => `<flowNodeRef>${nid}</flowNodeRef>`).join('') +
      `</lane>`
    ).join('') + `</laneSet>`;

    // BPMN Nodes
    let nodes = "";
    steps.forEach(step => {
      if (step.type === "start")
        nodes += `<startEvent id="${step.id}" name="${step.name}"/>`;
      else if (step.type === "end")
        nodes += `<endEvent id="${step.id}" name="${step.name}"/>`;
      else if (step.type === "gateway")
        nodes += `<exclusiveGateway id="${step.id}" name="${step.name}"/>`;
      else
        nodes += `<task id="${step.id}" name="${step.name}"/>`;
    });

    // BPMN Sequence Flows
    let flows = "";
    let edges = "";
    steps.forEach(step => {
      // Для gateway: условия
      if (step.type === 'gateway' && step.conditions && /:/.test(step.conditions)) {
        step.conditions.split(',').map(x => x.trim()).forEach(pair => {
          const [cond, target] = pair.split(':').map(z => z.trim());
          if (cond && target) {
            const flowId = `Flow_${step.id}_${target}`;
            flows += `<sequenceFlow id="${flowId}" sourceRef="${step.id}" targetRef="${target}">
                            <conditionExpression xsi:type="tFormalExpression"><![CDATA[${cond}]]></conditionExpression>
                        </sequenceFlow>`;
            // Добавим корректный waypoint
            const [fromPt, toPt] = getConnectionPoints(step.id, target, step.type, steps.find(s => s.id === target).type, nodeCoords);
            edges += `<bpmndi:BPMNEdge id="Edge_${flowId}" bpmnElement="${flowId}">
                          <di:waypoint x="${fromPt.x}" y="${fromPt.y}"/>
                          <di:waypoint x="${toPt.x}" y="${toPt.y}"/>
                        </bpmndi:BPMNEdge>`;
          }
        });
      }
      // Для обычных шагов
      else if (step.next) {
        step.next.split(',').map(x => x.trim()).forEach(nxt => {
          if (nxt) {
            const flowId = `Flow_${step.id}_${nxt}`;
            flows += `<sequenceFlow id="${flowId}" sourceRef="${step.id}" targetRef="${nxt}"/>`;
            const [fromPt, toPt] = getConnectionPoints(step.id, nxt, step.type, steps.find(s => s.id === nxt).type, nodeCoords);
            edges += `<bpmndi:BPMNEdge id="Edge_${flowId}" bpmnElement="${flowId}">
                          <di:waypoint x="${fromPt.x}" y="${fromPt.y}"/>
                          <di:waypoint x="${toPt.x}" y="${toPt.y}"/>
                        </bpmndi:BPMNEdge>`;
          }
        });
      }
    });

    // Диаграмма (shapes)
    let shapes = "";
    steps.forEach(step => {
      const coords = nodeCoords[step.id];
      const dims = getShapeDims(step.type);
      shapes += `<bpmndi:BPMNShape id="Shape_${step.id}" bpmnElement="${step.id}">
                <dc:Bounds x="${coords.x}" y="${coords.y}" width="${dims.w}" height="${dims.h}"/>
            </bpmndi:BPMNShape>`;
    });

    // lanes/пулы для BPMN
    let planeLanes = lanes.map((lane, i) => {
      return `<bpmndi:BPMNShape id="LaneShape_${lane.id}" bpmnElement="${lane.id}">
        <dc:Bounds x="${lane._leftX - 12}" y="${lane._topY - 12}" width="${lane._width + 60}" height="${lane._height + 24}"/>
    </bpmndi:BPMNShape>`;
    }).join('');


    window.lastSteps = { lanes, steps };

    // Итоговый BPMN XML
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
</definitions>
`;
  }

  function renderDiagram(xml) {
    bpmnContainer.innerHTML = "";
    if (bpmnModeler) {
      try { bpmnModeler.destroy && bpmnModeler.destroy(); } catch (e) { }
      bpmnModeler = null;
    }
    setTimeout(() => {
      bpmnModeler = isViewer
        ? new window.BpmnJS.Viewer({ container: "#bpmnContainer" })
        : new window.BpmnJS({ container: "#bpmnContainer" });
      bpmnModeler.importXML(xml).then(() => {
        // ---- Динамическая ширина/высота контейнера и SVG ----
        // 1. Посчитаем ширину схемы (ролей) и высоту (максимум lane)
        let numRoles = 1;
        let maxTasks = 1;
        if (window.lastSteps) {
          numRoles = window.lastSteps.lanes?.length || 1;
          maxTasks = Math.max(...window.lastSteps.lanes.map(l => l.nodes.length), 1);
        }
        // Рассчитаем размеры (можно подправить под твой лэйаут)
        let maxContainerWidth = document.querySelector('.container').clientWidth - 80; // 40 + 40 паддинги
        let width = Math.min(Math.max(800, maxTasks * 140 + 200), maxContainerWidth);
        let height = Math.max(600, numRoles * 130 + 200 + 200); // + 200 - отступы снизу

        bpmnContainer.style.width = width + "px";
        bpmnContainer.style.minWidth = width + "px";
        bpmnContainer.style.height = height + "px";
        bpmnContainer.style.minHeight = height + "px";
        bpmnContainer.style.margin = "0 auto";

        // Попробуем задать размер самому SVG (если есть)
        setTimeout(() => {
          const svg = bpmnContainer.querySelector('svg');
          if (svg) {
            svg.style.minWidth = width + "px";
            svg.style.width = width + "px";
            svg.style.height = height + "px";
            svg.style.minHeight = height + "px";
          }
        }, 30);
      }).catch(err => {
        bpmnContainer.innerHTML = `<div style="color: red; font-weight:bold;">Ошибка импорта BPMN:<br>${err}</div>`;
      });
    }, 30);
  }


  // Инициализация: выключаем экспорт и просмотр до построения схемы
  exportBtn.disabled = true;
  toggleBtn.disabled = true;
  updateRowNumbers();
});
