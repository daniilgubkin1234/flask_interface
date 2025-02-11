document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("survey-form");

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        let surveyData = {};

        // Собираем данные всех полей
        document.querySelectorAll("textarea, input, .custom-select-trigger").forEach(element => {
            if (element.tagName === "TEXTAREA" || element.type === "text" || element.type === "date") {
                surveyData[element.name] = element.value.trim();
            } else if (element.type === "radio" && element.checked) {
                surveyData[element.name] = element.value;
            } else if (element.classList.contains("custom-select-trigger")) {
                surveyData[element.parentElement.dataset.id] = element.dataset.value;
            }
        });

        console.log("Отправка данных:", surveyData);

        fetch("/submit_survey", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(surveyData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.survey_id) {
                alert("Опрос успешно сохранен!");
            } else {
                alert("Ошибка при сохранении данных!");
            }
        })
        .catch(error => console.error("Ошибка при отправке:", error));
    });
});
