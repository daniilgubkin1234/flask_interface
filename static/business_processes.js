// business_processes.js

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM
  const tbody = document.getElementById("bpTable")?.getElementsByTagName("tbody")[0];
  const addRowBtn = document.getElementById("addRow");
  const buildBtn = document.getElementById("buildDiagram");
  const exportBtn = document.getElementById("exportBPMN");
  const toggleBtn = document.getElementById("toggleMode");
  const saveBtn = document.getElementById("saveBP");
  const sendBtn = document.getElementById("sendToRegulations"); // опционально
  const bpmnContainer = document.getElementById("bpmnContainer");

  if (!tbody) return;

  // --- BPMN
  let bpmnModeler = null;     // если подключён bpmn-js, сюда положим инстанс
  let isViewer = true;        // режим «просмотр» (прячем палитру/контекст)
  let lastXml = "";           // последнее сгенерированное XML

  // ======================================================================
  // 1) Загрузка сохранённых данных
  // ======================================================================
  fetch("/get_business_processes")
    .then(r => r.json())
    .then(rows => {
      // Ожидаем массив вида [{ num, name, type, role, next, comment }, ...]
      if (!Array.isArray(rows) || rows.length === 0) {
        attachTypeChangeListeners();
        updateRowNumbers();
        return;
      }

      // Удалим все строки кроме первой (шаблон)
      while (tbody.rows.length > 1) tbody.deleteRow(1);

      rows.forEach((row, idx) => {
        const tr = idx === 0 ? tbody.rows[0] : tbody.rows[0].cloneNode(true);

        setText(tr, ".rowNum", row.num || `N${idx + 1}`);
        setValue(tr, ".stepNameField", row.name || "");
        setValue(tr, ".stepTypeField", row.type || "task");
        setValue(tr, ".roleField", row.role || "");
        setValue(tr, ".commentsField", row.comment || "");

        // перестроим поля «Следующий шаг» под тип
        ensureNextControls(tr, (row.type || "task"));

        // восстановим значения next (для gateway — два значения через запятую)
        const nextVals = String(row.next || "").split(",").map(s => s.trim()).filter(Boolean);
        const selects = tr.querySelectorAll(".nextField");
        if (selects[0] && nextVals[0]) selects[0].value = nextVals[0];
        if (selects[1] && nextVals[1]) selects[1].value = nextVals[1];

        if (idx !== 0) tbody.appendChild(tr);
      });

      updateRowNumbers();
      attachTypeChangeListeners();
    })
    .catch(err => console.error("Ошибка загрузки бизнес-процессов:", err));

  // ======================================================================
  // 2) Сохранение
  // ======================================================================
  saveBtn?.addEventListener("click", () => {
    const rows = getTableRowsData();
    fetch("/save_business_processes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows })
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        alert(d.message || "Данные сохранены!");
      })
      .catch(e => alert("Ошибка сохранения: " + e.message));
  });

  // ======================================================================
  // 3) Работа с таблицей (добавление/удаление/перенумерация/варианты next)
  // ======================================================================
  addRowBtn?.addEventListener("click", () => {
    const tr = tbody.rows[0].cloneNode(true);
    // очистка
    setText(tr, ".rowNum", "");
    setValue(tr, ".stepNameField", "");
    setValue(tr, ".stepTypeField", "task");
    setValue(tr, ".roleField", "");
    setValue(tr, ".commentsField", "");
    // перестроить зону «Следующий шаг»
    ensureNextControls(tr, "task");
    tbody.appendChild(tr);

    updateRowNumbers();
    attachTypeChangeListeners();
  });

  // делегирование на удаление строки
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest(".deleteRow");
    if (!btn) return;
    const tr = btn.closest("tr");
    // не даём удалить единственную строку-шаблон
    if (tbody.rows.length === 1) {
      // просто очистим поля
      setValue(tr, ".stepNameField", "");
      setValue(tr, ".stepTypeField", "task");
      setValue(tr, ".roleField", "");
      setValue(tr, ".commentsField", "");
      ensureNextControls(tr, "task");
    } else {
      tr.remove();
    }
    updateRowNumbers();
  });

  // ======================================================================
  // 4) Построение BPMN и экспорт
  // ======================================================================
  buildBtn?.addEventListener("click", async () => {
    const rows = getTableRowsData();
    if (rows.length === 0) {
      alert("Заполните таблицу.");
      return;
    }
    lastXml = buildBpmnXml(rows);

    // Если есть bpmn-js — отрисуем
    try {
      if (window.BpmnJS) {
        // инициализация (Modeler работает и как viewer, просто спрячем палитру)
        if (!bpmnModeler) {
          bpmnModeler = new window.BpmnJS({ container: bpmnContainer });
        }
        await bpmnModeler.importXML(lastXml);
        const canvas = bpmnModeler.get("canvas");
        canvas.zoom("fit-viewport", "auto");

        applyViewerMode(isViewer);
      } else {
        // Фолбэк: просто покажем XML
        bpmnContainer.textContent = lastXml;
      }
      alert("Диаграмма построена.");
    } catch (e) {
      console.error(e);
      alert("Не удалось построить диаграмму: " + (e.message || e));
    }
  });

  exportBtn?.addEventListener("click", () => {
    if (!lastXml) {
      alert("Сначала постройте схему.");
      return;
    }
    const blob = new Blob([lastXml], { type: "application/xml;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "process.bpmn";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  toggleBtn?.addEventListener("click", () => {
    isViewer = !isViewer;
    applyViewerMode(isViewer);
    toggleBtn.textContent = isViewer ? "Режим: просмотр" : "Режим: редактирование";
  });

  // (опционально) генерация текстовой «заготовки» регламента из таблицы
  sendBtn?.addEventListener("click", () => {
    const rows = getTableRowsData();
    const text = rows.map(r => {
      const nextTxt = r.type === "gateway"
        ? `Переходы: ${r.next}`
        : (r.next ? `Следующий шаг: ${r.next}` : "Завершение");
      return `# ${r.num} ${r.name}\nТип: ${r.type}\nРоль: ${r.role}\n${nextTxt}\nКомментарий: ${r.comment}\n`;
    }).join("\n");
    // Просто загрузим .txt — дальше можно прикрутить ваш endpoint
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "regulation_draft.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ======================================================================
  // helpers
  // ======================================================================
  function $(scope, sel) { return scope.querySelector(sel); }
  function setValue(scope, sel, val) { const el = $(scope, sel); if (el) el.value = val; }
  function setText(scope, sel, val) { const el = $(scope, sel); if (el) el.textContent = val; }

  function updateRowNumbers() {
    Array.from(tbody.rows).forEach((tr, i) => {
      setText(tr, ".rowNum", `N${i + 1}`);
    });
    rebuildNextOptions();
  }

  function rebuildNextOptions() {
    const nums = Array.from(tbody.rows).map((_, i) => `N${i + 1}`);
    Array.from(tbody.querySelectorAll(".nextField")).forEach(sel => {
      const cur = sel.value;
      sel.innerHTML = `<option value=""></option>` + nums.map(n => `<option value="${n}">${n}</option>`).join("");
      if (nums.includes(cur)) sel.value = cur; // восстановим, если возможно
    });
  }

  function attachTypeChangeListeners() {
    Array.from(tbody.querySelectorAll(".stepTypeField")).forEach(sel => {
      sel.onchange = () => {
        const tr = sel.closest("tr");
        ensureNextControls(tr, sel.value);
        rebuildNextOptions();
      };
    });
  }

  function ensureNextControls(tr, type) {
    // Находим (или создаём) ячейку для select'ов «Следующий шаг»
    let nextCell = tr.querySelector(".nextCell");
    if (!nextCell) {
      // если в шаблоне не размечено — создадим последнюю ячейку перед комментарием
      // предпочтительно найдём существующие select'ы и их родителя
      const existing = tr.querySelector(".nextField")?.parentElement;
      nextCell = existing || tr.insertCell(-1);
      nextCell.classList.add("nextCell");
    }

    // Сохраним текущие значения (если были)
    const oldVals = Array.from(nextCell.querySelectorAll(".nextField")).map(s => s.value);

    if (type === "gateway") {
      nextCell.innerHTML = `
        <select class="nextField"></select>
        <select class="nextField" style="margin-left:6px;"></select>
      `;
    } else if (type === "end") {
      nextCell.innerHTML = `<span style="opacity:.7;">—</span>`;
    } else {
      nextCell.innerHTML = `<select class="nextField"></select>`;
    }

    rebuildNextOptions();

    // вернём сохранённые значения
    const news = nextCell.querySelectorAll(".nextField");
    if (news[0] && oldVals[0]) news[0].value = oldVals[0];
    if (news[1] && oldVals[1]) news[1].value = oldVals[1];
  }

  function getTableRowsData() {
    return Array.from(tbody.rows).map((tr, idx) => {
      const type = tr.querySelector(".stepTypeField")?.value || "task";
      const role = tr.querySelector(".roleField")?.value?.trim() || "";
      const name = tr.querySelector(".stepNameField")?.value?.trim() || `Шаг ${idx + 1}`;
      const comment = tr.querySelector(".commentsField")?.value?.trim() || "";
      let next = "";

      if (type === "gateway") {
        const [a, b] = Array.from(tr.querySelectorAll(".nextField")).map(s => s.value).slice(0, 2);
        next = [a, b].filter(Boolean).join(",");
      } else if (type !== "end") {
        next = tr.querySelector(".nextField")?.value || "";
      }

      return {
        num: `N${idx + 1}`,
        name,
        type,     // task | gateway | end
        role,
        next,     // "", "N2" или "N3,N5" для gateway
        comment
      };
    });
  }

  function applyViewerMode(viewOnly) {
    if (!bpmnModeler) return;
    // спрячем/покажем палитру и контекстное меню
    const palette = bpmnContainer.querySelector(".djs-palette");
    const contextPads = bpmnContainer.querySelectorAll(".djs-context-pad");

    if (palette) palette.style.display = viewOnly ? "none" : "";
    contextPads.forEach(el => el.style.display = viewOnly ? "none" : "");

    // отключим хоткеи в «просмотре»
    const keyboard = bpmnModeler.get("keyboard", false);
    if (keyboard && keyboard._config) keyboard._config.bindTo = viewOnly ? null : document;
  }

  // --- Генерация простого BPMN-XML по таблице
  function buildBpmnXml(rows) {
    // Геометрия — просто вертикальная колонка
    const laneY = 100, xStart = 150, stepDY = 120;

    // Карта id по номеру
    const idByNum = {};
    rows.forEach((r, i) => {
      const base = r.type === "gateway" ? "Gateway" : (r.type === "end" ? "EndEvent" : "Task");
      idByNum[r.num] = `${base}_${i + 1}`;
    });

    // Элементы процесса
    const flowNodes = [];
    const diShapes = [];
    const flows = [];
    const diEdges = [];

    // Стартовое событие
    flowNodes.push(`<bpmn:startEvent id="StartEvent_1" name="Старт" />`);
    diShapes.push(shape("StartEvent_1", xStart, laneY - stepDY, 36, 36));

    // Узлы
    rows.forEach((r, i) => {
      const id = idByNum[r.num];
      const y = laneY + i * stepDY;

      if (r.type === "gateway") {
        flowNodes.push(`<bpmn:exclusiveGateway id="${id}" name="${escapeXml(r.name)}" />`);
        diShapes.push(shape(id, xStart, y, 50, 50));
      } else if (r.type === "end") {
        flowNodes.push(`<bpmn:endEvent id="${id}" name="${escapeXml(r.name)}" />`);
        diShapes.push(shape(id, xStart, y, 36, 36));
      } else {
        flowNodes.push(`<bpmn:task id="${id}" name="${escapeXml(r.name)}">
  <bpmn:documentation>${escapeXml(r.comment || "")}</bpmn:documentation>
</bpmn:task>`);
        diShapes.push(shape(id, xStart, y, 120, 80));
      }

      // Переходы
      const nexts = String(r.next || "").split(",").map(s => s.trim()).filter(Boolean);
      const fromId = (i === 0) ? "StartEvent_1" : idByNum[r.num];
      if (i === 0 && rows.length > 0 && !rows[0].next) {
        // если у первого шага не указан next — соединим старт -> первый
        const firstId = idByNum[rows[0].num];
        flows.push(seq(`Flow_Start_${firstId}`, "StartEvent_1", firstId));
        diEdges.push(edge(`Flow_Start_${firstId}`, "StartEvent_1", firstId));
      }

      nexts.forEach((n, k) => {
        const toId = idByNum[n];
        if (!toId) return;
        const fid = `Flow_${id}_${toId}_${k + 1}`;
        flows.push(seq(fid, id, toId));
        diEdges.push(edge(fid, id, toId));
      });
    });

    // Если у нас нет явного конца — добавим end к тем, кто без next
    rows.forEach((r, i) => {
      if (r.next || r.type === "end") return;
      const from = idByNum[r.num];
      const endId = `AutoEnd_${i + 1}`;
      flowNodes.push(`<bpmn:endEvent id="${endId}" name="Конец" />`);
      diShapes.push(shape(endId, xStart + 220, laneY + i * stepDY, 36, 36));
      const fid = `Flow_${from}_${endId}`;
      flows.push(seq(fid, from, endId));
      diEdges.push(edge(fid, from, endId));
    });

    // Итоговая сборка
    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    ${flowNodes.join("\n    ")}
    ${flows.join("\n    ")}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      ${diShapes.join("\n      ")}
      ${diEdges.join("\n      ")}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
  }

  function shape(id, x, y, w, h) {
    return `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}">
  <dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" />
</bpmndi:BPMNShape>`;
  }

  function seq(id, src, tgt) {
    return `<bpmn:sequenceFlow id="${id}" sourceRef="${src}" targetRef="${tgt}" />`;
  }

  function edge(id /*, src, tgt */) {
    // простая ломаная — координаты посчитает bpmn-js
    return `<bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}">
  <di:waypoint x="0" y="0" />
  <di:waypoint x="0" y="0" />
</bpmndi:BPMNEdge>`;
  }

  function escapeXml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
});
