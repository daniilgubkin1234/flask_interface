document.addEventListener("DOMContentLoaded", () => {
    const tasksContainer = document.getElementById("tasksContainer");
    const addTaskButton = document.getElementById("addTaskButton");

    /**
     * Создать новую задачу
     */
    const createTask = (taskNumber) => {
        const fieldset = document.createElement("fieldset");
        fieldset.classList.add("task");

        fieldset.innerHTML = `
            <legend>Задача ${taskNumber}: Новая задача</legend>

            <label for="task${taskNumber}_time">Время на подготовку:</label>
            <input type="text" id="task${taskNumber}_time" name="task${taskNumber}_time" placeholder="Введите время на подготовку" required>

            <label for="task${taskNumber}_resources">Ресурсы:</label>
            <textarea id="task${taskNumber}_resources" name="task${taskNumber}_resources" rows="2" placeholder="Введите ресурсы" required></textarea>

            <label for="task${taskNumber}_summarize_by_mentor">Подведение итогов наставником:</label>
            <textarea id="task${taskNumber}_summarize_by_mentor" name="task${taskNumber}_summarize_by_mentor" rows="2" placeholder="Введите подведение итогов наставником"></textarea>

            <label for="task${taskNumber}_summarize_by_employee">Подведение итогов сотрудником:</label>
            <textarea id="task${taskNumber}_summarize_by_employee" name="task${taskNumber}_summarize_by_employee" rows="2" placeholder="Введите подведение итогов сотрудником"></textarea>

            <button type="button" class="delete-task-button">Удалить задачу</button>
        `;
        return fieldset;
    };

    /**
     * Обновление номеров задач
     */
    const updateTaskNumbers = () => {
        const allTasks = tasksContainer.querySelectorAll(".task");

        allTasks.forEach((task, index) => {
            const legend = task.querySelector("legend");

            if (index === allTasks.length - 1) {
                // Последняя задача
                legend.textContent = `Задача ${index + 1}: Подведение итогов адаптации`;
            } else {
                legend.textContent = `Задача ${index + 1}: Новая задача`;
            }

            task.querySelectorAll("label, input, textarea").forEach((element) => {
                if (element.hasAttribute("for")) {
                    element.setAttribute("for", element.getAttribute("for").replace(/\d+/, index + 1));
                }
                if (element.id) {
                    element.id = element.id.replace(/\d+/, index + 1);
                }
                if (element.name) {
                    element.name = element.name.replace(/\d+/, index + 1);
                }
            });
        });
    };

    /**
     * Добавить задачу перед последней (замыкающей)
     */
    const addTaskBeforeFinal = () => {
        const allTasks = tasksContainer.querySelectorAll(".task");
    
        if (allTasks.length === 0) return;
    
        const finalTask = allTasks[allTasks.length - 1]; // замыкающая
        const newTask = createTask(allTasks.length); // номер не важен, после updateTaskNumbers() обновим всё
    
        tasksContainer.insertBefore(newTask, finalTask);
        updateTaskNumbers();
        
    };
    /**
     * Удалить задачу по клику
     */
    const handleDeleteTask = (event) => {
        if (event.target.classList.contains("delete-task-button")) {
            const taskFieldset = event.target.closest(".task");
            const allTasks = tasksContainer.querySelectorAll(".task");

            if (taskFieldset === allTasks[allTasks.length - 1]) {
                alert("Нельзя удалить последнюю задачу");
                return;
            }

            taskFieldset.remove();
            updateTaskNumbers();
        }
    };

    addTaskButton.addEventListener("click", addTaskBeforeFinal);
    tasksContainer.addEventListener("click", handleDeleteTask);

    updateTaskNumbers();
});