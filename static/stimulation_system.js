document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("stimulation-form");

    document.querySelector('.toggle-sidebar').addEventListener('click', function() {
        const sidebar = document.querySelector('.recommendation-block');
        const button = document.querySelector('.toggle-sidebar');
        
        sidebar.classList.toggle('show');
        button.classList.toggle('menu-open');
    });

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

    const BASE_ROWS_COUNT = {
        material: 7,
        nonmaterial: 4,
        motivation: 3,
        culture: 3,
        partnership: 1
    };

    const originalRows = {};
    Object.keys(BASE_ROWS_COUNT).forEach(section => {
        const tbody = document.getElementById(section + "-body");
        originalRows[section] = tbody.innerHTML;
    });

    fetch("/get_stimulation_system", { credentials: "same-origin" })
    .then(res => res.ok ? res.json() : Promise.resolve({}))
    .then(data => {
        loadStimulationDataIntoForm(data);
    })
    .catch(() => {});

    function collectData() {
        const data = {};

        const positionSelect = document.getElementById("stimulationPositionSelect");
        if (positionSelect) {
            data.position = positionSelect.value.trim();
        }

        form.querySelectorAll('input[name]').forEach(input => {
            // Безопасное сохранение значения
            const value = input.value;
            data[input.name] = value === null || value === undefined ? '' : String(value).trim();
        });

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
            data[section] = sectionData;
        });

        return data;
    }

    function autoSaveStimulationSystem() {
        fetch("/save_stimulation_system", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(collectData())
        }).catch(() => {});
    }

    form.addEventListener("input", autoSaveStimulationSystem);
    form.addEventListener("change", autoSaveStimulationSystem);

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

    document.querySelectorAll("table").forEach(table => {
        table.addEventListener("click", e => {
            if (e.target.classList.contains("delete-row-btn")) {
                const tr = e.target.closest("tr");
                const tbody = tr.closest("tbody");
                const section = tbody.id.replace('-body', '');
                const baseCount = BASE_ROWS_COUNT[section];
                const rowIndex = Array.from(tbody.rows).indexOf(tr);
                if (rowIndex < baseCount) return;
                tr.remove();
                autoSaveStimulationSystem();
            }
        });
    });

    form.addEventListener("submit", async function (e) {
        e.preventDefault();
        await fetch("/save_stimulation_system", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(collectData())
        });
        alert("Данные успешно сохранены!");
    });

    async function loadPositions() {
        try {
            const res = await fetch("/api/employees");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const employees = await res.json();
            
            const positionSelect = document.getElementById("stimulationPositionSelect");
            if (!positionSelect) return;
            
            const positions = [...new Set(employees
                .map(emp => emp.name)
                .filter(Boolean)
                .sort())];
            
            const options = ['<option value="">— выберите должность —</option>']
                .concat(positions.map(pos => 
                    `<option value="${pos.replace(/"/g, '&quot;')}">${pos}</option>`
                ));
            
            positionSelect.innerHTML = options.join("");
            
            const savedData = await loadStimulationData();
            if (savedData && savedData.position) {
                positionSelect.value = savedData.position;
            }
            
        } catch (error) {
            console.error("Ошибка загрузки должностей:", error);
        }
    }

    function setupPositionChangeHandler() {
        const positionSelect = document.getElementById("stimulationPositionSelect");
        if (positionSelect) {
            positionSelect.addEventListener("change", function() {
                autoSaveStimulationSystem();
            });
        }
    }

    async function loadStimulationData() {
        try {
            const res = await fetch("/get_stimulation_system", { credentials: "same-origin" });
            return res.ok ? await res.json() : {};
        } catch (error) {
            console.error("Ошибка загрузки данных:", error);
            return {};
        }
    }

    function loadStimulationDataIntoForm(data) {
        if (!data || Object.keys(data).length === 0) return;

        const positionSelect = document.getElementById("stimulationPositionSelect");
        if (positionSelect && data.position) {
            positionSelect.value = data.position;
        }

        Object.keys(BASE_ROWS_COUNT).forEach(section => {
            const items = data[section];
            const tbody = document.getElementById(section + "-body");
            if (!tbody) return;

            tbody.innerHTML = originalRows[section];

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

        form.querySelectorAll('input[name]').forEach(input => {
            if (Object.prototype.hasOwnProperty.call(data, input.name) &&
                data[input.name] !== undefined && data[input.name] !== null) {
                input.value = data[input.name];
            }
        });
    }

    const sections = document.querySelectorAll('.recommendation-section');
    sections.forEach(function(section) {
        const title = section.querySelector('h4');
        title.addEventListener('click', function() {
            section.classList.toggle('collapsed');
        });
    });

    // ===== Функции для экспорта в DOC =====
    function buildStimulationDocHTML(data) {
        const esc = (s) => String(s ?? '')
            .replaceAll('&','&amp;').replaceAll('<','&lt;')
            .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'", '&#39;');

        const formatDateRU = (iso) => {
            if (!iso) return '';
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return esc(iso);
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth()+1).padStart(2, '0');
            const yyyy = d.getFullYear();
            return `${dd}.${mm}.${yyyy}`;
        };

        function buildSectionTable(title, items, customItems = []) {
            if ((!items || Object.keys(items).length === 0) && customItems.length === 0) return '';

            let rows = '';
            
            Object.entries(items).forEach(([key, value]) => {
                // Пропускаем служебные поля
                if (['position', 'material', 'nonmaterial', 'motivation', 'culture', 'partnership'].includes(key)) return;
                
                // Безопасно обрабатываем значение
                let stringValue = '';
                if (value === null || value === undefined) {
                    stringValue = '';
                } else if (typeof value === 'string') {
                    stringValue = value.trim();
                } else if (typeof value === 'number') {
                    stringValue = String(value);
                } else if (Array.isArray(value)) {
                    stringValue = value.join(', ');
                } else if (typeof value === 'object') {
                    stringValue = JSON.stringify(value);
                } else {
                    stringValue = String(value);
                }
                
                if (stringValue !== '') {
                    const label = getFieldLabel(key);
                    rows += `
                        <tr>
                            <td>${esc(label)}</td>
                            <td>${esc(stringValue)}</td>
                        </tr>`;
                }
            });

            customItems.forEach(item => {
                // Безопасно обрабатываем пользовательские поля
                const name = item.name ? (typeof item.name === 'string' ? item.name.trim() : String(item.name)) : '';
                const value = item.value ? (typeof item.value === 'string' ? item.value.trim() : String(item.value)) : '';
                
                if (name || value) {
                    rows += `
                        <tr>
                            <td>${esc(name)}</td>
                            <td>${esc(value)}</td>
                        </tr>`;
                }
            });

            if (!rows) return '';

            return `
                <h2>${esc(title)}</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Элемент стимулирования</th>
                            <th>Описание/Значение</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;
        }

        function getFieldLabel(fieldName) {
            const labels = {
                salary: 'Оклад',
                bonus: 'Премия',
                commission: 'Комиссионное вознаграждение',
                mentoring_bonus: 'Надбавка за наставничество',
                sick_leave: 'Оплата больничного',
                vacation: 'Оплачиваемый отпуск',
                compensations: 'Компенсации',
                education: 'Обучение за счет компании',
                work_conditions: 'Комфортные условия труда',
                health_insurance: 'ДМС',
                standards: 'Система стандартов',
                company_goals: 'Понимание цели компании',
                task_understanding: 'Понимание своих задач',
                role_understanding: 'Понимание своей роли в компании',
                corporate_events: 'Корпоративные мероприятия',
                corporate_training: 'Участие в корпоративном обучении',
                personal_celebrations: 'Личные праздники',
                partnership_algorithm: 'Описание четкого алгоритма партнерства'
            };
            return labels[fieldName] || fieldName;
        }

        const titleBlock = `
            <h1>Система стимулирования</h1>
            ${data.position ? `<p><b>Должность:</b> ${esc(data.position)}</p>` : ''}
            <p><b>Дата формирования:</b> ${esc(formatDateRU(new Date().toISOString()))}</p>
        `;

        const sections = [
            buildSectionTable('Материальное стимулирование', data, data.material || []),
            buildSectionTable('Нематериальное стимулирование', data, data.nonmaterial || []),
            buildSectionTable('Работа с внутренней мотивацией', data, data.motivation || []),
            buildSectionTable('Элементы корпоративной культуры', data, data.culture || []),
            buildSectionTable('Система партнерства', data, data.partnership || [])
        ].filter(section => section !== '').join('');

        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Система стимулирования - ${esc(data.position || 'Должность')}</title>
<style>
    body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.4; margin: 20px; }
    h1 { text-align: center; margin: 0 0 20pt; font-size: 16pt; }
    h2 { font-size: 14pt; margin: 15pt 0 10pt; border-bottom: 1px solid #000; padding-bottom: 5pt; }
    table { width: 100%; border-collapse: collapse; margin: 10pt 0 20pt; }
    th, td { border: 1px solid #000; padding: 8pt; vertical-align: top; text-align: left; }
    th { background: #f2f2f2; font-weight: bold; }
    p { margin: 5pt 0; }
</style>
</head>
<body>
    ${titleBlock}
    ${sections}
</body>
</html>`;
    }

    function downloadStimulationDoc() {
        const data = collectData();
        const html = buildStimulationDocHTML(data);
        
        const datePart = new Date().toISOString().slice(0,10).replaceAll('-', '.');
        const positionSlug = (data.position || 'Система_стимулирования').trim().replace(/[^\w\-]+/g,'_');
        
        downloadDoc(html, `Система_стимулирования_${positionSlug}_${datePart}.doc`);
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

    // Обработчик для кнопки скачивания DOC
    document.getElementById('downloadStimulation')?.addEventListener('click', downloadStimulationDoc);

    // Инициализация
    loadPositions();
    setupPositionChangeHandler();
});