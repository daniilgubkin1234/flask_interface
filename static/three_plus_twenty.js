document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("threePlusTwentyForm");
    let TPT_LOADING = false;
    document
        .querySelector(".toggle-sidebar")
        .addEventListener("click", function () {
            const sidebar = document.querySelector(".recommendation-block");
            const button = document.querySelector(".toggle-sidebar");

            // Одновременно применяем классы для синхронной анимации
            sidebar.classList.toggle("show");
            button.classList.toggle("menu-open");
        });

    // --- 2. Закрытие меню при клике вне области
    document.addEventListener("click", function (e) {
        const sidebar = document.querySelector(".recommendation-block");
        const button = document.querySelector(".toggle-sidebar");

        if (
            sidebar.classList.contains("show") &&
            !sidebar.contains(e.target) &&
            !button.contains(e.target)
        ) {
            sidebar.classList.remove("show");
            button.classList.remove("menu-open");
        }
    });
    // ---------------- helpers ----------------
    const $ = (id) => document.getElementById(id);

    async function fetchJSON(url, options = {}) {
        const opts = {
            credentials: "same-origin",
            headers: { Accept: "application/json", ...(options.headers || {}) },
            ...options,
        };
        const res = await fetch(url, opts);
        const ct = res.headers.get("content-type") || "";
        if (res.status === 204) return {}; // на всякий случай
        if (!ct.includes("application/json")) {
            const text = await res.text().catch(() => "");
            throw new Error(text || `Не JSON (HTTP ${res.status})`);
        }
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data?.error || `Ошибка ${res.status}`);
        }

        return data;
    }

    // загрузить список должностей в селект
    async function populateTptSelect() {
        const sel = document.getElementById("tptSelect");
        if (!sel) return;

        sel.innerHTML = `<option value="">— не выбрано —</option>`;

        try {
            const items = await fetchJSON("/tpt_positions"); // уже есть на бэке
            (items || []).forEach((it) => {
                const pos = (it.position || "").trim();
                if (!pos) return;
                const opt = document.createElement("option");
                opt.value = pos;
                opt.textContent = pos;
                sel.appendChild(opt);
            });
        } catch (e) {
            console.warn(
                "Не удалось получить список должностей для 3+20:",
                e.message || e
            );
        }
    }

    // применяем данные 3+20 к форме (без автосохранения)
    function fillTptForm(data) {
        const $ = (id) => document.getElementById(id);
        const safe = (v) =>
            (typeof v === "string" ? v : Array.isArray(v) ? v[0] : "") || "";

        TPT_LOADING = true;
        try {
            // должность
            $("position_name") &&
                ($("position_name").value = safe(data.position));

            // направления (3)
            const to3 = (arr = []) =>
                arr.slice(0, 3).concat(["", "", ""]).slice(0, 3);
            const directions = data.main_functions?.length
                ? data.main_functions
                : data.directions || [];
            const [d1, d2, d3] = to3(directions);
            $("direction_1") && ($("direction_1").value = d1 || "");
            $("direction_2") && ($("direction_2").value = d2 || "");
            $("direction_3") && ($("direction_3").value = d3 || "");

            // обязанности (до 20)
            const resp = (
                data.additional_functions?.length
                    ? data.additional_functions
                    : data.responsibilities || []
            ).slice(0, 20);
            for (let i = 1; i <= 20; i++) {
                const el = $("responsibility_" + i);
                if (el) el.value = resp[i - 1] || "";
            }
        } finally {
            // небольшой таймер, чтобы события input от отрисовки не улетели в autosave
            setTimeout(() => {
                TPT_LOADING = false;
            }, 0);
        }
    }

    // загрузка карточки по должности
    async function loadTptByPosition(position) {
        if (!position) return;
        try {
            const data = await fetchJSON(
                `/api/tpt/by_position?position=${encodeURIComponent(position)}`
            );
            if (!data || Object.keys(data).length === 0) {
                // ничего не нашли — просто очистим и выставим должность
                fillTptForm({ position, directions: [], responsibilities: [] });
                return;
            }
            fillTptForm(data);
        } catch (e) {
            console.warn(
                "Не удалось загрузить 3+20 по должности:",
                e.message || e
            );
        }
    }

    // очистить форму до «чистой» карточки
    function clearTptForm() {
        fillTptForm({ position: "", directions: [], responsibilities: [] });
    }

    // ---------------- 1) Загрузка сохранённой версии 3+20 ----------------
    async function loadThreePlusTwenty() {
        try {
            const data = await fetchJSON("/get_three_plus_twenty");
            if (!data || Object.keys(data).length === 0) return;

            // 1.1 Должность
            const position = Array.isArray(data.position)
                ? data.position
                : [data.position].filter(Boolean);
            if (position[0] !== undefined && $("position_name")) {
                $("position_name").value = String(position[0] ?? "");
            }

            // 1.2 Источники полей (совместимость со старыми версиями)
            const toText = (x) =>
                typeof x === "string"
                    ? x
                    : (x &&
                          (x.name || x.task || x.work || x.title || x.value)) ||
                      "";

            const oldDirections = Array.isArray(data.directions)
                ? data.directions
                : [];
            const oldResp = Array.isArray(data.responsibilities)
                ? data.responsibilities
                : [];

            const mainFns = Array.isArray(data.main_functions)
                ? data.main_functions.map(toText)
                : [];
            const addFns = Array.isArray(data.additional_functions)
                ? data.additional_functions.map(toText)
                : [];

            // 1.3 Основные направления (3 шт.) — берём main_functions, иначе старое поле directions
            const directions = (
                mainFns.length ? mainFns.slice(0, 3) : oldDirections
            ).slice(0, 3);
            for (let i = 0; i < 3; i++) {
                if ($(`direction_${i + 1}`)) {
                    $(`direction_${i + 1}`).value = directions[i] || "";
                }
            }

            // 1.4 Должностные обязанности (20 шт.) — ТОЛЬКО из additional_functions или старого responsibilities
            const responsibilities = addFns.length ? addFns : oldResp;
            for (let i = 1; i <= 20; i++) {
                if ($(`responsibility_${i}`)) {
                    $(`responsibility_${i}`).value =
                        responsibilities[i - 1] || "";
                }
            }
        } catch (e) {
            console.warn("Не удалось загрузить 3+20:", e.message || e);
        }
    }

    // ---------------- 2) Datalist со списком задач для Направлений ----------------
    async function attachTaskDatalistToDirections() {
        // создаём единый datalist
        let dl = document.getElementById("task-options");
        if (!dl) {
            dl = document.createElement("datalist");
            dl.id = "task-options";
            document.body.appendChild(dl);
        }
        // привязываем к полям Направление 1–3
        ["direction_1", "direction_2", "direction_3"].forEach((id) => {
            const input = $(id);
            if (input) input.setAttribute("list", "task-options");
        });

        try {
            const tasks = await fetchJSON("/get_tasks");
            const names = [
                ...new Set(
                    (tasks || [])
                        .map((t) => (t.task || "").trim())
                        .filter(Boolean)
                ),
            ];

            dl.innerHTML = "";
            names.forEach((n) => {
                const opt = document.createElement("option");
                opt.value = n;
                dl.appendChild(opt);
            });
        } catch (e) {
            console.warn(
                "Не удалось загрузить список задач для направлений:",
                e.message || e
            );
        }
    }

    // ---------------- 3) Автосохранение ----------------
    // (Без дебаунса — при необходимости можно добавить)
    async function autoSave() {
        const position = [$("position_name")?.value?.trim() || ""];

        const directions = [
            $("direction_1")?.value?.trim() || "",
            $("direction_2")?.value?.trim() || "",
            $("direction_3")?.value?.trim() || "",
        ];

        const responsibilities = [];
        for (let i = 1; i <= 20; i++) {
            responsibilities.push(
                $(`responsibility_${i}`)?.value?.trim() || ""
            );
        }

        // Единый формат: main_functions = направления, additional_functions = обязанности
        const payload = {
            position,
            directions,
            responsibilities,
            main_functions: directions.filter(Boolean),
            additional_functions: responsibilities.filter(Boolean),
        };

        try {
            await fetchJSON("/save_three_plus_twenty", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        } catch (e) {
            console.warn("Не удалось сохранить 3+20:", e.message || e);
        }
    }

    // ---------------- 4) Init ----------------
    (async () => {
        await loadThreePlusTwenty(); // поднять сохранённые данные
        await attachTaskDatalistToDirections(); // подключить выпадающий список задач к направлениям

        // 1) Подтянуть список должностей в селект
        await populateTptSelect();

        // 2) Если форма уже содержит должность, подсветим её в селекте
        {
            const curPos = document
                .getElementById("position_name")
                ?.value?.trim();
            const sel = document.getElementById("tptSelect");
            if (curPos && sel) {
                const opt = Array.from(sel.options).find(
                    (o) => o.value === curPos
                );
                if (opt) sel.value = curPos;
            }
        }

        // 3) Переключение должности — загрузка соответствующей карточки 3+20
        document
            .getElementById("tptSelect")
            ?.addEventListener("change", (e) => {
                const pos = e.target.value;
                if (pos) {
                    loadTptByPosition(pos);
                } else {
                    // пустой пункт — начинаем «чистую» карточку
                    clearTptForm();
                    document.getElementById("position_name")?.focus();
                }
            });

        // 4) «+ Создать новый» — чистим форму, проставляем должность и делаем первое сохранение
        document
            .getElementById("tptCreateNewBtn")
            ?.addEventListener("click", () => {
                // Просто открыть пустую форму без каких-либо модалок и автосохранений
                clearTptForm();

                // Сбросить выбор в селекте «Выбрать должность»
                const sel = document.getElementById("tptSelect");
                if (sel) sel.value = "";

                // Поставить фокус в поле «Должность», чтобы пользователь сразу начал заполнять
                const posInput = document.getElementById("position_name");
                if (posInput) {
                    posInput.focus();
                    posInput.scrollIntoView({
                        block: "center",
                        behavior: "smooth",
                    });
                }
            });

        // 5) «Удалить» — удаляет все версии 3+20 по выбранной должности
        document
            .getElementById("tptDeleteBtn")
            ?.addEventListener("click", async () => {
                // Берём позицию прежде всего из селекта (там гарантированно точное совпадение),
                // если пусто — из поля "Должность".
                const fromSelect =
                    document.getElementById("tptSelect")?.value?.trim() || "";
                const fromInput =
                    document.getElementById("position_name")?.value?.trim() ||
                    "";
                const pos = fromSelect || fromInput;

                if (!pos) return alert("Нет выбранной должности.");

                if (!confirm(`Удалить все версии 3+20 по должности «${pos}»?`))
                    return;

                try {
                    const res = await fetchJSON("/api/tpt/delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ position: pos }),
                    });
                    await populateTptSelect();
                    clearTptForm();
                    alert(`Удалено документов: ${res.deleted || 0}`);
                } catch (e) {
                    alert(`Ошибка удаления: ${e.message || e}`);
                }
            });

        // навешиваем автосохранение на любые изменения формы
        let _saveTptTimer;
        function scheduleAutoSave() {
            if (TPT_LOADING) return; // <-- важная строка
            clearTimeout(_saveTptTimer);
            _saveTptTimer = setTimeout(autoSave, 700);
        }
        form?.addEventListener("input", scheduleAutoSave);
        window.addEventListener("beforeunload", () => {
            if (_saveTptTimer) clearTimeout(_saveTptTimer);
            // авто-save лёгкий и идемпотентный — можно вызвать синхронно
            navigator.sendBeacon?.(
                "/save_three_plus_twenty",
                new Blob(
                    [
                        JSON.stringify({
                            position: [
                                document
                                    .getElementById("position_name")
                                    ?.value?.trim() || "",
                            ],
                            directions: [
                                document
                                    .getElementById("direction_1")
                                    ?.value?.trim() || "",
                                document
                                    .getElementById("direction_2")
                                    ?.value?.trim() || "",
                                document
                                    .getElementById("direction_3")
                                    ?.value?.trim() || "",
                            ].filter(Boolean),
                            responsibilities: Array.from(
                                { length: 20 },
                                (_, i) =>
                                    document
                                        .getElementById(
                                            `responsibility_${i + 1}`
                                        )
                                        ?.value?.trim() || ""
                            ).filter(Boolean),
                            // поля main/additional продублируем — их же пишет autoSave
                            main_functions: [
                                document
                                    .getElementById("direction_1")
                                    ?.value?.trim() || "",
                                document
                                    .getElementById("direction_2")
                                    ?.value?.trim() || "",
                                document
                                    .getElementById("direction_3")
                                    ?.value?.trim() || "",
                            ].filter(Boolean),
                            additional_functions: Array.from(
                                { length: 20 },
                                (_, i) =>
                                    document
                                        .getElementById(
                                            `responsibility_${i + 1}`
                                        )
                                        ?.value?.trim() || ""
                            ).filter(Boolean),
                        }),
                    ],
                    { type: "application/json" }
                )
            );
        });
        // submit просто показывает уведомление (автосохранение уже сработало)
        form?.addEventListener("submit", function (event) {
            event.preventDefault();
            alert("Данные успешно сохранены!");
        });
    })();
    // --- Экспорт .doc по кнопке "Загрузить должностные обязанности" ---
    const downloadTptBtn = document.getElementById("downloadThreePlusTwenty");
    if (downloadTptBtn) {
        downloadTptBtn.addEventListener("click", () => {
            const data = collectThreePlusTwentyData();
            const html = buildThreePlusTwentyDocHTML(data);
            const datePart = new Date()
                .toISOString()
                .slice(0, 10)
                .replaceAll("-", ".");
            downloadDoc(html, `Должностные_обязанности_${datePart}.doc`);
        });
    }

    // Собираем данные формы "3+20"
    function collectThreePlusTwentyData() {
        const position =
            document.getElementById("position_name")?.value?.trim() || "";

        const directions = [
            document.getElementById("direction_1")?.value?.trim() || "",
            document.getElementById("direction_2")?.value?.trim() || "",
            document.getElementById("direction_3")?.value?.trim() || "",
        ].filter(Boolean);

        const responsibilities = Array.from(
            { length: 20 },
            (_, i) =>
                document
                    .getElementById(`responsibility_${i + 1}`)
                    ?.value?.trim() || ""
        ).filter(Boolean);

        return { position, directions, responsibilities };
    }

    // Генерация HTML для Word (.doc)
    function buildThreePlusTwentyDocHTML(d) {
        const esc = (s) =>
            String(s)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;");

        const dirRows = (d.directions.length ? d.directions : ["", "", ""])
            .slice(0, 3)
            .map(
                (val, idx) => `
        <tr>
          <td style="width:40px;">${idx + 1}</td>
          <td>${esc(val || "")}</td>
        </tr>
      `
            )
            .join("");

        const respRows = (
            d.responsibilities.length
                ? d.responsibilities
                : Array.from({ length: 20 }, () => "")
        )
            .slice(0, 20)
            .map(
                (val, idx) => `
        <tr>
          <td style="width:40px;">${idx + 1}</td>
          <td>${esc(val || "")}</td>
        </tr>
      `
            )
            .join("");

        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Должностные обязанности (3+20)</title>
<style>
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.35; }
  h1   { text-align:center; font-size:18pt; margin:0 0 12pt; }
  h2   { font-size:14pt; margin:12pt 0 6pt; }
  p    { margin:0 0 6pt; }
  table { width:100%; border-collapse:collapse; margin:8pt 0; }
  th, td { border:1px solid #000; padding:6pt; vertical-align:top; }
  th { text-align:center; }
</style>
</head>
<body>
  <h1>Должностные обязанности (3+20)</h1>

  <p><b>Должность:</b> ${esc(d.position)}</p>

  <h2>Основные направления (3)</h2>
  <table>
    <thead>
      <tr><th style="width:40px;">№</th><th>Направление</th></tr>
    </thead>
    <tbody>
      ${dirRows}
    </tbody>
  </table>

  <h2>Должностные обязанности (до 20)</h2>
  <table>
    <thead>
      <tr><th style="width:40px;">№</th><th>Обязанность</th></tr>
    </thead>
    <tbody>
      ${respRows}
    </tbody>
  </table>
</body>
</html>`;
    }

    // Утилита скачивания .doc (как в business_goal_form.js)
    function downloadDoc(htmlString, filename) {
        const blob = new Blob([htmlString], {
            type: "application/msword;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
});
