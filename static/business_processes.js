// static/business_processes.js — Semantics + bpmn-js auto layout, lanes, colors, editor-priority, upload to registry

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM
  const tbody = document.getElementById("bpTable")?.getElementsByTagName("tbody")[0];
  const addRowBtn = document.getElementById("addRow");
  const buildBtn = document.getElementById("buildDiagram");
  const exportBtn = document.getElementById("exportBPMN");
  const toggleBtn = document.getElementById("toggleMode");
  const saveBtn = document.getElementById("saveBP");
  const bpmnContainer = document.getElementById("bpmnContainer");
  const bpNameInput = document.getElementById("bpName");
  const resetBtn = document.getElementById("resetToAutoLayout");

  if (!tbody) return;

  // --- BPMN runtime / editor state
  let bpmnModeler = null; // bpmn-js (Modeler)
  let isViewer = true;    // скрыть палитру и контекст в режиме просмотра
  let lastXml = "";       // актуальный XML с DI (редакторская версия)
  let isDirty = false;    // правда, если в редакторе были ручные правки

  // === Цвета по ролям ===
  let lastRoles = [];
  function roleColor(idx) {
    const palette = [
      { fill: '#E6F4FF', stroke: '#1A73E8' },
      { fill: '#E8F5E9', stroke: '#0F9D58' },
      { fill: '#FFF8E1', stroke: '#F4B400' },
      { fill: '#FCE8E6', stroke: '#D93025' },
      { fill: '#EDE7F6', stroke: '#673AB7' },
      { fill: '#E0F2F1', stroke: '#00897B' },
      { fill: '#FFF3E0', stroke: '#FB8C00' },
      { fill: '#E1F5FE', stroke: '#039BE5' },
    ];
    return palette[idx % palette.length];
  }

  // легенда + скрытие ручек в режиме просмотра
  function ensureLegendStyles() {
    if (document.getElementById('bpLegendStyle')) return;
    const st = document.createElement('style');
    st.id = 'bpLegendStyle';
    st.textContent = `
      #bpLegend{margin-top:8px;display:flex;gap:12px;flex-wrap:wrap;font-size:13px}
      .bp-legend-item{display:flex;align-items:center;gap:6px}
      .bp-legend-swatch{width:12px;height:12px;border-radius:3px;border:1px solid rgba(0,0,0,.2)}
      .view-only .djs-bendpoints,
      .view-only .djs-resizer,
      .view-only .djs-outline{ display:none !important; }
    `;
    document.head.appendChild(st);
  }
  function updateLegend(roles) {
    ensureLegendStyles();
    const host = document.querySelector('.diagram-wrapper');
    if (!host) return;
    let legend = document.getElementById('bpLegend');
    if (!legend) {
      legend = document.createElement('div');
      legend.id = 'bpLegend';
      host.appendChild(legend);
    }
    legend.innerHTML = roles.map((r, i) => {
      const c = roleColor(i);
      return `<div class="bp-legend-item">
        <span class="bp-legend-swatch" style="background:${c.fill};border-color:${c.stroke}"></span>
        <span>${escapeHtml(r)}</span>
      </div>`;
    }).join('');
  }

  // =========================================================
  // 1) Загрузка сохранённых данных таблицы БП
  // =========================================================
  fetch("/get_business_processes")
    .then(r => r.json())
    .then(rows => {
      if (!Array.isArray(rows) || rows.length === 0) {
        attachTypeChangeListeners();
        updateRowNumbers();
        return;
      }

      while (tbody.rows.length > 1) tbody.deleteRow(1);

      rows.forEach((row, idx) => {
        const tr = idx === 0 ? tbody.rows[0] : tbody.rows[0].cloneNode(true);

        setText(tr, ".rowNum", row.num || `N${idx + 1}`);
        setValue(tr, ".stepNameField", row.name || "");
        setValue(tr, ".stepTypeField", row.type || "task");
        setValue(tr, ".roleField", row.role || "");
        setValue(tr, ".commentsField", row.comment || "");

        ensureNextControls(tr, row.type || "task");

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
  // 2) Сохранение: БД БП + (приоритетно) отредактированная схема + загрузка в «Регламенты»
  // =========================================================
  saveBtn?.addEventListener("click", async () => {
    const rows = getTableRowsData();
    if (rows.length === 0) {
      alert("Заполните таблицу.");
      return;
    }
    const bpName = (bpNameInput?.value || "").trim() || "Без названия";

    try {
      // 2.1. Сохраняем строки БП
      await fetch("/save_business_processes", {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=utf-8" },
        body: JSON.stringify({ name: bpName, rows })
      }).then(r => r.json());

      // 2.2. Если нет editor-версии — построим из таблицы и дадим bpmn-js проложить линии
      if (!lastXml) {
        const xmlBuilt = buildBpmnXml(rows);
        await ensureModelerWithXml(xmlBuilt);
        const saved = await bpmnModeler.saveXML({ format: true });
        lastXml = saved.xml;
      }

      // 2.3. Сохраняем редакторскую версию на сервер
      await saveEditedXmlToServer(bpName, lastXml);

      // 2.4. Экспорт в SVG/PNG/PDF и отправка в «Регламенты»
      const { svg } = await bpmnModeler.saveSVG({ format: true });
      const pngBlob = await svgToPngBlob(svg);

      const pngTitle = `BPMN: ${bpName} (PNG)`;
      const pngFileName = `${sanitizeFilename(bpName)}_${ts()}.png`;
      const pngUpload = await uploadFileToRegulations(pngBlob, pngFileName, pngTitle);

      const svgFileName = `${sanitizeFilename(bpName)}_${ts()}.svg`;
      const svgUpload = await uploadTextToRegulations(svg, svgFileName, `BPMN: ${bpName} (SVG)`, "image/svg+xml");

      const xmlFileName = `${sanitizeFilename(bpName)}_${ts()}.bpmn`;
      const xmlUpload = await uploadTextToRegulations(lastXml, xmlFileName, `BPMN: ${bpName} (XML)`, "application/xml");

      let pdfUpload = null;
      try {
        const jsPDF = await ensureJsPDF();
        const pdfBlob = await pngToPdfBlob(pngBlob, jsPDF);
        const pdfTitle = `BPMN: ${bpName} (PDF)`;
        const pdfFileName = `${sanitizeFilename(bpName)}_${ts()}.pdf`;
        pdfUpload = await uploadFileToRegulations(pdfBlob, pdfFileName, pdfTitle);
      } catch (e) {
        console.warn("PDF пропущен:", e);
      }

      const documents = [
        { title: "Схема BPMN (PNG)", external_id: pngUpload?.doc?.url || "" },
        { title: "Схема BPMN (SVG)", external_id: svgUpload?.doc?.url || "" },
        { title: "BPMN XML",        external_id: xmlUpload?.doc?.url || "" }
      ];
      if (pdfUpload?.doc?.url) {
        documents.unshift({ title: "Схема BPMN (PDF)", external_id: pdfUpload.doc.url });
      }
      await saveRegListRow(bpName, documents);

      alert("Готово: БП сохранён, редакторская схема — зафиксирована и загружена в «Регламенты».");
    } catch (e) {
      console.error(e);
      alert("Ошибка при сохранении/отправке в «Регламенты». Подробности в консоли.");
    }
  });

  // =========================================================
  // 3) Построить BPMN: приоритет — сохранённая редакторская версия
  // =========================================================
  buildBtn?.addEventListener("click", async () => {
    const rows = getTableRowsData();
    if (rows.length === 0) {
      alert("Заполните таблицу.");
      return;
    }
    const bpName = (bpNameInput?.value || "").trim();
    let restored = false;

    if (bpName) {
      try {
        const got = await loadEditedXmlFromServer(bpName);
        if (got.found && got.xml) {
          await ensureModelerWithXml(got.xml);
          lastXml = got.xml;
          isDirty = false;
          restored = true;
          alert("Загружена сохранённая версия схемы из редактора.");
        }
      } catch (e) { /* ignore */ }
    }

    if (!restored) {
      const xml = buildBpmnXml(rows);
      try {
        await ensureModelerWithXml(xml);
        const saved = await bpmnModeler.saveXML({ format: true });
        lastXml = saved.xml;
        isDirty = false;
        alert("Диаграмма построена.");
      } catch (e) {
        console.error(e);
        alert("Не удалось построить диаграмму: " + (e.message || e));
      }
    }
  });

  // =========================================================
  // 4) Экспорт BPMN (XML) — именно редакторская версия
  // =========================================================
  exportBtn?.addEventListener("click", async () => {
    if (!lastXml) {
      alert("Сначала постройте или сохраните схему.");
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
  // 5) Режим: Просмотр/Редактирование
  // =========================================================
  function toggleViewerClass() {
    if (!bpmnContainer) return;
    if (isViewer) bpmnContainer.classList.add('view-only');
    else bpmnContainer.classList.remove('view-only');
  }
  toggleBtn?.addEventListener("click", () => {
    isViewer = !isViewer;
    applyViewerMode(isViewer);
    toggleViewerClass();
    toggleBtn.textContent = isViewer ? "Режим: Просмотр" : "Режим: Редактирование";
  });

  // ==========================
  // helpers: DOM / таблица
  // ==========================
  function $(scope, sel) { return scope.querySelector(sel); }
  function setValue(scope, sel, val) { const el = $(scope, sel); if (el) el.value = val; }
  function setText(scope, sel, val) { const el = $(scope, sel); if (el) el.textContent = val; }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeXml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

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
      sel.innerHTML =
        `<option value="">—</option>` +
        nums.map(n => `<option value="${n}">${n}</option>`).join("");
      if (nums.includes(cur)) sel.value = cur;
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
    let nextCell = tr.querySelector(".nextCell");
    if (!nextCell) {
      const existing = tr.querySelector(".nextField")?.parentElement;
      if (existing) {
        nextCell = existing;
        nextCell.classList.add("nextCell");
      } else {
        nextCell = document.createElement("td");
        nextCell.className = "nextCell";
        const refCell = tr.children[4];
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
      nextCell.innerHTML = `—`;
    } else {
      nextCell.innerHTML = `<select class="nextField"><option value="">—</option></select>`;
    }

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
        type,   // task | gateway | end | start
        role,
        next,   // "", "N2" или "N3,N5"
        comment
      };
    });
  }

  // ==========================
  // helpers: BPMN & авто-лэйаут/редактор
  // ==========================
  async function ensureModelerWithXml(xml) {
    if (!window.BpmnJS) {
      bpmnContainer.textContent = xml;
      return;
    }
    if (!bpmnModeler) {
      bpmnModeler = new window.BpmnJS({ container: bpmnContainer });
    }
    await bpmnModeler.importXML(xml);

    // Авто-роутинг всех соединений силами bpmn-js
    const modeling = bpmnModeler.get('modeling');
    const elementRegistry = bpmnModeler.get('elementRegistry');
    elementRegistry.filter(e => e.waypoints && (e.type === 'bpmn:SequenceFlow' || e.type === 'bpmn:MessageFlow'))
      .forEach(conn => {
        try { modeling.layoutConnection(conn); } catch(e) { /* ignore */ }
      });

    const canvas = bpmnModeler.get("canvas");
    canvas.zoom("fit-viewport", "auto");
    applyViewerMode(isViewer);
    toggleViewerClass();
    updateLegend(lastRoles);

    // Слежение за правками: любая команда = обновляем lastXml
    const eventBus = bpmnModeler.get('eventBus');
    eventBus.off && eventBus.off('commandStack.changed');
    eventBus.on('commandStack.changed', async () => {
      try {
        const { xml } = await bpmnModeler.saveXML({ format: true });
        lastXml = xml;
        isDirty = true;
      } catch(e) { /* noop */ }
    });
  }

  async function exportCurrentXml() {
    const { xml } = await bpmnModeler.saveXML({ format: true });
    return xml;
  }

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
  // Семантическая генерация BPMN + минимальный DI
  // ---------------------------
  function buildBpmnXml(rows) {
    // роли
    const roles = [];
    const roleIndex = new Map();
    rows.forEach(r => {
      const role = (r.role || "").trim() || "Без роли";
      if (!roleIndex.has(role)) { roleIndex.set(role, roles.length); roles.push(role); }
    });
    lastRoles = roles.slice();

    // раскладка
    const L = 30;
    const laneH = 220;
    const laneTop0 = 100;
    const padY = 70;
    const xStart = 180;
    const xStep  = 230;
    const marginR = 260;

    const nextX = roles.map(() => xStart);

    const sizeOf = (type) => {
      if (type === "gateway") return { w: 50, h: 50 };
      if (type === "start" || type === "end") return { w: 36, h: 36 };
      return { w: 120, h: 80 };
    };

    // id по номеру
    const idByNum = {};
    rows.forEach((r, i) => {
      const base = r.type === "gateway" ? "Gateway"
                 : r.type === "end"     ? "EndEvent"
                 : r.type === "start"   ? "StartEvent" : "Task";
      idByNum[r.num] = `${base}_${i+1}`;
    });

    const flowNodes = [], flows = [], diShapes = [], diEdges = [];
    const bounds = {};
    const nodeLane = {};
    const laneRefs = roles.map(() => []);
    const lanesXml = [];

    // техн. старт, если нет явного
    const explicitStarts = rows.filter(r => (r.type||'').toLowerCase()==='start');
    if (explicitStarts.length===0 && rows.length){
      const firstRole = (rows[0].role||'').trim() || 'Без роли';
      const li = roleIndex.get(firstRole) ?? 0;
      const col = roleColor(li);
      const id  = 'StartEvent_1';
      const {w,h} = sizeOf('start');
      const x = xStart-140, y = laneTop0 + li*laneH + padY + h/4;
      flowNodes.push(`<bpmn:startEvent id="${id}" name="Старт"/>`);
      nodeLane[id]=li; bounds[id]={x,y,w,h};
      diShapes.push(
        `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}" bioc:fill="${col.fill}" bioc:stroke="${col.stroke}">
           <dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" />
         </bpmndi:BPMNShape>`
      );
      const firstId = idByNum[rows[0].num], fid=`Flow_${id}_${firstId}`;
      flows.push(`<bpmn:sequenceFlow id="${fid}" sourceRef="${id}" targetRef="${firstId}" />`);
      diEdges.push(minEdge(id, firstId, roleColor(li).stroke, fid));
    }

    // узлы
    rows.forEach((r,i)=>{
      const id = idByNum[r.num];
      const type = (r.type||'task').toLowerCase();
      const li = roleIndex.get((r.role||'').trim() || 'Без роли') ?? 0;
      const col = roleColor(li);
      const {w,h} = sizeOf(type);
      const x = nextX[li], y = laneTop0 + li*laneH + padY; nextX[li]+=xStep;

      if (type==='gateway') flowNodes.push(`<bpmn:exclusiveGateway id="${id}" name="${escapeXml(r.name)}"/>`);
      else if (type==='end') flowNodes.push(`<bpmn:endEvent id="${id}" name="${escapeXml(r.name)}"/>`);
      else if (type==='start') flowNodes.push(`<bpmn:startEvent id="${id}" name="${escapeXml(r.name?.trim()?r.name:"Старт")}"/>`);
      else flowNodes.push(
        `<bpmn:task id="${id}" name="${escapeXml(r.name)}">
           <bpmn:documentation>${escapeXml(r.comment||"")}</bpmn:documentation>
         </bpmn:task>`
      );

      nodeLane[id]=li; bounds[id]={x,y,w,h};
      diShapes.push(
        `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}" bioc:fill="${col.fill}" bioc:stroke="${col.stroke}">
           <dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" />
         </bpmndi:BPMNShape>`
      );
      laneRefs[li].push(id);
    });

    // связи
    rows.forEach(r=>{
      const id = idByNum[r.num];
      const to = String(r.next||'').split(',').map(s=>s.trim()).filter(Boolean);
      to.forEach((n,k)=>{
        const tid=idByNum[n]; if(!tid) return;
        const fid=`Flow_${id}_${tid}_${k+1}`;
        flows.push(`<bpmn:sequenceFlow id="${fid}" sourceRef="${id}" targetRef="${tid}" />`);
        diEdges.push(minEdge(id, tid, roleColor(nodeLane[id]??0).stroke, fid));
      });
    });

    // авто-end для висячих
    rows.forEach((r,i)=>{
      if (r.next || (r.type||'')==='end') return;
      const from=idByNum[r.num], li=nodeLane[from]??0, col=roleColor(li);
      const id=`AutoEnd_${i+1}`, {w,h}=sizeOf('end');
      const x=nextX[li], y=laneTop0 + li*laneH + padY; nextX[li]+=xStep;
      flowNodes.push(`<bpmn:endEvent id="${id}" name="Завершение"/>`);
      bounds[id]={x,y,w,h};
      diShapes.push(
        `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}" bioc:fill="${col.fill}" bioc:stroke="${col.stroke}">
           <dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" />
         </bpmndi:BPMNShape>`
      );
      const fid=`Flow_${from}_${id}`;
      flows.push(`<bpmn:sequenceFlow id="${fid}" sourceRef="${from}" targetRef="${id}" />`);
      diEdges.push(minEdge(from, id, col.stroke, fid));
      laneRefs[li].push(id);
    });

    // laneSet
    roles.forEach((role,i)=>{
      const id=`Lane_${i+1}`;
      const refs = laneRefs[i].map(n=>`<bpmn:flowNodeRef>${n}</bpmn:flowNodeRef>`).join("");
      lanesXml.push(`<bpmn:lane id="${id}" name="${escapeXml(role)}">${refs}</bpmn:lane>`);
    });

    // DI дорожек
    const maxX = Math.max(...Object.values(bounds).map(b=>b.x+b.w), xStart+200) + marginR;
    roles.forEach((_,i)=>{
      const id=`Lane_${i+1}`, top=laneTop0+i*laneH, col=roleColor(i);
      diShapes.push(
        `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}" bioc:fill="${col.fill}" bioc:stroke="${col.stroke}">
           <dc:Bounds x="${L}" y="${top}" width="${maxX-L}" height="${laneH}" />
         </bpmndi:BPMNShape>`
      );
    });

    // минимальные рёбра
    function minEdge(srcId, tgtId, stroke, idOpt){
      const s=bounds[srcId], t=bounds[tgtId], id=idOpt||`Flow_${srcId}_${tgtId}`;
      if(!s||!t) return `<bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}" bioc:stroke="${stroke}"/>`;
      const p1 = { x: s.x + s.w, y: s.y + s.h/2 };
      const p2 = { x: t.x,       y: t.y + t.h/2 };
      return `<bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}" bioc:stroke="${stroke}">
        <di:waypoint x="${Math.round(p1.x)}" y="${Math.round(p1.y)}" />
        <di:waypoint x="${Math.round(p2.x)}" y="${Math.round(p2.y)}" />
      </bpmndi:BPMNEdge>`;
    }

    // итоговый XML
    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0"
                  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      ${lanesXml.join("\n      ")}
    </bpmn:laneSet>

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

  // ==========================
  // helpers: хранилище редакторской версии (сервер)
  // ==========================
  async function saveEditedXmlToServer(name, xml) {
    const res = await fetch("/save_bpmn_xml", {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify({ name, xml })
    });
    return res.json();
  }
  async function loadEditedXmlFromServer(name) {
    const r = await fetch("/get_bpmn_xml?name=" + encodeURIComponent(name));
    return r.json(); // {found: bool, xml?: string}
  }
  async function deleteEditedXmlOnServer(name) {
    if (!name) return { ok: false, error: 'empty_name' };
    const res = await fetch('/delete_bpmn_xml', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: JSON.stringify({ name })
    });
    return res.json();
  }

  // ==========================
  // helpers: загрузка в регламенты
  // ==========================
  async function uploadFileToRegulations(blob, filename, title) {
    const fd = new FormData();
    fd.append("file", new File([blob], filename, { type: blob.type || "application/octet-stream" }));
    if (title) fd.append("title", title);
    const res = await fetch("/upload_regulation", { method: "POST", body: fd });
    return await res.json();
  }

  async function uploadTextToRegulations(text, filename, title, contentType) {
    const res = await fetch("/upload_regulation_text", {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify({
        filename,
        title,
        content: text,
        content_type: contentType || "application/octet-stream"
      })
    });
    return await res.json();
  }

  async function saveRegListRow(name, documents) {
    await fetch("/save_regulations_list", {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify({
        regulations: [{
          name: name || "Без названия",
          documents: (documents || []).map(d => ({
            title: d.title || "",
            external_id: d.external_id || ""
          }))
        }]
      })
    }).then(r => r.json());
  }

  // ==========================
  // helpers: графика/конвертации
  // ==========================
  async function svgToPngBlob(svgString) {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, "image/svg+xml").documentElement;
    let w = parseFloat(svgDoc.getAttribute("width")) || 0;
    let h = parseFloat(svgDoc.getAttribute("height")) || 0;
    const vb = svgDoc.getAttribute("viewBox")?.split(/\s+/).map(Number);
    if ((!w || !h) && vb && vb.length === 4) { w = vb[2]; h = vb[3]; }
    if (!w || !h) { w = 1600; h = 900; }

    const svgUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
    const img = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(w);
    canvas.height = Math.ceil(h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    return blob;
  }
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  async function ensureJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return window.jspdf.jsPDF;
  }
  async function pngToPdfBlob(pngBlob, jsPDF) {
    const pngDataUrl = await blobToDataUrl(pngBlob);
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const margin = 24;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;

    const img = await loadImage(pngDataUrl);
    let w = img.naturalWidth, h = img.naturalHeight;
    const ratio = Math.min(maxW / w, maxH / h);
    w = w * ratio; h = h * ratio;

    pdf.addImage(pngDataUrl, "PNG", (pageW - w) / 2, (pageH - h) / 2, w, h);
    return pdf.output("blob");
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
  }

  // ==========================
  // helpers: утилиты
  // ==========================
  function sanitizeFilename(s) {
    return String(s || "process").replace(/[^\w\-]+/g, "_").slice(0, 64);
  }
  function ts() { return new Date().toISOString().replace(/[:.TZ\-]/g, ""); }

  // ========================================================
  // 6) Таблица: добавление/удаление
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

  // =========================================================
  // 7) НОВОЕ: автоподъём редакторской версии при заходе с ?name=
  // =========================================================
  (async () => {
    try {
      const params = new URLSearchParams(location.search);
      const qName = params.get('name');
      if (!qName) return;
      if (bpNameInput) bpNameInput.value = qName;

      const got = await loadEditedXmlFromServer(qName);
      if (got && got.found && got.xml) {
        await ensureModelerWithXml(got.xml);
        lastXml = got.xml;
        isDirty = false;
        // Ничего не сохраняем авто— просто подняли сохранённую версию
      }
    } catch (e) {
      console.warn('Автоподъём редакторской версии не удался:', e);
    }
  })();

  // =========================================================
  // 8) НОВОЕ: «Сбросить на автолэйаут из таблицы»
  // =========================================================
  resetBtn?.addEventListener('click', async () => {
    const rows = getTableRowsData();
    if (!rows.length) {
      alert('Заполните таблицу.');
      return;
    }
    const bpName = (bpNameInput?.value || '').trim();

    try {
      if (bpName) {
        await deleteEditedXmlOnServer(bpName); // забыть серверную редакторскую версию
      }
      // сбросить локальную
      lastXml = '';
      isDirty = false;

      // построить заново из таблицы и дать bpmn-js переложить рёбра
      const xmlBuilt = buildBpmnXml(rows);
      await ensureModelerWithXml(xmlBuilt);

      alert('Редакторская версия сброшена. Схема перестроена по таблице.');
    } catch (e) {
      console.error(e);
      alert('Не удалось выполнить сброс. Подробности в консоли.');
    }
  });
});
