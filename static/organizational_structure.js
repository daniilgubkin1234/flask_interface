document.addEventListener("DOMContentLoaded", function () {
    const table = document.getElementById("orgTable").getElementsByTagName("tbody")[0];
    const addRowButton = document.getElementById("addRow");
    const submitButton = document.getElementById("submitData");

    function updateRowNumbers() {
        let rows = table.rows;
        for (let i = 0; i < rows.length; i++) {
            rows[i].cells[0].textContent = i + 1;
        }
    }

    function updateDropdowns() {
        let positions = [];
        document.querySelectorAll(".position").forEach((input, index) => {
            if (input.value.trim() !== "") {
                positions.push(`${index + 1}) ${input.value.trim()}`);
            }
        });

        document.querySelectorAll(".supervisor, .subordinates, .replacement").forEach(select => {
            let selectedValue = select.value;
            select.innerHTML = `<option value="">Выберите</option><option value="custom">Другой ответ</option>`;
            positions.forEach(pos => {
                let option = document.createElement("option");
                option.value = pos;
                option.textContent = pos;
                select.appendChild(option);
            });

            // Сохранение выбранного значения, если оно еще актуально
            if (positions.includes(selectedValue) || selectedValue === "custom") {
                select.value = selectedValue;
            } else {
                select.value = "";
            }

            toggleCustomInput(select);
        });
    }

    function toggleCustomInput(select) {
        let inputField = select.nextElementSibling;
        if (select.value === "custom") {
            inputField.style.display = "block";
            inputField.focus();
        } else {
            inputField.style.display = "none";
            inputField.value = "";
        }
    }

    addRowButton.addEventListener("click", function () {
        const rowCount = table.rows.length + 1;
        const newRow = table.insertRow();

        newRow.innerHTML = `
            <td>${rowCount}</td>
            <td><input type="text" class="position"></td>
            <td>
                <select class="supervisor">
                    <option value="">Выберите</option>
                    <option value="custom">Другой ответ</option>
                </select>
                <input type="text" class="custom-supervisor" style="display: none;">
            </td>
            <td>
                <select class="subordinates">
                    <option value="">Выберите</option>
                    <option value="custom">Другой ответ</option>
                </select>
                <input type="text" class="custom-subordinates" style="display: none;">
            </td>
            <td><input type="text" class="functional"></td>
            <td>
                <select class="replacement">
                    <option value="">Выберите</option>
                    <option value="custom">Другой ответ</option>
                </select>
                <input type="text" class="custom-replacement" style="display: none;">
            </td>
            <td><input type="text" class="task-method"></td>
            <td><input type="text" class="documents"></td>
            <td><button class="deleteRow">Удалить</button></td>
        `;

        updateDropdowns();
    });

    table.addEventListener("input", function (event) {
        if (event.target.classList.contains("position")) {
            updateDropdowns();
        }
    });

    table.addEventListener("change", function (event) {
        if (event.target.classList.contains("supervisor") || 
            event.target.classList.contains("subordinates") || 
            event.target.classList.contains("replacement")) {
            toggleCustomInput(event.target);
        }
    });

    table.addEventListener("click", function (event) {
        if (event.target.classList.contains("deleteRow")) {
            event.target.parentElement.parentElement.remove();
            updateRowNumbers();
            updateDropdowns();
        }
    });

    submitButton.addEventListener("click", function () {
        let data = [];
        document.querySelectorAll("#orgTable tbody tr").forEach(row => {
            data.push({
                position: row.querySelector(".position").value,
                supervisor: row.querySelector(".supervisor").value === "custom" ? row.querySelector(".custom-supervisor").value : row.querySelector(".supervisor").value,
                subordinates: row.querySelector(".subordinates").value === "custom" ? row.querySelector(".custom-subordinates").value : row.querySelector(".subordinates").value,
                functional: row.querySelector(".functional").value,
                replacement: row.querySelector(".replacement").value === "custom" ? row.querySelector(".custom-replacement").value : row.querySelector(".replacement").value,
                taskMethod: row.querySelector(".task-method").value,
                documents: row.querySelector(".documents").value
            });
        });

        fetch('/save_organizational_structure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ structure: data })
        }).then(response => response.json())
            .then(data => alert("Данные успешно сохранены!"))
            .catch(error => console.error("Ошибка:", error));
    });
});
