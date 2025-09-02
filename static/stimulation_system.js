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
    fetch("/get_stimulation_system", { credentials: "same-origin" })
  .then(res => res.ok ? res.json() : Promise.resolve({}))
  .then(data => {
    if (!data || Object.keys(data).length === 0) return;

    // 1) Сначала сбрасываем секции к базовым строкам и поднимаем пользовательские
    Object.keys(BASE_ROWS_COUNT).forEach(section => {
      const items = data[section];
      const tbody = document.getElementById(section + "-body");
      if (!tbody) return;

      // сброс до базовых
      tbody.innerHTML = originalRows[section];

      // дорисовать пользовательские строки
      if (Array.isArray(items)) {
        items.forEach(item => {
          const tr = document.createElement("tr");
          tr.dataset.original = "false";
          tr.innerHTML = `
            <td><input type="text" value="${(item.name || "").replace(/"/g, '&quot;')}" placeholder="Введите название"></td>
            <td><input type="text" value="${(item.value || "").replace(/"/g, '&quot;')}" placeholder="Введите описание/значение"></td>
            <td><button type="button" class="delete-row-btn" title="Удалить пункт"></button></td>
          `;
          tbody.appendChild(tr);
        });
      }
    });

    // 2) Теперь подставляем значения в базовые именованные поля
    form.querySelectorAll('input[name]').forEach(input => {
      if (Object.prototype.hasOwnProperty.call(data, input.name) &&
          data[input.name] !== undefined && data[input.name] !== null) {
        input.value = data[input.name];
      }
    });
  })
  .catch(() => {});

    // --- 2. Автосохранение ---
    function collectData() {
        const data = {};

        // Сохраняем ВСЕ значения именованных полей (базовые строки)
        form.querySelectorAll('input[name]').forEach(input => {
            data[input.name] = input.value.trim();
        });

        // Сохраняем пользовательские строки: всегда кладем массив (даже пустой)
        Object.keys(BASE_ROWS_COUNT).forEach(section => {
            const tbody = document.getElementById(section + "-body");
            const rows = Array.from(tbody.rows);
            const sectionData = [];
            for (let i = BASE_ROWS_COUNT[section]; i < rows.length; i++) {
                const row = rows[i];
                const inputs = row.querySelectorAll("input");
                const name = (inputs[0]?.value || "").trim();
                const value = (inputs[1]?.value || "").trim();
                if (name || value) {
                    sectionData.push({ name, value });
                }
            }
            data[section] = sectionData; // ВАЖНО: отправляем даже пустой массив
        });

        return data;
    }

    // без дебаунса — как у тебя
    function autoSaveStimulationSystem() {
        fetch("/save_stimulation_system", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(collectData())
        }).catch(() => {});
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
        await fetch("/save_stimulation_system", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(collectData())
        });
        // НИЧЕГО НЕ СБРАСЫВАЕМ — данные остаются на странице
        alert("Данные успешно сохранены!");
    });
});
