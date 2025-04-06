document.addEventListener("DOMContentLoaded", function () {
    const tableBody = document.querySelector("#bpTable tbody");
    const addRowButton = document.getElementById("addRow");
    const submitButton = document.getElementById("submitData");
  
    // Функция для добавления новой строки
    function addNewRow() {
      const newRow = document.createElement("tr");
      newRow.innerHTML = `
        <td><input type="text" class="objectField"></td>
        <td><input type="text" class="actionField"></td>
        <td><input type="text" class="nextObjectsField"></td>
        <td><input type="text" class="sentField"></td>
        <td><input type="text" class="sentByField"></td>
        <td><input type="text" class="commentsField"></td>
        <td><button class="deleteRow">Удалить</button></td>
      `;
      tableBody.appendChild(newRow);
    }
  
    // Обработчик для кнопки добавления строки
    addRowButton.addEventListener("click", function () {
      addNewRow();
    });
  
    // Обработчик для удаления строки (делегирование события)
    tableBody.addEventListener("click", function (event) {
      if (event.target.classList.contains("deleteRow")) {
        event.target.closest("tr").remove();
      }
    });
  
    // Обработчик для отправки данных
    submitButton.addEventListener("click", function () {
      let data = [];
      // Проходим по всем строкам таблицы
      const rows = tableBody.querySelectorAll("tr");
      rows.forEach(row => {
        const rowData = {
          object: row.querySelector(".objectField").value.trim(),
          action: row.querySelector(".actionField").value.trim(),
          nextObjects: row.querySelector(".nextObjectsField").value.trim(),
          sent: row.querySelector(".sentField").value.trim(),
          sentBy: row.querySelector(".sentByField").value.trim(),
          comments: row.querySelector(".commentsField").value.trim()
        };
        data.push(rowData);
      });
  
      // Отправляем данные на сервер (например, на Flask)
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
  