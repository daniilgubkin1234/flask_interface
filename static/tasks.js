document.addEventListener("DOMContentLoaded", function () {
    loadTasks(); 
     
    
    function loadTasks() {
        fetch("/get_tasks")
            .then(response => response.json())
            .then(tasks => {
                const tableBody = document.querySelector("#tasks-table tbody");
                tableBody.innerHTML = ""; 

                tasks.forEach((task, index) => {
                    const row = document.createElement("tr");

                    row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${task.task}</td>
                        <td>${task.event || ""}</td>
                        <td>${task.work || ""}</td>
                        <td>${task.responsible || ""}</td>
                        <td>${task.deadline || ""}</td>
                        <td>${task.result || ""}</td>
                        <td>${task.resources || ""}</td>
                        <td>${task.coexecutors || ""}</td>
                        <td>${task.comments || ""}</td>
                        <td class="task-actions">
                            <button class="edit-task btn btn-primary" data-id="${task.task}">Редактировать</button>
                            <button class="delete-task btn btn-danger" data-id="${task.task}">Удалить</button>
                            <button class="copy-task btn btn-secondary" data-id="${task.task}">Копировать в буффер</button>
                        </td>
                    `;

                    tableBody.appendChild(row);
                });

                addEventListeners(); // 
            })
            .catch(error => console.error("Ошибка загрузки задач:", error));
    }

    function addEventListeners() {
        document.querySelectorAll(".delete-task").forEach(button => {
            button.addEventListener("click", function () {
                const taskId = this.getAttribute("data-id");

                fetch(`/delete_task/${encodeURIComponent(taskId)}`, { method: "DELETE" })
                    .then(response => response.json())
                    .then(data => {
                        alert(data.message);
                        loadTasks();
                    })
                    .catch(error => console.error("Ошибка удаления:", error));
            });
        });

        document.querySelectorAll(".edit-task").forEach(button => {
            button.addEventListener("click", function () {
                const row = this.closest("tr");

                document.getElementById("task").value = row.cells[1].textContent;
                document.getElementById("event").value = row.cells[2].textContent;
                document.getElementById("work").value = row.cells[3].textContent;
                document.getElementById("responsible").value = row.cells[4].textContent;
                document.getElementById("deadline").value = row.cells[5].textContent;
                document.getElementById("result").value = row.cells[6].textContent;
                document.getElementById("resources").value = row.cells[7].textContent;
                document.getElementById("coexecutors").value = row.cells[8].textContent;
                document.getElementById("comments").value = row.cells[9].textContent;

                document.getElementById("saveChanges").setAttribute("data-id", this.getAttribute("data-id"));

                document.getElementById("submitTask").style.display = "none";
                document.getElementById("saveChanges").style.display = "block";
            });
        });
    }

    document.getElementById("saveChanges").addEventListener("click", function () {
        const taskId = this.getAttribute("data-id");
        const updatedTask = {
            task: document.getElementById("task").value,
            event: document.getElementById("event").value,
            work: document.getElementById("work").value,
            responsible: document.getElementById("responsible").value,
            deadline: document.getElementById("deadline").value,
            result: document.getElementById("result").value,
            resources: document.getElementById("resources").value,
            coexecutors: document.getElementById("coexecutors").value,
            comments: document.getElementById("comments").value
        };

        fetch(`/edit_task/${encodeURIComponent(taskId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedTask)
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            loadTasks();
            document.getElementById("saveChanges").style.display = "none";
            document.getElementById("submitTask").style.display = "block";
            document.getElementById("task-form").reset();
        })
        .catch(error => console.error("Ошибка редактирования:", error));
    });

    document.getElementById("submitTask").addEventListener("click", function (event) {
        event.preventDefault();

        const newTask = {
            task: document.getElementById("task").value,
            event: document.getElementById("event").value,
            work: document.getElementById("work").value,
            responsible: document.getElementById("responsible").value,
            deadline: document.getElementById("deadline").value,
            result: document.getElementById("result").value,
            resources: document.getElementById("resources").value,
            coexecutors: document.getElementById("coexecutors").value,
            comments: document.getElementById("comments").value
        };

        fetch("/add_task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newTask)
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            loadTasks(); // 
            document.getElementById("task-form").reset();
        })
        .catch(error => console.error("Ошибка добавления задачи:", error));
    });

    const tableBody = document.querySelector("#tasks-table tbody");

    // Добавляем обработчик на кнопки "Копировать"
    tableBody.addEventListener("click", (event) => {
        if (event.target.classList.contains("copy-task")) {
            const row = event.target.closest("tr");
            copyTaskToClipboard(row);
        }
    });

    function copyTaskToClipboard(row) {
        const columns = row.querySelectorAll("td");
        const taskData = {
            "Номер": columns[0].textContent.trim(),
            "Задача": columns[1].textContent.trim(),
            "Мероприятие": columns[2].textContent.trim(),
            "Работа": columns[3].textContent.trim(),
            "Ответственный": columns[4].textContent.trim(),
            "Срок": columns[5].textContent.trim(),
            "Результат": columns[6].textContent.trim(),
            "Ресурсы": columns[7].textContent.trim(),
            "Соисполнители": columns[8].textContent.trim(),
            "Комментарии": columns[9].textContent.trim()
        };

        // Формируем текст для копирования
        const taskText = Object.entries(taskData)
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n");

        // Копируем в буфер обмена
        navigator.clipboard.writeText(taskText)
            .then(() => alert("Задача успешно скопирована в буфер обмена!"))
            .catch((err) => console.error("Ошибка копирования:", err));
    }
});
