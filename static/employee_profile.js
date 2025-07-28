document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("employeeProfileForm");
    const addFieldButton = document.getElementById("add-field-button");
    const additionalFieldsContainer = document.getElementById("additional-fields");

    // --- 1. АВТОЗАГРУЗКА профиля сотрудника ---
    fetch('/get_employee')
        .then(res => res.json())
        .then(data => {
            // Если профиль найден — заполняем поля
            if (data && !data.error) {
                document.getElementById("name").value = data.name || '';
                document.getElementById("gender").value = data.gender || '';
                document.getElementById("age").value = data.age || '';
                document.getElementById("residence").value = data.residence || '';
                document.getElementById("education").value = data.education || '';
                document.getElementById("speech").value = data.speech || '';
                document.getElementById("languages").value = data.languages || '';
                document.getElementById("pc").value = data.pc || '';
                document.getElementById("appearance").value = data.appearance || '';
                document.getElementById("habits").value = data.habits || '';
                document.getElementById("info").value = data.info || '';
                document.getElementById("accuracy").value = data.accuracy || '';
                document.getElementById("scrupulousness").value = data.scrupulousness || '';
                document.getElementById("systemThinking").value = data.systemThinking || '';
                document.getElementById("decisiveness").value = data.decisiveness || '';
                document.getElementById("stressResistance").value = data.stressResistance || '';
                document.getElementById("otherQualities").value = data.otherQualities || '';
                document.getElementById("independence").value = data.independence || '';
                document.getElementById("organization").value = data.organization || '';
                document.getElementById("responsibility").value = data.responsibility || '';
                document.getElementById("managementStyle").value = data.managementStyle || '';
                document.getElementById("leadership").value = data.leadership || '';
                document.getElementById("mobility").value = data.mobility || '';
                document.getElementById("businessTrips").value = data.businessTrips || '';
                document.getElementById("car").value = data.car || '';
                // Дополнительные поля
                additionalFieldsContainer.innerHTML = '';
                if (Array.isArray(data.additionalFields)) {
                    data.additionalFields.forEach(val => {
                        const fieldContainer = document.createElement("div");
                        fieldContainer.classList.add("profile-item");
                        const label = document.createElement("label");
                        label.textContent = "Дополнительный пункт:";
                        const input = document.createElement("input");
                        input.type = "text";
                        input.name = "custom_field";
                        input.value = val;
                        // Кнопка удаления
                        const deleteButton = document.createElement("button");
                        deleteButton.type = "button";
                        deleteButton.textContent = "Удалить";
                        deleteButton.classList.add("delete-field-button");
                        deleteButton.addEventListener("click", () => fieldContainer.remove());
                        fieldContainer.appendChild(label);
                        fieldContainer.appendChild(input);
                        fieldContainer.appendChild(deleteButton);
                        additionalFieldsContainer.appendChild(fieldContainer);
                    });
                }
            }
        });

    // --- 2. АВТОСОХРАНЕНИЕ при любом изменении ---
    function autoSaveProfile() {
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
        additionalFieldsContainer.querySelectorAll("input[name='custom_field']").forEach(input => {
            if (input.value.trim() !== "") employeeData.additionalFields.push(input.value);
        });
        fetch("/add_employee", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(employeeData)
        });
    }

    form.addEventListener("input", autoSaveProfile);

    // --- 3. Добавление дополнительных пунктов ---
    addFieldButton.addEventListener("click", function () {
        const fieldContainer = document.createElement("div");
        fieldContainer.classList.add("profile-item");
        const label = document.createElement("label");
        label.textContent = "Дополнительный пункт:";
        const input = document.createElement("input");
        input.type = "text";
        input.name = "custom_field";
        input.placeholder = "Введите название и значение";
        // Кнопка удаления
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Удалить";
        deleteButton.classList.add("delete-field-button");
        deleteButton.addEventListener("click", () => fieldContainer.remove());
        fieldContainer.appendChild(label);
        fieldContainer.appendChild(input);
        fieldContainer.appendChild(deleteButton);
        additionalFieldsContainer.appendChild(fieldContainer);
    });

    // --- 4. Кнопка отправки (оставляем только alert, т.к. автосохранение) ---
    form.addEventListener("submit", function (event) {
        event.preventDefault();
        alert("Данные профиля сотрудника сохранены!");
    });
});
