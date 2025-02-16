document.addEventListener("DOMContentLoaded", () => {
    const tasksContainer = document.getElementById("adaptationForm");

    // Функция для создания пользовательской задачи
    const createTask = (taskNumber) => {
        const fieldset = document.createElement("fieldset");
        fieldset.classList.add("task");

        fieldset.innerHTML = `
            <legend>Задача ${taskNumber}: Новая задача</legend>
            <label for="task${taskNumber}_title">Название задачи:</label>
            <input type="text" id="task${taskNumber}_title" name="task${taskNumber}_title" placeholder="Введите название задачи" required>
            <label for="task${taskNumber}_time">Время на подготовку:</label>
            <input type="text" id="task${taskNumber}_time" name="task${taskNumber}_time" placeholder="Введите время на подготовку" required>
            <label for="task${taskNumber}_resources">Ресурсы:</label>
            <textarea id="task${taskNumber}_resources" name="task${taskNumber}_resources" rows="2" placeholder="Введите ресурсы" required></textarea>
            <label for="task${taskNumber}_summarize_by_mentor">Подведение итогов наставником:</label>
            <textarea id="task${taskNumber}_summarize_by_mentor" name="task${taskNumber}_summarize_by_mentor" rows="2" placeholder="Введите подведение итогов наставником"></textarea>
            <label for="task${taskNumber}_summarize_by_employee">Подведение итогов сотрудником:</label>
            <textarea id="task${taskNumber}_summarize_by_employee" name="task${taskNumber}_summarize_by_employee" rows="2" placeholder="Введите подведение итогов сотрудником"></textarea>
        `;
        return fieldset;
    };

    // Функция для обновления нумерации всех задач
    const updateTaskNumbers = () => {
        const allTasks = tasksContainer.querySelectorAll(".task");
        allTasks.forEach((task, index) => {
            const legend = task.querySelector("legend");
            const currentTitle = legend.textContent.split(":")[1].trim(); // Сохраняем название
            legend.textContent = `Задача ${index + 1}: ${currentTitle}`;
        });
    };

    // Функция для добавления задачи перед кнопкой
    const addTaskAboveButton = (button) => {
        const allTasks = Array.from(tasksContainer.querySelectorAll(".task, .primary-button"));
        const position = allTasks.indexOf(button); // Определяем позицию кнопки

        // Создаём новую задачу
        const newTask = createTask(position + 1);

        // Вставляем задачу перед кнопкой
        tasksContainer.insertBefore(newTask, button);

        // Обновляем нумерацию
        updateTaskNumbers();
    };

    // Делегирование события для кнопок
    tasksContainer.addEventListener("click", (event) => {
        if (event.target.classList.contains("primary-button")) {
            addTaskAboveButton(event.target);
        }
    });

    // Первоначальное обновление нумерации
    updateTaskNumbers();
});

