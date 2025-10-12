document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("jobDescriptionForm");
 document.querySelectorAll('.recommendation-block button[data-route]').forEach(button => {
        button.addEventListener('click', function() {
            const route = this.getAttribute('data-route');
            if (route) {
                window.location.href = route;
            }
        });
    // -------------------- Вспомогательные функции --------------------
    const byName = (n) => document.getElementsByName(n)[0];
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
    // Добавить недостающие функции
    async function fetchEmployeeById(id) {
        try {
            const res = await fetch(`/api/employees/${encodeURIComponent(id)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error("Ошибка загрузки профиля:", error);
            return null;
        }
    }

    function snapshotJDFromForm() {
        const formData = new FormData(document.getElementById('jobDescriptionForm'));
        const data = {};
        for (const [key, value] of formData.entries()) {
            data[key] = value;
        }
        return data;
    }

    function ensureInput(containerId, nameAttr, count) {
        const container = document.getElementById(containerId);
        while (
            container.querySelectorAll(`input[name="${nameAttr}"]`).length <
            count
        ) {
            const input = document.createElement("input");
            input.type = "text";
            input.name = nameAttr;
            input.placeholder =
                nameAttr === "mainActivity[]"
                    ? "Введите направление деятельности"
                    : "Введите должностную обязанность";
            input.required = true;
            container.appendChild(input);
        }
    }

    function getValues(containerId, nameAttr) {
        return Array.from(
            document.querySelectorAll(
                `#${containerId} input[name="${nameAttr}"]`
            )
        ).map((i) => i.value);
    }

    function setExact(containerId, nameAttr, values) {
        const container = document.getElementById(containerId);
        container.innerHTML = "";
        (values && values.length ? values : [""]).forEach((v) => {
            const input = document.createElement("input");
            input.type = "text";
            input.name = nameAttr;
            input.placeholder =
                nameAttr === "mainActivity[]"
                    ? "Введите направление деятельности"
                    : "Введите должностную обязанность";
            input.required = true;
            input.value = v ?? "";
            container.appendChild(input);
        });
    }

    // Перезаписывает первые N значений, не удаляя лишние строки пользователя
    function overwriteFirstN(containerId, nameAttr, values) {
        const n = values.length;
        ensureInput(containerId, nameAttr, n);
        const inputs = document.querySelectorAll(
            `#${containerId} input[name="${nameAttr}"]`
        );
        for (let i = 0; i < n; i++) inputs[i].value = values[i] ?? "";
    }

    // Подпись и рендер «Дополнительных пунктов»
    function renderAdditionalFields(values) {
        const wrap = document.getElementById("profileAdditionalFields");
        wrap.innerHTML = "";

        const items = Array.isArray(values)
            ? values
                  .map((v) => (typeof v === "string" ? v.trim() : ""))
                  .filter(Boolean)
            : [];

        if (items.length === 0) return;

        const label = document.createElement("label");
        label.id = "additionalFieldsLabel";
        label.textContent = "Дополнительные пункты:";
        wrap.appendChild(label);

        items.forEach((v) => {
            const inp = document.createElement("input");
            inp.type = "text";
            inp.name = "additionalFields[]";
            inp.value = v;
            wrap.appendChild(inp);
        });
    }

    // Нормализация
    const normStr = (s) => (typeof s === "string" ? s.trim() : "");
    const normArr = (arr, len) => {
        const a = Array.isArray(arr) ? arr.map(normStr) : [];
        const r = typeof len === "number" ? a.slice(0, len) : a.slice();
        if (typeof len === "number") while (r.length < len) r.push("");
        return r;
    };

    // ---- 3+20 ----
    function makeTPTNormalized(tpt) {
        return {
            position: normStr(
                Array.isArray(tpt?.position) ? tpt.position[0] : ""
            ),
            directions: normArr(tpt?.directions, 3),
            responsibilities: normArr(tpt?.responsibilities, 20),
        };
    }

    function makeJDSubsetNormalized(jd) {
        const acts = Array.isArray(jd?.mainActivity)
            ? jd.mainActivity
            : Array.isArray(jd?.["mainActivity[]"])
            ? jd["mainActivity[]"]
            : [];
        const duties = Array.isArray(jd?.jobDuty)
            ? jd.jobDuty
            : Array.isArray(jd?.["jobDuty[]"])
            ? jd["jobDuty[]"]
            : [];
        return {
            position: normStr(jd?.position || ""),
            directions: normArr(acts, 3),
            responsibilities: normArr(duties, 20),
            tptSig: jd?.__tptSig || "",
            empSig: jd?.__empSig || "",
        };
    }

    const eqArr = (a, b) =>
        a.length === b.length &&
        a.every((v, i) => normStr(v) === normStr(b[i]));

    function arraysPayloadEqual(a, b) {
        return (
            normStr(a.position) === normStr(b.position) &&
            eqArr(a.directions, b.directions) &&
            eqArr(a.responsibilities, b.responsibilities)
        );
    }

    const computeTptSig = (obj) =>
        JSON.stringify({
            p: normStr(obj.position),
            d: normArr(obj.directions, 3),
            r: normArr(obj.responsibilities, 20),
        });

    // ---- EMP (портрет) ----
    const EMP_KEYS = [
        "name", "gender", "age", "residence", "education", "speech", "languages", 
        "pc", "appearance", "habits", "info", "accuracy", "scrupulousness", 
        "systemThinking", "decisiveness", "stressResistance", "otherQualities", 
        "independence", "organization", "responsibility", "managementStyle", 
        "leadership", "mobility", "businessTrips", "car",
    ];

    function makeEmpNormalized(emp) {
        const o = {};
        EMP_KEYS.forEach((k) => (o[k] = normStr(emp?.[k] ?? "")));
        o.additionalFields = Array.isArray(emp?.additionalFields)
            ? emp.additionalFields.map(normStr)
            : [];
        return o;
    }

    const computeEmpSig = (e) =>
        JSON.stringify({
            ...EMP_KEYS.reduce(
                (acc, k) => ((acc[k] = normStr(e[k] ?? "")), acc),
                {}
            ),
            additionalFields: (e.additionalFields || []).map(normStr),
        });

    function hasMeaningfulEmpSection(jd) {
        return (
            EMP_KEYS.some((k) => normStr(jd?.[k] || "") !== "") ||
            (Array.isArray(jd?.additionalFields) &&
                jd.additionalFields.some((v) => normStr(v) !== ""))
        );
    }

    // -------------------- рендер сохранённой ДИ --------------------
    function applyJobDescriptionData(data) {
        if (!data || Object.keys(data).length === 0) return;

        // общие (титульный и др.)
        [
            "company", "position", "approval", "appointedBy", "documentPurpose", 
            "replaces", "activityGuide", "supervisor", "rights", "responsibility",
        ].forEach((name) => {
            const el = byName(name);
            if (el && data[name] !== undefined) el.value = data[name];
        });

        // блок 2 — читаем как новые имена, так и старые (обратная совместимость)
        const mapOldToNew = {
            pcSkills: "pc",
            infoSkills: "info",
            decisionMaking: "independence",
        };
        EMP_KEYS.forEach((name) => {
            const el = byName(name);
            if (!el) return;
            if (data[name] !== undefined) el.value = data[name];
            else {
                const old = Object.keys(mapOldToNew).find(
                    (k) => mapOldToNew[k] === name
                );
                if (old && data[old] !== undefined) el.value = data[old];
            }
        });

        // дополнительные пункты профиля
        renderAdditionalFields(
            Array.isArray(data.additionalFields) ? data.additionalFields : []
        );

        // массивы разделов 3 и 4
        const mainActivities = Array.isArray(data.mainActivity)
            ? data.mainActivity
            : Array.isArray(data["mainActivity[]"])
            ? data["mainActivity[]"]
            : [];
        setExact("mainActivities", "mainActivity[]", mainActivities);

        const jobDuties = Array.isArray(data.jobDuty)
            ? data.jobDuty
            : Array.isArray(data["jobDuty[]"])
            ? data["jobDuty[]"]
            : [];
        setExact("jobDuties", "jobDuty[]", jobDuties);
    }

    // -------------------- импорт из 3+20 (с проверкой) --------------------
    function importFromTPTIfNeeded(jd, tpt) {
        const tptN = makeTPTNormalized(tpt);
        const jdN = makeJDSubsetNormalized(jd);
        const tptIsEmpty =
            !tptN.position &&
            !tptN.directions.some((x) => x) &&
            !tptN.responsibilities.some((x) => x);
        if (tptIsEmpty) return { imported: false, tptSig: jdN.tptSig };

        const newSig = computeTptSig(tptN);

        if (!hasMeaningfulJD(jd)) {
            applyImportFromTPT(tptN);
            return { imported: true, tptSig: newSig };
        }
        if (jdN.tptSig && jdN.tptSig === newSig) {
            return { imported: false, tptSig: jdN.tptSig };
        }
        if (arraysPayloadEqual(jdN, tptN)) {
            return { imported: false, tptSig: jdN.tptSig || newSig };
        }
        applyImportFromTPT(tptN);
        return { imported: true, tptSig: newSig };
    }

    function hasMeaningfulJD(jd) {
        const sub = makeJDSubsetNormalized(jd);
        return !!(
            sub.position ||
            sub.directions.some((x) => x) ||
            sub.responsibilities.some((x) => x)
        );
    }

    function applyImportFromTPT(tptN) {
        const positionEl = document.getElementById("position");
        if (positionEl) positionEl.value = tptN.position;
        overwriteFirstN("mainActivities", "mainActivity[]", tptN.directions);
        overwriteFirstN("jobDuties", "jobDuty[]", tptN.responsibilities);
    }

    // -------------------- импорт из Портрета (с проверкой) --------------------
    function importFromEMPIfNeeded(jd, emp) {
        const empN = makeEmpNormalized(emp);
        const jdEmpSig = jd?.__empSig || "";
        const newEmpSig = computeEmpSig(empN);

        const empIsEmpty =
            EMP_KEYS.every((k) => !empN[k]) &&
            (!empN.additionalFields || empN.additionalFields.length === 0);

        if (empIsEmpty) return { imported: false, empSig: jdEmpSig };

        if (!hasMeaningfulEmpSection(jd)) {
            applyImportFromEMP(empN);
            return { imported: true, empSig: newEmpSig };
        }

        if (jdEmpSig && jdEmpSig === newEmpSig) {
            return { imported: false, empSig: jdEmpSig };
        }

        // отличия есть — перезаписываем блок 2 полностью
        applyImportFromEMP(empN);
        return { imported: true, empSig: newEmpSig };
    }

    function applyImportFromEMP(empN) {
        EMP_KEYS.forEach((name) => {
            const el = byName(name);
            if (el) el.value = empN[name] || "";
        });
        renderAdditionalFields(empN.additionalFields || []);
    }

    // -------------------- автосохранение --------------------
    function autoSaveJobDescription(extra = {}) {
        const jsonData = {};

        // разделы 3 и 4
        jsonData.mainActivity = getValues(
            "mainActivities",
            "mainActivity[]"
        ).map((v) => v.trim());
        jsonData.jobDuty = getValues("jobDuties", "jobDuty[]").map((v) =>
            v.trim()
        );

        // собрать остальные поля формы
        const fd = new FormData(form);
        for (const [key, value] of fd.entries()) {
            if (key === "mainActivity[]" || key === "jobDuty[]") continue;
            if (key === "additionalFields[]") {
                if (!jsonData.additionalFields) jsonData.additionalFields = [];
                jsonData.additionalFields.push(value);
                continue;
            }
            if (jsonData[key] === undefined) jsonData[key] = value;
            else if (Array.isArray(jsonData[key])) jsonData[key].push(value);
            else jsonData[key] = [jsonData[key], value];
        }

        Object.assign(jsonData, extra);

        fetch("/submit_job_description", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(jsonData),
        }).catch((err) =>
            console.error("Не удалось сохранить должностную инструкцию:", err)
        );
    }

    form.addEventListener("input", () => {
        const extra = {};
        if (currentTptSig) extra.__tptSig = currentTptSig;
        if (currentEmpSig) extra.__empSig = currentEmpSig;
        if (currentEmpId) extra.__empId = currentEmpId;
        autoSaveJobDescription(extra);
    });

    // кнопки добавления строк
    document
        .getElementById("addActivity")
        .addEventListener("click", function () {
            ensureInput(
                "mainActivities",
                "mainActivity[]",
                getValues("mainActivities", "mainActivity[]").length + 1
            );
            const extra = {};
            if (currentTptSig) extra.__tptSig = currentTptSig;
            if (currentEmpSig) extra.__empSig = currentEmpSig;
            autoSaveJobDescription(extra);
        });

    document.getElementById("addDuty").addEventListener("click", function () {
        ensureInput(
            "jobDuties",
            "jobDuty[]",
            getValues("jobDuties", "jobDuty[]").length + 1
        );
        const extra = {};
        if (currentTptSig) extra.__tptSig = currentTptSig;
        if (currentEmpSig) extra.__empSig = currentEmpSig;
        autoSaveJobDescription(extra);
    });

    // -------------------- инициализация --------------------
    let currentTptSig = "";
    let currentEmpSig = "";
    let currentEmpId = "";

    const jdSelect = document.getElementById("jdEmployeeSelect");
    const jdImportBtn = document.getElementById("jdImportEmpBtn");

    function autoSaveWithSign(extra = {}) {
        const ex = { ...extra };
        if (currentTptSig) ex.__tptSig = currentTptSig;
        if (currentEmpSig) ex.__empSig = currentEmpSig;
        if (currentEmpId) ex.__empId = currentEmpId;
        autoSaveJobDescription(ex);
    }

    (async function initJD() {
        const [jd, tpt, empList, survey] = await Promise.all([
            fetch("/get_job_description").then((r) => r.json()).catch(() => ({})),
            fetch("/get_three_plus_twenty").then((r) => r.json()).catch(() => ({})),
            fetch("/api/employees").then((r) => r.json()).catch(() => []),
            fetch("/get_user_survey").then((r) => r.json()).catch(() => ({})),
        ]);

        // 1) рендерим то, что уже сохранено в ДИ
        applyJobDescriptionData(jd);

        // 2) если company в ДИ пусто — берём из диагностики ответ на q2
        try {
            const companyInput = document.getElementById("company");
            const hasJDCompany = (jd?.company || "").trim().length > 0;
            const companyFromSurvey = (survey?.q2 || "").trim();
            if (!hasJDCompany && companyFromSurvey) {
                companyInput.value = companyFromSurvey;
                autoSaveWithSign({ company: companyFromSurvey });
            }
        } catch (e) {
            /* no-op */
        }

        // 3) наполняем селект профилей
        currentEmpId = typeof jd?.__empId === "string" ? jd.__empId : "";
        if (!currentEmpId && Array.isArray(empList) && empList.length === 1) {
            currentEmpId = empList[0]?._id || "";
        }
        if (Array.isArray(empList)) {
            const opts = [
                '<option value="">— выберите профиль —</option>',
            ].concat(
                empList.map(
                    (e) =>
                        `<option value="${e._id}">${
                            e.name || "(без ФИО)"
                        }</option>`
                )
            );
            const sel = document.getElementById("jdEmployeeSelect");
            if (sel) {
                sel.innerHTML = opts.join("");
                if (currentEmpId) sel.value = currentEmpId;
            }
        }

        // 4) «умный» импорт из 3+20
        const tptRes = importFromTPTIfNeeded(jd, tpt);
        currentTptSig = tptRes.tptSig || currentTptSig;

        // 5) «умный» импорт из выбранного портрета
        if (currentEmpId) {
            const empDoc = await fetchEmployeeById(currentEmpId);
            if (empDoc) {
                const empRes = importFromEMPIfNeeded(jd, empDoc);
                currentEmpSig = empRes.empSig || currentEmpSig;
                if (tptRes.imported || empRes.imported) autoSaveWithSign();
            }
        }
    })();

    // ВЫБОР ПРОФИЛЯ
    jdSelect?.addEventListener("change", async () => {
        currentEmpId = jdSelect.value || "";
        if (!currentEmpId) return;

        const empDoc = await fetchEmployeeById(currentEmpId);
        if (!empDoc) {
            alert("Не удалось загрузить профиль.");
            return;
        }

        const jdNow = snapshotJDFromForm();
        const empRes = importFromEMPIfNeeded(jdNow, empDoc);
        currentEmpSig = empRes.empSig || currentEmpSig;
        
        autoSaveWithSign();
    });

    // импорт по кнопке
    jdImportBtn?.addEventListener("click", async () => {
        const id = jdSelect.value || "";
        if (!id) {
            alert("Выберите профиль для импорта.");
            return;
        }
        const empDoc = await fetchEmployeeById(id);
        if (!empDoc) {
            alert("Не удалось загрузить профиль.");
            return;
        }

        const jdNow = snapshotJDFromForm();
        const empRes = importFromEMPIfNeeded(jdNow, empDoc);
        currentEmpSig = empRes.empSig || currentEmpSig;
        currentEmpId = id;

        autoSaveWithSign();
        alert("Данные профиля импортированы в ДИ.");
    });

    // submit
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        alert("Должностная инструкция сохранена!");
    });

    // --- 7. Встроенный "Адаптационный план" на странице ДИ ---
    const jdContainer = document.getElementById("jdTasksContainer");
    if (jdContainer) {
        const AP_DEFAULT_TASKS = [
            "Задача 1: Оформление на работу",
            "Задача 2: Знакомство с коллективом, офисом, оргтехникой",
            "Задача 3: Изучение информации о компании",
            "Задача 4: Изучение стандартов компании",
            "Задача 5: Участие в планерке",
            "Задача 6: Уточнение адаптационного плана",
            "Задача 7: Формирование плана работы на неделю",
            "Задача 8: Просмотр видео-семинаров",
            "Задача 9: Чтение книг из корпоративной библиотеки",
            "Задача 10: Подведение итогов адаптации",
        ].map((title) => ({
            title,
            time: "",
            resources: "",
            customTitle: null,
            feedbackMentor: "",
            feedbackEmployee: "",
        }));

        const templateTask = jdContainer.querySelector("fieldset.task").cloneNode(true);
        const addButton = document.getElementById("jdAddTask");

        function renderJDTasks(tasks) {
            while (jdContainer.querySelectorAll("fieldset.task").length > 1) {
                jdContainer.querySelectorAll("fieldset.task")[1].remove();
            }
            tasks.forEach((t, idx) => {
                const el = idx === 0
                    ? jdContainer.querySelector("fieldset.task")
                    : templateTask.cloneNode(true);
                el.querySelector("legend").textContent = t.title || `Задача ${idx + 1}`;

                const timeEl = el.querySelector('input[name*="_time"]');
                const resEl = el.querySelector('textarea[name*="_resources"]');
                const sumM = el.querySelector('textarea[name*="_summarize_by_mentor"]');
                const sumE = el.querySelector('textarea[name*="_summarize_by_employee"]');

                if (timeEl) timeEl.value = t.time || "";
                if (resEl) resEl.value = t.resources || "";
                if (sumM) sumM.value = t.feedbackMentor || "";
                if (sumE) sumE.value = t.feedbackEmployee || "";

                if (idx !== 0) {
                    const wrapper = jdContainer.querySelector(".add-task-wrapper");
                    jdContainer.insertBefore(el, wrapper);
                }
            });
            updateJDNumbers();
            bindJDDeletes();
        }

        function collectJDTasks() {
            return Array.from(jdContainer.querySelectorAll("fieldset.task")).map(
                (fs) => ({
                    title: fs.querySelector("legend")?.textContent?.trim() || "",
                    time: fs.querySelector('input[name*="_time"]')?.value.trim() || "",
                    resources: fs.querySelector('textarea[name*="_resources"]')?.value.trim() || "",
                    customTitle: fs.querySelector('input[name*="_custom_title"]')?.value.trim() || null,
                    feedbackMentor: fs.querySelector('textarea[name*="_summarize_by_mentor"]')?.value.trim() || "",
                    feedbackEmployee: fs.querySelector('textarea[name*="_summarize_by_employee"]')?.value.trim() || "",
                })
            );
        }

        let saveTimer = null;
        function autoSaveJD() {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                const tasks = collectJDTasks();
                fetch("/submit_adaptation_plan", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tasks }),
                }).catch(() => {});
            }, 400);
        }

        function updateJDNumbers() {
            jdContainer.querySelectorAll("fieldset.task").forEach((fs, i) => {
                const title = fs.querySelector("legend")?.textContent || "";
                if (/^Задача\s+\d+/.test(title)) {
                    fs.querySelector("legend").textContent = `Задача ${i + 1}: ${title.split(":").slice(1).join(":").trim()}`;
                }
            });
        }

        function bindJDDeletes() {
            jdContainer.querySelectorAll(".delete-task-btn").forEach((btn) => {
                btn.onclick = () => {
                    const all = jdContainer.querySelectorAll("fieldset.task");
                    if (all.length <= 1) return;
                    btn.closest("fieldset.task")?.remove();
                    updateJDNumbers();
                    autoSaveJD();
                };
            });
        }

        addButton.addEventListener("click", () => {
            const wrapper = jdContainer.querySelector(".add-task-wrapper");
            const newEl = templateTask.cloneNode(true);
            jdContainer.insertBefore(newEl, wrapper);
            updateJDNumbers();
            bindJDDeletes();
            autoSaveJD();
        });

        jdContainer.addEventListener("input", autoSaveJD);

        fetch("/get_adaptation_plan")
            .then((r) => r.json())
            .then((tasks) => {
                const has = Array.isArray(tasks) && tasks.length > 0;
                renderJDTasks(has ? tasks : AP_DEFAULT_TASKS);
            })
            .catch(() => renderJDTasks(AP_DEFAULT_TASKS));
    }

     // ===== Экспорт .doc (как в meeting_protocol.js) =====
    function buildJobDescriptionDocHTML() {
        const formData = new FormData(form);
        const data = {};
        
        for (const [key, value] of formData.entries()) {
            if (key === 'mainActivity[]' || key === 'jobDuty[]' || key === 'additionalFields[]') {
                if (!data[key]) data[key] = [];
                data[key].push(value);
            } else {
                data[key] = value;
            }
        }

        const adaptationTasks = jdContainer ? collectJDTasks() : [];

        // Функция экранирования как в meeting_protocol.js
        const esc = (s) => String(s ?? '')
            .replaceAll('&','&amp;').replaceAll('<','&lt;')
            .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'", '&#39;');

        // Функция для получения читаемых названий полей
        function getFieldLabel(key) {
            const labels = {
                name: 'Имя сотрудника',
                gender: 'Пол',
                age: 'Возраст',
                residence: 'Проживание',
                education: 'Образование',
                speech: 'Грамотная речь',
                languages: 'Знание иностранных языков',
                pc: 'Владение ПК, оргтехникой',
                appearance: 'Внешний вид',
                habits: 'Вредные привычки',
                info: 'Умение работать с информацией',
                accuracy: 'Точность',
                scrupulousness: 'Скурпулезность',
                systemThinking: 'Системное мышление',
                decisiveness: 'Решительность',
                stressResistance: 'Стрессоустойчивость',
                otherQualities: 'Иные качества',
                independence: 'Умение самостоятельно принимать решение',
                organization: 'Умение организовать труд подчиненных',
                responsibility: 'Умение брать ответственность',
                managementStyle: 'Стиль управления',
                leadership: 'Лидерские качества',
                mobility: 'Мобильность',
                businessTrips: 'Возможность и желание командировок',
                car: 'Наличие автомобиля'
            };
            return labels[key] || key;
        }

        // Форматирование даты как в meeting_protocol.js
        const formatDateRU = (iso) => {
            if (!iso) return '';
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return esc(iso);
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth()+1).padStart(2, '0');
            const yyyy = d.getFullYear();
            return `${dd}.${mm}.${yyyy}`;
        };

        const titleBlock = `
            <h1>ДОЛЖНОСТНАЯ ИНСТРУКЦИЯ</h1>
            ${data.company ? `<p><b>Наименование компании:</b> ${esc(data.company)}</p>` : ''}
            ${data.position ? `<p><b>Наименование должности:</b> ${esc(data.position)}</p>` : ''}
            ${data.approval ? `<p><b>Утверждение:</b> ${esc(data.approval)}</p>` : ''}
        `;

        // Участники (если нужно, аналогично meeting_protocol)
        const rowsParticipants = ''; // Добавьте если нужны участники

        // Основные направления деятельности
        const rowsActivities = (data['mainActivity[]'] || []).map((activity, i) => `
            <tr>
                <td>${i+1}</td>
                <td>${esc(activity)}</td>
            </tr>`).join('');

        // Должностные обязанности
        const rowsDuties = (data['jobDuty[]'] || []).map((duty, i) => `
            <tr>
                <td>${i+1}</td>
                <td>${esc(duty)}</td>
            </tr>`).join('');

        // Адаптационные задачи
        const rowsTasks = (adaptationTasks || []).map((task, i) => `
            <tr>
                <td>${i+1}</td>
                <td>${esc(task.title || '')}</td>
                <td>${esc(task.time || '')}</td>
                <td>${esc(task.resources || '')}</td>
                <td>${esc(task.feedbackMentor || '')}</td>
                <td>${esc(task.feedbackEmployee || '')}</td>
            </tr>`).join('');

        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${esc(data.position || 'Должностная инструкция')}</title>
<style>
    body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.4; }
    h1 { text-align: center; margin: 0 0 10pt; }
    h2 { margin-top: 15pt; margin-bottom: 10pt; }
    table { width: 100%; border-collapse: collapse; margin: 10pt 0; }
    th, td { border: 1px solid #000; padding: 6pt; vertical-align: top; }
    th { background: #f2f2f2; text-align: left; }
    .field { margin: 8pt 0; }
    .field-label { font-weight: bold; display: inline-block; min-width: 200pt; }
</style>
</head>
<body>
    ${titleBlock}

    <h2>1. Общие положения</h2>
    <div class="field">
        <span class="field-label">Кем назначается:</span> ${esc(data.appointedBy || '')}
    </div>
    <div class="field">
        <span class="field-label">Каким документом назначается:</span> ${esc(data.documentPurpose || '')}
    </div>
    <div class="field">
        <span class="field-label">Кто заменяет на период отсутствия:</span> ${esc(data.replaces || '')}
    </div>
    <div class="field">
        <span class="field-label">Чем руководствуется в своей деятельности:</span> ${esc(data.activityGuide || '')}
    </div>
    <div class="field">
        <span class="field-label">Кому подчиняется:</span> ${esc(data.supervisor || '')}
    </div>

    <h2>2. Требования к кандидатам на вакансию</h2>
    ${Object.keys(data).filter(key => 
        EMP_KEYS.includes(key) && data[key]
    ).map(key => `
        <div class="field">
            <span class="field-label">${getFieldLabel(key)}:</span> ${esc(data[key])}
        </div>
    `).join('')}
    
    ${data['additionalFields[]'] && data['additionalFields[]'].length > 0 ? `
        <h3>Дополнительные пункты:</h3>
        ${data['additionalFields[]'].map((field, index) => `
            <div class="field">
                <span class="field-label">Пункт ${index + 1}:</span> ${esc(field)}
            </div>
        `).join('')}
    ` : ''}

    <h2>3. Основные направления деятельности</h2>
    <table>
        <thead><tr><th>#</th><th>Направление деятельности</th></tr></thead>
        <tbody>${rowsActivities}</tbody>
    </table>

    <h2>4. Должностные обязанности</h2>
    <table>
        <thead><tr><th>#</th><th>Обязанность</th></tr></thead>
        <tbody>${rowsDuties}</tbody>
    </table>

    <h2>5. Права</h2>
    <div class="field">${esc(data.rights || '')}</div>

    <h2>6. Ответственность</h2>
    <div class="field">${esc(data.responsibility || '')}</div>

    ${adaptationTasks.length > 0 ? `
    <h2>7. Адаптационный план</h2>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Задача</th>
                <th>Время на подготовку</th>
                <th>Ресурсы</th>
                <th>Итоги наставника</th>
                <th>Итоги сотрудника</th>
            </tr>
        </thead>
        <tbody>${rowsTasks}</tbody>
    </table>
    ` : ''}
</body>
</html>`;
    }
 
    function downloadDoc(htmlString, filename) {
        const blob = new Blob([htmlString], { type: 'application/msword;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    // Обработчик кнопки скачивания (используем существующую кнопку из HTML)
    const downloadBtn = document.getElementById('downloadProtocol');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const html = buildJobDescriptionDocHTML();
            const position = document.getElementById('position').value || 'должность';
            const company = document.getElementById('company').value || 'компания';
            const datePart = new Date().toISOString().slice(0,10).replaceAll('-', '.');
            downloadDoc(html, `ДИ_${company}_${position}_${datePart}.doc`);
        });
    }
});
});