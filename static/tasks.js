document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("tasks-form");
    const tbody = document.querySelector("#tasks-table tbody");

    const submitBtn = document.getElementById("submitTask");
    const saveBtn = document.getElementById("saveChanges");
    const syncBtn = document.getElementById("syncSources");
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

    // -------- helpers --------
    const $ = (id) => document.getElementById(id);
// ===== ЗАДАЧА: предустановленные значения + "Другое" =====
const GOAL_PRESETS = [
  "Финансы",
  "Персонал",
  "Продажи",
  "Социальная ответственность",
];

const goalSelect = document.getElementById("goal");
const goalCustom = document.getElementById("goal-custom");

// показать/скрыть поле "Другое" в зависимости от выбора
function toggleGoalCustom() {
  const isOther = goalSelect.value === "__other__";
  goalCustom.style.display = isOther ? "block" : "none";
  goalCustom.required = isOther;       // если "Другое" — делаем поле обязательным
  if (!isOther) goalCustom.value = ""; // если вернулись к предустановке — очищаем
}
if (goalSelect && goalCustom) {
  goalSelect.addEventListener("change", toggleGoalCustom);
}

// получить значение "Задачи" с учётом "Другое"
function getGoalValueFromUI() {
  if (!goalSelect) return "";
  return goalSelect.value === "__other__" ? (goalCustom.value || "").trim()
                                          : goalSelect.value;
}

// выставить UI из произвольного значения (для режима "Редактировать")
function setGoalUIFromValue(v) {
  if (!goalSelect) return;
  const clean = (v || "").trim();
  if (GOAL_PRESETS.includes(clean)) {
    goalSelect.value = clean;
    toggleGoalCustom();
  } else if (clean) {
    goalSelect.value = "__other__";
    toggleGoalCustom();
    goalCustom.value = clean;
  } else {
    goalSelect.value = "";
    toggleGoalCustom();
  }
}
    async function fetchJSON(url, options = {}) {
        const opts = {
            credentials: "same-origin",
            headers: { Accept: "application/json", ...(options.headers || {}) },
            ...options,
        };
        const res = await fetch(url, opts);

        // если редирект на логин или отдан HTML/текст — покажем понятное сообщение
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
            const text = await res.text();
            if (
                res.redirected ||
                res.status === 401 ||
                /<html|<!doctype/i.test(text)
            ) {
                throw new Error(
                    "Похоже, требуется вход в систему. Обновите страницу и войдите заново."
                );
            }
            throw new Error(
                text.slice(0, 300) || `Неожиданный ответ (${res.status})`
            );
        }

        let data;
        try {
            data = await res.json();
        } catch (e) {
            throw new Error("Некорректный JSON от сервера");
        }
        if (!res.ok) {
            throw new Error(data.error || `Ошибка ${res.status}`);
        }
        return data;
    }

    // ---------- datalists: ТОЛЬКО этапы -> список «Задача» ----------
    async function preloadStageNames() {
        try {
            const doc = await fetchJSON("/get_business_goal");

            // Собираем названия этапов из возможных форматов
            const names = [];

            // формат: { stages: [ { stageNumber, stageDescription, stageDate }, ... ] }
            if (Array.isArray(doc?.stages)) {
                for (const s of doc.stages) {
                    const v = (s?.stageNumber || "").trim();
                    if (v) names.push(v);
                }
            }

            // запасной формат: { stageNumber: ["Этап 1", "Этап 2", ...] }
            if (Array.isArray(doc?.stageNumber)) {
                for (const v of doc.stageNumber) {
                    if (typeof v === "string" && v.trim()) names.push(v.trim());
                }
            }

            const uniq = [...new Set(names)];
            const dl = $("task-list");
            if (!dl) return;
            dl.innerHTML = "";
            uniq.forEach((v) => {
                const opt = document.createElement("option");
                opt.value = v;
                dl.appendChild(opt);
            });
        } catch (e) {
            console.error("Не удалось загрузить названия этапов:", e);
            // тихо игнорируем, поле просто останется пустым
        }
    }

    // ---------- datalists: «Мероприятие» — НЕ трогаем «Задача» ----------
    async function preloadEventList() {
        const eventList = $("event-list");
        if (!eventList) return;
        eventList.innerHTML = "";
        try {
            const mp = await fetchJSON("/get_meeting_protocol");
            [
                "Бизнес-цель",
                mp.meetingDate ? `Протокол совещания ${mp.meetingDate}` : "",
            ]
                .filter(Boolean)
                .forEach((name) => {
                    const o = document.createElement("option");
                    o.value = name;
                    eventList.appendChild(o);
                });
        } catch {
            // если протокола нет — оставим только «Бизнес-цель»
            const o = document.createElement("option");
            o.value = "Бизнес-цель";
            eventList.appendChild(o);
        }
    }

    // ---------- загрузка / рендер задач ----------
    async function loadTasks() {
        try {
            const tasks = await fetchJSON("/get_tasks");
            tbody.innerHTML = "";

            (tasks || []).forEach((t, i) => {
                const id = t._id || t.id || "";
                const tr = document.createElement("tr");
                tr.setAttribute("data-id", id);
                tr.innerHTML = `
          <td>${i + 1}</td>
          <td>${t.task || ""}</td>
          <td>${t.event || ""}</td>
          <td>${t.work || ""}</td>
          <td>${t.responsible || ""}</td>
          <td>${t.deadline || ""}</td>
          <td>${t.result || ""}</td>
          <td>${t.resources || ""}</td>
          <td>${t.coexecutors || ""}</td>
          <td>${t.comments || ""}</td>
          <td>
            <button class="edit-task btn btn-primary" data-id="${id}">Редактировать</button>
            <button class="delete-task btn btn-danger" data-id="${id}">Удалить</button>
            <button class="duplicate-task btn btn-secondary" data-id="${id}">Дублировать</button>
          </td>
        `;
                tbody.appendChild(tr);
            });

            bindRowActions();
        } catch (e) {
            console.error("Ошибка загрузки задач:", e);
            alert(String(e.message || e));
        }
    }

    // ---------- действия по рядам ----------
    function bindRowActions() {
        // Удаление с подтверждением
        tbody.querySelectorAll(".delete-task").forEach((btn) => {
            btn.onclick = async () => {
                const id = btn.dataset.id;
                if (!id) return;

                const row = btn.closest("tr");
                const title =
                    row?.children?.[1]?.textContent?.trim() || "эту задачу";
                const deadline = row?.children?.[5]?.textContent?.trim();
                const msg = `Удалить «${title}»${
                    deadline ? ` (срок: ${deadline})` : ""
                }?`;

                if (!confirm(msg)) return;

                try {
                    const data = await fetchJSON(
                        `/delete_task/${encodeURIComponent(id)}`,
                        { method: "DELETE" }
                    );
                    alert(data.message || "Готово");
                    await loadTasks();
                } catch (e) {
                    alert(String(e.message || e));
                }
            };
        });

        // Редактирование
        tbody.querySelectorAll(".edit-task").forEach((btn) => {
  btn.onclick = () => {
    const cells = btn.closest("tr").children;
    setGoalUIFromValue(cells[1].textContent.trim());
    $("event").value       = cells[2].textContent;
    $("work").value        = cells[3].textContent; // работа/поручение
    $("responsible").value = cells[4].textContent;
    $("deadline").value    = cells[5].textContent;
    $("result").value      = cells[6].textContent;
    $("resources").value   = cells[7].textContent;
    $("coexecutors").value = cells[8].textContent;
    $("comments").value    = cells[9].textContent;

    saveBtn.dataset.id = btn.dataset.id || "";
    submitBtn.style.display = "none";
    saveBtn.style.display = "inline-block";
  };
});

    }

    // ---------- обработчики формы ----------
    function bindFormHandlers() {
        form?.addEventListener("submit", (e) => {
            e.preventDefault();
            if (saveBtn.style.display !== "none" && saveBtn.dataset.id) {
                doSaveChanges();
            } else {
                addTask();
            }
        });

        submitBtn?.addEventListener("click", (e) => {
            e.preventDefault();
            addTask();
        });

        saveBtn?.addEventListener("click", (e) => {
            e.preventDefault();
            doSaveChanges();
        });
    }

    async function addTask() {
        const payload = collectForm();
        if (!payload.task) {
            alert("Название задачи обязательно");
            return;
        }
        try {
            const data = await fetchJSON("/add_task", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            alert(data.message || "Готово");
            form.reset();
            await loadTasks();
        } catch (e) {
            alert(String(e.message || e));
        }
    }

    async function doSaveChanges() {
        const id = saveBtn.dataset.id;
        if (!id) return;
        const payload = collectForm();
        try {
            const data = await fetchJSON(
                `/edit_task/${encodeURIComponent(id)}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            );
            alert(data.message || "Готово");
            saveBtn.style.display = "none";
            saveBtn.dataset.id = "";
            submitBtn.style.display = "inline-block";
            form.reset();
            await loadTasks();
        } catch (e) {
            alert(String(e.message || e));
        }
    }

    function collectForm() {
  return {
    task: getGoalValueFromUI(),                         // ← здесь учтено "Другое"
    event: document.getElementById("event").value,
    work: document.getElementById("work").value,
    responsible: document.getElementById("responsible").value,
    deadline: document.getElementById("deadline").value,
    result: document.getElementById("result").value,
    resources: document.getElementById("resources").value,
    coexecutors: document.getElementById("coexecutors").value,
    comments: document.getElementById("comments").value,
  };
}
    // ---------- синхронизация ----------
    function bindSyncButton() {
        if (!syncBtn) return;
        syncBtn.addEventListener("click", async () => {
            syncBtn.disabled = true;
            try {
                const data = await fetchJSON("/sync_tasks_from_sources", {
                    method: "POST",
                });
                alert(data.message || "Готово");
                await Promise.all([
                    preloadStageNames(),
                    preloadEventList(),
                    loadTasks(),
                ]);
            } catch (e) {
                alert("Ошибка синхронизации: " + String(e.message || e));
            } finally {
                syncBtn.disabled = false;
            }
        });
    }

    // ---------- копирование строки ----------
    function bindCopyDelegation() {
        tbody.addEventListener("click", (e) => {
            const btn = e.target.closest(".copy-row");
            if (!btn) return;
            const row = btn.closest("tr");
            const cells = Array.from(row.children)
                .slice(0, 10)
                .map((td) => td.textContent.trim());
            navigator.clipboard
                .writeText(cells.join(" | "))
                .then(() => alert("Скопировано в буфер"))
                .catch(() => alert("Не удалось скопировать"));
        });
    }

    // ---------- дублирование строки ----------
    function bindDuplicateDelegation() {
        tbody.addEventListener("click", async (e) => {
            const btn = e.target.closest(".duplicate-task");
            if (!btn) return;

            // Текущая строка
            const row = btn.closest("tr");
            if (!row) return;

            // Собираем данные из ячеек (строго по колонкам таблицы)
            const cells = row.querySelectorAll("td");
            const payload = {
                task: (cells[1]?.textContent || "").trim(),
                event: (cells[2]?.textContent || "").trim(),
                work: (cells[3]?.textContent || "").trim(),
                responsible: (cells[4]?.textContent || "").trim(),
                deadline: (cells[5]?.textContent || "").trim(),
                result: (cells[6]?.textContent || "").trim(),
                resources: (cells[7]?.textContent || "").trim(),
                coexecutors: (cells[8]?.textContent || "").trim(),
                comments: (cells[9]?.textContent || "").trim(),
            };

            try {
                // 1) Создаём новый документ через API
                const resp = await fetchJSON("/add_task", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

                // Возможные ответы бэка: {message, id} или просто {message}
                const createdId = resp?.id || null;

                // 2) Обновляем таблицу
                await loadTasks();

                // 3) Определяем id созданной строки:
                //    - если бэк вернул id — отлично
                //    - если нет — найдём по совпадению полей (берём последний матч)
                let newId = createdId;
                if (!newId) {
                    newId = findDuplicatedRowIdByPayload(payload);
                }

                // 4) Подставляем данные в форму и переводим в режим «Сохранить изменения»
                fillFormFromPayload(payload);

                if (newId) {
                    saveBtn.dataset.id = newId;
                    submitBtn.style.display = "none";
                    saveBtn.style.display = "inline-block";
                } else {
                    // Если id не удалось найти — всё равно даём отредактировать как новую
                    // (пользователь может нажать «Отправить», получится ещё один дубль)
                    saveBtn.dataset.id = "";
                    submitBtn.style.display = "inline-block";
                    saveBtn.style.display = "none";
                }

                // 5) Скроллим к началу страницы и фокусируем «Задачу»
                document
                    .getElementById("plan-top")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                document.getElementById("goal")?.focus();
            } catch (e) {
                alert(String(e.message || e));
            }
        });
    }

    /**
     * Пытаемся найти id только что добавленного дубля по значениям полей.
     * Ищем снизу вверх (последний совпавший ряд).
     */
    function findDuplicatedRowIdByPayload(payload) {
        const rows = Array.from(tbody.querySelectorAll("tr")).reverse();
        for (const tr of rows) {
            const tds = tr.querySelectorAll("td");
            const same =
                (tds[1]?.textContent || "").trim() === payload.task &&
                (tds[2]?.textContent || "").trim() === payload.event &&
                (tds[3]?.textContent || "").trim() === payload.work &&
                (tds[4]?.textContent || "").trim() === payload.responsible && // <-- тут была ошибка
                (tds[5]?.textContent || "").trim() === payload.deadline &&
                (tds[6]?.textContent || "").trim() === payload.result &&
                (tds[7]?.textContent || "").trim() === payload.resources &&
                (tds[8]?.textContent || "").trim() === payload.coexecutors &&
                (tds[9]?.textContent || "").trim() === payload.comments;

            if (same) {
                return tr.getAttribute("data-id") || null;
            }
        }
        return null;
    }

    /** Заполняем форму данными */
    function fillFormFromPayload(p) {
  
  setGoalUIFromValue(p.task || "");
  $("event").value       = p.event || "";
  $("work").value        = p.work || "";         
  $("responsible").value = p.responsible || "";
  $("deadline").value    = p.deadline || "";
  $("result").value      = p.result || "";
  $("resources").value   = p.resources || "";
  $("coexecutors").value = p.coexecutors || "";
  $("comments").value    = p.comments || "";
}

    // ---------- фильтр ----------
    function bindFilter() {
        const filterInput = $("filter-input");
        const filterColumn = $("filter-column");
        if (!filterInput || !filterColumn) return;

        const colIndexByName = {
            task: 1,
            event: 2,
            work: 3,
            responsible: 4,
            deadline: 5,
            result: 6,
            resources: 7,
            coexecutors: 8,
            comments: 9,
        };

        function applyFilter() {
            const q = filterInput.value.trim().toLowerCase();
            const col = filterColumn.value;

            Array.from(tbody.querySelectorAll("tr")).forEach((tr) => {
                const cells = tr.querySelectorAll("td");
                let match = false;

                if (col === "all") {
                    for (let i = 1; i <= 9; i++) {
                        if (
                            (cells[i]?.textContent || "")
                                .toLowerCase()
                                .includes(q)
                        ) {
                            match = true;
                            break;
                        }
                    }
                } else {
                    const idx = colIndexByName[col];
                    match = (cells[idx]?.textContent || "")
                        .toLowerCase()
                        .includes(q);
                }

                tr.style.display = match ? "" : "none";
            });
        }

        filterInput.addEventListener("input", applyFilter);
        filterColumn.addEventListener("change", applyFilter);
    }

    // ----- старт -----
    (async () => {
        await Promise.all([
            loadTasks(),
            preloadEventList(),
        ]);
        bindDuplicateDelegation();
        bindFilter();
        bindFormHandlers();
    })();
});
