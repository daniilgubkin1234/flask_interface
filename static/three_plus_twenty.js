document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("threePlusTwentyForm");

    form.addEventListener("submit", function (event) {
        event.preventDefault(); // Отключаем стандартную отправку формы

        // Собираем данные: 1 должность, 3 направления, 20 обязанностей
        const position = [
            document.getElementById("position_name").value.trim()
        ];

        const directions = [
            document.getElementById("direction_1").value.trim(),
            document.getElementById("direction_2").value.trim(),
            document.getElementById("direction_3").value.trim()
        ];

        const responsibilities = [];
        for (let i = 1; i <= 20; i++) {
            let fieldValue = document.getElementById(`responsibility_${i}`).value.trim();
            responsibilities.push(fieldValue);
        }

        const payload = {
            position: position,
            directions: directions,
            responsibilities: responsibilities
        };

        console.log("Отправляемые данные:", payload);

        // Отправляем данные на сервер
        fetch("/save_three_plus_twenty", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                alert(data.message);
                // Можно очистить форму
                form.reset();
            } else {
                alert("Ошибка при сохранении данных!");
            }
        })
        .catch(error => {
            console.error("Ошибка при отправке:", error);
            alert("Произошла ошибка при сохранении данных.");
        });
    });
});
