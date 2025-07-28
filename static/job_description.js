document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("jobDescriptionForm");

    // Динамическое добавление полей
    function addDynamicField(containerId, inputName, placeholder, value = "") {
        const container = document.getElementById(containerId);
        const fieldWrapper = document.createElement("div");
        fieldWrapper.classList.add("dynamic-field");

        const input = document.createElement("input");
        input.type = "text";
        input.name = inputName;
        input.placeholder = placeholder;
        input.required = true;
        input.value = value;

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
        autoSaveJobDescription();
    });

    document.getElementById("addDuty").addEventListener("click", function () {
        addDynamicField("jobDuties", "jobDuty[]", "Введите должностную обязанность");
        autoSaveJobDescription();
    });

    // --- 1. АВТОЗАГРУЗКА ---
    fetch("/get_job_description")
        .then(res => res.json())
        .then(data => {
            if (!data || Object.keys(data).length === 0) return;

            // Все одиночные поля
            [
                "company", "position", "approval", "appointedBy", "documentPurpose", "replaces",
                "activityGuide", "supervisor", "gender", "age", "residence", "education", "speech",
                "languages", "pcSkills", "appearance", "habits", "infoSkills", "accuracy", "decisionMaking",
                "leadership", "car", "rights", "responsibility"
            ].forEach(field => {
                if (data[field] !== undefined && document.getElementsByName(field)[0])
                    document.getElementsByName(field)[0].value = data[field];
            });

            // Основные направления деятельности (массив)
            const mainActivities = Array.isArray(data.mainActivity) ? data.mainActivity : (data.mainActivity ? [data.mainActivity] : []);
            const mainActivitiesContainer = document.getElementById("mainActivities");
            // Оставляем только первое поле, остальные удаляем
            while (mainActivitiesContainer.children.length > 1) mainActivitiesContainer.removeChild(mainActivitiesContainer.lastChild);
            if (mainActivities.length > 0) {
                mainActivities.forEach((val, idx) => {
                    if (idx === 0) {
                        mainActivitiesContainer.children[0].value = val;
                    } else {
                        addDynamicField("mainActivities", "mainActivity[]", "Введите направление деятельности", val);
                    }
                });
            }

            // Должностные обязанности (массив)
            const jobDuties = Array.isArray(data.jobDuty) ? data.jobDuty : (data.jobDuty ? [data.jobDuty] : []);
            const jobDutiesContainer = document.getElementById("jobDuties");
            while (jobDutiesContainer.children.length > 1) jobDutiesContainer.removeChild(jobDutiesContainer.lastChild);
            if (jobDuties.length > 0) {
                jobDuties.forEach((val, idx) => {
                    if (idx === 0) {
                        jobDutiesContainer.children[0].value = val;
                    } else {
                        addDynamicField("jobDuties", "jobDuty[]", "Введите должностную обязанность", val);
                    }
                });
            }
        });

    // --- 2. АВТОСОХРАНЕНИЕ ---
    function autoSaveJobDescription() {
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

        fetch("/submit_job_description", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(jsonData)
        });
    }

    form.addEventListener("input", autoSaveJobDescription);

    // --- 3. Кнопка submit ---
    form.addEventListener("submit", function (event) {
        event.preventDefault();
        alert("Должностная инструкция сохранена!");
    });
});
