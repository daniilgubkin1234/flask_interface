// business_goal_form.js

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('businessForm');
    const addStageBtn = document.getElementById('addStageBtn');
    const table = document.getElementById('stagesTable').getElementsByTagName('tbody')[0];
function ensureActionsCell(row) {
  if (row.querySelector('.remove-stage')) return; // уже добавлена
  const td = document.createElement('td');
  td.className = 'actions';
  td.innerHTML = `<button type="button" class="remove-stage" title="Удалить этап">Удалить</button>`;
  row.appendChild(td);
}

// Делегирование клика по кнопке "Удалить" для всех строк (включая добавленные динамически)
table.addEventListener('click', (e) => {
  const btn = e.target.closest('.remove-stage');
  if (!btn) return;
  const tr = btn.closest('tr');
  if (!tr) return;
  if (confirm('Удалить этот этап?')) {
    tr.remove();
    // Удаление — это не "input"-событие, поэтому вручную дергаем автосохранение:
    autoSaveBusinessGoal();
  }
});
    // --- 1. АВТОЗАГРУЗКА бизнес-цели пользователя ---
    fetch('/get_business_goal')
        .then(res => res.json())
        .then(data => {
            if (!data || Object.keys(data).length === 0) return;

            document.getElementById('financeRevenue').value = data.financeRevenue || '';
            document.getElementById('financeProfit').value = data.financeProfit || '';
            document.getElementById('personnelCount').value = data.personnelCount || '';
            document.getElementById('averageSalary').value = data.averageSalary || '';
            document.getElementById('clientBase').value = data.clientBase || '';
            document.getElementById('conversionRate').value = data.conversionRate || '';
            document.getElementById('taxes').value = data.taxes || '';
            document.getElementById('treePlanting').value = data.treePlanting || '';
            document.getElementById('startDate').value = data.startDate || '';

            // Очистить все строки кроме первой
            while (table.rows.length > 1) table.deleteRow(1);

            // Восстановить этапы (если есть)
            if (Array.isArray(data.stages) && data.stages.length > 0) {
                data.stages.forEach((stage, idx) => {
                    let row;
                    if (idx === 0) {
                        row = table.rows[0];
                    } else {
                        row = document.createElement('tr');
                        row.innerHTML = `
                            <td><input type="text" name="stageNumber[]" placeholder="Название этапа" required></td>
                            <td><textarea name="stageDescription[]" placeholder="Описание этапа" required></textarea></td>
                            <td><input type="date" name="stageDate[]" required></td>
                        `;
                        table.appendChild(row);
                    }
                    ensureActionsCell(row);
                    row.querySelector("input[name='stageNumber[]']").value = stage.stageNumber || '';
                    row.querySelector("textarea[name='stageDescription[]']").value = stage.stageDescription || '';
                    row.querySelector("input[name='stageDate[]']").value = stage.stageDate || '';
                });
            }
        });

    // --- 2. АВТОСОХРАНЕНИЕ при любом изменении ---
    function autoSaveBusinessGoal() {
        const businessGoalData = {
            financeRevenue: document.getElementById('financeRevenue').value,
            financeProfit: document.getElementById('financeProfit').value,
            personnelCount: document.getElementById('personnelCount').value,
            averageSalary: document.getElementById('averageSalary').value,
            clientBase: document.getElementById('clientBase').value,
            conversionRate: document.getElementById('conversionRate').value,
            taxes: document.getElementById('taxes').value,
            treePlanting: document.getElementById('treePlanting').value,
            startDate: document.getElementById('startDate').value,
            stages: []
        };

        const stageRows = table.querySelectorAll('tr');
        stageRows.forEach(row => {
            businessGoalData.stages.push({
                stageNumber: row.querySelector("input[name='stageNumber[]']").value,
                stageDescription: row.querySelector("textarea[name='stageDescription[]']").value,
                stageDate: row.querySelector("input[name='stageDate[]']").value
            });
        });

        fetch("/add_business_goal", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(businessGoalData)
        });
    }

    // Навесить автосохранение на все поля формы и таблицы
    form.addEventListener('input', autoSaveBusinessGoal);

    // --- 3. КНОПКА "Добавить этап" ---
    addStageBtn.addEventListener('click', function () {
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td><input type="text" name="stageNumber[]" placeholder="Название этапа" required></td>
            <td><textarea name="stageDescription[]" placeholder="Описание этапа" required></textarea></td>
            <td><input type="date" name="stageDate[]" required></td>
        `;
        table.appendChild(newRow);
        ensureActionsCell(newRow);
        autoSaveBusinessGoal(); // автосохраняем сразу после добавления этапа
    });

    // --- 4. САБМИТ ФОРМЫ ---
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        // Можно оставить только alert, так как автосохранение уже происходит
        alert('Данные бизнес-цели сохранены!');
        // form.reset(); // если нужно сбрасывать форму после отправки
    });
});
