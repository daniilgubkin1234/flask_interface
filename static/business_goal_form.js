document.getElementById('addStageBtn').addEventListener('click', function () {
    const table = document.getElementById('stagesTable').getElementsByTagName('tbody')[0];
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td><input type="text" name="stageNumber[]" placeholder="Название этапа" required></td>
        <td><textarea name="stageDescription[]" placeholder="Описание этапа" required></textarea></td>
        <td><input type="date" name="stageDate[]" required></td>
    `;
    table.appendChild(newRow);
});

document.getElementById('businessForm').addEventListener('submit', function (e) {
    e.preventDefault();

    // Собираем данные из формы
    const businessGoalData = {
        financeRevenue: document.getElementById('financeRevenue').value,
        financeProfit: document.getElementById('financeProfit').value,
        personnelCount: document.getElementById('personnelCount').value,
        averageSalary: document.getElementById('averageSalary').value,
        clientBase: document.getElementById('clientBase').value,
        conversionRate: document.getElementById('conversionRate').value,
        taxes: document.getElementById('taxes').value,
        treePlanting: document.getElementById('treePlanting').value,
        startDate: document.getElementById('startDate').value,
        stages: []
    };

    // Собираем данные по этапам реализации
    const stageRows = document.querySelectorAll("#stagesTable tbody tr");
    stageRows.forEach(row => {
        const stageData = {
            stageNumber: row.querySelector("input[name='stageNumber[]']").value,
            stageDescription: row.querySelector("textarea[name='stageDescription[]']").value,
            stageDate: row.querySelector("input[name='stageDate[]']").value
        };
        businessGoalData.stages.push(stageData);
    });

    console.log("Отправляемые данные:", businessGoalData); // Для отладки

    // Отправляем данные в Flask
    fetch("/add_business_goal", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(businessGoalData)
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        document.getElementById('businessForm').reset();
    })
    .catch(error => console.error("Ошибка при отправке:", error));
});
