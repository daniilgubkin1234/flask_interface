document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("jobDescriptionForm");
    
    // Динамическое добавление полей
    function addDynamicField(containerId, inputName, placeholder) {
        const container = document.getElementById(containerId);
        const fieldWrapper = document.createElement("div");
        fieldWrapper.classList.add("dynamic-field");

        const input = document.createElement("input");
        input.type = "text";
        input.name = inputName;
        input.placeholder = placeholder;
        input.required = true;

        const removeButton = document.createElement("button");
        removeButton.textContent = "✖";
        removeButton.classList.add("remove-btn");
        removeButton.type = "button";

        removeButton.addEventListener("click", () => fieldWrapper.remove());

        fieldWrapper.appendChild(input);
        fieldWrapper.appendChild(removeButton);
        container.appendChild(fieldWrapper);
    }

    document.getElementById("addActivity").addEventListener("click", function () {
        addDynamicField("mainActivities", "mainActivity[]", "Введите направление деятельности");
    });

    document.getElementById("addDuty").addEventListener("click", function () {
        addDynamicField("jobDuties", "jobDuty[]", "Введите должностную обязанность");
    });

    // Обработка отправки формы
    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const formData = new FormData(form);
        const jsonData = {};

        formData.forEach((value, key) => {
            if (!jsonData[key]) {
                jsonData[key] = value;
            } else if (Array.isArray(jsonData[key])) {
                jsonData[key].push(value);
            } else {
                jsonData[key] = [jsonData[key], value];
            }
        });

        console.log("Отправка данных:", jsonData); // Для отладки

        fetch("/submit_job_description", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(jsonData)
        })
        .then(response => response.json())
        .then(data => {
            alert("Должностная инструкция сохранена!");
            form.reset();
        })
        .catch(error => console.error("Ошибка при отправке:", error));
    });
});
