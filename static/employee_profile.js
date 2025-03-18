document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("employeeProfileForm");
    const submitButton = document.getElementById("submit-button");
    const editButton = document.getElementById("edit-button");
    const saveButton = document.getElementById("save-button");
    const addFieldButton = document.getElementById("add-field-button");
    const additionalFieldsContainer = document.getElementById("additional-fields");

    let currentEmployeeId = null;

    addFieldButton.addEventListener("click", function () {
        const fieldContainer = document.createElement("div");
        fieldContainer.classList.add("profile-item");
    
        // Заголовок поля (подпись)
        const label = document.createElement("label");
        label.textContent = "Дополнительный пункт:";
    
        // Поле ввода
        const input = document.createElement("input");
        input.type = "text";
        input.name = "custom_field";
        input.placeholder = "Введите название и значение";
    
        // Кнопка удаления
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Удалить";
        deleteButton.classList.add("delete-field-button");
    
        deleteButton.addEventListener("click", () => {
            fieldContainer.remove();
        });
    
        // Добавляем элементы в контейнер
        fieldContainer.appendChild(label);
        fieldContainer.appendChild(input);
        fieldContainer.appendChild(deleteButton);
    
        // Добавляем в общий контейнер дополнительных полей
        additionalFieldsContainer.appendChild(fieldContainer);
    });

    // Отправка нового сотрудника в БД
    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const employeeData = {
            name: document.getElementById("name").value,
            gender: document.getElementById("gender").value,
            age: document.getElementById("age").value,
            residence: document.getElementById("residence").value,
            education: document.getElementById("education").value,
            speech: document.getElementById("speech").value,
            languages: document.getElementById("languages").value,
            pc: document.getElementById("pc").value,
            appearance: document.getElementById("appearance").value,
            habits: document.getElementById("habits").value,
            info: document.getElementById("info").value,
            accuracy: document.getElementById("accuracy").value,
            scrupulousness: document.getElementById("scrupulousness").value,
            systemThinking: document.getElementById("systemThinking").value,
            decisiveness: document.getElementById("decisiveness").value,
            stressResistance: document.getElementById("stressResistance").value,
            otherQualities: document.getElementById("otherQualities").value,
            independence: document.getElementById("independence").value,
            organization: document.getElementById("organization").value,
            responsibility: document.getElementById("responsibility").value,
            managementStyle: document.getElementById("managementStyle").value,
            leadership: document.getElementById("leadership").value,
            mobility: document.getElementById("mobility").value,
            businessTrips: document.getElementById("businessTrips").value,
            car: document.getElementById("car").value,
            additionalFields: []
        };

        document.querySelectorAll("#additional-fields input").forEach(input => {
            if (input.value.trim() !== "") {
                employeeData.additionalFields.push(input.value);
            }
        });

        fetch("/add_employee", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(employeeData)
        })
        .then(response => response.json())
        .then(data => {
            alert("Сотрудник добавлен!");
            form.reset();
            additionalFieldsContainer.innerHTML = "";
        })
        .catch(error => console.error("Ошибка:", error));
    });

    // Редактирование сотрудника
    editButton.addEventListener("click", function () {
        const name = prompt("Введите имя сотрудника, которого хотите редактировать:");
        if (name) {
            fetch(`/get_employee?name=${name}`)
            .then(response => response.json())
            .then(data => {
                if (data) {
                    currentEmployeeId = data._id;
                    document.getElementById("name").value = data.name;
                    document.getElementById("gender").value = data.gender;
                    document.getElementById("age").value = data.age;
                    document.getElementById("residence").value = data.residence;
                    document.getElementById("education").value = data.education;
                    document.getElementById("speech").value = data.speech;
                    document.getElementById("languages").value = data.languages;
                    document.getElementById("pc").value = data.pc;
                    document.getElementById("appearance").value = data.appearance;
                    document.getElementById("habits").value = data.habits;
                    document.getElementById("info").value = data.info;
                    document.getElementById("accuracy").value = data.accuracy;
                    document.getElementById("scrupulousness").value = data.scrupulousness;
                    document.getElementById("systemThinking").value = data.systemThinking;
                    document.getElementById("decisiveness").value = data.decisiveness;
                    document.getElementById("stressResistance").value = data.stressResistance;
                    document.getElementById("otherQualities").value = data.otherQualities;
                    document.getElementById("independence").value = data.independence;
                    document.getElementById("organization").value = data.organization;
                    document.getElementById("responsibility").value = data.responsibility;
                    document.getElementById("managementStyle").value = data.managementStyle;
                    document.getElementById("leadership").value = data.leadership;
                    document.getElementById("mobility").value = data.mobility;
                    document.getElementById("businessTrips").value = data.businessTrips;
                    document.getElementById("car").value = data.car;

                    additionalFieldsContainer.innerHTML = "";
                    if (data.additionalFields) {
                        data.additionalFields.forEach(fieldValue => {
                            const fieldContainer = document.createElement("div");
                            const input = document.createElement("input");
                            input.type = "text";
                            input.name = "custom_field";
                            input.value = fieldValue;

                            fieldContainer.appendChild(input);
                            additionalFieldsContainer.appendChild(fieldContainer);
                        });
                    }

                    submitButton.style.display = "none";
                    editButton.style.display = "none";
                    saveButton.style.display = "inline-block";
                } else {
                    alert("Сотрудник не найден");
                }
            })
            .catch(error => console.error("Ошибка при загрузке данных:", error));
        }
    });

    // Сохранение изменений
    saveButton.addEventListener("click", function () {
        if (!currentEmployeeId) {
            alert("Ошибка: ID сотрудника не найден.");
            return;
        }

        const updatedData = {
            name: document.getElementById("name").value,
            gender: document.getElementById("gender").value,
            age: document.getElementById("age").value,
            residence: document.getElementById("residence").value,
            education: document.getElementById("education").value,
            speech: document.getElementById("speech").value,
            languages: document.getElementById("languages").value,
            pc: document.getElementById("pc").value,
            appearance: document.getElementById("appearance").value,
            habits: document.getElementById("habits").value,
            info: document.getElementById("info").value,
            accuracy: document.getElementById("accuracy").value,
            scrupulousness: document.getElementById("scrupulousness").value,
            systemThinking: document.getElementById("systemThinking").value,
            decisiveness: document.getElementById("decisiveness").value,
            stressResistance: document.getElementById("stressResistance").value,
            otherQualities: document.getElementById("otherQualities").value,
            independence: document.getElementById("independence").value,
            organization: document.getElementById("organization").value,
            responsibility: document.getElementById("responsibility").value,
            managementStyle: document.getElementById("managementStyle").value,
            leadership: document.getElementById("leadership").value,
            mobility: document.getElementById("mobility").value,
            businessTrips: document.getElementById("businessTrips").value,
            car: document.getElementById("car").value,
        };

        fetch(`/update_employee/${currentEmployeeId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedData)
        });
    });
});
