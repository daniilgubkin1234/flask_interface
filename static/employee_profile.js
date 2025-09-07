document.addEventListener("DOMContentLoaded", () => {
    // --- DOM
    const form = document.getElementById("employeeProfileForm");
    const employeeSelect = document.getElementById("employeeSelect");
    const newBtn = document.getElementById("newEmployeeBtn");
    const saveBtn = document.getElementById("saveEmployeeBtn");
    const deleteBtn = document.getElementById("deleteEmployeeBtn");
    const submitAllBtn = document.getElementById("submitAllBtn");
    const addFieldButton = document.getElementById("add-field-button");
    const additionalFieldsContainer = document.getElementById("additional-fields");

    // --- State
    let employees = [];
    let currentId = null;

    // --- Utils
    function getVal(id) { return document.getElementById(id)?.value?.trim() || ""; }
    function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v ?? ""; }

    function readForm() {
        const data = {
            name: getVal("name"),
            gender: getVal("gender"),
            age: getVal("age"),
            residence: getVal("residence"),
            education: getVal("education"),
            speech: getVal("speech"),
            languages: getVal("languages"),
            pc: getVal("pc"),
            appearance: getVal("appearance"),
            habits: getVal("habits"),
            info: getVal("info"),
            accuracy: getVal("accuracy"),
            scrupulousness: getVal("scrupulousness"),
            systemThinking: getVal("systemThinking"),
            decisiveness: getVal("decisiveness"),
            stressResistance: getVal("stressResistance"),
            otherQualities: getVal("otherQualities"),
            independence: getVal("independence"),
            organization: getVal("organization"),
            responsibility: getVal("responsibility"),
            managementStyle: getVal("managementStyle"),
            leadership: getVal("leadership"),
            mobility: getVal("mobility"),
            businessTrips: getVal("businessTrips"),
            car: getVal("car"),
            additionalFields: []
        };
        additionalFieldsContainer.querySelectorAll("input[name='custom_field']").forEach(input => {
            const v = (input.value || "").trim();
            if (v) data.additionalFields.push(v);
        });
        return data;
    }

    function fillForm(data = {}) {
        setVal("name", data.name);
        setVal("gender", data.gender);
        setVal("age", data.age);
        setVal("residence", data.residence);
        setVal("education", data.education);
        setVal("speech", data.speech);
        setVal("languages", data.languages);
        setVal("pc", data.pc);
        setVal("appearance", data.appearance);
        setVal("habits", data.habits);
        setVal("info", data.info);
        setVal("accuracy", data.accuracy);
        setVal("scrupulousness", data.scrupulousness);
        setVal("systemThinking", data.systemThinking);
        setVal("decisiveness", data.decisiveness);
        setVal("stressResistance", data.stressResistance);
        setVal("otherQualities", data.otherQualities);
        setVal("independence", data.independence);
        setVal("organization", data.organization);
        setVal("responsibility", data.responsibility);
        setVal("managementStyle", data.managementStyle);
        setVal("leadership", data.leadership);
        setVal("mobility", data.mobility);
        setVal("businessTrips", data.businessTrips);
        setVal("car", data.car);

        additionalFieldsContainer.innerHTML = "";
        (data.additionalFields || []).forEach(val => addCustomField(val));
    }

    function clearForm() {
        fillForm({});
        currentId = null;
    }

    // --- List
    function sortByNameRu(a, b) {
        return (a.name || "").localeCompare(b.name || "", "ru", { sensitivity: "base" });
    }

    async function loadEmployees() {
        try {
            const res = await fetch("/api/employees");
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                alert(`Ошибка загрузки списка (GET /api/employees): HTTP ${res.status}\n${text}`);
                return;
            }
            const list = await res.json();
            employees = Array.isArray(list) ? list.sort(sortByNameRu) : [];
            renderSelect();
        } catch (e) {
            alert(`Сбой загрузки списка сотрудников: ${e?.message || e}`);
        }
    }

    function renderSelect() {
        const opts = ['<option value="">— выберите профиль —</option>']
            .concat(employees.map(e => `<option value="${e._id}">${escapeHtml(e.name || "(без ФИО)")}</option>`));
        employeeSelect.innerHTML = opts.join("");
        if (currentId) employeeSelect.value = currentId;
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m]));
    }

    // --- CRUD
    async function saveCurrent() {
        const payload = readForm();
        if (!payload.name) { alert("Укажите ФИО."); return; }

        if (!currentId) {
            // CREATE -> POST /api/employees
            const res = await fetch("/api/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                alert(`Ошибка сохранения (create): HTTP ${res.status}\n${text}`);
                return;
            }

            let data = null;
            try { data = await res.json(); }
            catch {
                const text = await res.text().catch(() => "");
                alert(`Сервер вернул не-JSON (create):\n${text}`);
                return;
            }

            if (data && data._id) {
                currentId = data._id;
                await loadEmployees();
                employeeSelect.value = currentId;
                alert("Портрет создан и сохранён.");
            } else {
                alert("Не удалось сохранить портрет (create): нет _id в ответе.");
            }
        } else {
            // UPDATE -> PUT /api/employees/:id
            const res = await fetch(`/api/employees/${encodeURIComponent(currentId)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                alert(`Ошибка сохранения (update): HTTP ${res.status}\n${text}`);
                return;
            }

            let data = null;
            try { data = await res.json(); }
            catch {
                const text = await res.text().catch(() => "");
                alert(`Сервер вернул не-JSON (update):\n${text}`);
                return;
            }

            if (data && data.ok) {
                await loadEmployees();
                employeeSelect.value = currentId;
                alert("Портрет обновлён.");
            } else {
                alert("Не удалось сохранить портрет (update).");
            }
        }
    }

    async function deleteCurrent() {
        if (!currentId) { alert("Сначала выберите портрет для удаления."); return; }
        const who = getVal("name") || "без ФИО";
        if (!confirm(`Удалить портрет «${who}»? Действие необратимо.`)) return;

        const res = await fetch(`/api/employees/${encodeURIComponent(currentId)}`, { method: "DELETE" });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            alert(`Ошибка удаления: HTTP ${res.status}\n${text}`);
            return;
        }
        const data = await res.json().catch(() => ({}));
        if (data && data.ok) {
            await loadEmployees();
            clearForm();
            alert("Портрет удалён.");
        } else {
            alert("Не удалось удалить портрет.");
        }
    }

    async function openById(id) {
        if (!id) { clearForm(); return; }
        const res = await fetch(`/api/employees/${encodeURIComponent(id)}`);
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            alert(`Не удалось загрузить портрет: HTTP ${res.status}\n${text}`);
            return;
        }
        const data = await res.json().catch(() => null);
        if (!data || data.error) { alert("Не удалось загрузить портрет."); return; }
        currentId = data._id;
        fillForm(data);
    }

    // --- Доп. поля
    function addCustomField(value = "") {
        const wrap = document.createElement("div");
        wrap.className = "profile-item custom-field";

        const label = document.createElement("label");
        label.textContent = "Дополнительный пункт:";

        const input = document.createElement("input");
        input.type = "text";
        input.name = "custom_field";
        input.placeholder = "Введите название и значение";
        input.value = value;

        const del = document.createElement("button");
        del.type = "button";
        del.textContent = "Удалить";
        del.className = "delete-field-button";
        del.addEventListener("click", () => wrap.remove());

        wrap.append(label, input, del);
        additionalFieldsContainer.appendChild(wrap);
    }

    addFieldButton.addEventListener("click", () => addCustomField());

    // --- События панели
    employeeSelect.addEventListener("change", e => openById(e.target.value));
    newBtn.addEventListener("click", () => {
        employeeSelect.value = "";
        clearForm();
        document.getElementById("name").focus();
    });
    saveBtn.addEventListener("click", saveCurrent);
    deleteBtn.addEventListener("click", deleteCurrent);

    submitAllBtn.addEventListener("click", async () => {
        // Заберём актуальный список из БД и отправим
        const resList = await fetch("/api/employees");
        if (!resList.ok) {
            const text = await resList.text().catch(() => "");
            alert(`Не удалось получить список перед отправкой: HTTP ${resList.status}\n${text}`);
            return;
        }
        const list = await resList.json().catch(() => []);
        const res = await fetch("/api/employees:submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employees: Array.isArray(list) ? list : [] })
        });
        const data = await res.json().catch(() => ({}));
        if (data && data.ok) alert(`Все портреты отправлены (кол-во: ${data.count}).`);
        else alert("Не удалось отправить все портреты.");
    });

    // --- init
    loadEmployees();
});
