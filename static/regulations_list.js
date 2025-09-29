document.addEventListener('DOMContentLoaded', () => {
  // =========================
  // БЛОК: загрузка файлов
  // =========================
  const uploadForm = document.getElementById('uploadForm');
  const docFile = document.getElementById('docFile');
  const docTitle = document.getElementById('docTitle');
  const uploadMsg = document.getElementById('uploadMsg');
document.querySelector('.toggle-sidebar').addEventListener('click', function() {
        const sidebar = document.querySelector('.recommendation-block');
        const button = document.querySelector('.toggle-sidebar');
        
        // Одновременно применяем классы для синхронной анимации
        sidebar.classList.toggle('show');
        button.classList.toggle('menu-open');
    });

    // --- 2. Закрытие меню при клике вне области
    document.addEventListener('click', function(e) {
        const sidebar = document.querySelector('.recommendation-block');
        const button = document.querySelector('.toggle-sidebar');
        
        if (sidebar.classList.contains('show') && 
            !sidebar.contains(e.target) && 
            !button.contains(e.target)) {
            sidebar.classList.remove('show');
            button.classList.remove('menu-open');
        }
    });

    const uploadedTbody = document.querySelector("#uploadedTable tbody");
    const previewWrap = document.getElementById("preview");
    const previewTitle = document.getElementById("previewTitle");
    const previewFrame = document.getElementById("previewFrame");
    const previewCloseBtn = document.getElementById("previewCloseBtn");

    function hidePreview() {
        previewFrame.src = "";
        previewWrap.style.display = "none";
        previewTitle.textContent = "Предпросмотр";
    }
    previewCloseBtn?.addEventListener("click", hidePreview);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && previewWrap.style.display === "block") {
            hidePreview();
        }
    });

    function formatBytes(bytes) {
        if (!bytes && bytes !== 0) return "";
        const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
        let i = 0,
            v = bytes;
        while (v >= 1024 && i < units.length - 1) {
            v /= 1024;
            i++;
        }
        const dec = v >= 10 || i === 0 ? 0 : 1;
        return `${v.toFixed(dec)} ${units[i]}`;
    }

    function escapeHtml(s) {
        return (s ?? "").replace(
            /[&<>"']/g,
            (c) =>
                ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;",
                }[c])
        );
    }
    function escapeAttr(s) {
        return escapeHtml(s).replace(/"/g, "&quot;");
    }
    function isPreviewable(ct) {
        const t = (ct || "").toLowerCase();
        return t.includes("pdf") || t.startsWith("image/");
    }

    // --- парсинг заголовка BPMN-набора вида: "BPMN: <имя> (PNG|PDF|SVG|XML)"
    function parseBpmnBundle(doc) {
        const title = doc?.title || "";
        const rx = /^(.*)\s*\((PDF|PNG|SVG|XML)\)\s*$/i;
        const m = title.match(rx);
        if (!m) return null;
        const base = (m[1] || "").trim();
        const fmt = (m[2] || "").toLowerCase();
        if (!/^BPMN:/i.test(base)) return null;
        return { baseTitle: base, key: base.toLowerCase(), fmt };
    }
    function getProcessNameFromBaseTitle(baseTitle) {
        return (
            (baseTitle || "").replace(/^BPMN:\s*/i, "").trim() || "Без названия"
        );
    }

    function renderUploaded(items) {
        uploadedTbody.textContent = "";

        // --- группировка BPMN-наборов
        const map = new Map();
        const singles = [];

        (items || []).forEach((doc) => {
            const parsed = parseBpmnBundle(doc);
            if (!parsed) {
                singles.push(doc);
                return;
            }
            let g = map.get(parsed.key);
            if (!g) {
                g = { baseTitle: parsed.baseTitle, docs: {}, ids: [] };
                map.set(parsed.key, g);
            }

            const fmt = parsed.fmt;
            const ts = doc.uploaded_at ? Date.parse(doc.uploaded_at) || 0 : 0;
            const cur = g.docs[fmt];
            const curTs =
                cur && cur.uploaded_at ? Date.parse(cur.uploaded_at) || 0 : -1;

            // оставляем только САМЫЙ НОВЫЙ файл каждого формата
            if (!cur || ts > curTs) {
                g.docs[fmt] = doc;
            }

            // для кнопки "Удалить всё" копим ВСЕ id версии данного набора
            g.ids.push(doc._id);
        });

        // финализируем агрегаты: размер/дата ТОЛЬКО по свежим версиям форматов
        const groups = Array.from(map.values()).map((g) => {
            const selected = Object.values(g.docs);
            g.size = selected.reduce((sum, d) => sum + (d.size || 0), 0);
            const maxTs = Math.max(
                0,
                ...selected.map((d) => Date.parse(d.uploaded_at) || 0)
            );
            g.uploaded_at = maxTs ? new Date(maxTs).toISOString() : null;
            return g;
        });

        let rowIdx = 0;

        const mkTd = (html, cls, isHtml = true) => {
            const td = document.createElement("td");
            if (cls) td.className = cls;
            if (isHtml) td.innerHTML = html;
            else td.textContent = html;
            return td;
        };

        const appendRow = (cells, bindFn) => {
            const tr = document.createElement("tr");
            cells.forEach((td) => tr.appendChild(td));
            uploadedTbody.appendChild(tr);
            bindFn?.(tr);
        };

        // --- BPMN-наборы
        groups.forEach((g) => {
            rowIdx++;

            const png = g.docs.png,
                pdf = g.docs.pdf,
                svg = g.docs.svg,
                xml = g.docs.xml;

            const linkChips = [];
            if (png)
                linkChips.push(
                    `<a href="${png.url}" target="_blank" rel="noopener">PNG</a>`
                );
            if (pdf)
                linkChips.push(
                    `<a href="${pdf.url}" target="_blank" rel="noopener">PDF</a>`
                );
            if (svg)
                linkChips.push(
                    `<a href="${svg.url}" target="_blank" rel="noopener">SVG</a>`
                );
            if (xml)
                linkChips.push(
                    `<a href="${xml.url}" target="_blank" rel="noopener">XML</a>`
                );

            const previewBtns = [];
            if (png)
                previewBtns.push(
                    `<button type="button" class="btn previewBtn" data-url="${
                        png.url
                    }" data-title="${escapeAttr(
                        g.baseTitle + " — PNG"
                    )}">Предпросмотр PNG</button>`
                );
            if (pdf)
                previewBtns.push(
                    `<button type="button" class="btn previewBtn" data-url="${
                        pdf.url
                    }" data-title="${escapeAttr(
                        g.baseTitle + " — PDF"
                    )}">Предпросмотр PDF</button>`
                );

            const processName = getProcessNameFromBaseTitle(g.baseTitle);
            const openEditorBtn = `<a class="btn" href="/business_processes?name=${encodeURIComponent(
                processName
            )}">Открыть в редакторе</a>`;
            const delBtn = `<button type="button" class="btn btn-danger deleteGroup" data-ids="${g.ids.join(
                ","
            )}">Удалить всё</button>`;

            // 6-й столбец — внутри div.actions-grid
            const actionsTd = document.createElement("td");
            const actionsDiv = document.createElement("div");
            actionsDiv.className = "actions-grid";
            actionsDiv.innerHTML = `${linkChips.join(" ")} ${previewBtns.join(
                " "
            )}`;
            actionsTd.appendChild(actionsDiv);

            // 7-й столбец — внутри div.controls-stack
            const controlsTd = document.createElement("td");
            const controlsDiv = document.createElement("div");
            controlsDiv.className = "controls-stack";
            controlsDiv.innerHTML = `${openEditorBtn} ${delBtn}`;
            controlsTd.appendChild(controlsDiv);

            appendRow(
                [
                    mkTd(String(rowIdx), null, false),
                    mkTd(escapeHtml(g.baseTitle)),
                    mkTd("BPMN-набор"),
                    mkTd(formatBytes(g.size)),
                    mkTd(
                        g.uploaded_at
                            ? new Date(g.uploaded_at).toLocaleString()
                            : ""
                    ),
                    actionsTd,
                    controlsTd,
                ],
                (tr) => {
                    tr.querySelectorAll(".previewBtn").forEach((btn) => {
                        btn.addEventListener("click", () => {
                            previewTitle.textContent =
                                btn.dataset.title || "Предпросмотр";
                            previewFrame.src = btn.dataset.url;
                            previewWrap.style.display = "block";
                            previewCloseBtn?.focus();
                        });
                    });
                    const del = tr.querySelector(".deleteGroup");
                    del?.addEventListener("click", async () => {
                        if (!confirm("Удалить все файлы этого BPMN-набора?"))
                            return;
                        const ids = (del.dataset.ids || "")
                            .split(",")
                            .filter(Boolean);
                        try {
                            for (const id of ids) {
                                await fetch(
                                    `/delete_regulation_file/${encodeURIComponent(
                                        id
                                    )}`,
                                    { method: "DELETE" }
                                );
                            }
                            await loadUploaded();
                        } catch (e) {
                            console.error(e);
                            alert("Ошибка удаления набора");
                        }
                    });
                }
            );
        });

        // --- Прочие документы
        singles.forEach((doc) => {
            rowIdx++;

            const actionsTd = document.createElement("td");
            const actionsDiv = document.createElement("div");
            actionsDiv.className = "actions-grid";
            actionsDiv.innerHTML = `
            <a href="${doc.url}" target="_blank" rel="noopener">Открыть</a>
            ${
                isPreviewable(doc.content_type)
                    ? `<button type="button" class="btn previewBtn" data-url="${
                          doc.url
                      }" data-title="${escapeAttr(
                          doc.title || "Предпросмотр"
                      )}">Предпросмотр</button>`
                    : ""
            }
        `;
            actionsTd.appendChild(actionsDiv);

            const controlsTd = document.createElement("td");
            const controlsDiv = document.createElement("div");
            controlsDiv.className = "controls-stack";
            controlsDiv.innerHTML = `<button type="button" class="btn btn-danger deleteFile" data-id="${doc._id}">Удалить</button>`;
            controlsTd.appendChild(controlsDiv);

            appendRow(
                [
                    mkTd(String(rowIdx), null, false),
                    mkTd(escapeHtml(doc.title || "Без названия")),
                    mkTd(escapeHtml(doc.content_type || "")),
                    mkTd(formatBytes(doc.size)),
                    mkTd(
                        doc.uploaded_at
                            ? new Date(doc.uploaded_at).toLocaleString()
                            : ""
                    ),
                    actionsTd,
                    controlsTd,
                ],
                (tr) => {
                    const prev = tr.querySelector(".previewBtn");
                    prev?.addEventListener("click", () => {
                        previewTitle.textContent =
                            prev.dataset.title || "Предпросмотр";
                        previewFrame.src = prev.dataset.url;
                        previewWrap.style.display = "block";
                        previewCloseBtn?.focus();
                    });
                    const del = tr.querySelector(".deleteFile");
                    del?.addEventListener("click", async () => {
                        if (!confirm("Удалить документ?")) return;
                        try {
                            const res = await fetch(
                                `/delete_regulation_file/${encodeURIComponent(
                                    del.dataset.id
                                )}`,
                                { method: "DELETE" }
                            );
                            const data = await res.json();
                            if (data.success) {
                                const currentSrc = previewFrame?.src || "";
                                await loadUploaded();
                                if (
                                    currentSrc &&
                                    !uploadedTbody.querySelector(
                                        `.previewBtn[data-url="${currentSrc}"]`
                                    )
                                ) {
                                    previewWrap.style.display = "none";
                                    previewFrame.src = "";
                                }
                            } else {
                                alert(data.error || "Ошибка удаления");
                            }
                        } catch (e) {
                            console.error(e);
                            alert("Сетевая ошибка при удалении");
                        }
                    });
                }
            );
        });

        if (!uploadedTbody.children.length) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 7;
            td.textContent = "Нет загруженных документов";
            tr.appendChild(td);
            uploadedTbody.appendChild(tr);
        }
    }

    async function loadUploaded() {
        try {
            const res = await fetch("/get_regulation_files");
            const data = await res.json();
            if (data.success) {
                renderUploaded(data.items || []);
            } else {
                uploadedTbody.innerHTML =
                    '<tr><td colspan="7">Ошибка загрузки списка</td></tr>';
            }
        } catch (e) {
            console.error(e);
            uploadedTbody.innerHTML =
                '<tr><td colspan="7">Сетевая ошибка</td></tr>';
        }
    }

    if (uploadForm) {
        uploadForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            uploadMsg.textContent = "";

            if (!docFile.files.length) {
                uploadMsg.textContent = "Выберите файл";
                return;
            }

            const fd = new FormData();
            const t = docTitle.value.trim();
            if (t) fd.append("title", t);
            fd.append("file", docFile.files[0]);

            try {
                const res = await fetch("/upload_regulation", {
                    method: "POST",
                    body: fd,
                });
                const data = await res.json();
                if (data.success) {
                    uploadMsg.textContent = "Файл загружен";
                    uploadForm.reset();
                    await loadUploaded();
                } else {
                    uploadMsg.textContent = data.error || "Ошибка загрузки";
                }
            } catch (e) {
                console.error(e);
                uploadMsg.textContent = "Сетевая ошибка";
            }
        });
    }

    // =========================
    // БЛОК: Реестр регламентов
    // =========================
    const regsTbody = document.querySelector("#regsTable tbody");
    const addRowBtn = document.getElementById("addRow");
    const saveRegsBtn = document.getElementById("saveRegs");

    // утилиты
    function topRows() {
        return Array.from(regsTbody?.children || []).filter(
            (el) => el.tagName === "TR"
        );
    }
    function syncRowNumbers() {
        topRows().forEach((tr, i) => {
            const cell = tr.querySelector(".row-number");
            if (cell) cell.textContent = i + 1;
        });
    }

    // создатели строк
    function createDocRow(doc = { title: "", external_id: "" }) {
        const r = document.createElement("tr");
        r.innerHTML = `
    <td><input type="text" class="doc-name" placeholder="Название" value="${(
        doc.title || ""
    ).replace(/"/g, "&quot;")}"></td>
    <td><input type="text" class="doc-id" placeholder="ID или URL" value="${(
        doc.external_id || ""
    ).replace(/"/g, "&quot;")}"></td>
    <td><button class="btn btn-danger deleteRow" type="button">Удалить</button></td>
  `;
        // удаление строки документа
        r.querySelector(".deleteRow").addEventListener("click", () => {
            r.remove();
        });
        return r;
    }

    function createRegRow(
        reg = { name: "", documents: [{ title: "", external_id: "" }] }
    ) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
    <td class="row-number"></td>
    <td>
      <input type="text" class="reg-name" placeholder="Наименование регламента" value="${(
          reg.name || ""
      ).replace(/"/g, "&quot;")}">
    </td>
    <td>
      <table class="table inner-table">
        <thead>
          <tr>
            <th>Название</th>
            <th>ID/внешняя ссылка</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody class="docs-rows"></tbody>
      </table>
      <button class="btn addDocRow" type="button">Добавить документ</button>
    </td>
  `;

        // наполнить документы
        const docsTbody = tr.querySelector(".docs-rows");
        const docs =
            Array.isArray(reg.documents) && reg.documents.length
                ? reg.documents
                : [{ title: "", external_id: "" }];
        docs.forEach((d) => docsTbody.appendChild(createDocRow(d)));

        // обработчик «Добавить документ»
        const addDocBtn = tr.querySelector(".addDocRow");
        addDocBtn.addEventListener("click", () => {
            docsTbody.appendChild(createDocRow());
        });

        return tr;
    }

    // рендер реестра из данных
    function renderRegistry(items = []) {
        regsTbody.textContent = "";
        if (!Array.isArray(items) || !items.length) {
            regsTbody.appendChild(createRegRow()); // пустая строка по умолчанию
        } else {
            items.forEach((reg) => regsTbody.appendChild(createRegRow(reg)));
        }
        syncRowNumbers();
    }

    // собрать данные из DOM
    function collectRegistry() {
        const regs = [];
        topRows().forEach((tr) => {
            const name = tr.querySelector(".reg-name")?.value.trim();
            if (!name) return;
            const docs = [];
            tr.querySelectorAll(".docs-rows tr").forEach((dr) => {
                const dname = dr.querySelector(".doc-name")?.value.trim();
                const did = dr.querySelector(".doc-id")?.value.trim();
                if (dname || did)
                    docs.push({ title: dname || "", external_id: did || "" });
            });
            regs.push({ name, documents: docs });
        });
        return regs;
    }

    // загрузка сохранённого реестра
    async function loadRegistry() {
        try {
            const res = await fetch("/get_regulations_list");
            const data = await res.json();
            if (data.success) {
                renderRegistry(data.items || []);
            } else {
                console.error(data.error || "Ошибка загрузки реестра");
                renderRegistry([]);
            }
        } catch (e) {
            console.error(e);
            renderRegistry([]);
        }
    }

    // добавление новой строки
    addRowBtn?.addEventListener("click", () => {
        regsTbody.appendChild(createRegRow());
        syncRowNumbers();
    });

    // сохранение реестра
    saveRegsBtn?.addEventListener("click", async () => {
        const regs = collectRegistry();
        try {
            const res = await fetch("/save_regulations_list", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ regulations: regs }),
            });
            const data = await res.json();
            if (data.success) {
                alert("Перечень сохранён");
                await loadRegistry(); // перерисуем, чтобы зафиксировать авто-нумерацию и актуальное состояние
            } else {
                alert(data.error || "Ошибка при сохранении");
            }
        } catch (e) {
            console.error(e);
            alert("Сетевая ошибка");
        }
    });

    // инициализация
    if (regsTbody) {
        loadRegistry(); // первичная загрузка
    }

    // первичная загрузка файлов
    loadUploaded();
});
