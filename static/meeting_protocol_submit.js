// Заменить весь файл на этот код
document.addEventListener("DOMContentLoaded", function () {
    // Убрать дублирующий код управления боковым меню
    // (он уже есть в meeting_protocol.js)
    
    document.getElementById("protocolForm").addEventListener("submit", function (event) {
        event.preventDefault();
        
        const meetingData = {
            date: document.getElementById("meetingDate").value,
            participants: [],
            discussionResults: [],
            nextSteps: []
        };

        // Сбор участников
        document.querySelectorAll("#participantsSection .participant input").forEach(input => {
            if (input.value.trim() !== "") {
                meetingData.participants.push(input.value.trim());
            }
        });

        // Сбор результатов обсуждения
        document.querySelectorAll("#discussionResultsSection .discussion-result textarea").forEach(textarea => {
            if (textarea.value.trim() !== "") {
                meetingData.discussionResults.push(textarea.value.trim());
            }
        });

        // Сбор шагов из таблицы
        document.querySelectorAll("#nextStepsTable tbody tr").forEach(row => {
            const columns = row.querySelectorAll("td");
            if (columns.length === 6) { // Обновлено для 6 колонок
                meetingData.nextSteps.push({
                    goal: columns[1].querySelector("input").value.trim(),
                    event: columns[2].querySelector("input").value.trim(),
                    work: columns[3].querySelector("textarea").value.trim(),
                    executor: columns[4].querySelector("input").value.trim(),
                    deadline: columns[5].querySelector("input").value.trim()
                });
            }
        });

        console.log("Отправляемые данные:", meetingData);

        // URL определяется в основном meeting_protocol.js
        // Этот файл можно упростить или удалить, перенеся логику в основной
    });
});