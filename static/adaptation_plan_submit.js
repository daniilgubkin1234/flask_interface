document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("adaptationForm");
    const addTaskButton = document.getElementById("addTaskButton");
    const submitButton = document.getElementById("submitButton");
    const tasksContainer = document.getElementById("tasksContainer");

    if (!form || !addTaskButton || !tasksContainer) {
        console.error("Не найдены необходимые элементы формы!");
        return;
    }

    // Добавляем новую задачу при нажатии кнопки "Добавить задачу"
    addTaskButton.addEventListener("click", function () {
        const taskCount = tasksContainer.querySelectorAll(".task").length + 1;

        const newTask = document.createElement("fieldset");
        newTask.classList.add("task");
        newTask.innerHTML = `
            <legend>Задача ${taskCount}</legend>
            <label>Время выполнения: <input type="text" name="task${taskCount}_time"></label>
            <label>Ресурсы: <textarea name="task${taskCount}_resources"></textarea></label>
            <label>Обратная связь наставника: <textarea name="task${taskCount}_mentor"></textarea></label>
            <label>Обратная связь сотрудника: <textarea name="task${taskCount}_employee"></textarea></label>
        `;

        tasksContainer.appendChild(newTask);
    });

    // Отправка данных формы
    form.addEventListener("submit", function (event) {
        event.preventDefault();

        let adaptationData = { tasks: [] };

        const tasks = tasksContainer.querySelectorAll(".task");
        tasks.forEach((task, index) => {
            const taskData = {
                title: task.querySelector("legend").innerText.trim(),
                time: task.querySelector("input[name*='_time']").value.trim(),
                resources: task.querySelector("textarea[name*='_resources']").value.trim(),
                mentor_feedback: task.querySelector("textarea[name*='_mentor']").value.trim(),
                employee_feedback: task.querySelector("textarea[name*='_employee']").value.trim()
            };
            adaptationData.tasks.push(taskData);
        });

        console.log("Отправляемые данные:", adaptationData);

        fetch("/submit_adaptation_plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(adaptationData)
        })
        .then(response => response.json())
        .then(data => {
            console.log("Ответ от сервера:", data);
            alert("Адаптационный план успешно сохранен!");
        })
        .catch(error => console.error("Ошибка при отправке:", error));
    });
});
