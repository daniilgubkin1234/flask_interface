document.addEventListener("DOMContentLoaded", function () {
    const tableBody = document.querySelector("#bpTable tbody");
    const addRowButton = document.getElementById("addRow");
    const submitButton = document.getElementById("submitData");

    // Функция для перенумерации строк (чтобы первый столбец был "1,2,3..." при добавлении/удалении)
    function updateRowNumbers() {
        const rows = tableBody.querySelectorAll("tr");
        rows.forEach((row, index) => {
            row.cells[0].textContent = index + 1;
        });
    }

    // Добавить новую строку
    addRowButton.addEventListener("click", function () {
        const newRow = document.createElement("tr");

        // Узнаём, сколько строк уже есть
        const rowCount = tableBody.querySelectorAll("tr").length + 1;

        newRow.innerHTML = `
            <td>${rowCount}</td>
            <td><input type="text" class="processName"></td>
            <td><input type="text" class="participants"></td>
            <td><input type="text" class="inputDocs"></td>
            <td><input type="text" class="outputDocs"></td>
            <td><input type="text" class="qualityCriteria"></td>
            <td><button class="deleteRow">Удалить</button></td>
        `;
        tableBody.appendChild(newRow);
    });

    // Обработка кликов на удаление строки
    tableBody.addEventListener("click", function (e) {
        if (e.target.classList.contains("deleteRow")) {
            e.target.closest("tr").remove();
            updateRowNumbers();
        }
    });

    // При отправке данных
    submitButton.addEventListener("click", function () {
        let data = [];
        // Считываем каждую строку
        const rows = tableBody.querySelectorAll("tr");
        rows.forEach(row => {
            const rowData = {
                processName: row.querySelector(".processName").value.trim(),
                participants: row.querySelector(".participants").value.trim(),
                inputDocs: row.querySelector(".inputDocs").value.trim(),
                outputDocs: row.querySelector(".outputDocs").value.trim(),
                qualityCriteria: row.querySelector(".qualityCriteria").value.trim()
            };
            data.push(rowData);
        });

        // Выполняем POST-запрос к Flask
        fetch("/save_business_processes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ business_processes: data })
        })
        .then(response => response.json())
        .then(result => {
            alert(result.message || "Данные успешно сохранены!");
        })
        .catch(error => {
            console.error("Ошибка:", error);
            alert("Произошла ошибка при сохранении данных.");
        });
    });
});
