document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("stimulation-form");

    // --- 1. Автозагрузка из БД ---
    fetch("/get_stimulation_system")
        .then(res => res.json())
        .then(data => {
            if (!data || Object.keys(data).length === 0) return;

            // Восстановление основных (фиксированных) input
            Object.entries(data).forEach(([key, value]) => {
                // Ищем по name
                const el = form.querySelector(`[name="${key}"]`);
                if (el && typeof value === "string") el.value = value;
            });

            // Восстановление динамических секций
            const sections = ["material", "nonmaterial", "motivation", "culture", "partnership"];
            sections.forEach(section => {
                if (Array.isArray(data[section])) {
                    const tbody = document.getElementById(section + "-body");
                    // Удаляем все, кроме первой строки (или всех, если нет)
                    while (tbody.rows.length) tbody.deleteRow(0);
                    data[section].forEach(item => {
                        const tr = document.createElement("tr");
                        tr.innerHTML = `
                            <td><input type="text" value="${item.name || ""}" placeholder="Введите название"></td>
                            <td><input type="text" value="${item.value || ""}" placeholder="Введите описание/значение"></td>
                            <td>
                                <button type="button" class="delete-row-btn" title="Удалить пункт"></button>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            });
        });

    // --- 2. Автосохранение ---
    function autoSaveStimulationSystem() {
        const stimulationData = {};

        // Фиксированные поля (inputs по name вне динамических таблиц)
        form.querySelectorAll('input[name]').forEach(input => {
            // Только если input не внутри таблицы (динамику ниже собираем отдельно)
            if (!input.closest('tbody')) {
                stimulationData[input.name] = input.value.trim();
            }
        });

        // Динамические секции
        ["material", "nonmaterial", "motivation", "culture", "partnership"].forEach(section => {
            const tbody = document.getElementById(section + "-body");
            stimulationData[section] = [];
            Array.from(tbody.rows).forEach(row => {
                const cells = row.querySelectorAll('input');
                if (cells.length === 2) {
                    const name = cells[0].value.trim();
                    const value = cells[1].value.trim();
                    if (name || value) {
                        stimulationData[section].push({ name, value });
                    }
                }
            });
        });

        fetch("/save_stimulation_system", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stimulationData)
        });
    }

    // --- 3. События для автосохранения ---
    form.addEventListener("input", autoSaveStimulationSystem);
    form.addEventListener("change", autoSaveStimulationSystem);

    // --- 4. Добавление строк ---
    document.querySelectorAll('.add-row-btn').forEach(function (button) {
        button.addEventListener('click', function () {
            const section = button.getAttribute('data-section');
            const tbody = document.getElementById(section + '-body');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="text" placeholder="Введите название"></td>
                <td><input type="text" placeholder="Введите описание/значение"></td>
                <td>
                    <button type="button" class="delete-row-btn" title="Удалить пункт"></button>
                </td>
            `;
            tbody.appendChild(tr);
            autoSaveStimulationSystem(); // автосохраняем!
        });
    });

    // --- 5. Удаление строк ---
    document.querySelectorAll('table').forEach(function (table) {
        table.addEventListener('click', function (e) {
            if (e.target.classList.contains('delete-row-btn')) {
                e.target.closest('tr').remove();
                autoSaveStimulationSystem(); // автосохраняем!
            }
        });
    });

    // --- 6. Submit (alert, данные уже автосохранены) ---
    form.addEventListener("submit", function (event) {
        event.preventDefault();
        alert("Данные успешно сохранены!");
    });
});
