document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('adaptationForm');
    const tasksContainer = document.getElementById('tasksContainer');
    const addButtons = document.querySelectorAll('.add-task-btn');

    // ---------- 0) Стартовый шаблон из 10 задач ----------
    const DEFAULT_TASKS = [
        'Задача 1: Оформление на работу',
        'Задача 2: Знакомство с коллективом, офисом, оргтехникой',
        'Задача 3: Изучение информации о компании',
        'Задача 4: Изучение стандартов компании',
        'Задача 5: Участие в планерке',
        'Задача 6: Уточнение адаптационного плана',
        'Задача 7: Формирование плана работы на неделю',
        'Задача 8: Просмотр видео-семинаров',
        'Задача 9: Чтение книг из корпоративной библиотеки',
        'Задача 10: Подведение итогов адаптации'
    ].map(title => ({
        title,
        time: '',
        resources: '',
        customTitle: null,
        feedbackMentor: '',
        feedbackEmployee: ''
    }));

    // Клонируем первый fieldset как шаблон для последующих вставок
    const templateTask = tasksContainer.querySelector('fieldset.task').cloneNode(true);

    // ---------- 1) Загрузка из БД ----------
    fetch('/get_adaptation_plan')
        .then(res => res.json())
        .then(tasks => {
            const hasTasks = Array.isArray(tasks) && tasks.length > 0;
            renderTasks(hasTasks ? tasks : DEFAULT_TASKS);
            bindDeleteButtons();
            updateTaskNumbers();
        })
        .catch(() => {
            // на всякий случай показываем шаблон, если загрузка не удалась
            renderTasks(DEFAULT_TASKS);
            bindDeleteButtons();
            updateTaskNumbers();
        });

    // Рендер набора задач в DOM
    function renderTasks(tasks) {
        // Удаляем всё кроме первого шаблонного fieldset
        while (tasksContainer.querySelectorAll('fieldset.task').length > 1) {
            tasksContainer.querySelectorAll('fieldset.task')[1].remove();
        }

        tasks.forEach((task, idx) => {
            const taskEl = idx === 0
                ? tasksContainer.querySelector('fieldset.task')
                : templateTask.cloneNode(true);

            // Заголовок
            taskEl.querySelector('legend').textContent = task.title || `Задача ${idx + 1}`;

            // Поля
            const timeEl = taskEl.querySelector('input[name*="_time"]');
            const resEl = taskEl.querySelector('textarea[name*="_resources"]');
            const cmEl = taskEl.querySelector('input[name*="_custom_title"]');
            const sumM = taskEl.querySelector('textarea[name*="_summarize_by_mentor"]');
            const sumE = taskEl.querySelector('textarea[name*="_summarize_by_employee"]');

            if (timeEl) timeEl.value = task.time || '';
            if (resEl) resEl.value = task.resources || '';
            if (cmEl) cmEl.value = task.customTitle || '';
            if (sumM) sumM.value = task.feedbackMentor || '';
            if (sumE) sumE.value = task.feedbackEmployee || '';

            if (idx !== 0) {
                const wrapper = document.querySelector('.add-task-wrapper');
                tasksContainer.insertBefore(taskEl, wrapper);
            }
        });
    }

    // ---------- 2) Автосохранение ----------
    function collectTasksFromDOM() {
        return Array.from(tasksContainer.querySelectorAll('fieldset.task')).map(task => ({
            title: task.querySelector('legend').textContent,
            time: task.querySelector('input[name*="_time"]')?.value.trim() || '',
            resources: task.querySelector('textarea[name*="_resources"]')?.value.trim() || '',
            customTitle: task.querySelector('input[name*="_custom_title"]')?.value.trim() || null,
            feedbackMentor: task.querySelector('textarea[name*="_summarize_by_mentor"]')?.value.trim() || '',
            feedbackEmployee: task.querySelector('textarea[name*="_summarize_by_employee"]')?.value.trim() || ''
        }));
    }

    function autoSavePlan() {
        const tasks = collectTasksFromDOM();
        fetch('/submit_adaptation_plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks })
        }).catch(() => { });
    }

    // Сохраняем при любом вводе в пределах контейнера задач
    tasksContainer.addEventListener('input', autoSavePlan);

    // ---------- 3) Нумерация и атрибуты ----------
    function updateTaskNumbers() {
        const tasks = Array.from(tasksContainer.querySelectorAll('fieldset.task'));

        tasks.forEach((task, idx) => {
            const num = idx + 1;
            task.dataset.taskId = num;

            const legend = task.querySelector('legend');
            const customInput = task.querySelector('input[name*="_custom_title"]');

            let desc;
            if (customInput) {
                desc = customInput.value.trim() || 'Новая задача';
            } else {
                const parts = (legend.textContent || '').split(':');
                desc = parts.slice(1).join(':').trim() || 'Новая задача';
            }
            legend.textContent = `Задача ${num}: ${desc}`;

            // Обновляем for/id/name
            task.querySelectorAll('label').forEach(label => {
                if (label.htmlFor) label.htmlFor = label.htmlFor.replace(/\d+/, num);
            });
            task.querySelectorAll('input, textarea').forEach(el => {
                if (el.id) el.id = el.id.replace(/\d+/, num);
                if (el.name) el.name = el.name.replace(/\d+/, num);
            });
        });
    }

    // ---------- 4) Удаление и добавление ----------
    function bindDeleteButtons() {
        tasksContainer.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.onclick = () => {
                const all = tasksContainer.querySelectorAll('fieldset.task');
                if (all.length > 1) {
                    btn.closest('fieldset.task').remove();
                    updateTaskNumbers();
                    autoSavePlan();               // важный фикс: сохраняем факт удаления
                } else {
                    alert('Нельзя удалить последнюю задачу');
                }
            };
        });
    }

    addButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const wrapper = btn.closest('.add-task-wrapper');
            const newTask = templateTask.cloneNode(true);

            // чистим значения
            newTask.querySelectorAll('input, textarea').forEach(el => el.value = '');

            // поле «Название задачи» (если его ещё нет у шаблона)
            if (!newTask.querySelector('input[name*="_custom_title"]')) {
                const legend = newTask.querySelector('legend');

                const titleLabel = document.createElement('label');
                titleLabel.textContent = 'Название задачи:';
                titleLabel.htmlFor = 'task0_custom_title';

                const titleInput = document.createElement('input');
                titleInput.type = 'text';
                titleInput.placeholder = 'Введите название задачи';
                titleInput.required = true;
                titleInput.id = 'task0_custom_title';
                titleInput.name = 'task0_custom_title';

                titleLabel.appendChild(titleInput);
                legend.insertAdjacentElement('afterend', titleLabel);
            }

            tasksContainer.insertBefore(newTask, wrapper);
            updateTaskNumbers();
            bindDeleteButtons();
            autoSavePlan(); // фикс: сохраняем факт добавления
        });
    });

    // ---------- 5) Кнопка «Восстановить шаблон» ----------
    // если кнопки нет в HTML — создадим её и вставим перед «Отправить»
    (function ensureResetButton() {
        let resetBtn = document.getElementById('resetToDefault');
        if (!resetBtn) {
            const submitBtn = document.getElementById('submitButton') || form.querySelector('button[type="submit"]');
            resetBtn = document.createElement('button');
            resetBtn.type = 'button';
            resetBtn.id = 'resetToDefault';
            resetBtn.className = 'secondary';
            resetBtn.textContent = 'Восстановить шаблон';
            submitBtn?.parentNode?.insertBefore(resetBtn, submitBtn);
        }
        resetBtn.addEventListener('click', () => {
            if (!confirm('Вернуть исходный шаблон из 10 задач? Текущие данные будут перезаписаны.')) return;

            // Перезаписываем БД и UI стартовыми задачами
            fetch('/submit_adaptation_plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tasks: DEFAULT_TASKS })
            })
                .then(() => {
                    renderTasks(DEFAULT_TASKS);
                    bindDeleteButtons();
                    updateTaskNumbers();
                })
                .then(() => autoSavePlan()) // контрольная фиксация
                .catch(() => { });
        });
    })();

    // ---------- 6) Сабмит формы (ручное сохранение) ----------
    form.addEventListener('submit', e => {
        e.preventDefault();
        const tasks = collectTasksFromDOM();
        fetch('/submit_adaptation_plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks })
        })
            .then(res => {
                if (!res.ok) throw new Error(`Status ${res.status}`);
                return res.json();
            })
            .then(() => alert('Адаптационный план успешно сохранён'))
            .catch(() => alert('Произошла ошибка при сохранении плана'));
    });
});
