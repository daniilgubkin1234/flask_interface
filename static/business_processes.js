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

  // --- BPMN runtime
  let bpmnModeler = null; // bpmn-js (Modeler)
  let isViewer = true;    // скрыть палитру и контекст в режиме просмотра
  let lastXml = "";       // последнее сгенерированное XML

  // =========================================================
  // 1) Загрузка сохранённых данных
  // =========================================================
  fetch("/get_business_processes")
    .then(r => r.json())
    .then(rows => {
      // ожидаем массив вида [{ num, name, type, role, next, comment }, ...]
      if (!Array.isArray(rows) || rows.length === 0) {
        attachTypeChangeListeners();
        updateRowNumbers();
        return;
      }

      // удалить все строки, кроме первой-шаблона
      while (tbody.rows.length > 1) tbody.deleteRow(1);

      rows.forEach((row, idx) => {
        const tr = idx === 0 ? tbody.rows[0] : tbody.rows[0].cloneNode(true);

        setText(tr, ".rowNum", row.num || `N${idx + 1}`);
        setValue(tr, ".stepNameField", row.name || "");
        setValue(tr, ".stepTypeField", row.type || "task");
        setValue(tr, ".roleField", row.role || "");
        setValue(tr, ".commentsField", row.comment || "");

        // перестроим «Следующие шаги» под тип
        ensureNextControls(tr, row.type || "task");

        // восстановим next (для gateway — два значения через запятую)
        const nextVals = String(row.next || "")
          .split(",").map(s => s.trim()).filter(Boolean);
        const selects = tr.querySelectorAll(".nextField");
        if (selects[0] && nextVals[0]) selects[0].value = nextVals[0];
        if (selects[1] && nextVals[1]) selects[1].value = nextVals[1];

        if (idx !== 0) tbody.appendChild(tr);
      });

      updateRowNumbers();
      attachTypeChangeListeners();
    })
    .catch(err => console.error("Ошибка загрузки бизнес-процессов:", err));

  // =========================================================
  // 2) Сохранение
  // =========================================================
  saveBtn?.addEventListener("click", () => {
    const rows = getTableRowsData();
    fetch("/save_business_processes", {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify(rows)
    })
      .then(r => r.json())
      .then(ans => {
        alert(ans?.message || "Сохранено.");
      })
      .catch(err => {
        console.error(err);
        alert("Не удалось сохранить.");
      });
  });

  // =========================================================
  // 3) Построить BPMN
  // =========================================================
  buildBtn?.addEventListener("click", async () => {
    const rows = getTableRowsData();
    if (rows.length === 0) {
      alert("Заполните таблицу.");
      return;
    }
    lastXml = buildBpmnXml(rows);

    try {
      if (window.BpmnJS) {
        if (!bpmnModeler) {
          bpmnModeler = new window.BpmnJS({ container: bpmnContainer });
        }
        await bpmnModeler.importXML(lastXml);
        const canvas = bpmnModeler.get("canvas");
        canvas.zoom("fit-viewport", "auto");
        applyViewerMode(isViewer);
      } else {
        // Фолбэк: покажем сырое XML
        bpmnContainer.textContent = lastXml;
      }
      alert("Диаграмма построена.");
    } catch (e) {
      console.error(e);
      alert("Не удалось построить диаграмму: " + (e.message || e));
    }
  });

  // =========================================================
  // 4) Экспорт BPMN
  // =========================================================
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

  // =========================================================
  // 5) Переключение режима (просмотр/редактирование)
  // =========================================================
  toggleBtn?.addEventListener("click", () => {
    isViewer = !isViewer;
    applyViewerMode(isViewer);
    toggleBtn.textContent = isViewer ? "Режим: Просмотр" : "Режим: Редактирование";
  });

  // (опционально) «Отправить в перечень регламентов» — заглушка .txt
  sendBtn?.addEventListener("click", () => {
    const rows = getTableRowsData();
    const txt = rows.map(r => {
      const nextTxt = r.type === "gateway"
        ? `Переходы: ${r.next || "—"}`
        : (r.next ? `Следующий шаг: ${r.next}` : "Завершение");
      return `# ${r.num} ${r.name}\nТип: ${r.type}\nРоль: ${r.role}\n${nextTxt}\nКомментарий: ${r.comment}\n`;
    }).join("\n");
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "regulation_draft.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ==========================
  // helpers
  // ==========================
  function $(scope, sel) { return scope.querySelector(sel); }
  function setValue(scope, sel, val) { const el = $(scope, sel); if (el) el.value = val; }
  function setText(scope, sel, val) { const el = $(scope, sel); if (el) el.textContent = val; }

  function updateRowNumbers() {
    Array.from(tbody.rows).forEach((tr, i) => {
      setText(tr, ".rowNum", `N${i + 1}`);
    });
    rebuildNextOptions();
  }

  // перестраиваем опции «Следующие шаги» (N1..Nn)
  function rebuildNextOptions() {
    const nums = Array.from(tbody.rows).map((_, i) => `N${i + 1}`);
    Array.from(tbody.querySelectorAll(".nextField")).forEach(sel => {
      const cur = sel.value;
      sel.innerHTML =
        `<option value="">—</option>` +
        nums.map(n => `<option value="${n}">${n}</option>`).join("");
      if (nums.includes(cur)) sel.value = cur; // восстановим предыдущее, если возможно
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

  // создает/перестраивает контролы «Следующие шаги» под тип
  function ensureNextControls(tr, type) {
    let nextCell = tr.querySelector(".nextCell");
    if (!nextCell) {
      // если нет размеченной ячейки — берем родителя первого select'а
      const existing = tr.querySelector(".nextField")?.parentElement;
      if (existing) {
        nextCell = existing;
        nextCell.classList.add("nextCell");
      } else {
        // на всякий — создадим новую ячейку
        nextCell = document.createElement("td");
        nextCell.className = "nextCell";
        const refCell = tr.children[4]; // по верстке пятая колонка — «Следующие шаги»
        if (refCell) refCell.replaceWith(nextCell);
        else tr.appendChild(nextCell);
      }
    }

    const oldVals = Array.from(nextCell.querySelectorAll(".nextField")).map(s => s.value);
    if (type === "gateway") {
      nextCell.innerHTML = `
        <select class="nextField"><option value="">—</option></select>
        <select class="nextField"><option value="">—</option></select>`;
    } else if (type === "end") {
      nextCell.innerHTML = `—`; // у «конца» нет исходящих
    } else { // task / start
      nextCell.innerHTML = `<select class="nextField"><option value="">—</option></select>`;
    }

    const news = nextCell.querySelectorAll(".nextField");
    if (news[0] && oldVals[0]) news[0].value = oldVals[0];
    if (news[1] && oldVals[1]) news[1].value = oldVals[1];
  }

  // собираем данные из таблицы
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
        type, // task | gateway | end | start(если решишь его использовать)
        role,
        next, // "", "N2" или "N3,N5" для gateway
        comment
      };
    });
  }

  // скрываем/показываем палитру и hotkeys
  function applyViewerMode(viewOnly) {
    if (!bpmnModeler) return;
    const palette = bpmnContainer.querySelector(".djs-palette");
    const contextPads = bpmnContainer.querySelectorAll(".djs-context-pad");
    if (palette) palette.style.display = viewOnly ? "none" : "";
    contextPads.forEach(el => el.style.display = viewOnly ? "none" : "");
    const keyboard = bpmnModeler.get("keyboard", false);
    if (keyboard && keyboard._config) keyboard._config.bindTo = viewOnly ? null : document;
  }

  // ---------------------------
  // Генерация BPMN XML по таблице
  // ---------------------------
  function buildBpmnXml(rows) {
    // простая вертикальная геометрия
    const laneY = 100, xStart = 150, stepDY = 120;

    // id по номеру
    const idByNum = {};
    rows.forEach((r, i) => {
      const base = r.type === "gateway" ? "Gateway" : (r.type === "end" ? "EndEvent" : "Task");
      idByNum[r.num] = `${base}_${i + 1}`;
    });

    // реестр координат фигур для DI-ребер
    const bounds = {};
    const place = (id, x, y, w, h) => {
      bounds[id] = { x, y, w, h };
      return `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}">
  <dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" />
</bpmndi:BPMNShape>`;
    };
    // считаем реальные waypoint-ы: из низа источника в верх цели
    const edge = (id, src, tgt) => {
      const s = bounds[src], t = bounds[tgt];
      if (!s || !t) return `<bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}" />`;
      const sx = s.x + s.w / 2, sy = s.y + s.h;
      const tx = t.x + t.w / 2, ty = t.y;
      return `<bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}">
  <di:waypoint x="${sx}" y="${sy}" />
  <di:waypoint x="${tx}" y="${ty}" />
</bpmndi:BPMNEdge>`;
    };

    // элементы процесса
    const flowNodes = [];
    const diShapes = [];
    const flows = [];
    const diEdges = [];

    // Старт
    flowNodes.push(`<bpmn:startEvent id="StartEvent_1" name="Старт" />`);
    diShapes.push(place("StartEvent_1", xStart, laneY - stepDY, 36, 36));

    // Узлы
    rows.forEach((r, i) => {
      const id = idByNum[r.num];
      const y = laneY + i * stepDY;

      if (r.type === "gateway") {
        flowNodes.push(`<bpmn:exclusiveGateway id="${id}" name="${escapeXml(r.name)}" />`);
        diShapes.push(place(id, xStart, y, 50, 50));
      } else if (r.type === "end") {
        flowNodes.push(`<bpmn:endEvent id="${id}" name="${escapeXml(r.name)}" />`);
        diShapes.push(place(id, xStart, y, 36, 36));
      } else {
        flowNodes.push(`<bpmn:task id="${id}" name="${escapeXml(r.name)}">
  <bpmn:documentation>${escapeXml(r.comment || "")}</bpmn:documentation>
</bpmn:task>`);
        diShapes.push(place(id, xStart, y, 120, 80));
      }
    });

    // Старт -> первый узел (всегда)
    if (rows.length > 0) {
      const firstId = idByNum[rows[0].num];
      const fid = `Flow_Start_${firstId}`;
      flows.push(`<bpmn:sequenceFlow id="${fid}" sourceRef="StartEvent_1" targetRef="${firstId}" />`);
      diEdges.push(edge(fid, "StartEvent_1", firstId));
    }

    // переходы из столбца «Следующие шаги»
    rows.forEach((r) => {
      const id = idByNum[r.num];
      const nexts = String(r.next || "").split(",").map(s => s.trim()).filter(Boolean);
      nexts.forEach((n, k) => {
        const toId = idByNum[n];
        if (!toId) return;
        const fid = `Flow_${id}_${toId}_${k + 1}`;
        flows.push(`<bpmn:sequenceFlow id="${fid}" sourceRef="${id}" targetRef="${toId}" />`);
        diEdges.push(edge(fid, id, toId));
      });
    });

    // авто-завершения для «висячих» узлов
    rows.forEach((r, i) => {
      if (r.next || r.type === "end") return;
      const from = idByNum[r.num];
      const endId = `AutoEnd_${i + 1}`;
      flowNodes.push(`<bpmn:endEvent id="${endId}" name="Конец" />`);
      diShapes.push(place(endId, xStart + 220, laneY + i * stepDY, 36, 36));
      const fid = `Flow_${from}_${endId}`;
      flows.push(`<bpmn:sequenceFlow id="${fid}" sourceRef="${from}" targetRef="${endId}" />`);
      diEdges.push(edge(fid, from, endId));
    });

    // итоговое XML
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

  // вспомогательные «глобальные» генераторы (могут не использоваться)
  function shape(id, x, y, w, h) {
    return `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}">
  <dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" />
</bpmndi:BPMNShape>`;
  }
  function seq(id, src, tgt) {
    return `<bpmn:sequenceFlow id="${id}" sourceRef="${src}" targetRef="${tgt}" />`;
  }
  function edge(id /*, src, tgt */) {
    // оставлена для совместимости; реальные waypoint'ы задаём в buildBpmnXml
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

  // =========================================================
  // 6) Работа с таблицей: добавление/удаление строк
  // =========================================================
  addRowBtn?.addEventListener("click", () => {
    const tr = tbody.rows[0].cloneNode(true);
    setValue(tr, ".stepNameField", "");
    setValue(tr, ".stepTypeField", "task");
    setValue(tr, ".roleField", "");
    setValue(tr, ".commentsField", "");
    ensureNextControls(tr, "task");
    tbody.appendChild(tr);
    updateRowNumbers();
    attachTypeChangeListeners();
  });

  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest(".deleteRow");
    if (!btn) return;
    const tr = btn.closest("tr");
    if (tbody.rows.length === 1) {
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
});
