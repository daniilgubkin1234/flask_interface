document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("stimulation-form");

    // Количество базовых строк (фиксированных) в каждой секции
    const BASE_ROWS_COUNT = {
        material: 7,
        nonmaterial: 4,
        motivation: 3,
        culture: 3,
        partnership: 1
    };

    // Сохраняем исходную HTML-структуру
    const originalRows = {};
    Object.keys(BASE_ROWS_COUNT).forEach(section => {
        const tbody = document.getElementById(section + "-body");
        originalRows[section] = tbody.innerHTML;
    });

    // --- 1. Загрузка данных из БД ---
    fetch("/get_stimulation_system")
        .then(res => res.json())
        .then(data => {
            if (!data || Object.keys(data).length === 0) return;

            // Восстановление значений стандартных инпутов
            form.querySelectorAll('input[name]').forEach(input => {
                if (data.hasOwnProperty(input.name) && data[input.name] !== undefined && data[input.name] !== null) {
                    input.value = data[input.name];
                }
            });

            // Восстановление пользовательских строк (только добавленные вручную!)
            Object.keys(BASE_ROWS_COUNT).forEach(section => {
                const items = data[section];
                const tbody = document.getElementById(section + "-body");
                if (Array.isArray(items) && items.length > 0) {
                    tbody.innerHTML = originalRows[section]; // сброс до базовых
                    items.forEach(item => {
                        const tr = document.createElement("tr");
                        tr.dataset.original = "false";
                        tr.innerHTML = `
                            <td><input type="text" value="${item.name || ""}" placeholder="Введите название"></td>
                            <td><input type="text" value="${item.value || ""}" placeholder="Введите описание/значение"></td>
                            <td><button type="button" class="delete-row-btn" title="Удалить пункт"></button></td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            });
        });

    // --- 2. Автосохранение ---
    function autoSaveStimulationSystem() {
        const data = {};

        // Сохраняем все значения input[name]
        form.querySelectorAll('input[name]').forEach(input => {
            data[input.name] = input.value.trim();
        });

        // Сохраняем только пользовательские строки!
        Object.keys(BASE_ROWS_COUNT).forEach(section => {
            const tbody = document.getElementById(section + "-body");
            const rows = Array.from(tbody.rows);
            const sectionData = [];
            // Только строки после базовых!
            for (let i = BASE_ROWS_COUNT[section]; i < rows.length; i++) {
                const row = rows[i];
                const inputs = row.querySelectorAll("input");
                const name = inputs[0]?.value.trim();
                const value = inputs[1]?.value.trim();
                if (name || value) {
                    sectionData.push({ name, value });
                }
            }
            if (sectionData.length > 0) {
                data[section] = sectionData;
            }
        });

        fetch("/save_stimulation_system", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
    }

    form.addEventListener("input", autoSaveStimulationSystem);
    form.addEventListener("change", autoSaveStimulationSystem);

    // --- 3. Добавление пользовательской строки ---
    document.querySelectorAll(".add-row-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const section = btn.dataset.section;
            const tbody = document.getElementById(section + "-body");
            const tr = document.createElement("tr");
            tr.dataset.original = "false";
            tr.innerHTML = `
                <td><input type="text" placeholder="Введите название"></td>
                <td><input type="text" placeholder="Введите описание/значение"></td>
                <td><button type="button" class="delete-row-btn" title="Удалить пункт"></button></td>
            `;
            tbody.appendChild(tr);
            autoSaveStimulationSystem();
        });
    });

    // --- 4. Удаление пользовательской строки ---
    document.querySelectorAll("table").forEach(table => {
        table.addEventListener("click", e => {
            if (e.target.classList.contains("delete-row-btn")) {
                const tr = e.target.closest("tr");
                const tbody = tr.closest("tbody");
                const section = tbody.id.replace('-body', '');
                const baseCount = BASE_ROWS_COUNT[section];
                const rowIndex = Array.from(tbody.rows).indexOf(tr);
                if (rowIndex < baseCount) return; // нельзя удалять базовые
                tr.remove();
                autoSaveStimulationSystem();
            }
        });
    });

    // --- 5. Сабмит формы ---
    form.addEventListener("submit", async function (e) {
        e.preventDefault();
        const data = {};
        form.querySelectorAll('input[name]').forEach(input => {
            data[input.name] = input.value.trim();
        });
        Object.keys(BASE_ROWS_COUNT).forEach(section => {
            const tbody = document.getElementById(section + "-body");
            const rows = Array.from(tbody.rows);
            const sectionData = [];
            for (let i = BASE_ROWS_COUNT[section]; i < rows.length; i++) {
                const row = rows[i];
                const inputs = row.querySelectorAll("input");
                const name = inputs[0]?.value.trim();
                const value = inputs[1]?.value.trim();
                if (name || value) {
                    sectionData.push({ name, value });
                }
            }
            if (sectionData.length > 0) {
                data[section] = sectionData;
            }
        });
        await fetch("/save_stimulation_system", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        alert("Данные успешно сохранены!");
        Object.keys(BASE_ROWS_COUNT).forEach(section => {
            const tbody = document.getElementById(section + "-body");
            tbody.innerHTML = originalRows[section];
        });
        form.querySelectorAll('input[name]').forEach(input => {
            input.value = "";
        });
    });
});
