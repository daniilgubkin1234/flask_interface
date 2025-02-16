document.addEventListener("DOMContentLoaded", function () {
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
            if (columns.length === 4) {
                meetingData.nextSteps.push({
                    task: columns[1].querySelector("textarea").value.trim(),
                    executor: columns[2].querySelector("input").value.trim(),
                    deadline: columns[3].querySelector("input").value.trim()
                });
            }
        });

        console.log("Отправляемые данные:", meetingData);

        fetch("/save_meeting_protocol", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(meetingData)
        })
        .then(response => response.json())
        .then(data => {
            console.log("Ответ сервера:", data);
            alert("Протокол успешно сохранен!");
            document.getElementById("protocolForm").reset();
        })
        .catch(error => console.error("Ошибка при отправке:", error));
    });
});
