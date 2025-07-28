document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('adaptationForm');
    const tasksContainer = document.getElementById('tasksContainer');
    const addButtons = document.querySelectorAll('.add-task-btn');

    // Клонируем первый fieldset как шаблон
    const templateTask = tasksContainer.querySelector('fieldset.task').cloneNode(true);

    // --- ЗАГРУЗКА данных из базы ---
    fetch('/get_adaptation_plan')
        .then(res => res.json())
        .then(tasks => {
            if (tasks && tasks.length > 0) {
                // Очищаем всё кроме первого шаблона
                while (tasksContainer.querySelectorAll('fieldset.task').length > 1)
                    tasksContainer.querySelectorAll('fieldset.task')[1].remove();

                tasks.forEach((task, idx) => {
                    let taskEl = idx === 0 ? tasksContainer.querySelector('fieldset.task') : templateTask.cloneNode(true);

                    // Заполняем значения
                    taskEl.querySelector('legend').textContent = task.title || `Задача ${idx + 1}`;
                    taskEl.querySelector('input[name*="_time"]').value = task.time || '';
                    taskEl.querySelector('textarea[name*="_resources"]').value = task.resources || '';
                    if (taskEl.querySelector('input[name*="_custom_title"]') && task.customTitle)
                        taskEl.querySelector('input[name*="_custom_title"]').value = task.customTitle;
                    taskEl.querySelector('textarea[name*="_summarize_by_mentor"]').value = task.feedbackMentor || '';
                    taskEl.querySelector('textarea[name*="_summarize_by_employee"]').value = task.feedbackEmployee || '';

                    if (idx !== 0) tasksContainer.insertBefore(taskEl, document.querySelector('.add-task-wrapper'));
                });
                updateTaskNumbers();
                bindDeleteButtons();
            }
        });

    // --- ФУНКЦИЯ автосохранения ---
    function autoSavePlan() {
        const tasks = Array.from(tasksContainer.querySelectorAll('fieldset.task')).map(task => ({
            title: task.querySelector('legend').textContent,
            time: task.querySelector('input[name*="_time"]').value.trim(),
            resources: task.querySelector('textarea[name*="_resources"]').value.trim(),
            customTitle: task.querySelector('input[name*="_custom_title"]')?.value.trim() || null,
            feedbackMentor: task.querySelector('textarea[name*="_summarize_by_mentor"]').value.trim(),
            feedbackEmployee: task.querySelector('textarea[name*="_summarize_by_employee"]').value.trim()
        }));
        fetch('/submit_adaptation_plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks })
        });
    }

    // Навешиваем автосохранение на все поля задач
    tasksContainer.addEventListener('input', () => {
        autoSavePlan();
    });
    // Обновляет нумерацию, легенду и атрибуты всех задач
    function updateTaskNumbers() {
        const tasks = Array.from(tasksContainer.querySelectorAll('fieldset.task'));

        tasks.forEach((task, idx) => {
            const num = idx + 1;
            task.dataset.taskId = num;

            // Обработка легенды
            const legend = task.querySelector('legend');
            const customInput = task.querySelector('input[name*="_custom_title"]');

            let desc;
            if (customInput) {
                // для динамических задач
                if (customInput.value.trim()) {
                    desc = customInput.value.trim();
                } else {
                    desc = 'Новая задача';
                }
            } else {
                // для стартовых задач
                const parts = legend.textContent.split(':');
                desc = parts.slice(1).join(':').trim() || 'Новая задача';
            }
            legend.textContent = `Задача ${num}: ${desc}`;

            // Обновляем каждый label
            task.querySelectorAll('label').forEach(label => {
                if (label.htmlFor) {
                    label.htmlFor = label.htmlFor.replace(/\d+/, num);
                }
            });

            // Обновляем каждый input/textarea
            task.querySelectorAll('input, textarea').forEach(el => {
                if (el.id) el.id = el.id.replace(/\d+/, num);
                if (el.name) el.name = el.name.replace(/\d+/, num);
            });
        });
    }

    // Привязывает нажатия по кнопкам удаления
    function bindDeleteButtons() {
        tasksContainer.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.onclick = () => {
                const all = tasksContainer.querySelectorAll('fieldset.task');
                if (all.length > 1) {
                    btn.closest('fieldset.task').remove();
                    updateTaskNumbers();
                } else {
                    alert('Нельзя удалить последнюю задачу');
                }
            };
        });
    }

    // Обработчики кнопок «Добавить задачу»
    addButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const wrapper = btn.closest('.add-task-wrapper');
            const newTask = templateTask.cloneNode(true);

            // Очищаем все поля
            newTask.querySelectorAll('input, textarea').forEach(el => el.value = '');

            // Вставляем поле «Название задачи» сразу после легенды
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

            // Убедимся, что есть кнопка удаления
            if (!newTask.querySelector('.delete-task-btn')) {
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'delete-task-btn';
                delBtn.textContent = 'Удалить задачу';
                newTask.appendChild(delBtn);
            }

            // Вставляем перед обёрткой кнопки «Добавить»
            tasksContainer.insertBefore(newTask, wrapper);

            // Сначала перенумеруем, потом привяжем удаление
            updateTaskNumbers();
            bindDeleteButtons();
        });
    });

    // Инициализация на старте
    bindDeleteButtons();
    updateTaskNumbers();

    // Обработка сабмита формы
    form.addEventListener('submit', e => {
        e.preventDefault();

        const tasks = Array.from(tasksContainer.querySelectorAll('fieldset.task')).map(task => ({
            title: task.querySelector('legend').textContent,
            time: task.querySelector('input[name*="_time"]').value.trim(),
            resources: task.querySelector('textarea[name*="_resources"]').value.trim(),
            customTitle: task.querySelector('input[name*="_custom_title"]')?.value.trim() || null,
            feedbackMentor: task.querySelector('textarea[name*="_summarize_by_mentor"]').value.trim(),
            feedbackEmployee: task.querySelector('textarea[name*="_summarize_by_employee"]').value.trim()
        }));

        fetch('/submit_adaptation_plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks })
        })
            .then(res => {
                if (!res.ok) throw new Error(`Status ${res.status}`);
                return res.json();
            })
            .then(data => {
                alert('Адаптационный план успешно сохранён');
                console.log('Server response:', data);
            })
            .catch(err => {
                console.error('Ошибка при отправке:', err);
                alert('Произошла ошибка при сохранении плана');
            });
    });
});
