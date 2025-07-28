document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("threePlusTwentyForm");

    // --- 1. Автозагрузка ---
    fetch("/get_three_plus_twenty")
        .then(res => res.json())
        .then(data => {
            if (!data || Object.keys(data).length === 0) return;

            // Должность
            if (data.position && data.position[0] !== undefined)
                document.getElementById("position_name").value = data.position[0];

            // 3 направления
            if (Array.isArray(data.directions)) {
                for (let i = 0; i < 3; i++) {
                    if (data.directions[i] !== undefined)
                        document.getElementById(`direction_${i + 1}`).value = data.directions[i];
                }
            }

            // 20 обязанностей
            if (Array.isArray(data.responsibilities)) {
                for (let i = 0; i < 20; i++) {
                    if (data.responsibilities[i] !== undefined)
                        document.getElementById(`responsibility_${i + 1}`).value = data.responsibilities[i];
                }
            }
        });

    // --- 2. Автосохранение ---
    function autoSave() {
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
        fetch("/save_three_plus_twenty", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    }

    // --- 3. Вешаем автосохранение на любые изменения ---
    form.addEventListener("input", autoSave);

    // --- 4. Submit: просто alert, так как данные уже сохранены ---
    form.addEventListener("submit", function (event) {
        event.preventDefault();
        alert("Данные успешно сохранены!");
    });
});
