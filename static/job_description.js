// job_description.js — полная версия

document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("jobDescriptionForm");

    // -------------------- helpers --------------------
    const byName = (n) => document.getElementsByName(n)[0];

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

        if (items.length === 0) return; // никаких элементов -> никакой подписи

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
        const a = Array.isArray(arr) ? aSafe(arr) : [];
        const r = typeof len === "number" ? a.slice(0, len) : a.slice();
        if (typeof len === "number") while (r.length < len) r.push("");
        return r;

        function aSafe(x) {
            return x.map(normStr);
        }
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
        "name",
        "gender",
        "age",
        "residence",
        "education",
        "speech",
        "languages",
        "pc",
        "appearance",
        "habits",
        "info",
        "accuracy",
        "scrupulousness",
        "systemThinking",
        "decisiveness",
        "stressResistance",
        "otherQualities",
        "independence",
        "organization",
        "responsibility",
        "managementStyle",
        "leadership",
        "mobility",
        "businessTrips",
        "car",
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
            "company",
            "position",
            "approval",
            "appointedBy",
            "documentPurpose",
            "replaces",
            "activityGuide",
            "supervisor",
            "rights",
            "responsibility",
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

        Object.assign(jsonData, extra); // подписи источников

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
        // добавили 4-й запрос — анкета пользователя
        const [jd, tpt, empList, survey] = await Promise.all([
            fetch("/get_job_description")
                .then((r) => r.json())
                .catch(() => ({})),
            fetch("/get_three_plus_twenty")
                .then((r) => r.json())
                .catch(() => ({})),
            fetch("/api/employees")
                .then((r) => r.json())
                .catch(() => []),
            fetch("/get_user_survey")
                .then((r) => r.json())
                .catch(() => ({})),
        ]);

        // 1) рендерим то, что уже сохранено в ДИ
        applyJobDescriptionData(jd);

        // 2) если company в ДИ пусто — берём из диагностики ответ на q2
        try {
            const companyInput = document.getElementById("company");
            const hasJDCompany = (jd?.company || "").trim().length > 0;
            const companyFromSurvey = (survey?.q2 || "").trim(); // «Как называется ваша компания?» (Диагностика)
            if (!hasJDCompany && companyFromSurvey) {
                companyInput.value = companyFromSurvey;
                // сразу зафиксируем автосохранение, чтобы company попала в ДБ
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

        // 4) «умный» импорт из 3+20 (как и раньше)
        const tptRes = importFromTPTIfNeeded(jd, tpt);
        currentTptSig = tptRes.tptSig || currentTptSig;

        // 5) «умный» импорт из выбранного портрета (как и раньше)
        if (currentEmpId) {
            const res = await fetch(
                `/api/employees/${encodeURIComponent(currentEmpId)}`
            ).catch(() => null);
            const empDoc =
                res && res.ok ? await res.json().catch(() => null) : null;
            if (empDoc) {
                const empRes = importFromEMPIfNeeded(jd, empDoc);
                currentEmpSig = empRes.empSig || currentEmpSig;
                if (tptRes.imported || empRes.imported) autoSaveWithSign();
            }
        }
    })();

    // ВЫБОР ПРОФИЛЯ: всегда импортируем поля портрета в раздел 2 ДИ и сохраняем связь
    jdSelect?.addEventListener("change", async () => {
        currentEmpId = jdSelect.value || "";
        if (!currentEmpId) return;

        try {
            const res = await fetch(
                `/api/employees/${encodeURIComponent(currentEmpId)}`
            );
            if (!res.ok)
                return alert(
                    `Не удалось загрузить профиль: HTTP ${res.status}`
                );
            const empDoc = await res.json();

            // Нормализуем и применяем ВСЕ поля портрета в раздел 2
            const empN = makeEmpNormalized(empDoc); // функция уже есть выше в файле
            applyImportFromEMP(empN); // функция уже есть выше в файле

            // Обновляем подписи источника для автосейва
            currentEmpSig = computeEmpSig(empN);
            autoSaveWithSign(); // сохранит __empId и __empSig
        } catch (e) {
            alert("Ошибка загрузки профиля: " + (e?.message || e));
        }
    });

    // импорт по кнопке (альтернативно/дополнительно)
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
});

// --- 7. Встроенный "Адаптационный план" на странице ДИ ---
document.addEventListener("DOMContentLoaded", () => {
    const jdContainer = document.getElementById("jdTasksContainer");
    if (!jdContainer) return;

    // Тот же стартовый шаблон из adaptation_plan.js (1:1)
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

    const templateTask = jdContainer
        .querySelector("fieldset.task")
        .cloneNode(true);
    const addButton = document.querySelector("#adaptationPlanJD .add-task-btn");

    // Рендер набора задач в DOM (совместим с форматом adaptation_plan.js)
    function renderJDTasks(tasks) {
        // Сохраняем только первый шаблон, остальное удаляем
        while (jdContainer.querySelectorAll("fieldset.task").length > 1) {
            jdContainer.querySelectorAll("fieldset.task")[1].remove();
        }
        tasks.forEach((t, idx) => {
            const el =
                idx === 0
                    ? jdContainer.querySelector("fieldset.task")
                    : templateTask.cloneNode(true);
            el.querySelector("legend").textContent =
                t.title || `Задача ${idx + 1}`;

            const timeEl = el.querySelector('input[name*="_time"]');
            const resEl = el.querySelector('textarea[name*="_resources"]');
            const sumM = el.querySelector(
                'textarea[name*="_summarize_by_mentor"]'
            );
            const sumE = el.querySelector(
                'textarea[name*="_summarize_by_employee"]'
            );

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
                time:
                    fs.querySelector('input[name*="_time"]')?.value.trim() ||
                    "",
                resources:
                    fs
                        .querySelector('textarea[name*="_resources"]')
                        ?.value.trim() || "",
                customTitle:
                    fs
                        .querySelector('input[name*="_custom_title"]')
                        ?.value.trim() || null,
                feedbackMentor:
                    fs
                        .querySelector('textarea[name*="_summarize_by_mentor"]')
                        ?.value.trim() || "",
                feedbackEmployee:
                    fs
                        .querySelector(
                            'textarea[name*="_summarize_by_employee"]'
                        )
                        ?.value.trim() || "",
            })
        );
    }

    // Лёгкий дебаунс автосохранения
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
            // если заголовок не кастомный — поддержим стандартный "Задача N:"
            if (/^Задача\s+\d+/.test(title)) {
                fs.querySelector("legend").textContent = `Задача ${
                    i + 1
                }: ${title.split(":").slice(1).join(":").trim()}`;
            }
        });
    }

    function bindJDDeletes() {
        jdContainer.querySelectorAll(".delete-task-btn").forEach((btn) => {
            btn.onclick = () => {
                const all = jdContainer.querySelectorAll("fieldset.task");
                if (all.length <= 1) return; // минимум одна должна остаться
                btn.closest("fieldset.task")?.remove();
                updateJDNumbers();
                autoSaveJD();
            };
        });
    }

    // Добавление новых задач (кнопки после 5/7/9 как на исходной странице)
    addButton.addEventListener("click", () => {
        const wrapper = jdContainer.querySelector(".add-task-wrapper");
        const newEl = templateTask.cloneNode(true);
        jdContainer.insertBefore(newEl, wrapper);
        updateJDNumbers();
        bindJDDeletes();
        autoSaveJD();
    });

    // Автосохранение при любой правке внутри блока
    jdContainer.addEventListener("input", autoSaveJD);

    // Загрузка из БД (как на adaptation_plan.js)
    fetch("/get_adaptation_plan")
        .then((r) => r.json())
        .then((tasks) => {
            const has = Array.isArray(tasks) && tasks.length > 0;
            renderJDTasks(has ? tasks : AP_DEFAULT_TASKS);
        })
        .catch(() => renderJDTasks(AP_DEFAULT_TASKS));
});
