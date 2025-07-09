document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("stimulation-form").addEventListener("submit", function (event) {
        event.preventDefault();

        let formData = new FormData(event.target);
        let stimulationData = {};

        formData.forEach((value, key) => {
            stimulationData[key] = value.trim();
        });

        fetch("/save_stimulation_system", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stimulationData)
        })
            .then(response => response.json())
            .then(data => {
                alert(data.message);
                event.target.reset();
            })
            .catch(error => console.error("Ошибка при отправке данных:", error));
    });
});

document.addEventListener("DOMContentLoaded", function () {
    // Для всех кнопок добавления строки
    document.querySelectorAll('.add-row-btn').forEach(function (button) {
        button.addEventListener('click', function () {
            const section = button.getAttribute('data-section');
            const tbody = document.getElementById(section + '-body');
            // Создать новую строку
            const tr = document.createElement('tr');

            // Две ячейки для пользовательского ввода, третья — для кнопки удаления
            tr.innerHTML = `
                <td><input type="text" placeholder="Введите название"></td>
                <td><input type="text" placeholder="Введите описание/значение"></td>
                <td>
                    <button type="button" class="delete-row-btn" title="Удалить пункт"></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });

    // Делегирование: обработка удаления строки (работает для всех таблиц)
    document.querySelectorAll('table').forEach(function (table) {
        table.addEventListener('click', function (e) {
            if (e.target.classList.contains('delete-row-btn')) {
                e.target.closest('tr').remove();
            }
        });
    });
});
